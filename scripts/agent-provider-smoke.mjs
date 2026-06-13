import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
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

const tempDir = mkdtempSync(join(tmpdir(), "lunch-up-agent-provider-smoke-"))
const tempDbPath = join(tempDir, "lunch_up_crm.sqlite")
copyFileSync(sourceDbPath, tempDbPath)
for (const suffix of ["-wal", "-shm"]) {
  if (existsSync(`${sourceDbPath}${suffix}`)) {
    copyFileSync(`${sourceDbPath}${suffix}`, `${tempDbPath}${suffix}`)
  }
}
process.env.LUNCH_UP_CRM_DB_PATH = tempDbPath

const server = createServer((request, response) => {
  let body = ""
  request.on("data", (chunk) => {
    body += chunk.toString()
  })
  request.on("end", () => {
    const provider = new URL(request.url ?? "/", "http://127.0.0.1").pathname.replace("/", "") || "unknown"
    const payload = JSON.parse(body || "{}")
    const task = payload?.context?.task
    response.writeHead(200, { "content-type": "application/json" })
    response.end(
      JSON.stringify({
        result: {
          summary: `${provider} provider smoke processed task #${task?.id ?? "unknown"}.`,
          confidence: "medium",
          risk_level: "medium",
          recommended_actions: [
            {
              type: "provider_smoke",
              title: `Проверить результат ${provider} provider`,
              owner: "sales_manager",
              due_at: null,
              requires_manager_approval: true
            }
          ],
          customer_message_draft: null,
          manager_note: "Smoke endpoint вернул структурированный JSON; рабочая CRM база не изменялась.",
          evidence_sources: [
            {
              label: `${provider} smoke endpoint`,
              source_type: "provider_smoke",
              url: null,
              note: `Received schema ${payload?.schema_version ?? "unknown"} for task #${task?.id ?? "unknown"}.`
            },
            {
              label: "Temporary SQLite copy",
              source_type: "sqlite_temp",
              url: null,
              note: "Smoke test uses LUNCH_UP_CRM_DB_PATH pointing to a temporary database copy."
            }
          ],
          inventory_watchlist: [],
          memory_updates: [
            {
              memory_type: "provider_smoke",
              memory_key: provider,
              content: `Provider ${provider} accepted lunch-up-crm-agent-runtime.v1 payload.`,
              confidence: "medium"
            }
          ],
          next_status: "needs_review"
        }
      })
    )
  })
})

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const address = server.address()
const port = typeof address === "object" && address ? address.port : null
if (!port) throw new Error("Failed to start provider smoke server")

const baseEnv = {
  ...process.env,
  LUNCH_UP_CRM_DB_PATH: tempDbPath,
  AGENT_LLM_ENABLED: "1",
  AGENT_LLM_TIMEOUT_MS: "15000"
}

function runNode(scriptPath, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`${scriptPath} exited ${code}:\n${stdout}\n${stderr}`))
      }
    })
  })
}

await runNode(join(root, "scripts", "migrate-agent-runtime.mjs"), [], baseEnv)

const providers = [
  { provider: "paperclip", envKey: "PAPERCLIP_AGENT_ENDPOINT" },
  { provider: "hermes", envKey: "HERMES_AGENT_ENDPOINT" },
  { provider: "openclaw", envKey: "OPENCLAW_AGENT_ENDPOINT" }
]
const results = []

try {
  for (const item of providers) {
    let smokeTaskId = null
    {
      const { db } = openAgentDb(root)
      try {
        const agent = db.prepare("SELECT id FROM ai_agents WHERE code = 'customer_order_concierge'").get()
        if (!agent) throw new Error("Missing customer_order_concierge agent")
        smokeTaskId = Number(
          db.prepare(`
            INSERT INTO ai_tasks(agent_id, task_type, priority, prompt, due_at)
            VALUES (?, ?, 9999, ?, CURRENT_TIMESTAMP)
          `).run(agent.id, `agent_provider_smoke_${item.provider}`, `Smoke: проверить ${item.provider} provider adapter.`,).lastInsertRowid
        )
      } finally {
        db.close()
      }
    }

    const env = {
      ...baseEnv,
      AGENT_LLM_PROVIDER: item.provider,
      AGENT_WORKER_ID: `agent-provider-smoke-${item.provider}`,
      [item.envKey]: `http://127.0.0.1:${port}/${item.provider}`
    }
    await runNode(join(root, "scripts", "agent-worker.mjs"), ["--once", "--limit=1", `--provider=${item.provider}`], env)

    const { db } = openAgentDb(root)
    try {
      const task = db.prepare("SELECT status, result_summary, result_json FROM ai_tasks WHERE id = ?").get(smokeTaskId)
      if (!task) throw new Error(`${item.provider} smoke task was not found`)
      if (task.status !== "needs_review" && task.status !== "done") {
        throw new Error(`Expected completed ${item.provider} smoke task, got ${task.status}`)
      }
      if (!task.result_summary || !task.result_summary.includes(item.provider)) {
        throw new Error(`${item.provider} smoke task summary does not include provider marker`)
      }
      const run = db.prepare("SELECT mode, model FROM ai_task_runs WHERE task_id = ? ORDER BY id DESC LIMIT 1").get(smokeTaskId)
      if (run?.mode !== `${item.provider}_http`) {
        throw new Error(`Expected ${item.provider}_http run mode, got ${run?.mode}`)
      }
      const result = JSON.parse(task.result_json)
      if (!Array.isArray(result.recommended_actions) || result.recommended_actions.length === 0) {
        throw new Error(`${item.provider} smoke result is missing recommended actions`)
      }
      if (!Array.isArray(result.evidence_sources) || result.evidence_sources.length === 0) {
        throw new Error(`${item.provider} smoke result is missing evidence_sources`)
      }
      results.push({ provider: item.provider, task_id: smokeTaskId, mode: run.mode })
    } finally {
      db.close()
    }
  }
} finally {
  server.close()
}

console.log(JSON.stringify({ ok: true, tempDbPath, results }, null, 2))
