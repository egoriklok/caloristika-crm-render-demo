import { DatabaseSync } from "node:sqlite"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const production = {
  address: "Санкт-Петербург, Уральская улица, 13",
  latitude: 59.9532837,
  longitude: 30.2630469
}

function readJson(relativePath, fallback) {
  const path = join(root, relativePath)
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, "utf-8"))
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload
  for (const key of ["rows", "prospects", "items", "companies"]) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/санкт-петербург|спб|spb|saint petersburg/g, "")
    .replace(/\b(ооо|ао|пао|ип|зао|llc)\b/g, "")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim()
}

function dgisSearchUrl(name, city, address) {
  return `https://2gis.ru/spb/search/${encodeURIComponent([name, address, city || "Санкт-Петербург"].filter(Boolean).join(" "))}`
}

function dgisFirmUrl(dgisId) {
  return clean(dgisId) ? `https://2gis.ru/spb/firm/${encodeURIComponent(String(dgisId))}` : null
}

function clampMinutes(value) {
  return Math.max(3, Math.min(90, Math.round(value)))
}

function driveFromWalk(walkMin) {
  const value = Number(walkMin)
  if (!Number.isFinite(value) || value <= 0) return null
  return clampMinutes(3 + value * 0.55)
}

function driveFromCoordinates(latitude, longitude) {
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const earthRadiusKm = 6371
  const dLat = ((lat - production.latitude) * Math.PI) / 180
  const dLon = ((lon - production.longitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((production.latitude * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  const directKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return clampMinutes(8 + directKm * 4.2)
}

function driveFromText(address, district, city, segment) {
  const text = [address, district, city, segment].filter(Boolean).join(" ").toLowerCase()
  if (/уральск[^0-9]{0,30}13\b/.test(text)) return 3
  if (/уральск/.test(text)) return 6
  if (/василеостров|в\.о\.|линия в\.о|средний проспект|малый в\.о|большой проспект в\.о|университетская/.test(text)) return 18
  if (/кронверк|петроград|профессора попова|аптекар/.test(text)) return 28
  if (/централь|адмиралтей|мойк|грибоедов|морская|красноармейск|московский проспект|правды|фонтанк|моховая|соляной|дворцовая/.test(text)) return 35
  if (/киров|балтийск|двинская|декабристов|лоцманская|черниговская/.test(text)) return 42
  if (/калинин|политехническ|литовская|выборг|кудров|мурино|парнас|парголов|всеволож|ленинградская область/.test(text)) return 55
  if (/невск|большевиков|красногвард|малоохтинск|охта/.test(text)) return 50
  if (/аэропорт|пулково/.test(text)) return 60
  if (/городская сеть|сеть|несколько адресов|город\/область|спб\/ло|сзфо/.test(text)) return 45
  return 40
}

function addressFromNotes(notes) {
  const value = String(notes ?? "")
  const match = value.match(/(?:офис|адрес)[^:]*:\s*([^.;]+)/i) ?? value.match(/(?:ул\.|улица|проспект|наб\.|набережная|шоссе)\s*[^.;]+/i)
  return match?.[1]?.trim() ?? match?.[0]?.trim() ?? null
}

function defaultAddress(company) {
  const city = clean(company.city) ?? "Санкт-Петербург"
  const district = clean(company.district)
  if (district && !/городская сеть|франчайзинговая сеть|сеть|город\/область|спб\/ло|сзфо|трассовые точки/i.test(district)) {
    return `${city}, ${district}`
  }
  return `${city}, сеть/несколько адресов; пилотная точка уточняется`
}

function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

function sourceRecord(name, values) {
  return {
    name,
    key: norm(name),
    address: clean(values.address),
    dgis_url: clean(values.dgis_url),
    drive_minutes_from_production: values.drive_minutes_from_production ?? null,
    drive_minutes_source: values.drive_minutes_source ?? null
  }
}

function addSource(sources, name, values) {
  const record = sourceRecord(name, values)
  if (record.key) sources.push(record)
  const commaAlias = clean(name)?.split(",")[0]?.trim()
  if (commaAlias && norm(commaAlias) !== record.key) {
    sources.push({ ...record, name: commaAlias, key: norm(commaAlias) })
  }
}

function findSource(sources, companyName) {
  const key = norm(companyName)
  const exact = sources.find((item) => item.key === key)
  if (exact) return exact
  return (
    sources
      .filter((item) => key && item.key && (item.key.includes(key) || key.includes(item.key)))
      .sort((a, b) => Math.abs(a.key.length - key.length) - Math.abs(b.key.length - key.length))[0] ?? null
  )
}

if (!existsSync(dbPath)) {
  throw new Error("Missing SQLite database. Run npm run db:init first.")
}

const db = new DatabaseSync(dbPath)
db.exec("PRAGMA foreign_keys = ON;")
for (const table of ["companies", "contacts"]) {
  addColumnIfMissing(db, table, "address", "TEXT")
  addColumnIfMissing(db, table, "dgis_url", "TEXT")
  addColumnIfMissing(db, table, "drive_minutes_from_production", "INTEGER")
  addColumnIfMissing(db, table, "drive_minutes_source", "TEXT")
}
addColumnIfMissing(db, "company_enrichment_profiles", "dgis_url", "TEXT")
addColumnIfMissing(db, "company_enrichment_profiles", "drive_minutes_from_production", "INTEGER")
addColumnIfMissing(db, "company_enrichment_profiles", "drive_minutes_source", "TEXT")

const sourceRows = []
for (const row of rowsFromPayload(readJson("data/uralskaya-local-prospects.json", {}))) {
  addSource(sourceRows, row.name, {
    address: row.address,
    dgis_url: clean(row.source_2gis)?.includes("2gis.ru") ? row.source_2gis : null,
    drive_minutes_from_production: driveFromWalk(row.walk_min),
    drive_minutes_source: "estimated_from_walk_time"
  })
}

for (const row of rowsFromPayload(readJson("data/education-campus-prospects-2026-06-06.json", {}))) {
  const driveFromPoint = driveFromCoordinates(row.dgis_match?.latitude, row.dgis_match?.longitude)
  addSource(sourceRows, row.name, {
    address: row.address,
    dgis_url: row.dgisUrl ?? dgisFirmUrl(row.dgis_match?.id),
    drive_minutes_from_production: driveFromPoint ?? driveFromText(row.address, row.district, "Санкт-Петербург", "education_campus"),
    drive_minutes_source: driveFromPoint ? "estimated_from_2gis_coordinates" : "estimated_from_address"
  })
}

for (const row of readJson("data/launch-crm-content.json", {}).vending_companies ?? []) {
  addSource(sourceRows, row.name, {
    address: row.address,
    dgis_url: clean(row.source_2gis)?.includes("2gis.ru") ? row.source_2gis : null,
    drive_minutes_from_production: driveFromText(row.address, null, "Санкт-Петербург", row.segment),
    drive_minutes_source: "estimated_from_address"
  })
}

const publicContactsPath = join(root, "data", "public-contacts.json")
const publicContacts = readJson("data/public-contacts.json", [])
const publicByCompany = new Map(publicContacts.map((item) => [item.company, item]))

const companies = db.prepare(`
  SELECT
    c.id,
    c.name,
    c.segment,
    c.city,
    c.district,
    c.address,
    c.dgis_url,
    c.drive_minutes_from_production,
    c.drive_minutes_source,
    ep.address AS enrichment_address,
    ep.dgis_id,
    ep.dgis_url AS enrichment_dgis_url
  FROM companies c
  LEFT JOIN company_enrichment_profiles ep ON ep.company_id = c.id
  ORDER BY c.id
`).all()

const updateCompany = db.prepare(`
  UPDATE companies
  SET address = ?, dgis_url = ?, drive_minutes_from_production = ?, drive_minutes_source = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`)
const updateContacts = db.prepare(`
  UPDATE contacts
  SET address = ?, dgis_url = ?, drive_minutes_from_production = ?, drive_minutes_source = ?
  WHERE company_id = ?
`)
const updateProfile = db.prepare(`
  UPDATE company_enrichment_profiles
  SET
    address = COALESCE(address, ?),
    dgis_url = COALESCE(dgis_url, ?),
    drive_minutes_from_production = COALESCE(drive_minutes_from_production, ?),
    drive_minutes_source = COALESCE(drive_minutes_source, ?),
    updated_at = CURRENT_TIMESTAMP
  WHERE company_id = ?
`)

let companiesUpdated = 0
let contactsUpdated = 0
let exactSources = 0
const outputByCompany = new Map()

db.exec("BEGIN IMMEDIATE")
try {
  for (const company of companies) {
    const publicContact = publicByCompany.get(company.name)
    const source = findSource(sourceRows, company.name)
    if (source) exactSources += 1
    const address =
      clean(company.address) ??
      source?.address ??
      clean(company.enrichment_address) ??
      clean(publicContact?.address) ??
      addressFromNotes(publicContact?.notes) ??
      defaultAddress(company)
    const dgisUrl =
      clean(company.dgis_url) ??
      source?.dgis_url ??
      clean(publicContact?.dgis_url) ??
      clean(company.enrichment_dgis_url) ??
      dgisFirmUrl(company.dgis_id) ??
      (clean(publicContact?.source_url)?.includes("2gis.ru") ? publicContact.source_url : null) ??
      dgisSearchUrl(company.name, company.city, address)
    const driveMinutes =
      Number(source?.drive_minutes_from_production) > 0
        ? Number(source.drive_minutes_from_production)
        : Number(publicContact?.drive_minutes_from_production) > 0
          ? Number(publicContact.drive_minutes_from_production)
          : Number(company.drive_minutes_from_production) > 0
            ? Number(company.drive_minutes_from_production)
            : driveFromText(address, company.district, company.city, company.segment)
    const driveSource =
      clean(company.drive_minutes_source) ??
      source?.drive_minutes_source ??
      clean(publicContact?.drive_minutes_source) ??
      "estimated_from_address"

    updateCompany.run(address, dgisUrl, driveMinutes, driveSource, company.id)
    const contactResult = updateContacts.run(address, dgisUrl, driveMinutes, driveSource, company.id)
    updateProfile.run(address, dgisUrl, driveMinutes, driveSource, company.id)
    companiesUpdated += 1
    contactsUpdated += Number(contactResult.changes ?? 0)
    outputByCompany.set(company.name, {
      address,
      dgis_url: dgisUrl,
      drive_minutes_from_production: driveMinutes,
      drive_minutes_source: driveSource,
      production_address: production.address
    })
  }
  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
}

if (Array.isArray(publicContacts) && existsSync(publicContactsPath)) {
  const enriched = publicContacts.map((item) => ({
    ...item,
    ...(outputByCompany.get(item.company) ?? {})
  }))
  writeFileSync(publicContactsPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf-8")
}

const missing = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM companies WHERE COALESCE(TRIM(address), '') = '' OR COALESCE(TRIM(dgis_url), '') = '' OR drive_minutes_from_production IS NULL) AS companies_missing,
    (SELECT COUNT(*) FROM contacts WHERE COALESCE(TRIM(address), '') = '' OR COALESCE(TRIM(dgis_url), '') = '' OR drive_minutes_from_production IS NULL) AS contacts_missing
`).get()
db.close()

console.log(JSON.stringify({
  companiesUpdated,
  contactsUpdated,
  matchedSourceRows: exactSources,
  companiesMissingLocation: missing.companies_missing,
  contactsMissingLocation: missing.contacts_missing
}, null, 2))
