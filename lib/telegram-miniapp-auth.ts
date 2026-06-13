import { createHmac, timingSafeEqual } from "node:crypto"

export type TelegramMiniAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export type TelegramMiniAppAuth = {
  mode: "telegram" | "local_demo"
  init_data_valid: boolean
  user: TelegramMiniAppUser
  query_id: string | null
  chat_id: string
  auth_date: number | null
  warnings: string[]
}

export class TelegramMiniAppAuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message)
    this.name = "TelegramMiniAppAuthError"
  }
}

function parseJsonField<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function displayName(user: TelegramMiniAppUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username || `Telegram ${user.id}`
}

export function telegramDisplayName(user: TelegramMiniAppUser) {
  return displayName(user)
}

function safeCompareHex(left: string, right: string) {
  const a = Buffer.from(left, "hex")
  const b = Buffer.from(right, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

function localDemoAuth(): TelegramMiniAppAuth {
  return {
    mode: "local_demo",
    init_data_valid: false,
    user: {
      id: 100001,
      first_name: "Lunch",
      last_name: "Up"
    },
    query_id: null,
    chat_id: "local-demo-100001",
    auth_date: null,
    warnings: ["Локальный режим: TELEGRAM_BOT_TOKEN не задан, Telegram initData не проверяется."]
  }
}

export function authenticateTelegramMiniApp(initData: string | null | undefined): TelegramMiniAppAuth {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const allowLocalDemo = process.env.MINIAPP_DEMO_MODE === "1"

  if (!initData?.trim()) {
    if (allowLocalDemo) return localDemoAuth()
    throw new TelegramMiniAppAuthError("Telegram initData is required")
  }

  if (!botToken) {
    if (allowLocalDemo) return localDemoAuth()
    throw new TelegramMiniAppAuthError("TELEGRAM_BOT_TOKEN is required for Mini App authorization")
  }

  const params = new URLSearchParams(initData)
  const receivedHash = params.get("hash")
  if (!receivedHash) {
    throw new TelegramMiniAppAuthError("Telegram initData hash is missing")
  }

  params.delete("hash")
  params.delete("signature")
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  if (!safeCompareHex(calculatedHash, receivedHash)) {
    throw new TelegramMiniAppAuthError("Telegram initData hash is invalid")
  }

  const authDate = Number(params.get("auth_date"))
  const ttlSeconds = Number(process.env.TELEGRAM_MINIAPP_AUTH_TTL_SECONDS ?? 86400)
  if (Number.isFinite(authDate) && ttlSeconds > 0) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate
    if (ageSeconds > ttlSeconds) {
      throw new TelegramMiniAppAuthError("Telegram initData is expired")
    }
  }

  const user = parseJsonField<TelegramMiniAppUser>(params.get("user"))
  if (!user?.id) {
    throw new TelegramMiniAppAuthError("Telegram user is missing")
  }

  const chat = parseJsonField<{ id?: number | string }>(params.get("chat"))
  return {
    mode: "telegram",
    init_data_valid: true,
    user,
    query_id: params.get("query_id"),
    chat_id: String(chat?.id ?? user.id),
    auth_date: Number.isFinite(authDate) ? authDate : null,
    warnings: []
  }
}
