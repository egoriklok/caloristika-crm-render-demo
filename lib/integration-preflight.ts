import { getIntegrationStatus, getPublicBaseUrl } from "@/lib/external-integrations"

export type IntegrationPreflightCheck = {
  key: string
  label: string
  status: "ok" | "warning" | "blocked"
  message: string
  evidence?: string | null
}

export type IntegrationPreflightResult = {
  ok: boolean
  checked_at: string
  public_base_url: string | null
  checks: IntegrationPreflightCheck[]
}

function check(key: string, label: string, status: IntegrationPreflightCheck["status"], message: string, evidence?: string | null) {
  return { key, label, status, message, evidence } satisfies IntegrationPreflightCheck
}

async function telegramApi(method: string, token: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
  return {
    response,
    payload: (await response.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 7000, headers: Record<string, string> = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "LunchUpCRM/0.1 integration-preflight",
        ...headers
      }
    })
  } finally {
    clearTimeout(timeout)
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function apiBaseUrl(value: string | undefined, fallback: string) {
  const cleaned = cleanText(value)
  if (!cleaned) return fallback
  try {
    return new URL(cleaned).toString()
  } catch {
    return fallback
  }
}

function dadataEndpoint(path: string) {
  const base = cleanText(process.env.DADATA_API_BASE_URL)
  if (!base) return `https://suggestions.dadata.ru${path}`
  try {
    return new URL(path, base.endsWith("/") ? base : `${base}/`).toString()
  } catch {
    return `https://suggestions.dadata.ru${path}`
  }
}

async function checkTelegramWebhookPublicAccess(publicBaseUrl: string | null, webhookSecret: string | undefined) {
  if (!publicBaseUrl) {
    return check("telegram_webhook_public_access", "Публичный Telegram webhook", "blocked", "Нельзя проверить webhook без PUBLIC_BASE_URL или сохраненной tunnel-ссылки.")
  }
  if (!webhookSecret) {
    return check("telegram_webhook_public_access", "Публичный Telegram webhook", "blocked", "TELEGRAM_WEBHOOK_SECRET не задан; публичный webhook должен открываться только с Telegram secret header.")
  }

  const webhookUrl = `${publicBaseUrl}/api/telegram/webhook`
  try {
    const response = await fetchWithTimeout(webhookUrl, 7000, {
      "x-telegram-bot-api-secret-token": webhookSecret
    })
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; endpoint?: string; secret_configured?: boolean } | null
    return response.ok && payload?.ok === true && payload.endpoint === "/api/telegram/webhook" && payload.secret_configured === true
      ? check("telegram_webhook_public_access", "Публичный Telegram webhook", "ok", "Webhook доступен без CRM key при корректном Telegram secret header.", webhookUrl)
      : check("telegram_webhook_public_access", "Публичный Telegram webhook", "blocked", `Webhook не подтвердил публичный доступ с secret header; HTTP ${response.status}.`, webhookUrl)
  } catch (error) {
    return check("telegram_webhook_public_access", "Публичный Telegram webhook", "blocked", "Публичный webhook не открылся с Telegram secret header.", error instanceof Error ? error.message : null)
  }
}

async function checkMiniappPublicRoutes(publicBaseUrl: string | null) {
  if (!publicBaseUrl) {
    return [
      check("miniapp_public", "Публичный Mini App", "blocked", "Нельзя проверить Mini App без PUBLIC_BASE_URL или сохраненной tunnel-ссылки."),
      check("miniapp_catalog", "Публичный каталог Mini App", "blocked", "Нельзя проверить каталог Mini App без публичной ссылки.")
    ]
  }

  const miniappUrl = `${publicBaseUrl}/miniapp`
  const catalogUrl = `${publicBaseUrl}/api/miniapp/catalog`
  const checks: IntegrationPreflightCheck[] = []

  try {
    const response = await fetchWithTimeout(miniappUrl, 15000)
    const html = await response.text().catch(() => "")
    const looksLikeMiniapp = /<html|_next\/static|Lunch Up|TelegramMiniappOrder|miniapp/i.test(html)
    checks.push(
      response.ok && looksLikeMiniapp
        ? check("miniapp_public", "Публичный Mini App", "ok", "Публичная страница Mini App открывается.", miniappUrl)
        : check("miniapp_public", "Публичный Mini App", "blocked", `Mini App URL вернул HTTP ${response.status}.`, miniappUrl)
    )
  } catch (error) {
    checks.push(check("miniapp_public", "Публичный Mini App", "blocked", "Публичный Mini App не открылся.", error instanceof Error ? error.message : null))
  }

  try {
    const response = await fetchWithTimeout(catalogUrl, 10000)
    const payload = (await response.json().catch(() => null)) as { products?: unknown[] } | null
    const productCount = payload?.products?.length ?? 0
    checks.push(
      response.ok && productCount > 0
        ? check("miniapp_catalog", "Публичный каталог Mini App", "ok", "Публичный API каталога отвечает товарами.", `${catalogUrl}; products: ${productCount}`)
        : check("miniapp_catalog", "Публичный каталог Mini App", "blocked", `Каталог Mini App не вернул товары; HTTP ${response.status}.`, catalogUrl)
    )
  } catch (error) {
    checks.push(check("miniapp_catalog", "Публичный каталог Mini App", "blocked", "Публичный API каталога Mini App не открылся.", error instanceof Error ? error.message : null))
  }

  return checks
}

async function checkTelegramBot(token: string | undefined, publicBaseUrl: string | null) {
  if (!token) {
    return [
      check("telegram_bot", "Telegram BotFather", "blocked", "TELEGRAM_BOT_TOKEN не задан. Создайте бота в BotFather и добавьте токен на сервер."),
      check("telegram_webhook", "Telegram webhook", "blocked", "Webhook нельзя проверить без TELEGRAM_BOT_TOKEN.")
    ]
  }

  try {
    const me = await telegramApi("getMe", token)
    const bot = me.payload?.result as { username?: string } | undefined
    const botCheck = me.payload?.ok
      ? check("telegram_bot", "Telegram BotFather", "ok", "Токен Telegram отвечает.", bot?.username ? `@${bot.username}` : null)
      : check("telegram_bot", "Telegram BotFather", "blocked", me.payload?.description ?? "Telegram не подтвердил токен.")

    const webhook = await telegramApi("getWebhookInfo", token)
    const info = webhook.payload?.result as { url?: string; pending_update_count?: number; last_error_message?: string } | undefined
    const expectedUrl = publicBaseUrl ? `${publicBaseUrl}/api/telegram/webhook` : null
    const webhookMatches = Boolean(expectedUrl && info?.url === expectedUrl)
    const webhookCheck = webhook.payload?.ok
      ? webhookMatches
        ? check("telegram_webhook", "Telegram webhook", "ok", "Webhook смотрит на текущую публичную CRM.", `${info?.url}; pending: ${info?.pending_update_count ?? 0}`)
        : check(
            "telegram_webhook",
            "Telegram webhook",
            "warning",
            expectedUrl ? "Webhook отличается от текущей публичной ссылки. Запустите npm run telegram:setup." : "PUBLIC_BASE_URL не задан; сверить webhook с Mini App нельзя.",
            info?.last_error_message || info?.url || null
          )
      : check("telegram_webhook", "Telegram webhook", "blocked", webhook.payload?.description ?? "Не удалось прочитать webhook.")

    return [botCheck, webhookCheck]
  } catch (error) {
    return [
      check("telegram_bot", "Telegram BotFather", "blocked", "Telegram API недоступен или токен неверный.", error instanceof Error ? error.message : null),
      check("telegram_webhook", "Telegram webhook", "blocked", "Webhook не проверен из-за ошибки Telegram API.")
    ]
  }
}

async function checkDgis() {
  const key = process.env.DGIS_API_KEY ?? process.env.TWO_GIS_API_KEY
  if (!key) {
    return check("dgis", "2ГИС Places API", "blocked", "DGIS_API_KEY не задан. Без него CRM использует локальные данные и эвристику.")
  }
  try {
    const url = new URL(apiBaseUrl(process.env.DGIS_API_BASE_URL, "https://catalog.api.2gis.com/3.0/items"))
    url.searchParams.set("q", "Lunch Up Санкт-Петербург")
    url.searchParams.set("key", key)
    url.searchParams.set("page_size", "1")
    const response = await fetch(url, { cache: "no-store" })
    const payload = (await response.json().catch(() => null)) as { meta?: { message?: string }; result?: { total?: number } } | null
    if (!response.ok) {
      return check("dgis", "2ГИС Places API", "blocked", `2ГИС вернул HTTP ${response.status}.`, payload?.meta?.message ?? null)
    }
    return check("dgis", "2ГИС Places API", "ok", "2ГИС API отвечает на server-side запрос.", `найдено: ${payload?.result?.total ?? 0}`)
  } catch (error) {
    return check("dgis", "2ГИС Places API", "blocked", "Не удалось проверить 2ГИС API.", error instanceof Error ? error.message : null)
  }
}

async function checkDadata() {
  const token = process.env.DADATA_API_KEY ?? process.env.DADATA_TOKEN
  if (!token) {
    return check("dadata", "DaData / ФНС", "blocked", "DADATA_API_KEY не задан. Среднесписочная численность ФНС не подтягивается автоматически.")
  }
  try {
    const response = await fetch(dadataEndpoint("/suggestions/api/4_1/rs/findById/party"), {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: "7812014560", count: 1 })
    })
    const payload = (await response.json().catch(() => null)) as { suggestions?: unknown[] } | null
    if (!response.ok) {
      return check("dadata", "DaData / ФНС", "blocked", `DaData вернула HTTP ${response.status}.`)
    }
    return check("dadata", "DaData / ФНС", "ok", "DaData отвечает на server-side запрос.", `suggestions: ${payload?.suggestions?.length ?? 0}`)
  } catch (error) {
    return check("dadata", "DaData / ФНС", "blocked", "Не удалось проверить DaData API.", error instanceof Error ? error.message : null)
  }
}

export async function runIntegrationPreflight(): Promise<IntegrationPreflightResult> {
  const status = getIntegrationStatus()
  const publicBaseUrl = getPublicBaseUrl()
  const checks: IntegrationPreflightCheck[] = [
    check(
      "public_base_url",
      "Публичная ссылка CRM",
      publicBaseUrl ? "ok" : "blocked",
      publicBaseUrl ? "Публичная ссылка найдена для webhook и Mini App." : "PUBLIC_BASE_URL или logs/public_crm_url.txt не найдены.",
      publicBaseUrl
    ),
    check(
      "webhook_secret",
      "Telegram webhook secret",
      status.telegram_bot.webhook_secret_configured ? "ok" : "blocked",
      status.telegram_bot.webhook_secret_configured ? "TELEGRAM_WEBHOOK_SECRET задан." : "Задайте TELEGRAM_WEBHOOK_SECRET перед запуском webhook."
    ),
    await checkTelegramWebhookPublicAccess(publicBaseUrl, process.env.TELEGRAM_WEBHOOK_SECRET),
    check(
      "miniapp_auth",
      "Mini App auth",
      status.miniapp.auth_required ? "ok" : "warning",
      status.miniapp.auth_required ? "Публичный Mini App требует Telegram initData." : "Включен MINIAPP_DEMO_MODE; для публичного бота его лучше выключить."
    ),
    ...(await checkMiniappPublicRoutes(publicBaseUrl)),
    ...(await checkTelegramBot(process.env.TELEGRAM_BOT_TOKEN, publicBaseUrl)),
    await checkDgis(),
    await checkDadata(),
    check(
      "manager_notifications",
      "Уведомления менеджеру",
      status.telegram_bot.manager_chat_configured ? "ok" : "warning",
      status.telegram_bot.manager_chat_configured ? "TELEGRAM_MANAGER_CHAT_ID задан." : "Новые заказы сохранятся в CRM, но менеджер не получит Telegram-уведомление."
    ),
    check(
      "external_export",
      "Внешний export заказов",
      status.external_order_webhook.configured ? "ok" : "warning",
      status.external_order_webhook.configured ? "EXTERNAL_ORDER_WEBHOOK_URL задан." : "Внешняя система не подключена; заказы остаются в CRM."
    )
  ]

  return {
    ok: checks.every((item) => item.status !== "blocked"),
    checked_at: new Date().toISOString(),
    public_base_url: publicBaseUrl,
    checks
  }
}
