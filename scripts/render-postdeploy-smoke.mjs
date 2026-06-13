import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
loadLocalEnv(root)

const rawBaseUrl = process.argv[2] || process.env.RENDER_BASE_URL || process.env.PUBLIC_BASE_URL || ""
const baseUrl = rawBaseUrl.trim().replace(/\/+$/, "")
const accessKey = (process.env.CRM_ACCESS_KEY || "").trim()

if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
  console.error("Usage: npm run render:smoke -- https://<service>.onrender.com")
  process.exit(2)
}

async function check(path, options = {}) {
  const url = new URL(path, `${baseUrl}/`)
  const response = await fetch(url, { redirect: "manual" })
  const text = await response.text()
  const ok = options.statuses ? options.statuses.includes(response.status) : response.status >= 200 && response.status < 400
  if (!ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${text.slice(0, 220)}`)
  }
  if (options.includes && !text.includes(options.includes)) {
    throw new Error(`${path} did not include expected text: ${options.includes}`)
  }
  if (options.excludes && text.includes(options.excludes)) {
    throw new Error(`${path} included blocked text: ${options.excludes}`)
  }
  return { path, status: response.status }
}

const results = []

const health = await fetch(`${baseUrl}/api/health`)
const healthPayload = await health.json().catch(() => null)
if (health.status !== 200 || healthPayload?.ok !== true) {
  throw new Error(`/api/health failed: HTTP ${health.status}`)
}
results.push({ path: "/api/health", status: health.status })

results.push(await check("/catalog", { includes: "<html", excludes: "Нужен ключ доступа" }))
results.push(await check("/miniapp", { includes: "<html", excludes: "Нужен ключ доступа" }))

if (accessKey) {
  const protectedPath = `/?key=${encodeURIComponent(accessKey)}`
  results.push(await check(protectedPath, { includes: "<html", excludes: "Нужен ключ доступа" }))
} else {
  results.push(await check("/", { statuses: [200, 401], includes: "<html" }))
}

console.log("Render CRM smoke passed")
for (const result of results) {
  const safePath = result.path.startsWith("/?key=") ? "/?key=<hidden>" : result.path
  console.log(`- ${safePath}: ${result.status}`)
}
