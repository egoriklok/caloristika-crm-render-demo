import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ensureAgentRuntimeSchema, listAgentTasks, openAgentDb } from "./agent-runtime-sql.mjs"
import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
loadLocalEnv(root)

const { db, dbPath } = openAgentDb(root)
try {
  const migration = ensureAgentRuntimeSchema(db)
  const taskCounts = {
    queued: listAgentTasks(db, { status: "queued", limit: 200 }).length,
    running: listAgentTasks(db, { status: "running", limit: 200 }).length,
    needs_review: listAgentTasks(db, { status: "needs_review", limit: 200 }).length,
    failed: listAgentTasks(db, { status: "failed", limit: 200 }).length
  }
  const agents = db.prepare(`
    SELECT code, name, is_active
    FROM ai_agents
    ORDER BY code
  `).all()
  console.log(JSON.stringify({ ok: true, dbPath, migration, taskCounts, agents }, null, 2))
} finally {
  db.close()
}
