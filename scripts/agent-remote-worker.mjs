import { randomUUID } from "node:crypto"
import { dirname, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"

import { boundedInteger, normalizeAgentResult } from "./agent-runtime-sql.mjs"
import { resolveAgentRuntime, runAgentProvider } from "./agent-runtime-providers.mjs"
import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
loadLocalEnv(root)

function parseArgs(argv) {
  const flags = new Set()
  const values = new Map()
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue
    const [key, ...rest] = arg.slice(2).split("=")
    if (rest.length === 0) {
      flags.add(key)
    } else {
      values.set(key, rest.join("="))
    }
  }
  return { flags, values }
}

function clean(value) {
  const text = String(value ?? "").trim()
  return text.length ? text : null
}

function normalizeBaseUrl(value) {
  const text = clean(value)
  return text ? text.replace(/\/+$/, "") : null
}

const args = parseArgs(process.argv.slice(2))
const crmBaseUrl = normalizeBaseUrl(
  args.values.get("crm-url") || process.env.REMOTE_CRM_BASE_URL || process.env.CRM_BASE_URL || process.env.PUBLIC_BASE_URL
)
const crmAccessKey = clean(args.values.get("crm-key") || process.env.REMOTE_CRM_ACCESS_KEY || process.env.CRM_ACCESS_KEY)
const workerId = args.values.get("worker-id") || process.env.AGENT_WORKER_ID || `remote-agent-${randomUUID().slice(0, 8)}`
const maxTasksPerRun = boundedInteger(args.values.get("limit") ?? process.env.AGENT_MAX_TASKS_PER_RUN, 3, 1, 50)
const maxAttempts = boundedInteger(args.values.get("max-attempts") ?? process.env.AGENT_MAX_ATTEMPTS, 3, 1, 10)
const pollIntervalMs = boundedInteger(args.values.get("poll-ms") ?? process.env.AGENT_POLL_INTERVAL_MS, 10000, 1000, 300000)
const once = args.flags.has("once") || process.env.AGENT_RUN_ONCE === "1"
const runtime = resolveAgentRuntime(args)
const allowedAgentCodes = (args.values.get("agents") || process.env.AGENT_ALLOWED_CODES || "")
  .split(",")
  .map((code) => code.trim())
  .filter(Boolean)

if (!crmBaseUrl) {
  throw new Error("REMOTE_CRM_BASE_URL, CRM_BASE_URL, PUBLIC_BASE_URL or --crm-url=<url> is required")
}

function authHeaders(contentType = true) {
  const headers = {
    accept: "application/json",
    "user-agent": "lunch-up-crm-remote-agent-worker"
  }
  if (contentType) headers["content-type"] = "application/json"
  if (crmAccessKey) headers["x-crm-access-key"] = crmAccessKey
  return headers
}

async function crmRequest(method, path, body = undefined) {
  const response = await fetch(`${crmBaseUrl}${path}`, {
    method,
    headers: authHeaders(Boolean(body)),
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { raw: text }
  }
  if (!response.ok || payload?.ok === false) {
    const error = payload?.error || payload?.raw || response.statusText
    throw new Error(`CRM ${method} ${path} failed with HTTP ${response.status}: ${String(error).slice(0, 1000)}`)
  }
  return payload
}

function deterministicResult(context) {
  const task = context?.task ?? {}
  const companyName = context?.company?.name || task.company_name || "CRM account"
  const lowStock = Array.isArray(context?.low_stock) ? context.low_stock : []
  const recentItems = Array.isArray(context?.recent_order_items) ? context.recent_order_items : []
  const orders = Array.isArray(context?.orders) ? context.orders : []
  const inventoryWatchlist = lowStock.slice(0, 5).map((row) => ({
    product_id: Number(row.product_id ?? 0),
    name: String(row.name ?? ""),
    available_quantity: Number(row.available_quantity ?? 0),
    recommended_target: Number(row.target_stock ?? row.reorder_point ?? 0)
  }))
  const firstRecentSku = recentItems[0]
  const actionTitle =
    task.agent_code === "inventory_replenishment_agent"
      ? `Review replenishment for ${inventoryWatchlist[0]?.name || "low-stock SKU"}`
      : task.agent_code === "sales_demand_analyst"
        ? `Review repeat demand${firstRecentSku?.name ? ` for ${firstRecentSku.name}` : ""}`
        : `Review next customer step for ${companyName}`

  return normalizeAgentResult({
    summary: `${task.agent_name || "Remote worker"} prepared a manager-reviewable recommendation for ${companyName}.`,
    confidence: orders.length || recentItems.length ? "medium" : "low",
    risk_level: lowStock.length ? "high" : "medium",
    recommended_actions: [
      {
        type: "manager_review",
        title: actionTitle,
        owner: "sales_manager",
        due_at: null,
        requires_manager_approval: true
      }
    ],
    customer_message_draft:
      task.agent_code === "customer_order_concierge"
        ? "Здравствуйте! Мы проверим состав заказа, дату доставки и предложим удобный следующий шаг."
        : null,
    manager_note:
      "Remote worker ran in offline mode. Use this as a safe connectivity check; business mutations still require manager approval.",
    evidence_sources: [
      {
        label: "Render CRM task API",
        source_type: "crm_api",
        url: `${crmBaseUrl}/api/agent/tasks`,
        note: `Task #${task.id ?? "unknown"}, agent_code=${task.agent_code ?? "unknown"}.`
      }
    ],
    inventory_watchlist: inventoryWatchlist,
    memory_updates: [],
    next_status: "needs_review"
  })
}

async function processOne() {
  const claimPayload = await crmRequest("PATCH", "/api/agent/tasks", {
    action: "claim_next",
    worker_id: workerId,
    allowed_agent_codes: allowedAgentCodes,
    max_attempts: maxAttempts
  })
  const claim = claimPayload?.claim
  if (!claim?.task) return false

  const task = claim.task
  const context = claim.context
  const startedAt = new Date().toISOString()
  const started = Date.now()

  try {
    const result = runtime.provider === "offline" ? deterministicResult(context) : await runAgentProvider(context, runtime)
    const completed = await crmRequest("PATCH", "/api/agent/tasks", {
      action: "complete",
      task_id: task.id,
      worker_id: workerId,
      mode: runtime.mode,
      model: runtime.model,
      started_at: startedAt,
      latency_ms: Date.now() - started,
      input: context,
      result
    })
    console.log(
      JSON.stringify({
        ok: true,
        event: "remote_agent_task_completed",
        task_id: task.id,
        agent_code: task.agent_code,
        status: completed?.task?.status,
        mode: runtime.mode
      })
    )
    return true
  } catch (error) {
    const requeue = Number(task.attempts ?? 0) < maxAttempts
    await crmRequest("PATCH", "/api/agent/tasks", {
      action: "fail",
      task_id: task.id,
      worker_id: workerId,
      mode: runtime.mode,
      model: runtime.model,
      input: context,
      error: String(error?.message ?? error),
      requeue
    })
    console.error(
      JSON.stringify({
        ok: false,
        event: "remote_agent_task_failed",
        task_id: task.id,
        agent_code: task.agent_code,
        mode: runtime.mode,
        requeue,
        error: String(error?.message ?? error)
      })
    )
    return true
  }
}

async function main() {
  console.log(
    JSON.stringify({
      ok: true,
      event: "remote_agent_worker_started",
      crmBaseUrl,
      worker_id: workerId,
      provider: runtime.provider,
      mode: runtime.mode,
      model: runtime.model,
      endpointConfigured: runtime.endpointConfigured,
      commandConfigured: runtime.commandConfigured,
      apiKeyConfigured: runtime.apiKeyConfigured,
      crmAccessKeyConfigured: Boolean(crmAccessKey),
      maxTasksPerRun,
      maxAttempts
    })
  )

  do {
    let processed = 0
    for (let index = 0; index < maxTasksPerRun; index += 1) {
      const didWork = await processOne()
      if (!didWork) break
      processed += 1
    }
    if (once) break
    if (processed === 0) await sleep(pollIntervalMs)
  } while (true)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, event: "remote_agent_worker_crashed", error: String(error?.stack ?? error) }))
  process.exit(1)
})
