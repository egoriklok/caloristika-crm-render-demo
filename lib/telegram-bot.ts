import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { getActiveStrategy } from "@/lib/active-strategy"
import { getBotCatalog } from "@/lib/bot-catalog"
import { applyMiniappIntentToUrl, type MiniappEntryIntent } from "@/lib/telegram-intents"

type TelegramInlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; web_app?: { url: string }; url?: string }>>
}

type TelegramOrderItemPreview = {
  name: string
  quantity: number
  line_total: number
}

function publicBaseUrl(requestUrl?: string) {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "")
  if (configured) return configured
  const saved = readSavedPublicBaseUrl()
  if (saved) return saved
  if (requestUrl) {
    const url = new URL(requestUrl)
    return `${url.protocol}//${url.host}`
  }
  return null
}

function readSavedPublicBaseUrl() {
  const path = join(process.cwd(), "logs", "public_crm_url.txt")
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

function baseUrlFromMiniappUrl(miniappUrl: string) {
  const url = new URL(miniappUrl)
  url.search = ""
  url.hash = ""
  url.pathname = url.pathname.replace(/\/miniapp\/?$/, "") || "/"
  return url.toString().replace(/\/$/, "")
}

function telegramBrandName() {
  const configured = process.env.TELEGRAM_BRAND_NAME?.trim()
  if (configured) return configured
  try {
    const catalog = getBotCatalog()
    return catalog.active_strategy.brand_name || process.env.TELEGRAM_BOT_DISPLAY_NAME?.trim() || "B2B Food CRM"
  } catch {
    return process.env.TELEGRAM_BOT_DISPLAY_NAME?.trim() || "B2B Food CRM"
  }
}

function telegramOrderContext() {
  try {
    const catalog = getBotCatalog()
    return {
      brand: catalog.active_strategy.brand_name || telegramBrandName(),
      region: catalog.launch_region || null,
      minimumOrderAmount: Number(catalog.order_terms.minimum_order_amount) || null
    }
  } catch {
    return {
      brand: telegramBrandName(),
      region: process.env.TELEGRAM_ORDER_REGION?.trim() || null,
      minimumOrderAmount: Number(process.env.TELEGRAM_MIN_ORDER_AMOUNT) || null
    }
  }
}

function regionSuffix(region: string | null) {
  return region ? `: ${region}` : ""
}

export function getMiniappPublicUrl(requestUrl?: string, intent?: MiniappEntryIntent | null) {
  const base = publicBaseUrl(requestUrl)
  const miniappUrl = base ? `${base}/miniapp` : getActiveStrategy().miniapp_url || null
  if (!miniappUrl) return null
  return applyMiniappIntentToUrl(miniappUrl, intent)
}

async function callTelegram(method: string, payload: Record<string, unknown>) {
  if (process.env.TELEGRAM_OUTBOUND_DISABLED === "1") {
    return { ok: false, skipped: true, error: "TELEGRAM_OUTBOUND_DISABLED is enabled" }
  }
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, skipped: true, error: "TELEGRAM_BOT_TOKEN is not configured" }
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
  return response.json()
}

export async function sendTelegramTextMessage(chatId: string, text: string, replyMarkup?: TelegramInlineKeyboard) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  })
}

export async function sendManagerOrderNotification(input: {
  order_id: number
  status: string
  total_amount: number
  company_name: string
  delivery_address?: string | null
  delivery_date?: string | null
  instructions?: string | null
  item_count: number
  item_preview?: TelegramOrderItemPreview[]
}) {
  const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID?.trim()
  if (!managerChatId) {
    return { ok: false, skipped: true, error: "TELEGRAM_MANAGER_CHAT_ID is not configured" }
  }

  const brand = telegramBrandName()
  const text = [
    `Новый заказ ${brand} #${input.order_id}`,
    `Компания: ${input.company_name}`,
    `Статус: ${input.status}`,
    `Сумма: ${new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(input.total_amount)}`,
    `Позиций: ${input.item_count}`,
    input.delivery_date ? `Дата доставки: ${input.delivery_date}` : null,
    input.delivery_address ? `Адрес: ${input.delivery_address}` : null,
    input.instructions ? `Комментарий: ${input.instructions}` : null,
    input.item_preview?.length ? "Состав:" : null,
    ...(input.item_preview ?? []).slice(0, 6).map((item) => {
      const lineTotal = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(item.line_total)
      return `- ${item.name}: ${item.quantity} шт. / ${lineTotal}`
    })
  ]
    .filter(Boolean)
    .join("\n")

  return sendTelegramTextMessage(managerChatId, text)
}

export async function sendCustomerOrderStatusMessage(input: {
  chat_id: string | null
  order_id: number
  status: string
  total_amount: number
  manager_comment?: string | null
  request_url?: string | null
}) {
  if (!input.chat_id) {
    return { ok: false, skipped: true, error: "Customer Telegram chat is not linked" }
  }

  const statusText: Record<string, string> = {
    draft: "заказ сохранен как черновик",
    manager_review: "заказ на проверке у менеджера",
    confirmed: "заказ подтвержден",
    in_delivery: "заказ передан в доставку",
    completed: "заказ выполнен",
    blocked_minimum: "нужно добрать до минимальной суммы",
    cancelled: "заказ отменен"
  }
  const brand = telegramBrandName()
  const text = [
    `${brand}: статус заказа #${input.order_id}`,
    statusText[input.status] ?? input.status,
    `Сумма: ${new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(input.total_amount)}`,
    input.manager_comment ? `Комментарий: ${input.manager_comment}` : null
  ]
    .filter(Boolean)
    .join("\n")

  const miniappUrl = getMiniappPublicUrl(input.request_url ?? undefined, "orders")
  const replyMarkup: TelegramInlineKeyboard | undefined = miniappUrl
    ? {
        inline_keyboard: [
          [{ text: "Мои заказы и повтор", web_app: { url: miniappUrl } }],
          [{ text: "Клиентский каталог", url: `${baseUrlFromMiniappUrl(miniappUrl)}/catalog` }]
        ]
      }
    : undefined

  return sendTelegramTextMessage(input.chat_id, text, replyMarkup)
}

export async function sendMiniappEntryMessage(chatId: string, requestUrl?: string, intent: MiniappEntryIntent = "catalog") {
  const miniappUrl = getMiniappPublicUrl(requestUrl, intent)
  if (!miniappUrl) return { ok: false, skipped: true, error: "Mini App public URL is not configured" }
  const baseUrl = baseUrlFromMiniappUrl(miniappUrl)
  const context = telegramOrderContext()
  const buttonText =
    intent === "orders"
      ? "Мои заказы и повтор"
      : intent === "cart"
        ? "Корзина и оформление"
        : intent === "cabinet"
          ? "Кабинет клиента"
          : "Каталог и корзина"
  const message =
    intent === "orders"
      ? `${context.brand}: личный кабинет, история заказов и повтор заказа.`
      : intent === "cart"
        ? `${context.brand}: корзина, доставка и оформление заказа.`
        : intent === "cabinet"
          ? `${context.brand}: кабинет клиента, реквизиты, адрес доставки и история заказов.`
          : `${context.brand}: каталог, корзина, личный кабинет и история заказов для юридических лиц${regionSuffix(context.region)}.`

  const replyMarkup: TelegramInlineKeyboard = {
    inline_keyboard: [
      [{ text: buttonText, web_app: { url: miniappUrl } }],
      [{ text: "Клиентский каталог PDF/A4", url: `${baseUrl}/catalog` }]
    ]
  }

  return sendTelegramTextMessage(chatId, message, replyMarkup)
}

export async function sendTelegramHelpMessage(chatId: string, requestUrl?: string) {
  const miniappUrl = getMiniappPublicUrl(requestUrl)
  const cartUrl = getMiniappPublicUrl(requestUrl, "cart")
  const cabinetUrl = getMiniappPublicUrl(requestUrl, "cabinet")
  const ordersUrl = getMiniappPublicUrl(requestUrl, "orders")
  const replyMarkup: TelegramInlineKeyboard | undefined = miniappUrl
    ? {
        inline_keyboard: [
          [{ text: "Открыть каталог и корзину", web_app: { url: miniappUrl } }],
          ...(cartUrl ? [[{ text: "Корзина и оформление", web_app: { url: cartUrl } }]] : []),
          ...(cabinetUrl ? [[{ text: "Кабинет клиента", web_app: { url: cabinetUrl } }]] : []),
          ...(ordersUrl ? [[{ text: "Мои заказы", web_app: { url: ordersUrl } }]] : []),
      [{ text: "Клиентский каталог PDF/A4", url: `${baseUrlFromMiniappUrl(miniappUrl)}/catalog` }]
    ]
      }
    : undefined
  const context = telegramOrderContext()
  const minimumOrder =
    context.minimumOrderAmount && Number.isFinite(context.minimumOrderAmount)
      ? new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(context.minimumOrderAmount)
      : null
  const text = [
    `${context.brand}: бот заказов`,
    "/order - открыть каталог, корзину и кабинет",
    "/cart - открыть корзину и оформление",
    "/cabinet - открыть личный кабинет",
    "/orders - открыть историю заказов",
    "/whoami - показать chat id для уведомлений менеджеру",
    [minimumOrder ? `Минимальный заказ: ${minimumOrder}` : null, context.region ? `География: ${context.region}` : null]
      .filter(Boolean)
      .join(". ")
  ].join("\n")

  return sendTelegramTextMessage(chatId, text, replyMarkup)
}

export async function sendTelegramChatIdMessage(chatId: string) {
  return sendTelegramTextMessage(
    chatId,
    [
      `Telegram chat id: ${chatId}`,
      "Чтобы получать уведомления о новых Mini App заказах, добавьте это значение в TELEGRAM_MANAGER_CHAT_ID на сервере CRM."
    ].join("\n")
  )
}
