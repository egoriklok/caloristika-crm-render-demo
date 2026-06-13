import { spawn } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { createServer as createHttpServer } from "node:http"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createServer as createNetServer } from "node:net"
import { DatabaseSync } from "node:sqlite"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const sourceDbPath = join(root, "data", "lunch_up_crm.sqlite")
const crmAccessKey = "company-enrichment-smoke-crm-key"
const smokeCompanyName = "Mock 2GIS Office"
const smokeInn = "7801234567"

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
  const dir = mkdtempSync(join(tmpdir(), "lunch-up-company-enrichment-smoke-"))
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
              id: "mock-dgis-1",
              name: smokeCompanyName,
              full_name: 'ООО "Mock 2GIS Office"',
              address_name: "Санкт-Петербург, Невский проспект, 10",
              employees_org_count: "120",
              itin: smokeInn,
              contact_groups: [
                {
                  contacts: [
                    { type: "phone", value: "+7 812 111-22-33" },
                    { type: "email", value: "office@example.test" },
                    { type: "website", value: `http://127.0.0.1:${server.address().port}/site/mock-office` }
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
            value: 'ООО "Mock 2GIS Office"',
            unrestricted_value: 'ООО "Mock 2GIS Office"',
            data: {
              inn: smokeInn,
              branch_count: "2",
              employee_count: "160",
              name: {
                full_with_opf: 'ООО "Mock 2GIS Office"',
                short_with_opf: 'ООО "Mock 2GIS Office"'
              },
              address: { value: "Санкт-Петербург, Невский проспект, 10" },
              phones: [{ value: "+7 812 333-44-55" }],
              emails: [{ value: "fns@example.test" }]
            }
          }
        ]
      })
      return
    }

    if (url.pathname === "/site/mock-office" || url.pathname === "/contacts" || url.pathname === "/kontakty") {
      counters.website += 1
      htmlResponse(
        response,
        `<!doctype html>
        <html>
          <body>
            <main>
              <h1>${smokeCompanyName}</h1>
              <p>Команда 140 сотрудников в Санкт-Петербурге.</p>
              <p>Телефон: +7 812 555-66-77, email: hello@example.test.</p>
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
  while (Date.now() - startedAt < 70_000) {
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
const useProductionBuild = process.env.COMPANY_ENRICHMENT_SMOKE_NEXT_MODE === "start" && existsSync(join(root, ".next", "BUILD_ID"))
const args = useProductionBuild
  ? [nextBin, "start", "-H", "127.0.0.1", "-p", port]
  : [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", port]

const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    LUNCH_UP_CRM_DB_PATH: tempDbPath,
    CRM_ACCESS_KEY: crmAccessKey,
    DGIS_API_KEY: "mock-dgis-key",
    DADATA_API_KEY: "mock-dadata-key",
    DGIS_API_BASE_URL: `http://127.0.0.1:${mockPort}/2gis/3.0/items`,
    DADATA_API_BASE_URL: `http://127.0.0.1:${mockPort}`,
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_MANAGER_CHAT_ID: "",
    EXTERNAL_ORDER_WEBHOOK_URL: "",
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
const intakeUrl = `${baseUrl}/api/companies?key=${encodeURIComponent(crmAccessKey)}`
const leadPayload = {
  company_name: smokeCompanyName,
  inn: smokeInn,
  address: "Санкт-Петербург, Невский проспект, 10",
  segment: "office_cluster",
  region: "Санкт-Петербург и Ленинградская область",
  city: "Санкт-Петербург",
  source: "company_enrichment_smoke",
  lead_score: 88,
  create_ai_task: false,
  contact: {
    name: "Mock Office Buyer",
    role: "Офис-менеджер",
    email: "buyer@example.test",
    phone: "+7 812 999-00-11",
    preferred_channel: "email"
  }
}

try {
  await waitForReady(baseUrl, child)

  const dryRun = await jsonRequest(intakeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...leadPayload, dry_run: true })
  })
  assert(dryRun.response.status === 200, `Expected dry-run HTTP 200, got ${dryRun.response.status}: ${JSON.stringify(dryRun.payload)}`)
  assert(dryRun.payload?.ok === true && dryRun.payload?.dry_run === true, "Dry-run intake must be ok=true and dry_run=true")
  assert(dryRun.payload?.company_id === null, "Dry-run must not create a company")
  assert(countRows(tempDbPath, "companies", `name = ${sqlString(smokeCompanyName)}`) === beforeSmokeCompanies, "Dry-run must not mutate the temporary DB")

  const enrichment = dryRun.payload.enrichment
  assert(enrichment?.profile?.inn === smokeInn, "Enrichment must keep INN from 2GIS/DaData")
  assert(enrichment?.profile?.phone === "+7 812 111-22-33", "Enrichment must use public 2GIS phone")
  assert(enrichment?.profile?.email === "office@example.test", "Enrichment must use public 2GIS email")
  assert(enrichment?.profile?.website?.includes(`/site/mock-office`), "Enrichment must use website from 2GIS")
  assert(enrichment?.profile?.employee_count_fns === 160, "Enrichment must read employee_count from DaData/FNS")
  assert(enrichment?.profile?.employee_count_2gis === 120, "Enrichment must read employees_org_count from 2GIS")
  assert(enrichment?.profile?.employee_count_website === 140, "Enrichment must extract employee count from company website")
  assert(enrichment?.profile?.branch_count === 2, "Enrichment must read branch_count from DaData")
  assert(enrichment?.office_people?.confidence === "high", "Office estimate must be high confidence when FNS/DaData employee_count is present")
  assert(enrichment?.office_people?.min === 44, `Expected office_people.min=44, got ${enrichment?.office_people?.min}`)
  assert(enrichment?.office_people?.max === 72, `Expected office_people.max=72, got ${enrichment?.office_people?.max}`)
  assert(enrichment?.proposal?.headcount_source?.includes("ФНС/DaData: 160"), "Proposal must show FNS/DaData as headcount source")
  assert(enrichment?.proposal?.proposal_summary?.includes("Для КП используем диапазон 44-72"), "Proposal summary must include the calculated office range")
  assert(enrichment?.proposal?.what_to_offer?.length >= 3, "Proposal must include what_to_offer guidance")
  assert(enrichment?.headcount_evidence?.some((item) => item.source === "fns_dadata" && item.value === 160 && item.used_for_estimate), "Headcount evidence must mark FNS/DaData as the primary estimate source")
  assert(enrichment?.headcount_evidence?.some((item) => item.source === "2gis" && item.value === 120), "Headcount evidence must include the 2GIS employee signal")
  assert(enrichment?.headcount_evidence?.some((item) => item.source === "website" && item.value === 140), "Headcount evidence must include the website employee signal")
  assert(enrichment?.headcount_evidence?.some((item) => item.source === "crm_segment"), "Headcount evidence must include the CRM segment/fallback method")
  for (const source of ["2gis", "dadata", "website", "fns"]) {
    assert(sourceStatus(dryRun.payload, source) === "connected", `Expected ${source} source to be connected`)
  }

  const created = await jsonRequest(intakeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...leadPayload, dry_run: false })
  })
  assert(created.response.status === 201, `Expected create HTTP 201, got ${created.response.status}: ${JSON.stringify(created.payload)}`)
  assert(created.payload?.ok === true && created.payload?.dry_run === false, "Create intake must be ok=true and dry_run=false")
  assert(Number.isInteger(created.payload?.company_id), "Create intake must return company_id")
  assert(Number.isInteger(created.payload?.deal_id), "Create intake must return deal_id")
  assert(Number.isInteger(created.payload?.contact_id), "Create intake must return contact_id")
  assert(created.payload?.ai_task_id === null, "Smoke creation must not queue an AI task when create_ai_task=false")

  const afterCompanies = countRows(tempDbPath, "companies")
  assert(afterCompanies === beforeCompanies + 1, `Temporary DB should contain exactly one new company, before=${beforeCompanies}, after=${afterCompanies}`)
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
  assert(savedProfile?.employee_count_fns === 160, "Saved enrichment profile must include DaData/FNS employee count")
  assert(savedProfile?.employee_count_2gis === 120, "Saved enrichment profile must include 2GIS employee count")
  assert(savedProfile?.employee_count_website === 140, "Saved enrichment profile must include website employee count")
  assert(savedProfile?.office_people_min === 44 && savedProfile?.office_people_max === 72, "Saved enrichment profile must include office range")

  const connectedSources = countRows(
    tempDbPath,
    "company_enrichment_sources ces JOIN companies c ON c.id = ces.company_id",
    `c.name = ${sqlString(smokeCompanyName)} AND ces.source IN ('2gis', 'dadata', 'website', 'fns') AND ces.status = 'connected'`
  )
  assert(connectedSources === 4, `Expected four connected saved source rows, got ${connectedSources}`)
  assert(counters.dgis >= 2, `Mock 2GIS endpoint should be called for dry-run and create, got ${counters.dgis}`)
  assert(counters.dadata >= 2, `Mock DaData endpoint should be called for dry-run and create, got ${counters.dadata}`)
  assert(counters.website >= 2, `Mock website endpoint should be called for dry-run and create, got ${counters.website}`)

  const sourceRowsBeforeBulk = countRows(
    tempDbPath,
    "company_enrichment_sources ces JOIN companies c ON c.id = ces.company_id",
    `c.name = ${sqlString(smokeCompanyName)}`
  )
  const bulkUrl = `${baseUrl}/api/companies/enrichment/bulk?key=${encodeURIComponent(crmAccessKey)}`
  const bulkDryRun = await jsonRequest(bulkUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      company_ids: [created.payload.company_id],
      force_refresh: true,
      dry_run: true,
      limit: 1,
      cache_ttl_hours: 72
    })
  })
  assert(bulkDryRun.response.status === 200, `Expected bulk dry-run HTTP 200, got ${bulkDryRun.response.status}: ${JSON.stringify(bulkDryRun.payload)}`)
  assert(bulkDryRun.payload?.ok === true && bulkDryRun.payload?.dry_run === true, "Bulk enrichment dry-run must be ok=true and dry_run=true")
  assert(bulkDryRun.payload?.processed === 1 && bulkDryRun.payload?.saved === 0, "Bulk enrichment dry-run must process one company without saving")
  assert(bulkDryRun.payload?.results?.[0]?.source_statuses?.["2gis"] === "connected", "Bulk enrichment must return 2GIS source status")
  assert(bulkDryRun.payload?.results?.[0]?.enrichment?.headcount_evidence?.some((item) => item.source === "fns_dadata"), "Bulk enrichment must return headcount evidence")
  assert(
    countRows(tempDbPath, "company_enrichment_sources ces JOIN companies c ON c.id = ces.company_id", `c.name = ${sqlString(smokeCompanyName)}`) === sourceRowsBeforeBulk,
    "Bulk enrichment dry-run must not create source history rows"
  )

  const bulkCached = await jsonRequest(bulkUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      company_ids: [created.payload.company_id],
      dry_run: false,
      force_refresh: false,
      limit: 1,
      cache_ttl_hours: 72
    })
  })
  assert(bulkCached.response.status === 200, `Expected bulk cache HTTP 200, got ${bulkCached.response.status}: ${JSON.stringify(bulkCached.payload)}`)
  assert(bulkCached.payload?.ok === true && bulkCached.payload?.processed === 1, "Bulk enrichment cache run must process one company")
  assert(bulkCached.payload?.cache_hits === 1 && bulkCached.payload?.saved === 0, "Bulk enrichment cache run must use cache without saving duplicate sources")
  assert(
    countRows(tempDbPath, "company_enrichment_sources ces JOIN companies c ON c.id = ces.company_id", `c.name = ${sqlString(smokeCompanyName)}`) === sourceRowsBeforeBulk,
    "Bulk enrichment cache-hit must not create duplicate source history rows"
  )

  const dgisSearchUrl = `${baseUrl}/api/integrations/2gis/search?key=${encodeURIComponent(crmAccessKey)}`
  const beforeDgisSearchCompanies = countRows(tempDbPath, "companies", `name = ${sqlString(smokeCompanyName)}`)
  const dgisSearchDryRun = await jsonRequest(dgisSearchUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: smokeCompanyName,
      segment: "office_cluster",
      limit: 1,
      dry_run: true
    })
  })
  assert(dgisSearchDryRun.response.status === 200, `Expected 2GIS search dry-run HTTP 200, got ${dgisSearchDryRun.response.status}: ${JSON.stringify(dgisSearchDryRun.payload)}`)
  assert(dgisSearchDryRun.payload?.ok === true && dgisSearchDryRun.payload?.dry_run === true, "2GIS lead search dry-run must be ok=true and dry_run=true")
  assert(dgisSearchDryRun.payload?.candidates?.[0]?.suggested_payload?.company_name === smokeCompanyName, "2GIS lead search must return candidate suggested payload")
  assert(dgisSearchDryRun.payload?.candidates?.[0]?.phone === "+7 812 111-22-33", "2GIS lead search must return public phone from contact_groups")
  assert(
    countRows(tempDbPath, "companies", `name = ${sqlString(smokeCompanyName)}`) === beforeDgisSearchCompanies,
    "2GIS lead search dry-run must not create or update CRM companies"
  )

  const dgisSearchImport = await jsonRequest(dgisSearchUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: smokeCompanyName,
      segment: "office_cluster",
      limit: 1,
      dry_run: false,
      confirm_import: true,
      create_ai_task: false
    })
  })
  assert(dgisSearchImport.response.status === 200, `Expected 2GIS search import HTTP 200, got ${dgisSearchImport.response.status}: ${JSON.stringify(dgisSearchImport.payload)}`)
  assert(dgisSearchImport.payload?.ok === true && dgisSearchImport.payload?.imported === true, "2GIS lead search import must require explicit confirm_import")
  assert(Number.isInteger(dgisSearchImport.payload?.imports?.[0]?.result?.company_id), "2GIS lead search import must return lead-intake company_id")

  console.log("Company enrichment smoke passed")
  console.log("Mode: no-write/temp-db/temp-server/mock-2gis-dadata")
  console.log(`Temporary DB: ${tempDbPath}`)
  console.log(`Temporary URL: ${baseUrl}`)
  console.log(`Created company: #${created.payload.company_id}; office=${enrichment.office_people.min}-${enrichment.office_people.max}; source=${enrichment.proposal.headcount_source}`)
  console.log("- bulk enrichment: dry-run and cache-hit verified")
  console.log("- 2GIS lead search: dry-run and confirmed import verified")
} catch (error) {
  console.error("Company enrichment smoke failed")
  if (output.trim()) {
    console.error(output.trim().slice(-5000))
  }
  throw error
} finally {
  await stopChild(child)
  await closeServer(mockServer)
}
