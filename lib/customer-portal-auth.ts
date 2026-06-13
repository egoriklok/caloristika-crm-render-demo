import {
  authenticateTelegramMiniApp,
  telegramDisplayName,
  type TelegramMiniAppAuth
} from "@/lib/telegram-miniapp-auth"

export type CustomerPortalAuthInput = {
  initData?: string | null
  email?: string | null
  accessCode?: string | null
  profile?: {
    contact_name?: string | null
    email?: string | null
  }
}

export type CustomerPortalAuth = {
  mode: "telegram" | "email" | "local_demo"
  init_data_valid: boolean
  user: {
    id: string
    first_name?: string
    last_name?: string
    username?: string
    email?: string
  }
  query_id: string | null
  chat_id: string
  auth_date: number | null
  email: string | null
  channel: "telegram" | "web_catalog"
  preferred_channel: "telegram" | "email"
  warnings: string[]
}

export class CustomerPortalAuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message)
    this.name = "CustomerPortalAuthError"
  }
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null
  const email = value.trim().toLowerCase()
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CustomerPortalAuthError("Введите корректный email", 400)
  }
  return email
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function fromTelegram(auth: TelegramMiniAppAuth): CustomerPortalAuth {
  return {
    mode: auth.mode,
    init_data_valid: auth.init_data_valid,
    user: {
      id: String(auth.user.id),
      first_name: auth.user.first_name,
      last_name: auth.user.last_name,
      username: auth.user.username
    },
    query_id: auth.query_id,
    chat_id: auth.chat_id,
    auth_date: auth.auth_date,
    email: null,
    channel: "telegram",
    preferred_channel: "telegram",
    warnings: auth.warnings
  }
}

function emailAuth(input: CustomerPortalAuthInput, email: string): CustomerPortalAuth {
  const requiredAccessCode = process.env.CUSTOMER_PORTAL_SHARED_ACCESS_CODE?.trim()
  const accessCode = clean(input.accessCode)
  if (requiredAccessCode && accessCode !== requiredAccessCode) {
    throw new CustomerPortalAuthError("Неверный код доступа", 403)
  }

  const contactName = clean(input.profile?.contact_name)
  return {
    mode: "email",
    init_data_valid: false,
    user: {
      id: `email:${email}`,
      first_name: contactName ?? email,
      email
    },
    query_id: null,
    chat_id: `email:${email}`,
    auth_date: null,
    email,
    channel: "web_catalog",
    preferred_channel: "email",
    warnings: requiredAccessCode ? [] : ["Email-вход работает без серверного кода доступа: задайте CUSTOMER_PORTAL_SHARED_ACCESS_CODE для закрытого режима."]
  }
}

export function customerPortalDisplayName(auth: CustomerPortalAuth) {
  if (auth.mode === "telegram") {
    return telegramDisplayName({
      id: Number(auth.user.id),
      first_name: auth.user.first_name,
      last_name: auth.user.last_name,
      username: auth.user.username
    })
  }
  return [auth.user.first_name, auth.user.last_name].filter(Boolean).join(" ").trim() || auth.email || auth.user.id
}

export function authenticateCustomerPortal(input: CustomerPortalAuthInput): CustomerPortalAuth {
  if (input.initData?.trim()) {
    return fromTelegram(authenticateTelegramMiniApp(input.initData))
  }

  const email = normalizeEmail(input.email ?? input.profile?.email)
  if (email) return emailAuth(input, email)

  if (process.env.MINIAPP_DEMO_MODE === "1") {
    return fromTelegram(authenticateTelegramMiniApp(null))
  }

  throw new CustomerPortalAuthError("Для входа в web-каталог нужен email")
}
