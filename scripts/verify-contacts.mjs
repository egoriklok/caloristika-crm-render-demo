import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { openVerifyDb } from "./verify-db.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const publicContactsPath = join(root, "data", "public-contacts.json")

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(existsSync(dbPath), "Missing SQLite database. Run npm run db:init")
assert(existsSync(publicContactsPath), "Missing public contacts source")

const publicContacts = JSON.parse(readFileSync(publicContactsPath, "utf-8"))
assert(Array.isArray(publicContacts), "Public contacts source must be an array")

const db = openVerifyDb(dbPath)
const missingLiveContacts = db.prepare(`
  SELECT c.name, ct.phone, ct.email
  FROM companies c
  LEFT JOIN contacts ct ON ct.company_id = c.id
  WHERE COALESCE(TRIM(ct.phone), '') = ''
     OR COALESCE(TRIM(ct.email), '') = ''
  ORDER BY c.name
`).all()
const companies = db.prepare("SELECT name FROM companies ORDER BY name").all().map((row) => String(row.name))
const ordersWithDemoMarkers = db.prepare(`
  SELECT COUNT(*) AS count
  FROM orders
  WHERE lower(COALESCE(instructions, '')) LIKE '%demo%'
     OR lower(COALESCE(instructions, '')) LIKE '%демо%'
     OR lower(COALESCE(instructions, '')) LIKE '%test%'
     OR lower(COALESCE(instructions, '')) LIKE '%тест%'
     OR lower(COALESCE(manager_comment, '')) LIKE '%demo%'
     OR lower(COALESCE(manager_comment, '')) LIKE '%демо%'
     OR lower(COALESCE(manager_comment, '')) LIKE '%test%'
     OR lower(COALESCE(manager_comment, '')) LIKE '%тест%'
`).get()
db.close()

assert(missingLiveContacts.length === 0, `Missing live phone/email contacts: ${JSON.stringify(missingLiveContacts)}`)
assert(ordersWithDemoMarkers.count === 0, `Expected no demo/test orders, got ${ordersWithDemoMarkers.count}`)

const contactByCompany = new Map(publicContacts.map((item) => [item.company, item]))
const missingSourceContacts = []
for (const company of companies) {
  const contact = contactByCompany.get(company)
  if (!contact || !String(contact.phone ?? "").trim() || !String(contact.email ?? "").trim()) {
    missingSourceContacts.push(company)
  }
}
assert(missingSourceContacts.length === 0, `Missing source phone/email contacts: ${missingSourceContacts.join(", ")}`)

for (const [index, contact] of publicContacts.entries()) {
  const joined = [contact.company, contact.phone, contact.email, contact.source_url, contact.notes].join(" ")
  assert(String(contact.company ?? "").trim(), `Public contact ${index} has empty company`)
  assert(String(contact.phone ?? "").trim(), `Public contact ${contact.company} has empty phone`)
  assert(String(contact.email ?? "").trim(), `Public contact ${contact.company} has empty email`)
  assert(String(contact.source_url ?? "").trim(), `Public contact ${contact.company} has empty source_url`)
  assert(String(contact.address ?? "").trim(), `Public contact ${contact.company} has empty address`)
  assert(String(contact.dgis_url ?? "").trim(), `Public contact ${contact.company} has empty dgis_url`)
  assert(Number(contact.drive_minutes_from_production) > 0, `Public contact ${contact.company} has empty drive minutes`)
  assert(!/google\.com\/search/i.test(String(contact.source_url)), `Public contact ${contact.company} uses search URL`)
  assert(!/Marketplace business centers|офисно-ритейл кластер|офисно-складской кластер/i.test(joined), `Public contact ${contact.company} still has placeholder cluster data`)
}

console.log("CRM contact verification passed")
console.log(`Companies with phone+email: ${companies.length}`)
