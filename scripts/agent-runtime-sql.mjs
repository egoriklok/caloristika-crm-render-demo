import { DatabaseSync } from "node:sqlite"
import { join } from "node:path"

export const agentResultSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "confidence",
    "risk_level",
    "recommended_actions",
    "customer_message_draft",
    "manager_note",
    "evidence_sources",
    "inventory_watchlist",
    "memory_updates",
    "next_status"
  ],
  properties: {
    summary: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    recommended_actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "owner", "due_at", "requires_manager_approval"],
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          owner: { type: "string" },
          due_at: { type: ["string", "null"] },
          requires_manager_approval: { type: "boolean" }
        }
      }
    },
    customer_message_draft: { type: ["string", "null"] },
    manager_note: { type: "string" },
    evidence_sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "source_type", "url", "note"],
        properties: {
          label: { type: "string" },
          source_type: { type: "string" },
          url: { type: ["string", "null"] },
          note: { type: "string" }
        }
      }
    },
    inventory_watchlist: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["product_id", "name", "available_quantity", "recommended_target"],
        properties: {
          product_id: { type: "number" },
          name: { type: "string" },
          available_quantity: { type: "number" },
          recommended_target: { type: "number" }
        }
      }
    },
    memory_updates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["memory_type", "memory_key", "content", "confidence"],
        properties: {
          memory_type: { type: "string" },
          memory_key: { type: "string" },
          content: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] }
        }
      }
    },
    next_status: { type: "string", enum: ["needs_review", "done"] }
  }
}

export function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function getAgentDbPath(root) {
  return process.env.LUNCH_UP_CRM_DB_PATH?.trim() || join(root, "data", "lunch_up_crm.sqlite")
}

export function openAgentDb(root) {
  const dbPath = getAgentDbPath(root)
  const db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = ${boundedInteger(process.env.LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS, 5000, 100, 60000)};
    PRAGMA temp_store = MEMORY;
  `)
  return { db, dbPath }
}

function tableColumns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name))
}

function addColumnIfMissing(db, table, column, definition) {
  if (tableColumns(db, table).has(column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

function ensureAgent(db, code, name, mission, triggerRule) {
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

export function ensureAgentRuntimeSchema(db) {
  const changedColumns = []
  for (const [column, definition] of [
    ["locked_at", "TEXT"],
    ["locked_by", "TEXT"],
    ["attempts", "INTEGER NOT NULL DEFAULT 0"],
    ["last_error", "TEXT"],
    ["result_json", "TEXT"],
    ["completed_at", "TEXT"]
  ]) {
    if (addColumnIfMissing(db, "ai_tasks", column, definition)) changedColumns.push(`ai_tasks.${column}`)
  }

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
    db,
    "customer_order_concierge",
    "AI Customer Order Concierge",
    "Ведет заказ со стороны клиента: проверяет профиль, дату, состав корзины, статус и следующий шаг.",
    "Клиент вошел в web-каталог, оформил заказ или запросил сопровождение"
  )
  ensureAgent(
    db,
    "inventory_replenishment_agent",
    "AI Inventory Replenishment Agent",
    "Следит за остатками, резервами и точками пополнения после клиентских заказов.",
    "SKU ушел ниже точки пополнения или заказ резко увеличил резерв"
  )
  ensureAgent(
    db,
    "sales_demand_analyst",
    "AI Sales Demand Analyst",
    "Анализирует продажи по SKU, клиентам и повторным заказам для поддержания остатков.",
    "Появился новый заказ, повторный заказ или накопилась недельная статистика"
  )

  return {
    changedColumns,
    tables: ["ai_task_runs", "ai_agent_memories"],
    indexes: ["idx_ai_tasks_worker_claim", "idx_ai_task_runs_task", "idx_ai_agent_memories_lookup"]
  }
}

export function listAgentTasks(db, { status = null, limit = 20 } = {}) {
  const boundedLimit = boundedInteger(limit, 20, 1, 200)
  if (status) {
    return db.prepare(`
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
    `).all(status, boundedLimit)
  }

  return db.prepare(`
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
  `).all(boundedLimit)
}

export function readTask(db, taskId) {
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
  `).get(taskId)
}

export function buildTaskContext(db, taskId) {
  const task = readTask(db, taskId)
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
  const recentOrderItems = task.company_id
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
    recent_order_items: recentOrderItems,
    low_stock: lowStock,
    recent_memories: recentMemories,
    guardrails: [
      "Do not mutate orders, deals, contacts, prices or inventory directly without manager approval.",
      "products is the single source of truth for SKU names and prices.",
      "Orders below 7000 RUB must stay blocked_minimum.",
      "Use only public B2B contact channels.",
      "Current commercial scope is Saint Petersburg and Leningrad Oblast."
    ]
  }
}

function allowedClause(agentCodes) {
  const codes = (agentCodes ?? []).map((code) => String(code).trim()).filter(Boolean)
  if (codes.length === 0) return { clause: "", values: [] }
  return { clause: `AND a.code IN (${codes.map(() => "?").join(", ")})`, values: codes }
}

export function claimNextTask(db, { workerId, allowedAgentCodes = [], maxAttempts = 3 } = {}) {
  const max = boundedInteger(maxAttempts, 3, 1, 10)
  const allowed = allowedClause(allowedAgentCodes)
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
    `).get(max, ...allowed.values)
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
    `).run(workerId, task.id)
    db.exec("COMMIT")
    return {
      task: readTask(db, task.id),
      context: buildTaskContext(db, task.id)
    }
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

function stringifyJson(value) {
  return JSON.stringify(value ?? null)
}

export function normalizeAgentResult(value) {
  const fallback = {
    summary: "Agent result is missing or invalid.",
    confidence: "low",
    risk_level: "medium",
    recommended_actions: [],
    customer_message_draft: null,
    manager_note: "Проверьте задачу вручную: агент вернул неполный результат.",
    evidence_sources: [],
    inventory_watchlist: [],
    memory_updates: [],
    next_status: "needs_review"
  }
  if (!value || typeof value !== "object") return fallback
  const result = { ...fallback, ...value }
  result.summary = String(result.summary ?? fallback.summary).slice(0, 2000)
  result.confidence = ["low", "medium", "high"].includes(result.confidence) ? result.confidence : "low"
  result.risk_level = ["low", "medium", "high"].includes(result.risk_level) ? result.risk_level : "medium"
  result.customer_message_draft =
    typeof result.customer_message_draft === "string" ? result.customer_message_draft.slice(0, 2000) : null
  result.manager_note = String(result.manager_note ?? fallback.manager_note).slice(0, 2000)
  result.next_status = result.next_status === "done" ? "done" : "needs_review"
  result.evidence_sources = Array.isArray(result.evidence_sources)
    ? result.evidence_sources.slice(0, 12).map((source) => ({
        label: String(source?.label ?? "CRM context").slice(0, 160),
        source_type: String(source?.source_type ?? "crm").slice(0, 80),
        url: typeof source?.url === "string" && source.url.trim() ? source.url.slice(0, 500) : null,
        note: String(source?.note ?? "Used as evidence for agent recommendation.").slice(0, 500)
      }))
    : []
  result.recommended_actions = Array.isArray(result.recommended_actions)
    ? result.recommended_actions.slice(0, 8).map((action) => ({
        type: String(action?.type ?? "manager_review").slice(0, 80),
        title: String(action?.title ?? "Проверить рекомендацию агента").slice(0, 240),
        owner: String(action?.owner ?? "manager").slice(0, 80),
        due_at: typeof action?.due_at === "string" ? action.due_at.slice(0, 40) : null,
        requires_manager_approval: action?.requires_manager_approval !== false
      }))
    : []
  result.inventory_watchlist = Array.isArray(result.inventory_watchlist)
    ? result.inventory_watchlist.slice(0, 8).map((item) => ({
        product_id: Number(item?.product_id ?? 0),
        name: String(item?.name ?? "").slice(0, 180),
        available_quantity: Number(item?.available_quantity ?? 0),
        recommended_target: Number(item?.recommended_target ?? 0)
      }))
    : []
  result.memory_updates = Array.isArray(result.memory_updates)
    ? result.memory_updates.slice(0, 8).map((memory) => ({
        memory_type: String(memory?.memory_type ?? "task_observation").slice(0, 80),
        memory_key: String(memory?.memory_key ?? "general").slice(0, 160),
        content: String(memory?.content ?? "").slice(0, 2000),
        confidence: ["low", "medium", "high"].includes(memory?.confidence) ? memory.confidence : "medium"
      }))
    : []
  return result
}

function writeMemoryUpdates(db, task, result) {
  if (!result.memory_updates.length) return
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
  for (const memory of result.memory_updates) {
    upsert.run(
      task.agent_code,
      task.company_id,
      memory.memory_type,
      memory.memory_key,
      stringifyJson({ content: memory.content }),
      task.id,
      memory.confidence
    )
  }
}

export function completeTask(db, { taskId, workerId, mode, model = null, input = {}, result, startedAt = null, latencyMs = 0 }) {
  const task = readTask(db, taskId)
  if (!task) throw new Error(`AI task ${taskId} not found`)
  const normalized = normalizeAgentResult(result)
  const status = normalized.next_status === "done" ? "done" : "needs_review"
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
      workerId,
      mode,
      model,
      status,
      stringifyJson(input),
      stringifyJson(normalized),
      boundedInteger(latencyMs, 0, 0, 3_600_000),
      startedAt
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
    `).run(status, normalized.summary, stringifyJson(normalized), task.id)
    writeMemoryUpdates(db, task, normalized)
    db.exec("COMMIT")
    return { task: readTask(db, task.id), result: normalized }
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

export function failTask(db, { taskId, workerId, mode = "worker", model = null, input = {}, error, requeue = false }) {
  const task = readTask(db, taskId)
  if (!task) throw new Error(`AI task ${taskId} not found`)
  const message = String(error?.message ?? error ?? "Agent task failed").slice(0, 2000)
  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare(`
      INSERT INTO ai_task_runs(task_id, agent_code, worker_id, mode, model, status, input_json, error, completed_at)
      VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
    `).run(task.id, task.agent_code, workerId, mode, model, stringifyJson(input), message)
    db.prepare(`
      UPDATE ai_tasks
      SET
        status = ?,
        locked_at = NULL,
        locked_by = NULL,
        last_error = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requeue ? "queued" : "failed", message, task.id)
    db.exec("COMMIT")
    return { task: readTask(db, task.id), error: message }
  } catch (nextError) {
    db.exec("ROLLBACK")
    throw nextError
  }
}
