import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { performance } from "node:perf_hooks"

const root = process.cwd()
const defaultBaseUrl = `http://127.0.0.1:${process.env.PORT || "3011"}`
const baseUrl = (process.env.PERF_BASE_URL || defaultBaseUrl).replace(/\/$/, "")
const accessKey =
  process.env.CRM_ACCESS_KEY ||
  (existsSync(join(root, "logs", "public_access_key.txt"))
    ? readFileSync(join(root, "logs", "public_access_key.txt"), "utf-8").trim()
    : "")

function withKey(path) {
  if (!accessKey) return path
  const url = new URL(path, baseUrl)
  url.searchParams.set("key", accessKey)
  return `${url.pathname}${url.search}`
}

async function measure(label, path, options = {}) {
  const started = performance.now()
  const response = await fetch(`${baseUrl}${withKey(path)}`, {
    redirect: "follow",
    headers: { accept: options.accept || "*/*" }
  })
  const buffer = Buffer.from(await response.arrayBuffer())
  const elapsedMs = Math.round(performance.now() - started)
  return {
    label,
    path,
    status: response.status,
    ok: response.ok,
    elapsed_ms: elapsedMs,
    bytes: buffer.byteLength,
    content_type: response.headers.get("content-type") || null,
    server_timing: response.headers.get("server-timing") || null
  }
}

const checks = [
  ["root_html", "/", { accept: "text/html" }],
  ["health", "/api/health", { accept: "application/json" }],
  ["dashboard_json", "/api/dashboard", { accept: "application/json" }],
  ["admin_catalog_html", "/admin-catalog.html", { accept: "text/html" }],
  ["admin_catalog_data", "/admin-catalog-data.json", { accept: "application/json" }]
]

const results = []
for (const [label, path, options] of checks) {
  results.push(await measure(label, path, options))
}

const failures = results.filter((item) => !item.ok)
const rootHtml = results.find((item) => item.label === "root_html")
if (rootHtml && rootHtml.bytes > 700_000) {
  failures.push({
    label: "root_html_budget",
    status: 0,
    ok: false,
    elapsed_ms: 0,
    bytes: rootHtml.bytes,
    content_type: null,
    server_timing: null,
    path: "root HTML must stay below 700 KB"
  })
}

console.log(JSON.stringify({ base_url: baseUrl, checked_at: new Date().toISOString(), results }, null, 2))

if (failures.length) {
  console.error(`Performance baseline failed: ${failures.map((item) => item.label).join(", ")}`)
  process.exit(1)
}
