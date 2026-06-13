import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
loadLocalEnv(root)

function readSavedPublicBaseUrl() {
  const path = join(root, "logs", "public_crm_url.txt")
  if (!existsSync(path)) return null
  const savedUrl = readFileSync(path, "utf-8").trim()
  if (!savedUrl) return null
  try {
    const url = new URL(savedUrl)
    url.search = ""
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN
const publicBaseUrl = (process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || readSavedPublicBaseUrl())
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
const botDisplayName = process.env.TELEGRAM_BOT_DISPLAY_NAME?.trim() || "Lunch Up заказы"
const botDescription =
  process.env.TELEGRAM_BOT_DESCRIPTION?.trim() ||
  "Каталог Lunch Up для юридических лиц: личный кабинет, корзина, история заказов и повтор заказа через Telegram Mini App."
const botShortDescription =
  process.env.TELEGRAM_BOT_SHORT_DESCRIPTION?.trim() ||
  "Lunch Up: каталог, корзина и B2B-заказы для СПб и Ленинградской области."
const menuButtonText = process.env.TELEGRAM_MENU_BUTTON_TEXT?.trim() || "Lunch Up заказ"
const args = new Set(process.argv.slice(2))
const dryRun = args.has("--dry-run")
const outputJson = args.has("--json")
const skipUrlPreflight = args.has("--skip-url-preflight") || args.has("--skip-url-check")

if (!token && !dryRun) {
  throw new Error("TELEGRAM_BOT_TOKEN is required. Create the bot in @BotFather first, then run this script.")
}

if (!publicBaseUrl) {
  throw new Error("PUBLIC_BASE_URL is required, for example https://example.trycloudflare.com")
}

if (!webhookSecret) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET is required because the CRM API is protected. Set it on the server, then run this script.")
}

const miniappUrl = `${publicBaseUrl}/miniapp`
const webhookUrl = `${publicBaseUrl}/api/telegram/webhook`

function limitText(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength - 1).trimEnd() : value
}

function setupPayloads() {
  return [
    {
      method: "setMyName",
      optional: true,
      payload: {
        name: limitText(botDisplayName, 64)
      }
    },
    {
      method: "setMyDescription",
      optional: true,
      payload: {
        description: limitText(botDescription, 512)
      }
    },
    {
      method: "setMyShortDescription",
      optional: true,
      payload: {
        short_description: limitText(botShortDescription, 120)
      }
    },
    {
      method: "setWebhook",
      optional: false,
      payload: {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"]
      }
    },
    {
      method: "setChatMenuButton",
      optional: false,
      payload: {
        menu_button: {
          type: "web_app",
          text: limitText(menuButtonText, 64),
          web_app: {
            url: miniappUrl
          }
        }
      }
    },
    {
      method: "setMyCommands",
      optional: false,
      payload: {
        scope: { type: "default" },
        commands: [
          { command: "start", description: "Открыть каталог и личный кабинет" },
          { command: "order", description: "Оформить заказ Lunch Up" },
          { command: "cart", description: "Открыть корзину и оформление" },
          { command: "cabinet", description: "Открыть личный кабинет" },
          { command: "orders", description: "Открыть историю заказов" },
          { command: "help", description: "Показать команды и условия заказа" },
          { command: "whoami", description: "Показать chat id для уведомлений" }
        ]
      }
    }
  ]
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, key === "secret_token" ? "[secret hidden]" : redactSecrets(item)])
    )
  }
  return value
}

function setupPlan() {
  return {
    mode: dryRun ? "dry-run" : "execute",
    links: {
      public_base_url: publicBaseUrl,
      miniapp_url: miniappUrl,
      webhook_url: webhookUrl
    },
    telegram_api: setupPayloads().map((item) => ({
      method: item.method,
      optional: item.optional,
      payload: redactSecrets(item.payload)
    })),
    note: "Dry-run does not call Telegram API. Secret values are intentionally not printed."
  }
}

async function callTelegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
  const data = await response.json()
  if (!data.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(data)}`)
  }
  return data
}

async function callTelegramOptional(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
  const data = await response.json()
  if (!data.ok) {
    console.warn(`${method} skipped: ${JSON.stringify(data)}`)
  }
  return data
}

async function assertPublicEndpoint(url, label) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal })
    if (!response.ok) {
      throw new Error(`${label} returned HTTP ${response.status}`)
    }
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    throw new Error(`${label} is not reachable at ${url}: ${message}`)
  } finally {
    clearTimeout(timeout)
  }
}

async function assertPublicMiniAppReady() {
  await assertPublicEndpoint(miniappUrl, "Telegram Mini App URL")
  const catalogResponse = await assertPublicEndpoint(`${publicBaseUrl}/api/miniapp/catalog`, "Mini App catalog API")
  const catalogPayload = await catalogResponse.json().catch(() => null)
  if (!catalogPayload?.ok || !Array.isArray(catalogPayload.products) || catalogPayload.products.length === 0) {
    throw new Error("Mini App catalog API responded without products")
  }

  console.log(`Mini App public URL ready: ${miniappUrl}`)
  console.log(`Mini App catalog ready: ${catalogPayload.products.length} products`)
}

if (!skipUrlPreflight) {
  await assertPublicMiniAppReady()
} else {
  console.warn("Public Mini App URL preflight skipped")
}

if (dryRun) {
  const plan = setupPlan()
  if (outputJson) {
    console.log(JSON.stringify(plan, null, 2))
  } else {
    console.log("Telegram bot setup dry-run")
    console.log(`Mini App: ${plan.links.miniapp_url}`)
    console.log(`Webhook: ${plan.links.webhook_url}`)
    console.log("Telegram API payloads")
    for (const item of plan.telegram_api) {
      console.log(`- ${item.method}${item.optional ? " (optional)" : ""}: ${JSON.stringify(item.payload)}`)
    }
    console.log(plan.note)
  }
  process.exit(0)
}

const me = await callTelegram("getMe", {})

for (const item of setupPayloads()) {
  if (item.optional) await callTelegramOptional(item.method, item.payload)
  else await callTelegram(item.method, item.payload)
}

const webhookInfo = await callTelegram("getWebhookInfo", {})

console.log("Telegram bot configured")
console.log(`Bot: @${me.result.username}`)
console.log(`Webhook: ${webhookUrl}`)
console.log(`Mini App: ${miniappUrl}`)
console.log(`Webhook pending updates: ${webhookInfo.result.pending_update_count ?? 0}`)
