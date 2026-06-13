import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createServer } from "node:net"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const accessKey = "launch-guide-smoke-crm-key"
const fakeSecrets = [
  "123456:LAUNCH_GUIDE_SMOKE_BOT_TOKEN",
  "launch-guide-smoke-webhook-secret",
  "launch-guide-smoke-dgis-secret",
  "launch-guide-smoke-dadata-secret",
  "launch-guide-smoke-apify-secret"
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
      const response = await fetch(`${baseUrl}/api/integrations/launch-guide`)
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
  return { response, text, payload }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const port = await freePort()
const publicBaseUrl = "https://launch-guide-smoke.example"
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const useProductionBuild = process.env.LAUNCH_GUIDE_SMOKE_NEXT_MODE === "start" && existsSync(join(root, ".next", "BUILD_ID"))
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
    TELEGRAM_MINIAPP_SHORT_NAME: "lunchup",
    DGIS_API_KEY: fakeSecrets[2],
    DADATA_API_KEY: fakeSecrets[3],
    APIFY_TOKEN: fakeSecrets[4],
    APIFY_DEFAULT_RESEARCH_ACTOR_ID: "launch-guide-smoke-actor",
    TELEGRAM_MANAGER_CHAT_ID: "100200300",
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

  const blocked = await request(`${baseUrl}/api/integrations/launch-guide`)
  assert(blocked.response.status === 401, `Launch guide without CRM key must be blocked, got ${blocked.response.status}`)

  const guide = await request(`${baseUrl}/api/integrations/launch-guide?key=${encodeURIComponent(accessKey)}`)
  assert(guide.response.ok, `Launch guide with CRM key must pass, got HTTP ${guide.response.status}`)
  assert(guide.payload?.ok === true, "Launch guide should be ready when all required smoke env keys are configured")
  assert(guide.payload?.links?.miniapp_url === `${publicBaseUrl}/miniapp`, "Launch guide must expose public Mini App link")
  assert(guide.payload?.links?.webhook_url === `${publicBaseUrl}/api/telegram/webhook`, "Launch guide must expose public webhook link")

  const handoff = guide.payload?.operator_handoff
  assert(handoff?.botfather?.commands?.includes("/newbot"), "Operator handoff must include BotFather /newbot command")
  assert(handoff?.botfather?.open_url === "https://t.me/BotFather", "Operator handoff must include BotFather open URL")
  assert(handoff?.botfather?.bot_url_hint?.includes("https://t.me/"), "Operator handoff must include bot URL hint")
  assert(handoff?.botfather?.token_instruction?.includes("TELEGRAM_BOT_TOKEN"), "Operator handoff must include token storage instruction")
  const miniappSetup = handoff?.botfather?.miniapp_setup
  assert(miniappSetup?.configured === true, "Operator handoff must mark BotFather Mini App setup as configured when short name env is present")
  assert(miniappSetup?.short_name === "lunchup", "Operator handoff must expose the configured Mini App short name")
  assert(miniappSetup?.short_name_env_key === "TELEGRAM_MINIAPP_SHORT_NAME", "Operator handoff must name the Mini App short name env key")
  assert(miniappSetup?.miniapp_url === `${publicBaseUrl}/miniapp`, "Operator handoff must include Mini App URL for BotFather /newapp")
  assert(miniappSetup?.named_startapp_url?.includes("/lunchup?startapp=order"), "Operator handoff must include named Mini App startapp URL")
  assert(miniappSetup?.fallback_startapp_url?.includes("?startapp=order"), "Operator handoff must include fallback bot startapp URL")
  assert(miniappSetup?.botfather_commands?.includes("/newapp"), "Operator handoff must include BotFather /newapp command")
  assert(miniappSetup?.instructions?.some((item) => item.includes("TELEGRAM_MINIAPP_SHORT_NAME")), "Operator handoff must explain where to store Mini App short name")
  assert(handoff?.env_template?.length >= 6, "Operator handoff must include env_template")
  assert(handoff?.connection_checklist?.length >= 5, "Operator handoff must include connection_checklist")
  assert(handoff?.connection_checklist?.some((item) => item.id === "telegram_botfather" && item.official_url === "https://t.me/BotFather"), "Connection checklist must include Telegram BotFather")
  assert(handoff?.connection_checklist?.some((item) => item.id === "dgis_places" && item.official_url?.includes("docs.2gis.com")), "Connection checklist must include 2GIS official URL")
  assert(handoff?.connection_checklist?.some((item) => item.id === "dadata_fns" && item.official_url?.includes("dadata.ru")), "Connection checklist must include DaData official URL")
  assert(handoff?.connection_checklist?.some((item) => item.id === "apify_research" && item.official_url?.includes("console.apify.com/store")), "Connection checklist must include Apify Store")
  assert(handoff?.connection_checklist?.every((item) => item.configured || item.status !== "ready"), "Connection checklist status must match configured values")
  assert(handoff?.share_links?.some((item) => item.id === "client_miniapp" && item.audience === "client"), "Operator handoff must include client Mini App share link")
  assert(handoff?.share_links?.some((item) => item.id === "telegram_webhook" && item.audience === "telegram"), "Operator handoff must include Telegram webhook link")
  assert(handoff?.share_assets?.length >= 5, "Operator handoff must include ready-to-send share_assets")
  const orderShareAsset = handoff?.share_assets?.find((item) => item.id === "client_order_miniapp")
  assert(orderShareAsset?.url?.includes("tg_intent=order") && orderShareAsset.telegram_startapp_url?.includes("/lunchup?startapp=order") && orderShareAsset.telegram_share_url?.includes("https://t.me/share/url") && orderShareAsset.qr_payload_url === orderShareAsset.telegram_startapp_url && orderShareAsset.qr_image_url?.includes("/api/integrations/share-qr"), "Share assets must include client order Mini App link with Telegram startapp URL, Telegram share URL, QR payload and QR image URL")
  assert(handoff?.share_assets?.some((item) => item.id === "client_cart_miniapp" && item.url?.includes("tg_view=cart")), "Share assets must include client cart Mini App link")
  assert(handoff?.share_assets?.some((item) => item.id === "client_cabinet_miniapp" && item.url?.includes("tg_intent=cabinet")), "Share assets must include client cabinet Mini App link")
  assert(handoff?.share_assets?.some((item) => item.id === "client_orders_startapp" && item.telegram_startapp_url?.includes("startapp=orders")), "Share assets must include client orders startapp link")
  assert(handoff?.share_assets?.some((item) => item.id === "client_public_catalog" && item.url === `${publicBaseUrl}/catalog`), "Share assets must include public web catalog link")
  assert(handoff?.share_assets?.some((item) => item.id === "client_bot_entry" && item.url?.includes("https://t.me/")), "Share assets must include future Telegram bot entry link")
  assert(handoff?.telegram_entrypoints?.some((item) => item.command === "/order" && item.url?.includes("tg_intent=order")), "Operator handoff must include /order Mini App entrypoint")
  assert(handoff?.telegram_entrypoints?.some((item) => item.command === "/cart" && item.url?.includes("tg_view=cart")), "Operator handoff must include /cart Mini App entrypoint")
  assert(handoff?.telegram_entrypoints?.some((item) => item.command === "/cabinet" && item.url?.includes("tg_intent=cabinet")), "Operator handoff must include /cabinet Mini App entrypoint")
  assert(handoff?.telegram_entrypoints?.some((item) => item.command === "/orders" && item.url?.includes("tg_view=cabinet")), "Operator handoff must include /orders Mini App entrypoint")
  assert(handoff?.telegram_entrypoints?.some((item) => item.command === "/whoami"), "Operator handoff must include /whoami manager entrypoint")
  assert(handoff?.success_criteria?.some((item) => item.includes("/order")), "Operator handoff must include /order success criterion")
  assert(handoff?.success_criteria?.some((item) => item.includes("order_items")), "Operator handoff must include order_items success criterion")
  const qr = await request(`${baseUrl}/api/integrations/share-qr?url=${encodeURIComponent(orderShareAsset.qr_payload_url)}`)
  assert(qr.response.ok, `Share QR endpoint must return HTTP 200, got ${qr.response.status}`)
  assert(qr.response.headers.get("content-type")?.includes("image/svg+xml"), "Share QR endpoint must return SVG content type")
  assert(qr.text.includes("<svg") && qr.text.includes("</svg>"), "Share QR endpoint must return an SVG QR image")

  for (const secret of fakeSecrets) {
    assert(!guide.text.includes(secret), `Launch guide response must not expose secret value: ${secret}`)
  }
  assert(guide.text.includes("Секрет") || guide.text.includes("secret"), "Launch guide should label secret fields without values")

  console.log("Integration launch guide smoke passed")
  console.log("Mode: no-write/temp-server/secret-redaction")
  console.log(`Temporary URL: ${baseUrl}`)
  console.log("- no CRM key: 401")
  console.log("- operator_handoff: present")
  console.log("- BotFather Mini App setup: present")
  console.log("- connection checklist: Telegram, 2GIS, DaData, Apify")
  console.log("- share links: client, telegram, operator")
  console.log("- share assets: Mini App, catalog, bot entry")
  console.log("- QR SVG endpoint: ok")
  console.log("- secret values: redacted")
} catch (error) {
  console.error("Integration launch guide smoke failed")
  if (output.trim()) {
    console.error(output.trim().slice(-5000))
  }
  throw error
} finally {
  await stopChild(child)
}
