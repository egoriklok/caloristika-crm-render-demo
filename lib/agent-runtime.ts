import { getDb, assertWritableDb } from "@/lib/db"

type AgentTaskStatus = "queued" | "running" | "needs_review" | "done" | "failed"

type AgentTaskRow = {
  id: number
  agent_code: string
  agent_name: string
  agent_mission: string
  task_type: string
  priority: number
  prompt: string
  status: AgentTaskStatus
  attempts: number | null
  locked_at: string | null
  locked_by: string | null
  last_error: string | null
  result_summary: string | null
  result_json: string | null
  due_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  company_id: number | null
  company_name: string | null
  deal_id: number | null
  deal_title: string | null
}

export type AgentResult = {
  summary: string
  confidence: "low" | "medium" | "high"
  risk_level: "low" | "medium" | "high"
  recommended_actions: Array<{
    type: string
    title: string
    owner: string
    due_at: string | null
    requires_manager_approval: boolean
  }>
  customer_message_draft: string | null
  manager_note: string
  evidence_sources: Array<{
    label: string
    source_type: string
    url: string | null
    note: string
  }>
  inventory_watchlist: Array<{
    product_id: number
    name: string
    available_quantity: number
    recommended_target: number
  }>
  memory_updates: Array<{
    memory_type: string
    memory_key: string
    content: string
    confidence: "low" | "medium" | "high"
  }>
  next_status: "needs_review" | "done"
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function tableColumns(table: string) {
  const db = getDb()
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name))
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  const db = getDb()
  if (tableColumns(table).has(column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function firstConfigured(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value?.trim()))
}

function getConfiguredAgentProvider() {
  const explicit = process.env.AGENT_LLM_PROVIDER?.trim().toLowerCase() || process.env.AGENT_RUNTIME_PROVIDER?.trim().toLowerCase()
  if (explicit) return explicit
  return process.env.AGENT_LLM_ENABLED === "1" ? "openai" : "offline"
}

function getAgentProviderStatus(provider: string) {
  if (provider === "offline") {
    return { configured: true, mode: "offline", requirement: "No external provider required" }
  }
  if (provider === "openai") {
    return {
      configured: Boolean(process.env.OPENAI_API_KEY),
      mode: "openai_responses",
      requirement: "OPENAI_API_KEY"
    }
  }
  if (provider === "paperclip") {
    return {
      configured: firstConfigured(process.env.PAPERCLIP_AGENT_ENDPOINT, process.env.PAPERCLIP_API_URL, process.env.PAPERCLIP_AGENT_COMMAND),
      mode: firstConfigured(process.env.PAPERCLIP_AGENT_ENDPOINT, process.env.PAPERCLIP_API_URL) ? "paperclip_http" : "paperclip_command",
      requirement: "PAPERCLIP_AGENT_ENDPOINT or PAPERCLIP_AGENT_COMMAND"
    }
  }
  if (provider === "hermes") {
    return {
      configured: firstConfigured(process.env.HERMES_AGENT_ENDPOINT, process.env.HERMES_GATEWAY_URL, process.env.HERMES_AGENT_COMMAND),
      mode: firstConfigured(process.env.HERMES_AGENT_ENDPOINT, process.env.HERMES_GATEWAY_URL) ? "hermes_http" : "hermes_command",
      requirement: "HERMES_AGENT_ENDPOINT or HERMES_AGENT_COMMAND"
    }
  }
  if (provider === "openclaw") {
    return {
      configured: firstConfigured(process.env.OPENCLAW_AGENT_ENDPOINT, process.env.OPENCLAW_GATEWAY_URL, process.env.OPENCLAW_AGENT_COMMAND),
      mode: firstConfigured(process.env.OPENCLAW_AGENT_ENDPOINT, process.env.OPENCLAW_GATEWAY_URL) ? "openclaw_http" : "openclaw_command",
      requirement: "OPENCLAW_AGENT_ENDPOINT, OPENCLAW_GATEWAY_URL or OPENCLAW_AGENT_COMMAND"
    }
  }
  return { configured: false, mode: "unsupported", requirement: "AGENT_LLM_PROVIDER must be offline, paperclip, hermes, openclaw or openai" }
}

function ensureAgent(code: string, name: string, mission: string, triggerRule: string) {
  const db = getDb()
  db.prepare(`
    INSERT INTO ai_agents(code, name, mission, trigger_rule)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      mission = excluded.mission,
      trigger_rule = excluded.trigger_rule,
      is_active = 1
  `).run(code, name, mission, triggerRule)
}

export function ensureAgentRuntimeSchema() {
  assertWritableDb()
  const db = getDb()
  addColumnIfMissing("ai_tasks", "locked_at", "TEXT")
  addColumnIfMissing("ai_tasks", "locked_by", "TEXT")
  addColumnIfMissing("ai_tasks", "attempts", "INTEGER NOT NULL DEFAULT 0")
  addColumnIfMissing("ai_tasks", "last_error", "TEXT")
  addColumnIfMissing("ai_tasks", "result_json", "TEXT")
  addColumnIfMissing("ai_tasks", "completed_at", "TEXT")

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_task_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
      agent_code TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      model TEXT,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT,
      error TEXT,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_agent_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_code TEXT NOT NULL,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      memory_type TEXT NOT NULL,
      memory_key TEXT NOT NULL,
      content_json TEXT NOT NULL,
      source_task_id INTEGER REFERENCES ai_tasks(id) ON DELETE SET NULL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agent_code, company_id, memory_type, memory_key)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_tasks_worker_claim ON ai_tasks(status, priority DESC, due_at, attempts);
    CREATE INDEX IF NOT EXISTS idx_ai_task_runs_task ON ai_task_runs(task_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_ai_agent_memories_lookup ON ai_agent_memories(agent_code, company_id, memory_type);
  `)

  ensureAgent(
    "customer_order_concierge",
    "AI Customer Order Concierge",
    "Ведет заказ со стороны клиента: проверяет профиль, дату, состав корзины, статус и следующий шаг.",
    "Клиент вошел в web-каталог, оформил заказ или запросил сопровождение"
  )
  ensureAgent(
    "inventory_replenishment_agent",
    "AI Inventory Replenishment Agent",
    "Следит за остатками, резервами и точками пополнения после клиентских заказов.",
    "SKU ушел ниже точки пополнения или заказ резко увеличил резерв"
  )
  ensureAgent(
    "sales_demand_analyst",
    "AI Sales Demand Analyst",
    "Анализирует продажи по SKU, клиентам и повторным заказам для поддержания остатков.",
    "Появился новый заказ, повторный заказ или накопилась недельная статистика"
  )
}

function readTask(taskId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT
      t.id,
      a.code AS agent_code,
      a.name AS agent_name,
      a.mission AS agent_mission,
      t.task_type,
      t.priority,
      t.prompt,
      t.status,
      COALESCE(t.attempts, 0) AS attempts,
      t.locked_at,
      t.locked_by,
      t.last_error,
      t.result_summary,
      t.result_json,
      t.due_at,
      t.created_at,
      t.updated_at,
      t.completed_at,
      t.company_id,
      c.name AS company_name,
      t.deal_id,
      d.title AS deal_title
    FROM ai_tasks t
    JOIN ai_agents a ON a.id = t.agent_id
    LEFT JOIN companies c ON c.id = t.company_id
    LEFT JOIN deals d ON d.id = t.deal_id
    WHERE t.id = ?
  `).get(taskId) as AgentTaskRow | undefined
}

function buildAllowedAgentClause(agentCodes: string[] | undefined) {
  const codes = (agentCodes ?? []).map((code) => code.trim()).filter(Boolean)
  if (codes.length === 0) return { clause: "", values: [] as string[] }
  return {
    clause: `AND a.code IN (${codes.map(() => "?").join(", ")})`,
    values: codes
  }
}

export function listAgentTasks(input: { status?: string | null; limit?: number | null } = {}) {
  ensureAgentRuntimeSchema()
  const db = getDb()
  const limit = boundedInteger(input.limit, 50, 1, 200)
  const status = input.status?.trim()
  const rows = status
    ? db.prepare(`
        SELECT
          t.id,
          a.code AS agent_code,
          a.name AS agent_name,
          t.task_type,
          t.priority,
          t.prompt,
          t.status,
          COALESCE(t.attempts, 0) AS attempts,
          t.locked_at,
          t.locked_by,
          t.last_error,
          t.result_summary,
          t.result_json,
          t.due_at,
          t.created_at,
          t.updated_at,
          t.completed_at,
          c.name AS company_name
        FROM ai_tasks t
        JOIN ai_agents a ON a.id = t.agent_id
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.status = ?
        ORDER BY t.priority DESC, t.due_at ASC, t.created_at ASC
        LIMIT ?
      `).all(status, limit)
    : db.prepare(`
        SELECT
          t.id,
          a.code AS agent_code,
          a.name AS agent_name,
          t.task_type,
          t.priority,
          t.prompt,
          t.status,
          COALESCE(t.attempts, 0) AS attempts,
          t.locked_at,
          t.locked_by,
          t.last_error,
          t.result_summary,
          t.result_json,
          t.due_at,
          t.created_at,
          t.updated_at,
          t.completed_at,
          c.name AS company_name
        FROM ai_tasks t
        JOIN ai_agents a ON a.id = t.agent_id
        LEFT JOIN companies c ON c.id = t.company_id
        ORDER BY
          CASE t.status WHEN 'queued' THEN 0 WHEN 'running' THEN 1 WHEN 'needs_review' THEN 2 ELSE 3 END,
          t.priority DESC,
          t.due_at ASC,
          t.created_at ASC
        LIMIT ?
      `).all(limit)
  return rows
}

export function getAgentRuntimeHealth() {
  const db = getDb()
  const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name))
  const schemaReady = tables.has("ai_task_runs") && tables.has("ai_agent_memories")
  const taskRows = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM ai_tasks
    GROUP BY status
  `).all() as Array<{ status: string; count: number }>
  const runCount = schemaReady ? (db.prepare("SELECT COUNT(*) AS count FROM ai_task_runs").get() as { count: number }).count : 0
  const memoryCount = schemaReady ? (db.prepare("SELECT COUNT(*) AS count FROM ai_agent_memories").get() as { count: number }).count : 0
  const provider = getConfiguredAgentProvider()
  const providerStatus = getAgentProviderStatus(provider)
  return {
    schemaReady,
    workerConfigured: Boolean(process.env.AGENT_WORKER_ID || process.env.AGENT_LLM_ENABLED || process.env.AGENT_LLM_PROVIDER),
    llmEnabled: provider !== "offline",
    provider,
    providerConfigured: providerStatus.configured,
    mode: providerStatus.mode,
    requirement: providerStatus.requirement,
    modelConfigured: firstConfigured(
      process.env.AGENT_LLM_MODEL,
      process.env.OPENAI_AGENT_MODEL,
      process.env.PAPERCLIP_AGENT_MODEL,
      process.env.HERMES_AGENT_MODEL,
      process.env.OPENCLAW_AGENT_MODEL
    ),
    openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    paperclipConfigured: firstConfigured(process.env.PAPERCLIP_AGENT_ENDPOINT, process.env.PAPERCLIP_API_URL, process.env.PAPERCLIP_AGENT_COMMAND),
    hermesConfigured: firstConfigured(process.env.HERMES_AGENT_ENDPOINT, process.env.HERMES_GATEWAY_URL, process.env.HERMES_AGENT_COMMAND),
    openclawConfigured: firstConfigured(process.env.OPENCLAW_AGENT_ENDPOINT, process.env.OPENCLAW_GATEWAY_URL, process.env.OPENCLAW_AGENT_COMMAND),
    taskCounts: Object.fromEntries(taskRows.map((row) => [row.status, row.count])),
    runCount,
    memoryCount
  }
}

export function claimNextAgentTask(input: {
  workerId: string
  allowedAgentCodes?: string[]
  maxAttempts?: number
}) {
  ensureAgentRuntimeSchema()
  const db = getDb()
  const maxAttempts = boundedInteger(input.maxAttempts, 3, 1, 10)
  const allowed = buildAllowedAgentClause(input.allowedAgentCodes)

  db.exec("BEGIN IMMEDIATE")
  try {
    const task = db.prepare(`
      SELECT t.id
      FROM ai_tasks t
      JOIN ai_agents a ON a.id = t.agent_id
      WHERE t.status = 'queued'
        AND a.is_active = 1
        AND COALESCE(t.attempts, 0) < ?
        ${allowed.clause}
      ORDER BY t.priority DESC, t.due_at ASC, t.created_at ASC
      LIMIT 1
    `).get(maxAttempts, ...allowed.values) as { id: number } | undefined

    if (!task) {
      db.exec("COMMIT")
      return null
    }

    db.prepare(`
      UPDATE ai_tasks
      SET
        status = 'running',
        locked_at = CURRENT_TIMESTAMP,
        locked_by = ?,
        attempts = COALESCE(attempts, 0) + 1,
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'queued'
    `).run(input.workerId, task.id)
    db.exec("COMMIT")
    return {
      task: readTask(task.id),
      context: buildAgentTaskContext(task.id)
    }
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

export function buildAgentTaskContext(taskId: number) {
  const db = getDb()
  const task = readTask(taskId)
  if (!task) return null
  const company = task.company_id
    ? db.prepare(`
        SELECT
          c.id,
          c.name,
          c.segment,
          c.region,
          c.city,
          c.address,
          c.dgis_url,
          c.drive_minutes_from_production,
          c.website,
          c.lead_status,
          c.lead_score,
          c.fit_reason,
          c.notes,
          e.inn,
          e.legal_name,
          e.office_people_min,
          e.office_people_max,
          e.office_people_confidence,
          e.recommended_portions
        FROM companies c
        LEFT JOIN company_enrichment_profiles e ON e.company_id = c.id
        WHERE c.id = ?
      `).get(task.company_id)
    : null
  const contacts = task.company_id
    ? db.prepare(`
        SELECT role, email, phone, preferred_channel, is_public, consent_basis, notes
        FROM contacts
        WHERE company_id = ?
        ORDER BY id DESC
        LIMIT 6
      `).all(task.company_id)
    : []
  const orders = task.company_id
    ? db.prepare(`
        SELECT id, status, channel, delivery_date, payment_date, total_amount, manager_comment, created_at
        FROM orders
        WHERE company_id = ?
        ORDER BY created_at DESC
        LIMIT 8
      `).all(task.company_id)
    : []
  const recentItems = task.company_id
    ? db.prepare(`
        SELECT p.id AS product_id, p.name, p.category, SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        WHERE o.company_id = ?
        GROUP BY p.id, p.name, p.category
        ORDER BY quantity DESC, revenue DESC
        LIMIT 8
      `).all(task.company_id)
    : []
  const lowStock = db.prepare(`
    SELECT
      p.id AS product_id,
      p.name,
      p.category,
      ip.on_hand_quantity,
      ip.reserved_quantity,
      ip.reorder_point,
      ip.target_stock,
      CASE WHEN ip.on_hand_quantity > ip.reserved_quantity THEN ip.on_hand_quantity - ip.reserved_quantity ELSE 0 END AS available_quantity
    FROM inventory_positions ip
    JOIN products p ON p.id = ip.product_id
    WHERE p.is_active = 1
      AND CASE WHEN ip.on_hand_quantity > ip.reserved_quantity THEN ip.on_hand_quantity - ip.reserved_quantity ELSE 0 END <= ip.reorder_point
    ORDER BY available_quantity ASC, ip.reorder_point DESC, p.name
    LIMIT 8
  `).all()
  const recentMemories = task.company_id
    ? db.prepare(`
        SELECT memory_type, memory_key, content_json, confidence, updated_at
        FROM ai_agent_memories
        WHERE agent_code = ? AND (company_id = ? OR company_id IS NULL)
        ORDER BY updated_at DESC
        LIMIT 8
      `).all(task.agent_code, task.company_id)
    : []

  return {
    task,
    company,
    contacts,
    orders,
    recent_order_items: recentItems,
    low_stock: lowStock,
    recent_memories: recentMemories,
    guardrails: [
      "Не менять заказ, сделку, цену, контакт или остаток напрямую без отдельного manager approval.",
      "Каталог products является единой точкой истины для SKU и цен.",
      "Заказ ниже 7000 руб. должен оставаться blocked_minimum.",
      "Контакты использовать только как публичные B2B-каналы.",
      "СПб и Ленинградская область являются текущим регионом работы."
    ]
  }
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? null)
}

function writeMemoryUpdates(task: AgentTaskRow, result: AgentResult) {
  if (!result.memory_updates.length) return
  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO ai_agent_memories(
      agent_code, company_id, memory_type, memory_key, content_json, source_task_id, confidence, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(agent_code, company_id, memory_type, memory_key) DO UPDATE SET
      content_json = excluded.content_json,
      source_task_id = excluded.source_task_id,
      confidence = excluded.confidence,
      updated_at = CURRENT_TIMESTAMP
  `)
  for (const memory of result.memory_updates.slice(0, 8)) {
    upsert.run(
      task.agent_code,
      task.company_id,
      memory.memory_type.slice(0, 80),
      memory.memory_key.slice(0, 160),
      stringifyJson({ content: memory.content }),
      task.id,
      memory.confidence
    )
  }
}

export function completeAgentTask(input: {
  taskId: number
  workerId: string
  mode: string
  model?: string | null
  startedAt?: string | null
  latencyMs?: number | null
  input?: unknown
  result: AgentResult
}) {
  ensureAgentRuntimeSchema()
  const db = getDb()
  const task = readTask(input.taskId)
  if (!task) throw new Error("AI task not found")
  const status = input.result.next_status === "done" ? "done" : "needs_review"
  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare(`
      INSERT INTO ai_task_runs(
        task_id, agent_code, worker_id, mode, model, status, input_json, output_json, latency_ms, started_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
    `).run(
      task.id,
      task.agent_code,
      input.workerId,
      input.mode,
      input.model ?? null,
      status,
      stringifyJson(input.input ?? {}),
      stringifyJson(input.result),
      boundedInteger(input.latencyMs, 0, 0, 3_600_000),
      input.startedAt ?? null
    )
    db.prepare(`
      UPDATE ai_tasks
      SET
        status = ?,
        result_summary = ?,
        result_json = ?,
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, input.result.summary, stringifyJson(input.result), task.id)
    writeMemoryUpdates(task, input.result)
    db.exec("COMMIT")
    return { ok: true, task: readTask(task.id) }
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

export function failAgentTask(input: {
  taskId: number
  workerId: string
  mode?: string | null
  model?: string | null
  error: string
  input?: unknown
  requeue?: boolean | null
}) {
  ensureAgentRuntimeSchema()
  const db = getDb()
  const task = readTask(input.taskId)
  if (!task) throw new Error("AI task not found")
  const status = input.requeue ? "queued" : "failed"
  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare(`
      INSERT INTO ai_task_runs(task_id, agent_code, worker_id, mode, model, status, input_json, error, completed_at)
      VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
    `).run(
      task.id,
      task.agent_code,
      input.workerId,
      input.mode ?? "worker",
      input.model ?? null,
      stringifyJson(input.input ?? {}),
      input.error.slice(0, 2000)
    )
    db.prepare(`
      UPDATE ai_tasks
      SET
        status = ?,
        locked_at = NULL,
        locked_by = NULL,
        last_error = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, input.error.slice(0, 2000), task.id)
    db.exec("COMMIT")
    return { ok: true, task: readTask(task.id) }
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}
