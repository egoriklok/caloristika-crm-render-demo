import { randomUUID } from "node:crypto"
import { dirname, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"

import {
  boundedInteger,
  buildTaskContext,
  claimNextTask,
  completeTask,
  ensureAgentRuntimeSchema,
  failTask,
  listAgentTasks,
  normalizeAgentResult,
  openAgentDb
} from "./agent-runtime-sql.mjs"
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

const args = parseArgs(process.argv.slice(2))
const workerId = args.values.get("worker-id") || process.env.AGENT_WORKER_ID || `lunch-up-agent-${randomUUID().slice(0, 8)}`
const maxTasksPerRun = boundedInteger(args.values.get("limit") ?? process.env.AGENT_MAX_TASKS_PER_RUN, 3, 1, 50)
const maxAttempts = boundedInteger(args.values.get("max-attempts") ?? process.env.AGENT_MAX_ATTEMPTS, 3, 1, 10)
const pollIntervalMs = boundedInteger(args.values.get("poll-ms") ?? process.env.AGENT_POLL_INTERVAL_MS, 10000, 1000, 300000)
const once = args.flags.has("once") || process.env.AGENT_RUN_ONCE === "1"
const runtime = resolveAgentRuntime(args)
const allowedAgentCodes = (args.values.get("agents") || process.env.AGENT_ALLOWED_CODES || "")
  .split(",")
  .map((code) => code.trim())
  .filter(Boolean)

function money(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value ?? 0))
}

function deterministicResult(context) {
  const task = context.task
  const companyName = context.company?.name || task.company_name || "клиент"
  const lowStock = context.low_stock ?? []
  const orders = context.orders ?? []
  const recentItems = context.recent_order_items ?? []
  const actions = []
  const inventoryWatchlist = lowStock.slice(0, 5).map((row) => ({
    product_id: Number(row.product_id),
    name: String(row.name),
    available_quantity: Number(row.available_quantity ?? 0),
    recommended_target: Number(row.target_stock ?? row.reorder_point ?? 0)
  }))

  if (task.agent_code === "inventory_replenishment_agent") {
    for (const row of inventoryWatchlist.slice(0, 3)) {
      actions.push({
        type: "inventory_replenishment",
        title: `Проверить пополнение: ${row.name}, доступно ${row.available_quantity}, цель ${row.recommended_target}`,
        owner: "operations_manager",
        due_at: null,
        requires_manager_approval: true
      })
    }
  } else if (task.agent_code === "sales_demand_analyst") {
    const bestSku = recentItems[0]
    actions.push({
      type: "sales_review",
      title: bestSku
        ? `Проверить повторный спрос по ${bestSku.name}: ${bestSku.quantity} шт., ${money(bestSku.revenue)}`
        : `Проверить первые заказы и повторяемость SKU для ${companyName}`,
      owner: "sales_manager",
      due_at: null,
      requires_manager_approval: true
    })
  } else if (task.agent_code === "customer_order_concierge") {
    actions.push({
      type: "customer_next_step",
      title: orders.length
        ? `Сверить последний заказ ${companyName} и предложить повтор ходовых SKU`
        : `Проверить профиль ${companyName}, дату доставки и готовность к первому заказу`,
      owner: "sales_manager",
      due_at: null,
      requires_manager_approval: true
    })
  } else {
    actions.push({
      type: "manager_review",
      title: `Разобрать задачу ${task.task_type} для ${companyName}`,
      owner: "sales_manager",
      due_at: null,
      requires_manager_approval: true
    })
  }

  const lastOrder = orders[0]
  const summaryParts = [
    `${task.agent_name}: подготовлена рекомендация для ${companyName}.`,
    lastOrder ? `Последний заказ #${lastOrder.id}: ${lastOrder.status}, ${money(lastOrder.total_amount)}.` : "Заказов по клиенту в контексте нет.",
    lowStock.length ? `SKU ниже точки пополнения: ${lowStock.length}.` : "Критичных остатков в текущем контексте нет."
  ]
  return normalizeAgentResult({
    summary: summaryParts.join(" "),
    confidence: orders.length || lowStock.length ? "medium" : "low",
    risk_level: lowStock.length ? "high" : "medium",
    recommended_actions: actions,
    customer_message_draft:
      task.agent_code === "customer_order_concierge"
        ? "Здравствуйте! Мы проверим состав заказа, дату доставки и подскажем, что можно повторить или добрать до удобной поставки."
        : null,
    manager_note: [
      "Результат подготовлен в offline mode без внешнего LLM.",
      "Перед изменением заказа, статуса, контакта или остатка подтвердите действие вручную."
    ].join(" "),
    evidence_sources: [
      {
        label: "CRM task context",
        source_type: "crm",
        url: null,
        note: `ai_tasks #${task.id}, agent_code=${task.agent_code}, task_type=${task.task_type}`
      },
      {
        label: "CRM catalog and order context",
        source_type: "sqlite",
        url: null,
        note: `orders=${orders.length}, recent_order_items=${recentItems.length}, low_stock=${lowStock.length}`
      }
    ],
    inventory_watchlist: inventoryWatchlist,
    memory_updates: [
      {
        memory_type: "last_agent_review",
        memory_key: task.task_type,
        content: `Offline review for task #${task.id}: ${task.prompt.slice(0, 500)}`,
        confidence: "medium"
      }
    ],
    next_status: "needs_review"
  })
}

async function processOne(db) {
  const claim = claimNextTask(db, { workerId, allowedAgentCodes, maxAttempts })
  if (!claim?.task) return false
  const startedAt = new Date().toISOString()
  const started = Date.now()
  const context = claim.context ?? buildTaskContext(db, claim.task.id)
  try {
    const result = runtime.provider === "offline" ? deterministicResult(context) : await runAgentProvider(context, runtime)
    const completed = completeTask(db, {
      taskId: claim.task.id,
      workerId,
      mode: runtime.mode,
      model: runtime.model,
      input: context,
      result,
      startedAt,
      latencyMs: Date.now() - started
    })
    console.log(
      JSON.stringify({
        ok: true,
        task_id: claim.task.id,
        agent_code: claim.task.agent_code,
        status: completed.task.status,
        mode: runtime.mode,
        summary: completed.result.summary
      })
    )
    return true
  } catch (error) {
    const requeue = (claim.task.attempts ?? 0) < maxAttempts
    const failed = failTask(db, {
      taskId: claim.task.id,
      workerId,
      mode: runtime.mode,
      model: runtime.model,
      input: context,
      error,
      requeue
    })
    console.error(
      JSON.stringify({
        ok: false,
        task_id: claim.task.id,
        status: failed.task.status,
        requeue,
        error: String(error?.message ?? error)
      })
    )
    return true
  }
}

async function main() {
  const { db, dbPath } = openAgentDb(root)
  try {
    ensureAgentRuntimeSchema(db)
    console.log(
      JSON.stringify({
        ok: true,
        event: "agent_worker_started",
        worker_id: workerId,
        dbPath,
        provider: runtime.provider,
        mode: runtime.mode,
        model: runtime.model,
        endpointConfigured: runtime.endpointConfigured,
        commandConfigured: runtime.commandConfigured,
        apiKeyConfigured: runtime.apiKeyConfigured,
        maxTasksPerRun,
        maxAttempts,
        queued: listAgentTasks(db, { status: "queued", limit: 200 }).length
      })
    )

    do {
      let processed = 0
      for (let index = 0; index < maxTasksPerRun; index += 1) {
        const didWork = await processOne(db)
        if (!didWork) break
        processed += 1
      }
      if (once) break
      if (processed === 0) await sleep(pollIntervalMs)
    } while (true)
  } finally {
    db.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, event: "agent_worker_crashed", error: String(error?.stack ?? error) }))
  process.exit(1)
})
