import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { openAgentDb } from "./agent-runtime-sql.mjs"
import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
loadLocalEnv(root)

const sourceDbPath = process.env.LUNCH_UP_CRM_DB_PATH?.trim() || join(root, "data", "lunch_up_crm.sqlite")
if (!existsSync(sourceDbPath)) {
  throw new Error(`Missing SQLite database: ${sourceDbPath}`)
}

const tempDir = mkdtempSync(join(tmpdir(), "lunch-up-agent-smoke-"))
const tempDbPath = join(tempDir, "lunch_up_crm.sqlite")
copyFileSync(sourceDbPath, tempDbPath)
for (const suffix of ["-wal", "-shm"]) {
  if (existsSync(`${sourceDbPath}${suffix}`)) {
    copyFileSync(`${sourceDbPath}${suffix}`, `${tempDbPath}${suffix}`)
  }
}
process.env.LUNCH_UP_CRM_DB_PATH = tempDbPath

const env = {
  ...process.env,
  LUNCH_UP_CRM_DB_PATH: tempDbPath,
  AGENT_LLM_ENABLED: "0",
  AGENT_WORKER_ID: "agent-smoke-worker"
}

let smokeTaskId = null
{
  const { db } = openAgentDb(root)
  try {
    const agent = db.prepare("SELECT id FROM ai_agents WHERE code = 'customer_order_concierge'").get()
    if (!agent) throw new Error("Missing customer_order_concierge agent")
    smokeTaskId = Number(
      db.prepare(`
        INSERT INTO ai_tasks(agent_id, task_type, priority, prompt, due_at)
        VALUES (?, 'agent_worker_smoke', 99, 'Smoke: проверить offline worker, structured result и trace.', CURRENT_TIMESTAMP)
      `).run(agent.id).lastInsertRowid
    )
  } finally {
    db.close()
  }
}

const migration = spawnSync(process.execPath, [join(root, "scripts", "migrate-agent-runtime.mjs")], {
  cwd: root,
  env,
  encoding: "utf-8"
})
if (migration.status !== 0) {
  throw new Error(`agent runtime migration smoke failed:\n${migration.stdout}\n${migration.stderr}`)
}

const worker = spawnSync(process.execPath, [join(root, "scripts", "agent-worker.mjs"), "--once", "--limit=1", "--no-llm"], {
  cwd: root,
  env,
  encoding: "utf-8"
})
if (worker.status !== 0) {
  throw new Error(`agent worker smoke failed:\n${worker.stdout}\n${worker.stderr}`)
}

{
  const { db } = openAgentDb(root)
  try {
    const task = db.prepare(`
      SELECT status, result_summary, result_json, completed_at
      FROM ai_tasks
      WHERE id = ?
    `).get(smokeTaskId)
    if (!task) throw new Error("Smoke task was not found")
    if (task.status !== "needs_review" && task.status !== "done") {
      throw new Error(`Expected completed smoke task, got ${task.status}`)
    }
    if (!task.result_summary || !task.result_json || !task.completed_at) {
      throw new Error("Smoke task is missing result summary/json/completed_at")
    }
    const result = JSON.parse(task.result_json)
    if (!Array.isArray(result.recommended_actions) || result.recommended_actions.length === 0) {
      throw new Error("Smoke task result is missing recommended actions")
    }
    if (!Array.isArray(result.evidence_sources) || result.evidence_sources.length === 0) {
      throw new Error("Smoke task result is missing evidence_sources")
    }
    const run = db.prepare("SELECT COUNT(*) AS count FROM ai_task_runs WHERE task_id = ?").get(smokeTaskId)
    if (run.count < 1) throw new Error("Smoke task run trace was not recorded")
  } finally {
    db.close()
  }
}

console.log(JSON.stringify({ ok: true, tempDbPath, smokeTaskId }, null, 2))
