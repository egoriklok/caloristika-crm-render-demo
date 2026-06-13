import { spawn } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const sourceDbPath = join(root, "data", "lunch_up_crm.sqlite")
const accessKey = "telegram-webhook-post-smoke-crm-key"
const webhookSecret = "telegram-webhook-post-smoke-secret"

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === "object" && address?.port) resolve(String(address.port))
        else reject(new Error("Could not allocate a free local port"))
      })
    })
  })
}

function copyTempDb() {
  if (!existsSync(sourceDbPath)) {
    throw new Error("Source SQLite database is missing. Run npm run db:init first.")
  }
  const dir = mkdtempSync(join(tmpdir(), "lunch-up-telegram-webhook-post-smoke-"))
  const target = join(dir, basename(sourceDbPath))
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${sourceDbPath}${suffix}`
    if (existsSync(source)) copyFileSync(source, `${target}${suffix}`)
  }
  return target
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stopChild(child) {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000)
  ])
  if (child.exitCode === null) {
    child.kill("SIGKILL")
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(5000)
    ])
  }
  await delay(500)
}

async function waitForReady(baseUrl, child) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 70_000) {
    if (child.exitCode !== null) {
      throw new Error(`Temporary CRM server exited with code ${child.exitCode}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/telegram/webhook`)
      if (response.status === 401 || response.ok) return
    } catch {
      // Server is still starting.
    }
    await delay(750)
  }
  throw new Error("Temporary CRM server did not become ready in time")
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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function scalar(dbPath, sql, parameters = []) {
  const db = new DatabaseSync(dbPath)
  try {
    const row = db.prepare(sql).get(...parameters)
    return Number(row?.value ?? row?.count ?? 0)
  } finally {
    db.close()
  }
}

function buildUpdate(updateId, messageId, chatId, text, nameSuffix) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      text,
      chat: {
        id: chatId,
        type: "private",
        first_name: "Webhook",
        last_name: `Post Smoke ${nameSuffix}`,
        username: `webhook_post_smoke_${nameSuffix.toLowerCase()}`
      },
      from: {
        id: chatId,
        first_name: "Webhook",
        last_name: `Post Smoke ${nameSuffix}`,
        username: `webhook_post_smoke_${nameSuffix.toLowerCase()}`
      }
    }
  }
}

async function postTelegramUpdate(baseUrl, update, secret = webhookSecret) {
  return request(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret
    },
    body: JSON.stringify(update)
  })
}

const tempDbPath = copyTempDb()
const beforeEvents = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM telegram_events")
const beforeCustomers = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM bot_customers WHERE display_name LIKE 'Webhook Post Smoke%'")
const beforeTasks = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM ai_tasks WHERE task_type = 'telegram_update'")
const beforeOrders = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM orders")
const port = await freePort()
const baseUrl = `http://127.0.0.1:${port}`
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const useProductionBuild = process.env.TELEGRAM_WEBHOOK_POST_SMOKE_NEXT_MODE === "start" && existsSync(join(root, ".next", "BUILD_ID"))
const args = useProductionBuild
  ? [nextBin, "start", "-H", "127.0.0.1", "-p", port]
  : [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", port]
const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    LUNCH_UP_CRM_DB_PATH: tempDbPath,
    CRM_ACCESS_KEY: accessKey,
    PUBLIC_BASE_URL: baseUrl,
    TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_MANAGER_CHAT_ID: "",
    PORT: port,
    HOST: "127.0.0.1"
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
})

let output = ""
child.stdout.on("data", (chunk) => {
  output += chunk.toString()
})
child.stderr.on("data", (chunk) => {
  output += chunk.toString()
})

try {
  await waitForReady(baseUrl, child)

  const orderUpdate = buildUpdate(910001, 1, 910001, "/order", "Order")
  const withoutSecret = await request(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(orderUpdate)
  })
  assert(withoutSecret.response.status === 401, `Webhook POST without Telegram secret must be blocked, got ${withoutSecret.response.status}`)

  const withWrongSecret = await postTelegramUpdate(baseUrl, orderUpdate, "wrong-secret")
  assert(withWrongSecret.response.status === 401, `Webhook POST with wrong Telegram secret must be blocked, got ${withWrongSecret.response.status}`)

  const acceptedCases = [
    { update: orderUpdate, expectedIntent: "catalog", responseKey: "miniapp_entry_message" },
    { update: buildUpdate(910005, 5, 910005, "/cart", "Cart"), expectedIntent: "cart", responseKey: "miniapp_entry_message" },
    { update: buildUpdate(910006, 6, 910006, "/cabinet", "Cabinet"), expectedIntent: "cabinet", responseKey: "miniapp_entry_message" },
    { update: buildUpdate(910002, 2, 910002, "/orders", "Orders"), expectedIntent: "orders", responseKey: "miniapp_entry_message" },
    { update: buildUpdate(910003, 3, 910003, "/help", "Help"), expectedIntent: null, responseKey: "service_message" },
    { update: buildUpdate(910004, 4, 910004, "/whoami", "Whoami"), expectedIntent: null, responseKey: "service_message" }
  ]

  for (const item of acceptedCases) {
    const result = await postTelegramUpdate(baseUrl, item.update)
    assert(result.response.ok, `Accepted webhook POST failed: HTTP ${result.response.status}: ${JSON.stringify(result.payload)}`)
    assert(result.payload?.ok === true, "Webhook POST payload must be ok=true")
    assert(Number.isInteger(result.payload?.event_id), "Webhook POST must return event_id")
    assert(Number.isInteger(result.payload?.bot_customer_id), "Webhook POST must return bot_customer_id")
    assert(Number.isInteger(result.payload?.ai_task_id), "Webhook POST must queue ai_task_id")
    assert(result.payload?.miniapp_intent === item.expectedIntent, `Expected miniapp_intent=${item.expectedIntent}, got ${result.payload?.miniapp_intent}`)
    const messageResult = result.payload?.[item.responseKey]
    assert(messageResult?.skipped === true, `${item.responseKey} should be skipped without TELEGRAM_BOT_TOKEN`)
  }

  const afterEvents = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM telegram_events")
  const afterCustomers = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM bot_customers WHERE display_name LIKE 'Webhook Post Smoke%'")
  const afterTasks = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM ai_tasks WHERE task_type = 'telegram_update'")
  const afterOrders = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM orders")
  const smokePayloadEvents = scalar(tempDbPath, "SELECT COUNT(*) AS count FROM telegram_events WHERE payload_json LIKE '%Post Smoke%'")

  assert(afterEvents === beforeEvents + acceptedCases.length, `Temporary DB should contain ${acceptedCases.length} new telegram_events, before=${beforeEvents}, after=${afterEvents}`)
  assert(afterCustomers === beforeCustomers + acceptedCases.length, `Temporary DB should contain ${acceptedCases.length} smoke bot_customers, before=${beforeCustomers}, after=${afterCustomers}`)
  assert(afterTasks === beforeTasks + acceptedCases.length, `Temporary DB should contain ${acceptedCases.length} new telegram_update ai_tasks, before=${beforeTasks}, after=${afterTasks}`)
  assert(afterOrders === beforeOrders, `Webhook commands must not create orders, before=${beforeOrders}, after=${afterOrders}`)
  assert(smokePayloadEvents === acceptedCases.length, `Temporary DB should contain ${acceptedCases.length} smoke payload events, got ${smokePayloadEvents}`)

  console.log("Telegram webhook POST smoke passed")
  console.log("Mode: no-write/temp-db/temp-server")
  console.log(`Temporary DB: ${tempDbPath}`)
  console.log(`Temporary URL: ${baseUrl}`)
  console.log(`Accepted updates: ${acceptedCases.length}`)
  console.log("- no secret: 401")
  console.log("- wrong Telegram secret: 401")
  console.log("- /order: miniapp_intent=catalog")
  console.log("- /cart: miniapp_intent=cart")
  console.log("- /cabinet: miniapp_intent=cabinet")
  console.log("- /orders: miniapp_intent=orders")
  console.log("- /help and /whoami: service messages")
  console.log("- working orders untouched")
} catch (error) {
  console.error("Telegram webhook POST smoke failed")
  if (output.trim()) {
    console.error(output.trim().slice(-5000))
  }
  throw error
} finally {
  await stopChild(child)
}
