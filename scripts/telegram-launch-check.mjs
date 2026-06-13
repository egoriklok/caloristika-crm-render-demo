import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
loadLocalEnv(root)

const args = new Set(process.argv.slice(2))
const outputJson = args.has("--json")
const strict = args.has("--strict")
const noNetwork = args.has("--no-network")

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

function configured(name) {
  return Boolean(process.env[name]?.trim())
}

function envRow(key, label, required, secret = false) {
  return {
    key,
    label,
    required,
    secret,
    configured: configured(key)
  }
}

function envOneOf(keys, label, required, secret = false) {
  const configuredKey = keys.find((key) => configured(key)) ?? null
  return {
    key: configuredKey ?? keys[0],
    alternatives: keys,
    label,
    required,
    secret,
    configured: Boolean(configuredKey)
  }
}

async function callTelegram(method, token) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: "{}"
  })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

const publicBaseUrl = (process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || readSavedPublicBaseUrl())
const miniappUrl = publicBaseUrl ? `${publicBaseUrl}/miniapp` : null
const webhookUrl = publicBaseUrl ? `${publicBaseUrl}/api/telegram/webhook` : null
const botDisplayName = process.env.TELEGRAM_BOT_DISPLAY_NAME?.trim() || "Lunch Up заказы"
const suggestedUsername = process.env.TELEGRAM_BOT_SUGGESTED_USERNAME?.trim() || "lunch_up_orders_bot"
const sanitizedUsername = suggestedUsername.replace(/^@/, "")
const miniappShortName = process.env.TELEGRAM_MINIAPP_SHORT_NAME?.trim()?.replace(/^@/, "").replace(/[^a-zA-Z0-9_-]/g, "") || null
function telegramStartappUrl(payload) {
  const startapp = String(payload ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
  if (!startapp) return null
  const url = new URL(miniappShortName ? `https://t.me/${sanitizedUsername}/${miniappShortName}` : `https://t.me/${sanitizedUsername}`)
  url.searchParams.set("startapp", startapp)
  return url.toString()
}
const env = [
  envRow("TELEGRAM_BOT_TOKEN", "BotFather token", true, true),
  envRow("TELEGRAM_WEBHOOK_SECRET", "Telegram webhook secret header", true, true),
  {
    key: "PUBLIC_BASE_URL",
    label: "Public CRM URL",
    required: true,
    secret: false,
    configured: Boolean(publicBaseUrl),
    source: process.env.PUBLIC_BASE_URL ? "env" : publicBaseUrl ? "logs/public_crm_url.txt" : null
  },
  envOneOf(["DGIS_API_KEY", "TWO_GIS_API_KEY"], "2GIS Places API", true, true),
  envOneOf(["DADATA_API_KEY", "DADATA_TOKEN"], "DaData/FNS organization API", true, true),
  envRow("TELEGRAM_MANAGER_CHAT_ID", "Manager Telegram chat id", false, false),
  envRow("TELEGRAM_MINIAPP_SHORT_NAME", "BotFather Mini App short name for /startapp links", false, false),
  envRow("EXTERNAL_ORDER_WEBHOOK_URL", "External order webhook", false, false),
  envRow("APIFY_TOKEN", "Apify actors token", false, true),
  envRow("APIFY_DEFAULT_RESEARCH_ACTOR_ID", "Apify default company research actor", false, false)
]

const dgisReady = configured("DGIS_API_KEY") || configured("TWO_GIS_API_KEY")
const dadataReady = configured("DADATA_API_KEY") || configured("DADATA_TOKEN")
const configReady = env.filter((item) => item.required).every((item) => item.configured)
const nextActions = []
if (!configured("TELEGRAM_BOT_TOKEN")) nextActions.push("Create a bot in @BotFather and set TELEGRAM_BOT_TOKEN.")
if (!configured("TELEGRAM_WEBHOOK_SECRET")) nextActions.push("Set TELEGRAM_WEBHOOK_SECRET before exposing the webhook.")
if (!publicBaseUrl) nextActions.push("Set PUBLIC_BASE_URL or save a tunnel URL in logs/public_crm_url.txt.")
if (!dgisReady) nextActions.push("Set DGIS_API_KEY for 2GIS company cards.")
if (!dadataReady) nextActions.push("Set DADATA_API_KEY for INN and employee-count enrichment.")
if (configReady) nextActions.push("Run npm run telegram:setup, then run npm run telegram:check again.")
if (!configured("TELEGRAM_MANAGER_CHAT_ID")) nextActions.push("After setup, send /whoami to the bot and set TELEGRAM_MANAGER_CHAT_ID for manager notifications.")

let telegram = {
  checked: false,
  bot_ok: false,
  username: null,
  webhook_ok: false,
  webhook_url: null,
  pending_updates: null,
  error: null
}

if (configured("TELEGRAM_BOT_TOKEN") && !noNetwork) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const me = await callTelegram("getMe", token)
    const bot = me.payload?.result
    const webhook = await callTelegram("getWebhookInfo", token)
    const webhookInfo = webhook.payload?.result
    telegram = {
      checked: true,
      bot_ok: Boolean(me.payload?.ok),
      username: bot?.username ? `@${bot.username}` : null,
      webhook_ok: Boolean(webhookUrl && webhookInfo?.url === webhookUrl),
      webhook_url: webhookInfo?.url ?? null,
      pending_updates: webhookInfo?.pending_update_count ?? null,
      error: me.payload?.ok ? webhookInfo?.last_error_message ?? null : me.payload?.description ?? "Telegram getMe failed"
    }
    if (telegram.bot_ok && !telegram.webhook_ok) {
      nextActions.push("Run npm run telegram:setup to point Telegram webhook and menu button at the current Mini App URL.")
    }
  } catch (error) {
    telegram = {
      ...telegram,
      checked: true,
      error: error instanceof Error ? error.message : "Telegram API check failed"
    }
  }
}

const result = {
  ok: configReady && telegram.bot_ok && telegram.webhook_ok,
  config_ready: configReady,
  generated_at: new Date().toISOString(),
  botfather: {
    open_url: "https://t.me/BotFather",
    bot_name: botDisplayName,
    suggested_username: sanitizedUsername,
    bot_url_hint: `https://t.me/${sanitizedUsername}`,
    miniapp_short_name: miniappShortName,
    startapp_url_hint: telegramStartappUrl("order"),
    token_instruction: "Create the bot with /newbot, then store TELEGRAM_BOT_TOKEN only in .env.local or process environment."
  },
  links: {
    public_base_url: publicBaseUrl,
    miniapp_url: miniappUrl,
    webhook_url: webhookUrl,
    local_miniapp_url: "http://localhost:3011/miniapp"
  },
  telegram_entrypoints: [
    {
      command: "/order",
      title: "New order",
      url: publicBaseUrl ? `${publicBaseUrl}/miniapp?tg_view=catalog&tg_intent=order` : "http://localhost:3011/miniapp?tg_view=catalog&tg_intent=order",
      startapp_url: telegramStartappUrl("order"),
      note: "Opens catalog and cart."
    },
    {
      command: "/orders",
      title: "Order history and repeat",
      url: publicBaseUrl ? `${publicBaseUrl}/miniapp?tg_view=cabinet&tg_intent=orders` : "http://localhost:3011/miniapp?tg_view=cabinet&tg_intent=orders",
      startapp_url: telegramStartappUrl("orders"),
      note: "Opens client cabinet, order history and repeat order flow."
    },
    {
      command: "/cart",
      title: "Cart and checkout",
      url: publicBaseUrl ? `${publicBaseUrl}/miniapp?tg_view=cart&tg_intent=cart` : "http://localhost:3011/miniapp?tg_view=cart&tg_intent=cart",
      startapp_url: telegramStartappUrl("cart"),
      note: "Opens the cart, delivery fields and checkout."
    },
    {
      command: "/cabinet",
      title: "Client cabinet",
      url: publicBaseUrl ? `${publicBaseUrl}/miniapp?tg_view=cabinet&tg_intent=cabinet` : "http://localhost:3011/miniapp?tg_view=cabinet&tg_intent=cabinet",
      startapp_url: telegramStartappUrl("cabinet"),
      note: "Opens company profile, contacts, delivery address and proposal estimate."
    },
    {
      command: "/whoami",
      title: "Manager chat id",
      url: null,
      note: "Manager sends this command after setup to get TELEGRAM_MANAGER_CHAT_ID."
    }
  ],
  env,
  telegram,
  next_actions: Array.from(new Set(nextActions)),
  note: "Secret values are intentionally not printed. Store them only in .env.local or process environment."
}

if (outputJson) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log("Telegram Mini App launch check")
  console.log(`Config: ${result.config_ready ? "READY" : "NEEDS KEYS"}`)
  console.log(`Telegram: ${telegram.checked ? telegram.bot_ok ? "BOT OK" : "BOT ERROR" : "NOT CHECKED"}`)
  console.log("")
  console.log("Links")
  console.log(`- Mini App: ${result.links.miniapp_url ?? result.links.local_miniapp_url}`)
  console.log(`- Webhook: ${result.links.webhook_url ?? "PUBLIC_BASE_URL is not configured"}`)
  console.log("")
  console.log("BotFather")
  console.log(`- Open: ${result.botfather.open_url}`)
  console.log(`- Bot name: ${result.botfather.bot_name}`)
  console.log(`- Suggested username: ${result.botfather.suggested_username}`)
  console.log(`- Bot URL after creation: ${result.botfather.bot_url_hint}`)
  console.log(`- Mini App startapp URL: ${result.botfather.startapp_url_hint}`)
  console.log("- Token storage: TELEGRAM_BOT_TOKEN in .env.local only")
  console.log("")
  console.log("Telegram entrypoints")
  for (const entrypoint of result.telegram_entrypoints) {
    console.log(`- ${entrypoint.command}: ${entrypoint.url ?? entrypoint.note}`)
    if (entrypoint.startapp_url) console.log(`  startapp: ${entrypoint.startapp_url}`)
  }
  console.log("")
  console.log("Environment")
  for (const item of env) {
    const mark = item.configured ? "ok" : item.required ? "needed" : "optional"
    console.log(`- ${mark}: ${item.key} - ${item.label}${item.secret ? " (secret hidden)" : ""}`)
  }
  if (telegram.username || telegram.webhook_url || telegram.error) {
    console.log("")
    console.log("Telegram API")
    if (telegram.username) console.log(`- Bot: ${telegram.username}`)
    console.log(`- Webhook matches current CRM: ${telegram.webhook_ok ? "yes" : "no"}`)
    if (telegram.webhook_url) console.log(`- Current webhook: ${telegram.webhook_url}`)
    if (telegram.pending_updates !== null) console.log(`- Pending updates: ${telegram.pending_updates}`)
    if (telegram.error) console.log(`- Last error: ${telegram.error}`)
  }
  console.log("")
  console.log("Next actions")
  for (const action of result.next_actions) console.log(`- ${action}`)
  console.log("")
  console.log(result.note)
}

if (strict && !result.ok) {
  process.exitCode = 1
}
