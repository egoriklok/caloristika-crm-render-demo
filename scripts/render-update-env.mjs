import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const envPath = join(root, ".env.local")
loadLocalEnv(root)

const apiBaseUrl = "https://api.render.com/v1"
const args = new Set(process.argv.slice(2))
const serviceName = readArg("--service") || "caloristika-crm-demo"
const publicBaseUrl = normalizeUrl(readArg("--public-url") || process.env.PUBLIC_BASE_URL || "https://caloristika-crm-demo.onrender.com")
const ownerId = (readArg("--owner-id") || process.env.RENDER_OWNER_ID || "").trim()
const apiKey = (process.env.RENDER_API_KEY || "").trim()
const dryRun = args.has("--dry-run")
const deploy = args.has("--deploy")

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ""
}

function normalizeUrl(value) {
  const raw = String(value || "").trim().replace(/\/$/, "")
  if (!raw) return ""
  const url = new URL(raw)
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
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

function setEnvLine(key, value) {
  const existingText = existsSync(envPath) ? readFileSync(envPath, "utf-8") : ""
  const lines = existingText ? existingText.split(/\r?\n/) : []
  let updated = false
  const next = lines.map((line) => {
    if (line.match(new RegExp(`^${key}=`))) {
      updated = true
      return `${key}=${value}`
    }
    return line
  })
  if (!updated) {
    if (next.length && next[next.length - 1].trim()) next.push("")
    next.push(`${key}=${value}`)
  }
  writeFileSync(envPath, next.join("\n").replace(/\n+$/, "\n"), "utf-8")
}

function ensureLocalWebhookSecret() {
  if (process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) return process.env.TELEGRAM_WEBHOOK_SECRET.trim()
  const secret = randomBytes(32).toString("base64url")
  setEnvLine("TELEGRAM_WEBHOOK_SECRET", secret)
  process.env.TELEGRAM_WEBHOOK_SECRET = secret
  return secret
}

function configuredEnvValues() {
  const localEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf-8")) : new Map()
  const read = (key) => (process.env[key] || localEnv.get(key) || "").trim()
  const values = new Map([
    ["PUBLIC_BASE_URL", publicBaseUrl],
    ["CRM_ACCESS_KEY", read("CRM_ACCESS_KEY")],
    ["DGIS_API_KEY", read("DGIS_API_KEY")],
    ["DADATA_API_KEY", read("DADATA_API_KEY")],
    ["APIFY_TOKEN", read("APIFY_TOKEN")],
    ["TELEGRAM_BOT_TOKEN", read("TELEGRAM_BOT_TOKEN")],
    ["TELEGRAM_WEBHOOK_SECRET", ensureLocalWebhookSecret()],
    ["TELEGRAM_BOT_DISPLAY_NAME", read("TELEGRAM_BOT_DISPLAY_NAME") || "B2B Food CRM Demo"],
    [
      "TELEGRAM_BOT_DESCRIPTION",
      read("TELEGRAM_BOT_DESCRIPTION") ||
        "Демо CRM для B2B-продаж готовой еды: каталог, корзина, заявки и AI-помощник менеджера."
    ],
    ["TELEGRAM_BOT_SHORT_DESCRIPTION", read("TELEGRAM_BOT_SHORT_DESCRIPTION") || "Каталог, корзина и B2B-заявки через Telegram Mini App."],
    ["TELEGRAM_MENU_BUTTON_TEXT", read("TELEGRAM_MENU_BUTTON_TEXT") || "Открыть каталог"],
    ["TELEGRAM_MINIAPP_SHORT_NAME", read("TELEGRAM_MINIAPP_SHORT_NAME")],
    ["TELEGRAM_MANAGER_CHAT_ID", read("TELEGRAM_MANAGER_CHAT_ID")]
  ])
  return Array.from(values.entries())
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({ key, value }))
}

function isSecretKey(key) {
  return /TOKEN|SECRET|KEY|PASSWORD|API|CHAT_ID/i.test(key)
}

function redactedValue(item) {
  return isSecretKey(item.key) ? "<set>" : item.value
}

async function renderApi(path, options = {}) {
  if (!apiKey) throw new Error("RENDER_API_KEY is missing in .env.local or process env")
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`Render API ${options.method || "GET"} ${path} failed: HTTP ${response.status} ${JSON.stringify(payload)}`)
  }
  return payload
}

async function listServices() {
  if (!ownerId) throw new Error("RENDER_OWNER_ID is missing in .env.local or process env")
  const rows = await renderApi(`/services?ownerId=${encodeURIComponent(ownerId)}&limit=100`)
  return rows.map((row) => row.service || row)
}

async function findService() {
  const services = await listServices()
  const service = services.find((item) => item.name === serviceName)
  if (!service) {
    throw new Error(`Render service not found: ${serviceName}`)
  }
  return service
}

async function upsertEnvVar(serviceId, item) {
  return renderApi(`/services/${encodeURIComponent(serviceId)}/env-vars/${encodeURIComponent(item.key)}`, {
    method: "PUT",
    body: JSON.stringify({ value: item.value })
  })
}

async function triggerDeploy(serviceId) {
  return renderApi(`/services/${encodeURIComponent(serviceId)}/deploys`, {
    method: "POST",
    body: JSON.stringify({ deployMode: "deploy_only" })
  })
}

const service = await findService()
const serviceId = service.id
const items = configuredEnvValues()
const missingRequired = ["CRM_ACCESS_KEY", "PUBLIC_BASE_URL", "TELEGRAM_WEBHOOK_SECRET"].filter(
  (key) => !items.some((item) => item.key === key && item.value)
)
if (missingRequired.length) {
  throw new Error(`Missing required local values: ${missingRequired.join(", ")}`)
}

console.log(`Render service: ${service.name} (${serviceId})`)
console.log(`Mode: ${dryRun ? "dry-run" : "update"}`)
console.log("Env vars:")
for (const item of items) {
  console.log(`- ${item.key}: ${redactedValue(item)}`)
}

if (!items.some((item) => item.key === "TELEGRAM_BOT_TOKEN")) {
  console.log("Warning: TELEGRAM_BOT_TOKEN is not configured, webhook setup cannot be executed yet.")
}

if (!dryRun) {
  for (const item of items) {
    await upsertEnvVar(serviceId, item)
    console.log(`Updated ${item.key}: ${redactedValue(item)}`)
  }
  if (deploy) {
    const deployResult = await triggerDeploy(serviceId)
    const deployId = deployResult?.deploy?.id || deployResult?.id || "queued"
    console.log(`Deploy queued: ${deployId}`)
  } else {
    console.log("Env saved. Run with --deploy or trigger a Render deploy to apply runtime changes.")
  }
}
