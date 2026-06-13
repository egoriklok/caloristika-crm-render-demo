import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createServer as createHttpServer } from "node:http"
import { createServer as createNetServer } from "node:net"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const accessKey = "integration-preflight-mock-smoke-crm-key"
const webhookSecret = "integration-preflight-mock-smoke-webhook-secret"
const fakeDgisKey = "integration-preflight-mock-smoke-dgis-key"
const fakeDadataKey = "integration-preflight-mock-smoke-dadata-key"

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

function startMockSourceServer() {
  const counters = { dgis: 0, dadata: 0 }
  const server = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (url.pathname === "/2gis/3.0/items") {
      counters.dgis += 1
      jsonResponse(response, { result: { total: 1, items: [{ id: "mock-preflight-dgis", name: "Lunch Up Санкт-Петербург" }] } })
      return
    }
    if (url.pathname === "/suggestions/api/4_1/rs/findById/party") {
      counters.dadata += 1
      jsonResponse(response, {
        suggestions: [
          {
            value: 'ООО "Preflight Mock"',
            data: {
              inn: "7812014560",
              employee_count: "42"
            }
          }
        ]
      })
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

async function request(url, init = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, text, payload }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function checkByKey(payload, key) {
  return payload?.checks?.find((item) => item.key === key) ?? null
}

const { server: mockServer, counters, port: mockPort } = await startMockSourceServer()
const port = await freePort()
const baseUrl = `http://127.0.0.1:${port}`
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const useProductionBuild = process.env.INTEGRATION_PREFLIGHT_MOCK_SMOKE_NEXT_MODE === "start" && existsSync(join(root, ".next", "BUILD_ID"))
const args = useProductionBuild
  ? [nextBin, "start", "-H", "127.0.0.1", "-p", port]
  : [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", port]

const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    CRM_ACCESS_KEY: accessKey,
    PUBLIC_BASE_URL: baseUrl,
    TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    TELEGRAM_BOT_TOKEN: "",
    DGIS_API_KEY: fakeDgisKey,
    DADATA_API_KEY: fakeDadataKey,
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

try {
  await waitForReady(baseUrl, child)

  const blocked = await request(`${baseUrl}/api/integrations/preflight`)
  assert(blocked.response.status === 401, `Preflight without CRM key must be blocked, got ${blocked.response.status}`)

  const preflight = await request(`${baseUrl}/api/integrations/preflight?key=${encodeURIComponent(accessKey)}`)
  assert(preflight.response.ok, `Preflight with CRM key must pass, got HTTP ${preflight.response.status}`)
  assert(preflight.payload?.ok === false, "Preflight should remain not ready without TELEGRAM_BOT_TOKEN")
  for (const [key, expectedStatus] of [
    ["public_base_url", "ok"],
    ["webhook_secret", "ok"],
    ["telegram_webhook_public_access", "ok"],
    ["miniapp_public", "ok"],
    ["miniapp_catalog", "ok"],
    ["dgis", "ok"],
    ["dadata", "ok"],
    ["telegram_bot", "blocked"]
  ]) {
    const item = checkByKey(preflight.payload, key)
    assert(item?.status === expectedStatus, `Expected ${key}=${expectedStatus}, got ${item?.status ?? "missing"}`)
  }
  assert(counters.dgis === 1, `Mock 2GIS preflight endpoint should be called once, got ${counters.dgis}`)
  assert(counters.dadata === 1, `Mock DaData preflight endpoint should be called once, got ${counters.dadata}`)
  for (const secret of [accessKey, webhookSecret, fakeDgisKey, fakeDadataKey]) {
    assert(!preflight.text.includes(secret), `Preflight response must not expose secret value: ${secret}`)
  }

  console.log("Integration preflight mock smoke passed")
  console.log("Mode: no-write/temp-server/mock-2gis-dadata")
  console.log(`Temporary URL: ${baseUrl}`)
  console.log("- public Mini App/catalog: ok")
  console.log("- webhook public access: ok")
  console.log("- 2GIS/DaData proxy checks: ok")
  console.log("- Telegram token: intentionally missing")
} catch (error) {
  console.error("Integration preflight mock smoke failed")
  if (output.trim()) {
    console.error(output.trim().slice(-5000))
  }
  throw error
} finally {
  await stopChild(child)
  await closeServer(mockServer)
}
