import { spawn } from "node:child_process"
import { createHmac } from "node:crypto"
import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { createServer as createHttpServer } from "node:http"
import { createServer as createNetServer } from "node:net"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const sourceDbPath = join(root, "data", "lunch_up_crm.sqlite")
const botToken = "123456:miniapp-enrichment-smoke-token"
const smokeChatId = 710002
const smokeCompanyName = "Mini App Enrichment Smoke Office"
const smokeInn = "7812014560"

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === "object" && address?.port) resolve(String(address.port))
        else reject(new Error("Could not allocate a free local port"))
      })
    })
  })
}

function copyTempDb() {
  if (!existsSync(sourceDbPath)) {
    throw new Error("Source SQLite database is missing. Run npm run db:init first.")
  }
  const dir = mkdtempSync(join(tmpdir(), "lunch-up-miniapp-enrichment-smoke-"))
  const target = join(dir, basename(sourceDbPath))
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${sourceDbPath}${suffix}`
    if (existsSync(source)) copyFileSync(source, `${target}${suffix}`)
  }
  return target
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stopChild(child) {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5000)])
  if (child.exitCode === null) {
    child.kill("SIGKILL")
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5000)])
  }
  await delay(500)
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve))
}

function jsonResponse(response, payload, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(payload))
}

function htmlResponse(response, html) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  response.end(html)
}

function startMockSourceServer() {
  const counters = {
    dgis: 0,
    dadata: 0,
    website: 0
  }

  const server = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (url.pathname === "/2gis/3.0/items") {
      counters.dgis += 1
      jsonResponse(response, {
        result: {
          total: 1,
          items: [
            {
              id: "miniapp-dgis-office-1",
              name: smokeCompanyName,
              full_name: 'ООО "Mini App Enrichment Smoke Office"',
              address_name: "Санкт-Петербург, Уральская улица, 7",
              employees_org_count: "96",
              itin: smokeInn,
              contact_groups: [
                {
                  contacts: [
                    { type: "phone", value: "+7 812 101-20-30" },
                    { type: "email", value: "miniapp-office@example.test" },
                    { type: "website", value: `http://127.0.0.1:${server.address().port}/site/miniapp-office` }
                  ]
                }
              ]
            }
          ]
        }
      })
      return
    }

    if (url.pathname === "/suggestions/api/4_1/rs/findById/party" || url.pathname === "/suggestions/api/4_1/rs/suggest/party") {
      counters.dadata += 1
      jsonResponse(response, {
        suggestions: [
          {
            value: 'ООО "Mini App Enrichment Smoke Office"',
            unrestricted_value: 'ООО "Mini App Enrichment Smoke Office"',
            data: {
              inn: smokeInn,
              branch_count: "2",
              employee_count: "150",
              name: {
                full_with_opf: 'ООО "Mini App Enrichment Smoke Office"',
                short_with_opf: 'ООО "Mini App Enrichment Smoke Office"'
              },
              address: { value: "Санкт-Петербург, Уральская улица, 7" },
              phones: [{ value: "+7 812 404-50-60" }],
              emails: [{ value: "fns-miniapp@example.test" }]
            }
          }
        ]
      })
      return
    }

    if (url.pathname === "/site/miniapp-office" || url.pathname === "/contacts" || url.pathname === "/kontakty") {
      counters.website += 1
      htmlResponse(
        response,
        `<!doctype html>
        <html>
          <body>
            <main>
              <h1>${smokeCompanyName}</h1>
              <p>В офисе и на площадке 110 сотрудников в Санкт-Петербурге.</p>
              <p>Телефон: +7 812 777-88-99, email: hello-miniapp@example.test.</p>
            </main>
          </body>
        </html>`
      )
      return
    }

    jsonResponse(response, { error: "not found" }, 404)
  })

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, counters, port: String(server.address().port) }))
  })
}

async function waitForReady(baseUrl, child) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 180_000) {
    if (child.exitCode !== null) {
      throw new Error(`Temporary CRM server exited with code ${child.exitCode}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/miniapp/catalog`)
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await delay(750)
  }
  throw new Error("Temporary CRM server did not become ready in time")
}

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, payload }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function signedInitData(overrides = {}) {
  const fields = {
    query_id: "miniapp-enrichment-smoke-query",
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({
      id: smokeChatId,
      first_name: "Miniapp",
      last_name: "Enrichment Smoke",
      username: "miniapp_enrichment_smoke"
    }),
    chat: JSON.stringify({
      id: smokeChatId,
      type: "private"
    }),
    ...overrides
  }
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")
  return new URLSearchParams({ ...fields, hash }).toString()
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function dbGet(dbPath, sql) {
  const db = new DatabaseSync(dbPath)
  try {
    return db.prepare(sql).get()
  } finally {
    db.close()
  }
}

function countRows(dbPath, table, where = "1 = 1") {
  const row = dbGet(dbPath, `SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`)
  return Number(row.count)
}

function sourceStatus(payload, source) {
  return payload?.enrichment?.sources?.find((item) => item.source === source)?.status ?? null
}

const tempDbPath = copyTempDb()
const beforeCompanies = countRows(tempDbPath, "companies")
const beforeSmokeCompanies = countRows(tempDbPath, "companies", `name = ${sqlString(smokeCompanyName)}`)
const { server: mockServer, counters, port: mockPort } = await startMockSourceServer()
const port = await freePort()
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const useProductionBuild = process.env.MINIAPP_ENRICHMENT_SMOKE_NEXT_MODE !== "dev" && existsSync(join(root, ".next", "BUILD_ID"))
const args = useProductionBuild
  ? [nextBin, "start", "-H", "127.0.0.1", "-p", port]
  : [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", port]

const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    LUNCH_UP_CRM_DB_PATH: tempDbPath,
    MINIAPP_DEMO_MODE: "",
    CRM_ACCESS_KEY: "miniapp-enrichment-smoke-crm-key",
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_OUTBOUND_DISABLED: "1",
    TELEGRAM_MANAGER_CHAT_ID: "",
    EXTERNAL_ORDER_WEBHOOK_URL: "",
    DGIS_API_KEY: "mock-dgis-key",
    DADATA_API_KEY: "mock-dadata-key",
    DGIS_API_BASE_URL: `http://127.0.0.1:${mockPort}/2gis/3.0/items`,
    DADATA_API_BASE_URL: `http://127.0.0.1:${mockPort}`,
    PORT: port,
    HOST: "127.0.0.1"
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
})

let output = ""
child.stdout.on("data", (chunk) => {
  output += chunk.toString()
})
child.stderr.on("data", (chunk) => {
  output += chunk.toString()
})

const baseUrl = `http://127.0.0.1:${port}`

try {
  await waitForReady(baseUrl, child)

  const validInitData = signedInitData()
  const noInitData = await jsonRequest(`${baseUrl}/api/miniapp/enrichment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ company_name: smokeCompanyName, inn: smokeInn })
  })
  assert(noInitData.response.status === 401, `Mini App enrichment without initData must be blocked, got ${noInitData.response.status}`)

  const enrichment = await jsonRequest(`${baseUrl}/api/miniapp/enrichment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: validInitData,
      company_name: smokeCompanyName,
      inn: smokeInn,
      address: "Санкт-Петербург, Уральская улица, 7"
    })
  })
  assert(enrichment.response.status === 200, `Expected Mini App enrichment HTTP 200, got ${enrichment.response.status}: ${JSON.stringify(enrichment.payload)}`)
  assert(enrichment.payload?.ok === true, "Mini App enrichment payload must be ok=true")
  assert(enrichment.payload?.enrichment?.profile?.inn === smokeInn, "Mini App enrichment must return INN from 2GIS/DaData")
  assert(enrichment.payload?.enrichment?.profile?.phone === "+7 812 101-20-30", "Mini App enrichment must prefer public 2GIS phone")
  assert(enrichment.payload?.enrichment?.profile?.email === "miniapp-office@example.test", "Mini App enrichment must prefer public 2GIS email")
  assert(enrichment.payload?.enrichment?.profile?.website?.includes("/site/miniapp-office"), "Mini App enrichment must use website from 2GIS")
  assert(enrichment.payload?.enrichment?.profile?.employee_count_fns === 150, "Mini App enrichment must read DaData/FNS employee count")
  assert(enrichment.payload?.enrichment?.profile?.employee_count_2gis === 96, "Mini App enrichment must read 2GIS employees_org_count")
  assert(enrichment.payload?.enrichment?.profile?.employee_count_website === 110, "Mini App enrichment must extract employee count from website")
  assert(enrichment.payload?.enrichment?.office_people?.confidence === "high", "Mini App enrichment must use high confidence when FNS/DaData employee_count is present")
  assert(enrichment.payload?.enrichment?.office_people?.min === 41, `Expected office_people.min=41, got ${enrichment.payload?.enrichment?.office_people?.min}`)
  assert(enrichment.payload?.enrichment?.office_people?.max === 68, `Expected office_people.max=68, got ${enrichment.payload?.enrichment?.office_people?.max}`)
  assert(enrichment.payload?.enrichment?.proposal?.headcount_source?.includes("ФНС/DaData: 150"), "Mini App enrichment proposal must expose headcount source")
  assert(enrichment.payload?.enrichment?.proposal?.what_to_offer?.length >= 3, "Mini App enrichment proposal must include what_to_offer")
  for (const source of ["2gis", "dadata", "website", "fns"]) {
    assert(sourceStatus(enrichment.payload, source) === "connected", `Expected ${source} source to be connected for Mini App enrichment`)
  }
  assert(countRows(tempDbPath, "companies", `name = ${sqlString(smokeCompanyName)}`) === beforeSmokeCompanies, "Enrichment preview must not create a company before session save")

  const officePeople = enrichment.payload.enrichment.office_people
  const enrichedProfile = {
    company_name: smokeCompanyName,
    inn: enrichment.payload.enrichment.profile.inn,
    contact_name: "Mini App Enrichment Buyer",
    role: "Офис-менеджер",
    phone: enrichment.payload.enrichment.profile.phone,
    email: enrichment.payload.enrichment.profile.email,
    delivery_address: enrichment.payload.enrichment.profile.address,
    website: enrichment.payload.enrichment.profile.website,
    office_people: Math.round((officePeople.min + officePeople.max) / 2)
  }

  const session = await jsonRequest(`${baseUrl}/api/miniapp/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: validInitData, profile: enrichedProfile })
  })
  assert(session.response.status === 200, `Expected Mini App session save HTTP 200, got ${session.response.status}: ${JSON.stringify(session.payload)}`)
  assert(session.payload?.ok === true, "Mini App session save must be ok=true")
  assert(session.payload?.profile?.company_name === smokeCompanyName, "Mini App session must return saved company")
  assert(session.payload?.profile?.inn === smokeInn, "Mini App session must return saved INN")
  assert(session.payload?.profile?.phone === "+7 812 101-20-30", "Mini App session must return enriched phone")
  assert(session.payload?.profile?.email === "miniapp-office@example.test", "Mini App session must return enriched email")
  assert(session.payload?.profile?.delivery_address === "Санкт-Петербург, Уральская улица, 7", "Mini App session must return enriched delivery address")
  assert(session.payload?.profile?.office_people === enrichedProfile.office_people, "Mini App session must persist office people")
  assert(session.payload?.enrichment?.proposal?.proposal_summary?.includes("Для КП используем диапазон 41-68"), "Mini App session must keep proposal guidance")
  assert(enrichment.payload?.enrichment?.headcount_evidence?.some((item) => item.source === "fns_dadata" && item.value === 150 && item.used_for_estimate), "Mini App enrichment must mark FNS/DaData as the primary estimate source")
  assert(enrichment.payload?.enrichment?.headcount_evidence?.some((item) => item.source === "2gis" && item.value === 96), "Mini App enrichment must include the 2GIS employee signal")
  assert(enrichment.payload?.enrichment?.headcount_evidence?.some((item) => item.source === "website" && item.value === 110), "Mini App enrichment must include the website employee signal")

  const afterCompanies = countRows(tempDbPath, "companies")
  assert(afterCompanies === beforeCompanies + 1, `Temporary DB should contain exactly one new company, before=${beforeCompanies}, after=${afterCompanies}`)
  assert(countRows(tempDbPath, "miniapp_customer_profiles", `telegram_chat_id = '${smokeChatId}' AND company_name = ${sqlString(smokeCompanyName)} AND phone = '+7 812 101-20-30' AND email = 'miniapp-office@example.test'`) === 1, "Temporary DB must persist enriched Mini App customer profile")
  assert(countRows(tempDbPath, "contacts", "email = 'miniapp-office@example.test' AND phone = '+7 812 101-20-30'") >= 1, "Temporary DB must create enriched Mini App contact")

  const savedProfile = dbGet(
    tempDbPath,
    `SELECT ep.*
     FROM company_enrichment_profiles ep
     JOIN companies c ON c.id = ep.company_id
     WHERE c.name = ${sqlString(smokeCompanyName)}
     ORDER BY c.id DESC
     LIMIT 1`
  )
  assert(savedProfile?.inn === smokeInn, "Saved enrichment profile must include INN")
  assert(savedProfile?.employee_count_fns === 150, "Saved enrichment profile must include DaData/FNS employee count")
  assert(savedProfile?.employee_count_2gis === 96, "Saved enrichment profile must include 2GIS employee count")
  assert(savedProfile?.employee_count_website === 110, "Saved enrichment profile must include website employee count")
  assert(savedProfile?.office_people_min === 41 && savedProfile?.office_people_max === 68, "Saved enrichment profile must include Mini App office range")

  const connectedSources = countRows(
    tempDbPath,
    "company_enrichment_sources ces JOIN companies c ON c.id = ces.company_id",
    `c.name = ${sqlString(smokeCompanyName)} AND ces.source IN ('2gis', 'dadata', 'website', 'fns') AND ces.status = 'connected'`
  )
  assert(connectedSources === 4, `Expected four connected saved source rows, got ${connectedSources}`)
  assert(counters.dgis >= 2, `Mock 2GIS endpoint should be called for preview and save, got ${counters.dgis}`)
  assert(counters.dadata >= 2, `Mock DaData endpoint should be called for preview and save, got ${counters.dadata}`)
  assert(counters.website >= 2, `Mock website endpoint should be called for preview and save, got ${counters.website}`)

  console.log("Mini App enrichment smoke passed")
  console.log("Mode: no-write/temp-db/temp-server/signed-initData/mock-2gis-dadata")
  console.log(`Temporary DB: ${tempDbPath}`)
  console.log(`Temporary URL: ${baseUrl}`)
  console.log(`Company: ${smokeCompanyName}; office=${officePeople.min}-${officePeople.max}; source=${enrichment.payload.enrichment.proposal.headcount_source}`)
} catch (error) {
  console.error("Mini App enrichment smoke failed")
  if (output.trim()) {
    console.error(output.trim().slice(-5000))
  }
  throw error
} finally {
  await stopChild(child)
  await closeServer(mockServer)
}
