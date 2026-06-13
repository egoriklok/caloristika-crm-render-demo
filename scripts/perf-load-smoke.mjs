import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { performance } from "node:perf_hooks"

const root = process.cwd()
const baseUrl = (process.env.PERF_BASE_URL || `http://127.0.0.1:${process.env.PORT || "3011"}`).replace(/\/$/, "")
const accessKey =
  process.env.CRM_ACCESS_KEY ||
  (existsSync(join(root, "logs", "public_access_key.txt"))
    ? readFileSync(join(root, "logs", "public_access_key.txt"), "utf-8").replace(/[^a-z0-9]/gi, "")
    : "")
const concurrency = Math.max(1, Math.min(20, Number.parseInt(process.env.PERF_LOAD_CONCURRENCY || "4", 10)))
const iterations = Math.max(1, Math.min(100, Number.parseInt(process.env.PERF_LOAD_ITERATIONS || "8", 10)))

const scenarios = [
  { label: "root", path: "/", p95BudgetMs: 2000 },
  { label: "health", path: "/api/health", p95BudgetMs: 500 },
  { label: "dashboard", path: "/api/dashboard", p95BudgetMs: 2000 },
  { label: "admin_catalog", path: "/admin-catalog.html", p95BudgetMs: 500 },
  { label: "admin_data", path: "/admin-catalog-data.json", p95BudgetMs: 500 }
]

function withKey(path) {
  if (!accessKey) return path
  const url = new URL(path, baseUrl)
  url.searchParams.set("key", accessKey)
  return `${url.pathname}${url.search}`
}

async function requestOnce(scenario) {
  const started = performance.now()
  const response = await fetch(`${baseUrl}${withKey(scenario.path)}`, {
    cache: "no-store",
    headers: { accept: scenario.path.endsWith(".html") || scenario.path === "/" ? "text/html" : "application/json" }
  })
  await response.arrayBuffer()
  return {
    status: response.status,
    ok: response.ok,
    elapsed_ms: Math.round(performance.now() - started)
  }
}

async function runScenario(scenario) {
  const queue = Array.from({ length: iterations }, () => scenario)
  const results = []

  async function worker() {
    while (queue.length) {
      const next = queue.shift()
      if (!next) return
      results.push(await requestOnce(next))
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, iterations) }, () => worker()))
  const latencies = results.map((item) => item.elapsed_ms).sort((a, b) => a - b)
  const p95 = latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0
  const errors = results.filter((item) => !item.ok).length
  return {
    label: scenario.label,
    path: scenario.path,
    requests: results.length,
    errors,
    p50_ms: latencies[Math.max(0, Math.ceil(latencies.length * 0.5) - 1)] ?? 0,
    p95_ms: p95,
    p95_budget_ms: scenario.p95BudgetMs,
    passed: errors === 0 && p95 <= scenario.p95BudgetMs
  }
}

const results = []
for (const scenario of scenarios) {
  results.push(await runScenario(scenario))
}

console.log(JSON.stringify({ base_url: baseUrl, concurrency, iterations, checked_at: new Date().toISOString(), results }, null, 2))

const failed = results.filter((item) => !item.passed)
if (failed.length) {
  console.error(`Performance load smoke failed: ${failed.map((item) => item.label).join(", ")}`)
  process.exit(1)
}
