import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createServer } from "node:net"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const accessKey = "smoke-crm-access-key"
const webhookSecret = "smoke-telegram-webhook-secret"

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

const port = await freePort()
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const hasBuild = existsSync(join(root, ".next", "BUILD_ID"))
const args = hasBuild
  ? [nextBin, "start", "-H", "127.0.0.1", "-p", port]
  : [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", port]
const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    CRM_ACCESS_KEY: accessKey,
    TELEGRAM_WEBHOOK_SECRET: webhookSecret,
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

const baseUrl = `http://127.0.0.1:${port}`
try {
  await waitForReady(baseUrl, child)

  const withoutAccess = await request(`${baseUrl}/api/telegram/webhook`)
  assert(withoutAccess.response.status === 401, `Webhook without CRM key or Telegram secret must be blocked, got ${withoutAccess.response.status}`)

  const withCrmKey = await request(`${baseUrl}/api/telegram/webhook?key=${encodeURIComponent(accessKey)}`)
  assert(withCrmKey.response.ok && withCrmKey.payload?.ok === true, `Webhook with CRM key should be readable for operator smoke, got ${withCrmKey.response.status}`)
  assert(withCrmKey.payload?.secret_configured === true, "Webhook GET must report secret_configured=true in smoke server")

  const withWrongSecret = await request(`${baseUrl}/api/telegram/webhook`, {
    headers: {
      "x-telegram-bot-api-secret-token": "wrong-secret"
    }
  })
  assert(withWrongSecret.response.status === 401, `Webhook with wrong Telegram secret must be blocked, got ${withWrongSecret.response.status}`)

  const withTelegramSecret = await request(`${baseUrl}/api/telegram/webhook`, {
    headers: {
      "x-telegram-bot-api-secret-token": webhookSecret
    }
  })
  assert(
    withTelegramSecret.response.ok && withTelegramSecret.payload?.ok === true && withTelegramSecret.payload?.secret_configured === true,
    `Webhook with Telegram secret should pass without CRM key, got ${withTelegramSecret.response.status}`
  )

  console.log("Telegram webhook access smoke passed")
  console.log("Mode: no-write/temp-server")
  console.log(`Temporary URL: ${baseUrl}`)
  console.log("- no key/no secret: 401")
  console.log("- CRM key: 200")
  console.log("- wrong Telegram secret: 401")
  console.log("- Telegram secret header: 200 without CRM key")
} catch (error) {
  console.error("Telegram webhook access smoke failed")
  if (output.trim()) {
    console.error(output.trim().slice(-4000))
  }
  throw error
} finally {
  await stopChild(child)
}
