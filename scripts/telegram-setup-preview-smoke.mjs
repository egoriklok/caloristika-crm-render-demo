import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createServer } from "node:net"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const accessKey = "telegram-setup-preview-smoke-crm-key"
const fakeSecrets = [
  "123456:TELEGRAM_SETUP_PREVIEW_SMOKE_TOKEN",
  "telegram-setup-preview-smoke-webhook-secret"
]

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
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5000)])
  if (child.exitCode === null) {
    child.kill("SIGKILL")
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5000)])
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
      const response = await fetch(`${baseUrl}/api/integrations/telegram/setup-preview`)
      if (response.status === 401 || response.ok) return
    } catch {
      // Server is still starting.
    }
    await delay(750)
  }
  throw new Error("Temporary CRM server did not become ready in time")
}

async function request(url) {
  const response = await fetch(url)
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, text, payload }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const port = await freePort()
const publicBaseUrl = "https://telegram-setup-preview-smoke.example"
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const useProductionBuild = process.env.TELEGRAM_SETUP_PREVIEW_SMOKE_NEXT_MODE === "start" && existsSync(join(root, ".next", "BUILD_ID"))
const args = useProductionBuild
  ? [nextBin, "start", "-H", "127.0.0.1", "-p", port]
  : [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", port]
const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    CRM_ACCESS_KEY: accessKey,
    PUBLIC_BASE_URL: publicBaseUrl,
    TELEGRAM_BOT_TOKEN: fakeSecrets[0],
    TELEGRAM_WEBHOOK_SECRET: fakeSecrets[1],
    TELEGRAM_BOT_DISPLAY_NAME: "Lunch Up setup preview smoke",
    TELEGRAM_MENU_BUTTON_TEXT: "Lunch Up заказ",
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
  const blocked = await request(`${baseUrl}/api/integrations/telegram/setup-preview`)
  assert(blocked.response.status === 401, `Setup preview without CRM key must be blocked, got ${blocked.response.status}`)

  const preview = await request(`${baseUrl}/api/integrations/telegram/setup-preview?key=${encodeURIComponent(accessKey)}`)
  assert(preview.response.ok, `Setup preview with CRM key must pass, got HTTP ${preview.response.status}`)
  assert(preview.payload?.ok === true, "Setup preview must be ok=true with fake required env")
  assert(preview.payload?.mode === "server-side-preview", "Setup preview must identify server-side-preview mode")
  assert(preview.payload?.links?.miniapp_url === `${publicBaseUrl}/miniapp`, "Setup preview must expose public Mini App URL")
  assert(preview.payload?.links?.webhook_url === `${publicBaseUrl}/api/telegram/webhook`, "Setup preview must expose public webhook URL")
  assert(preview.payload?.telegram_api?.some((item) => item.method === "setWebhook" && item.payload?.secret_token === "[secret hidden]"), "Setup preview must redact webhook secret")
  assert(preview.payload?.telegram_api?.some((item) => item.method === "setChatMenuButton" && item.payload?.menu_button?.web_app?.url === preview.payload.links.miniapp_url), "Setup preview must include Mini App menu button")
  const commands = preview.payload?.telegram_api?.find((item) => item.method === "setMyCommands")?.payload?.commands ?? []
  assert(commands.some((item) => item.command === "order"), "Setup preview must include /order command")
  assert(commands.some((item) => item.command === "cart"), "Setup preview must include /cart command")
  assert(commands.some((item) => item.command === "cabinet"), "Setup preview must include /cabinet command")
  assert(commands.some((item) => item.command === "orders"), "Setup preview must include /orders command")
  assert(commands.some((item) => item.command === "whoami"), "Setup preview must include /whoami command")
  assert(preview.payload?.telegram_entrypoints?.some((item) => item.command === "/order" && item.url.includes("tg_intent=order")), "Setup preview must include /order entrypoint")
  assert(preview.payload?.telegram_entrypoints?.some((item) => item.command === "/cart" && item.url.includes("tg_view=cart")), "Setup preview must include /cart entrypoint")
  assert(preview.payload?.telegram_entrypoints?.some((item) => item.command === "/cabinet" && item.url.includes("tg_intent=cabinet")), "Setup preview must include /cabinet entrypoint")
  assert(preview.payload?.telegram_entrypoints?.some((item) => item.command === "/orders" && item.url.includes("tg_view=cabinet")), "Setup preview must include /orders entrypoint")

  for (const secret of fakeSecrets) {
    assert(!preview.text.includes(secret), `Setup preview response must not expose secret value: ${secret}`)
  }

  console.log("Telegram setup preview smoke passed")
  console.log("Mode: no-write/temp-server/secret-redaction")
  console.log(`Temporary URL: ${baseUrl}`)
  console.log("- no CRM key: 401")
  console.log("- payloads: setWebhook, setChatMenuButton, setMyCommands")
  console.log("- secret values: redacted")
} catch (error) {
  console.error("Telegram setup preview smoke failed")
  if (output.trim()) console.error(output.trim().slice(-5000))
  throw error
} finally {
  await stopChild(child)
}
