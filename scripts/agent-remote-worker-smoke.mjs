import { spawn } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  claimNextTask,
  completeTask,
  ensureAgentRuntimeSchema,
  failTask,
  listAgentTasks,
  openAgentDb
} from "./agent-runtime-sql.mjs"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const sourceDbPath = join(root, "data", "lunch_up_crm.sqlite")
const accessKey = "remote-worker-smoke-crm-key"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function copyTempDb() {
  if (!existsSync(sourceDbPath)) {
    throw new Error("Source SQLite database is missing. Run npm run db:init first.")
  }
  const dir = mkdtempSync(join(tmpdir(), "lunch-up-agent-remote-worker-smoke-"))
  const target = join(dir, basename(sourceDbPath))
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${sourceDbPath}${suffix}`
    if (existsSync(source)) copyFileSync(source, `${target}${suffix}`)
  }
  return target
}

async function request(url, init = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, payload }
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    let body = ""
    request.on("data", (chunk) => {
      body += chunk.toString()
    })
    request.on("error", reject)
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
  })
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" })
  response.end(JSON.stringify(payload))
}

function hasAccess(request) {
  const headerKey = request.headers["x-crm-access-key"]
  const authorization = String(request.headers.authorization ?? "")
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  return headerKey === accessKey || bearer === accessKey
}

function runNode(scriptPath, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
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
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${scriptPath} exited ${code}:\n${stdout}\n${stderr}`))
    })
  })
}

function insertSmokeTask(tempDbPath) {
  process.env.LUNCH_UP_CRM_DB_PATH = tempDbPath
  const { db } = openAgentDb(root)
  try {
    ensureAgentRuntimeSchema(db)
    const agent = db.prepare("SELECT id FROM ai_agents WHERE code = 'customer_order_concierge'").get()
    if (!agent) throw new Error("Missing customer_order_concierge agent")
    return Number(
      db.prepare(`
        INSERT INTO ai_tasks(agent_id, task_type, priority, prompt, due_at)
        VALUES (?, 'remote_worker_smoke', 9999, 'Remote worker should claim this through protected Render-style API.', CURRENT_TIMESTAMP)
      `).run(agent.id).lastInsertRowid
    )
  } finally {
    db.close()
  }
}

const tempDbPath = copyTempDb()
const smokeTaskId = insertSmokeTask(tempDbPath)
const serverEnv = {
  ...process.env,
  LUNCH_UP_CRM_DB_PATH: tempDbPath,
  CRM_ACCESS_KEY: accessKey,
  HOST: "127.0.0.1"
}

process.env.LUNCH_UP_CRM_DB_PATH = tempDbPath
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true })
      return
    }
    if (url.pathname !== "/api/agent/tasks") {
      sendJson(response, 404, { ok: false, error: "not found" })
      return
    }
    if (!hasAccess(request)) {
      sendJson(response, 401, { ok: false, error: "CRM access key is required" })
      return
    }
    const { db } = openAgentDb(root)
    try {
      ensureAgentRuntimeSchema(db)
      if (request.method === "GET") {
        sendJson(response, 200, {
          ok: true,
          tasks: listAgentTasks(db, {
            status: url.searchParams.get("status"),
            limit: Number(url.searchParams.get("limit") ?? 50)
          })
        })
        return
      }
      if (request.method === "PATCH") {
        const body = await readRequestJson(request)
        const workerId = body.worker_id?.trim() || "remote-worker-smoke-api"
        if (body.action === "claim_next") {
          sendJson(response, 200, {
            ok: true,
            claim: claimNextTask(db, {
              workerId,
              allowedAgentCodes: body.allowed_agent_codes,
              maxAttempts: body.max_attempts
            })
          })
          return
        }
        if (body.action === "complete") {
          sendJson(
            response,
            200,
            completeTask(db, {
              taskId: body.task_id,
              workerId,
              mode: body.mode ?? "api",
              model: body.model,
              startedAt: body.started_at,
              latencyMs: body.latency_ms,
              input: body.input,
              result: body.result
            })
          )
          return
        }
        if (body.action === "fail") {
          sendJson(
            response,
            200,
            failTask(db, {
              taskId: body.task_id,
              workerId,
              mode: body.mode,
              model: body.model,
              input: body.input,
              error: body.error,
              requeue: body.requeue
            })
          )
          return
        }
      }
      sendJson(response, 400, { ok: false, error: "Unsupported action" })
    } finally {
      db.close()
    }
  } catch (error) {
    sendJson(response, 500, { ok: false, error: String(error?.message ?? error) })
  }
})

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const address = server.address()
const port = typeof address === "object" && address?.port ? String(address.port) : null
if (!port) throw new Error("Could not start temporary remote worker API")
const baseUrl = `http://127.0.0.1:${port}`
serverEnv.PUBLIC_BASE_URL = baseUrl
serverEnv.PORT = port

try {
  const unauthorized = await request(`${baseUrl}/api/agent/tasks?status=queued&limit=1`)
  assert(unauthorized.response.status === 401, `Agent tasks API without CRM key must be blocked, got ${unauthorized.response.status}`)

  const authorized = await request(`${baseUrl}/api/agent/tasks?status=queued&limit=1`, {
    headers: { "x-crm-access-key": accessKey }
  })
  assert(authorized.response.ok, `Agent tasks API with CRM key must be allowed, got ${authorized.response.status}`)
  assert(authorized.payload?.ok === true, "Authorized agent tasks API response must be ok=true")

  await runNode(
    join(root, "scripts", "agent-remote-worker.mjs"),
    ["--once", "--limit=1", "--no-llm", `--crm-url=${baseUrl}`, "--worker-id=remote-worker-smoke"],
    {
      ...serverEnv,
      REMOTE_CRM_BASE_URL: baseUrl,
      REMOTE_CRM_ACCESS_KEY: accessKey,
      AGENT_LLM_PROVIDER: "offline"
    }
  )

  const { db } = openAgentDb(root)
  try {
    const task = db.prepare("SELECT status, locked_by, result_summary, result_json FROM ai_tasks WHERE id = ?").get(smokeTaskId)
    assert(task, "Smoke task must exist after remote worker run")
    assert(task.status === "needs_review" || task.status === "done", `Expected completed smoke task, got ${task.status}`)
    assert(String(task.result_summary ?? "").includes("manager-reviewable"), "Smoke task summary must come from remote worker")
    const run = db.prepare("SELECT mode, worker_id FROM ai_task_runs WHERE task_id = ? ORDER BY id DESC LIMIT 1").get(smokeTaskId)
    assert(run?.mode === "offline", `Expected offline run mode, got ${run?.mode}`)
    assert(run?.worker_id === "remote-worker-smoke", `Expected remote-worker-smoke worker id, got ${run?.worker_id}`)
  } finally {
    db.close()
  }

  console.log(JSON.stringify({ ok: true, tempDbPath, baseUrl, smokeTaskId }, null, 2))
} catch (error) {
  console.error("Remote worker smoke failed")
  throw error
} finally {
  await new Promise((resolve) => server.close(resolve))
}
