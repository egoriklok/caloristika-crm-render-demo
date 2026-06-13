import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const envPath = join(root, ".env.local")
const args = new Set(process.argv.slice(2))
const write = args.has("--write")
const force = args.has("--force")

loadLocalEnv(root)

function readFileTrimmed(path) {
  if (!existsSync(path)) return null
  const value = readFileSync(path, "utf-8").trim()
  return value || null
}

function normalizePublicUrl(value) {
  if (!value?.trim()) return ""
  try {
    const url = new URL(value.trim())
    url.search = ""
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  } catch {
    return value.trim().replace(/\/$/, "")
  }
}

function parseEnv(text) {
  const values = new Map()
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed
    const equalsIndex = normalized.indexOf("=")
    if (equalsIndex <= 0) continue
    const key = normalized.slice(0, equalsIndex).trim()
    let value = normalized.slice(equalsIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values.set(key, value)
  }
  return values
}

function mask(key, value) {
  if (!value) return "empty"
  if (/TOKEN|SECRET|KEY/i.test(key)) return "configured (secret hidden)"
  return value
}

const existingText = existsSync(envPath) ? readFileSync(envPath, "utf-8") : ""
const existing = parseEnv(existingText)
const savedPublicUrl = normalizePublicUrl(readFileTrimmed(join(root, "logs", "public_crm_url.txt")) ?? "")
const savedAccessKey = readFileTrimmed(join(root, "logs", "public_access_key.txt")) ?? ""
const defaults = new Map([
  ["CRM_ACCESS_KEY", savedAccessKey || randomBytes(18).toString("base64url")],
  ["PUBLIC_BASE_URL", normalizePublicUrl(process.env.PUBLIC_BASE_URL ?? existing.get("PUBLIC_BASE_URL") ?? savedPublicUrl)],
  ["PORT", process.env.PORT ?? existing.get("PORT") ?? "3011"],
  ["TELEGRAM_BOT_TOKEN", existing.get("TELEGRAM_BOT_TOKEN") ?? ""],
  ["TELEGRAM_WEBHOOK_SECRET", existing.get("TELEGRAM_WEBHOOK_SECRET") || randomBytes(32).toString("base64url")],
  ["TELEGRAM_MANAGER_CHAT_ID", existing.get("TELEGRAM_MANAGER_CHAT_ID") ?? ""],
  ["TELEGRAM_BOT_DISPLAY_NAME", existing.get("TELEGRAM_BOT_DISPLAY_NAME") ?? "Lunch Up заказы"],
  [
    "TELEGRAM_BOT_DESCRIPTION",
    existing.get("TELEGRAM_BOT_DESCRIPTION") ?? "Каталог Lunch Up для юридических лиц: кабинет, корзина и заказы через Telegram Mini App."
  ],
  ["TELEGRAM_BOT_SHORT_DESCRIPTION", existing.get("TELEGRAM_BOT_SHORT_DESCRIPTION") ?? "Каталог, корзина и B2B-заказы Lunch Up."],
  ["TELEGRAM_MENU_BUTTON_TEXT", existing.get("TELEGRAM_MENU_BUTTON_TEXT") ?? "Lunch Up заказ"],
  ["TELEGRAM_MINIAPP_SHORT_NAME", existing.get("TELEGRAM_MINIAPP_SHORT_NAME") ?? ""],
  ["DGIS_API_KEY", existing.get("DGIS_API_KEY") ?? ""],
  ["DADATA_API_KEY", existing.get("DADATA_API_KEY") ?? ""],
  ["APIFY_TOKEN", existing.get("APIFY_TOKEN") ?? ""],
  ["APIFY_DEFAULT_RESEARCH_ACTOR_ID", existing.get("APIFY_DEFAULT_RESEARCH_ACTOR_ID") ?? ""],
  ["EXTERNAL_ORDER_WEBHOOK_URL", existing.get("EXTERNAL_ORDER_WEBHOOK_URL") ?? ""],
  ["EXTERNAL_ORDER_WEBHOOK_TOKEN", existing.get("EXTERNAL_ORDER_WEBHOOK_TOKEN") ?? ""],
  ["EXTERNAL_ORDER_WEBHOOK_PROVIDER", existing.get("EXTERNAL_ORDER_WEBHOOK_PROVIDER") ?? ""],
  ["MINIAPP_DEMO_MODE", existing.get("MINIAPP_DEMO_MODE") ?? ""]
])

const requiredForLaunch = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "PUBLIC_BASE_URL", "DGIS_API_KEY", "DADATA_API_KEY"]
const nextValues = new Map(existing)
for (const [key, value] of defaults) {
  if (force || !nextValues.has(key) || !String(nextValues.get(key) ?? "").trim()) {
    nextValues.set(key, value)
  }
}
const extraKeys = Array.from(existing.keys()).filter((key) => !defaults.has(key)).sort()

const lines = [
  "# Lunch Up CRM local server-side configuration.",
  "# Do not send this file to clients, public chats, GitHub, or screenshots.",
  "",
  `CRM_ACCESS_KEY=${nextValues.get("CRM_ACCESS_KEY") ?? ""}`,
  `PUBLIC_BASE_URL=${nextValues.get("PUBLIC_BASE_URL") ?? ""}`,
  `PORT=${nextValues.get("PORT") ?? "3011"}`,
  "",
  `TELEGRAM_BOT_TOKEN=${nextValues.get("TELEGRAM_BOT_TOKEN") ?? ""}`,
  `TELEGRAM_WEBHOOK_SECRET=${nextValues.get("TELEGRAM_WEBHOOK_SECRET") ?? ""}`,
  `TELEGRAM_MANAGER_CHAT_ID=${nextValues.get("TELEGRAM_MANAGER_CHAT_ID") ?? ""}`,
  `TELEGRAM_BOT_DISPLAY_NAME=${nextValues.get("TELEGRAM_BOT_DISPLAY_NAME") ?? ""}`,
  `TELEGRAM_BOT_DESCRIPTION=${nextValues.get("TELEGRAM_BOT_DESCRIPTION") ?? ""}`,
  `TELEGRAM_BOT_SHORT_DESCRIPTION=${nextValues.get("TELEGRAM_BOT_SHORT_DESCRIPTION") ?? ""}`,
  `TELEGRAM_MENU_BUTTON_TEXT=${nextValues.get("TELEGRAM_MENU_BUTTON_TEXT") ?? ""}`,
  `TELEGRAM_MINIAPP_SHORT_NAME=${nextValues.get("TELEGRAM_MINIAPP_SHORT_NAME") ?? ""}`,
  "",
  `DGIS_API_KEY=${nextValues.get("DGIS_API_KEY") ?? ""}`,
  `DADATA_API_KEY=${nextValues.get("DADATA_API_KEY") ?? ""}`,
  "",
  `APIFY_TOKEN=${nextValues.get("APIFY_TOKEN") ?? ""}`,
  `APIFY_DEFAULT_RESEARCH_ACTOR_ID=${nextValues.get("APIFY_DEFAULT_RESEARCH_ACTOR_ID") ?? ""}`,
  `EXTERNAL_ORDER_WEBHOOK_URL=${nextValues.get("EXTERNAL_ORDER_WEBHOOK_URL") ?? ""}`,
  `EXTERNAL_ORDER_WEBHOOK_TOKEN=${nextValues.get("EXTERNAL_ORDER_WEBHOOK_TOKEN") ?? ""}`,
  `EXTERNAL_ORDER_WEBHOOK_PROVIDER=${nextValues.get("EXTERNAL_ORDER_WEBHOOK_PROVIDER") ?? ""}`,
  "",
  "# Use only for local browser testing outside Telegram.",
  `MINIAPP_DEMO_MODE=${nextValues.get("MINIAPP_DEMO_MODE") ?? ""}`,
  ...(extraKeys.length ? ["", "# Preserved extra local values.", ...extraKeys.map((key) => `${key}=${existing.get(key) ?? ""}`)] : []),
  ""
]

console.log("Telegram Mini App env bootstrap")
console.log(`Mode: ${write ? "write" : "dry-run"}`)
console.log(`Target: ${envPath}`)
console.log("")
for (const key of [
  "CRM_ACCESS_KEY",
  "PUBLIC_BASE_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_MINIAPP_SHORT_NAME",
  "DGIS_API_KEY",
  "DADATA_API_KEY",
  "TELEGRAM_MANAGER_CHAT_ID",
  "APIFY_TOKEN",
  "APIFY_DEFAULT_RESEARCH_ACTOR_ID"
]) {
  console.log(`- ${key}: ${mask(key, nextValues.get(key))}`)
}

const missing = requiredForLaunch.filter((key) => !String(nextValues.get(key) ?? "").trim())
console.log("")
if (write) {
  writeFileSync(envPath, lines.join("\n"), "utf-8")
  console.log(".env.local written. Secret values are intentionally not printed.")
} else {
  console.log("Dry-run only. Run `npm run telegram:env-bootstrap -- --write` to create/update .env.local.")
}

if (missing.length) {
  console.log("")
  console.log("Still needed before real launch:")
  for (const key of missing) console.log(`- ${key}`)
}

console.log("")
console.log("After filling external keys, run:")
console.log("- npm run telegram:check")
console.log("- npm run telegram:webhook-access-smoke")
console.log("- npm run miniapp:order-smoke")
console.log("- npm run telegram:launch")
