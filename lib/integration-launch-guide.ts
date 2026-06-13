import { getIntegrationStatus, getPublicBaseUrl } from "@/lib/external-integrations"

export type LaunchGuideStep = {
  id: string
  title: string
  status: "done" | "needed" | "optional"
  action: string
}

export type LaunchGuideEnvKey = {
  key: string
  label: string
  configured: boolean
  required: boolean
  secret: boolean
}

export type LaunchGuideShareLink = {
  id: string
  title: string
  audience: "client" | "manager" | "telegram" | "operator"
  url: string | null
  available: boolean
  note: string
}

export type LaunchGuideShareAsset = {
  id: string
  title: string
  audience: "client" | "manager" | "operator"
  channel: "telegram" | "web" | "crm"
  url: string | null
  available: boolean
  message: string
  telegram_share_url: string | null
  telegram_startapp_url: string | null
  qr_payload_url: string | null
  qr_image_url: string | null
  note: string
}

export type LaunchGuideConnectionItem = {
  id: string
  title: string
  provider: string
  required: boolean
  configured: boolean
  status: "ready" | "missing_required" | "optional_missing"
  env_keys: string[]
  official_url: string | null
  why_it_matters: string
  next_action: string
  crm_surface: string
  safe_handling: string
}

export type LaunchGuideOperatorHandoff = {
  botfather: {
    open_url: string
    bot_name: string
    suggested_username: string
    bot_url_hint: string
    short_description: string
    description: string
    commands: string[]
    token_instruction: string
    miniapp_setup: {
      required: boolean
      configured: boolean
      short_name_env_key: "TELEGRAM_MINIAPP_SHORT_NAME"
      short_name: string | null
      suggested_short_name: string
      miniapp_url: string | null
      local_miniapp_url: string
      fallback_startapp_url: string | null
      named_startapp_url: string | null
      botfather_commands: string[]
      instructions: string[]
      note: string
    }
  }
  env_template: Array<{
    key: string
    required: boolean
    secret: boolean
    value_hint: string
    where_to_get: string
  }>
  connection_checklist: LaunchGuideConnectionItem[]
  share_links: LaunchGuideShareLink[]
  share_assets: LaunchGuideShareAsset[]
  telegram_entrypoints: Array<{
    id: string
    title: string
    command: string
    url: string | null
    available: boolean
    note: string
  }>
  success_criteria: string[]
}

export type IntegrationLaunchGuide = {
  ok: boolean
  generated_at: string
  links: {
    public_base_url: string | null
    miniapp_url: string | null
    webhook_url: string | null
    local_miniapp_url: string
  }
  commands: {
    env_bootstrap: string
    launch_telegram_bot: string
    setup_telegram_bot: string
    run_preflight: string
    preview_telegram_setup: string
  }
  env: LaunchGuideEnvKey[]
  steps: LaunchGuideStep[]
  operator_handoff: LaunchGuideOperatorHandoff
  handoff_note: string
}

function publicLink(path: string) {
  const publicBaseUrl = getPublicBaseUrl()
  return publicBaseUrl ? `${publicBaseUrl}${path}` : null
}

function publicOrLocalLink(path: string) {
  return publicLink(path) ?? `http://localhost:3011${path}`
}

function telegramShareUrl(url: string | null, message: string) {
  if (!url) return null
  const share = new URL("https://t.me/share/url")
  share.searchParams.set("url", url)
  share.searchParams.set("text", message)
  return share.toString()
}

function qrImageUrl(url: string | null) {
  if (!url) return null
  return publicOrLocalLink(`/api/integrations/share-qr?url=${encodeURIComponent(url)}`)
}

function miniappShortName() {
  const value = process.env.TELEGRAM_MINIAPP_SHORT_NAME?.trim()
  if (!value) return null
  return value.replace(/^@/, "").replace(/[^a-zA-Z0-9_-]/g, "")
}

function telegramStartappUrl(botUsername: string, payload: string, shortName: string | null) {
  const username = botUsername.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "")
  const startapp = payload.replace(/[^a-zA-Z0-9_-]/g, "")
  if (!username || !startapp) return null
  const url = new URL(shortName ? `https://t.me/${username}/${shortName}` : `https://t.me/${username}`)
  url.searchParams.set("startapp", startapp)
  return url.toString()
}

function shareAsset(input: Omit<LaunchGuideShareAsset, "telegram_share_url" | "qr_payload_url" | "qr_image_url">): LaunchGuideShareAsset {
  const primaryShareUrl = input.telegram_startapp_url ?? input.url
  return {
    ...input,
    telegram_share_url: telegramShareUrl(primaryShareUrl, input.message),
    qr_payload_url: primaryShareUrl,
    qr_image_url: qrImageUrl(primaryShareUrl)
  }
}

function connectionStatus(configured: boolean, required: boolean): LaunchGuideConnectionItem["status"] {
  if (configured) return "ready"
  return required ? "missing_required" : "optional_missing"
}

export function buildIntegrationLaunchGuide(): IntegrationLaunchGuide {
  const status = getIntegrationStatus()
  const publicBaseUrl = getPublicBaseUrl()
  const botName = process.env.TELEGRAM_BOT_DISPLAY_NAME?.trim() || "Lunch Up заказы"
  const suggestedUsername = process.env.TELEGRAM_BOT_SUGGESTED_USERNAME?.trim() || "lunch_up_orders_bot"
  const miniappShort = miniappShortName()
  const shortDescription = process.env.TELEGRAM_BOT_SHORT_DESCRIPTION?.trim() || "Каталог, корзина и B2B-заказы Lunch Up."
  const description =
    process.env.TELEGRAM_BOT_DESCRIPTION?.trim() ||
    "Каталог Lunch Up для юридических лиц: кабинет, корзина и B2B-заказы через Telegram Mini App."
  const env: LaunchGuideEnvKey[] = [
    {
      key: "TELEGRAM_BOT_TOKEN",
      label: "Токен нового бота из BotFather",
      configured: status.telegram_bot.configured,
      required: true,
      secret: true
    },
    {
      key: "TELEGRAM_WEBHOOK_SECRET",
      label: "Секретный заголовок для webhook",
      configured: status.telegram_bot.webhook_secret_configured,
      required: true,
      secret: true
    },
    {
      key: "PUBLIC_BASE_URL",
      label: "Публичная ссылка CRM для Telegram",
      configured: Boolean(publicBaseUrl),
      required: true,
      secret: false
    },
    {
      key: "TELEGRAM_MANAGER_CHAT_ID",
      label: "Чат менеджера для уведомлений",
      configured: status.telegram_bot.manager_chat_configured,
      required: false,
      secret: false
    },
    {
      key: "TELEGRAM_MINIAPP_SHORT_NAME",
      label: "Short name Mini App из BotFather /newapp",
      configured: Boolean(miniappShort),
      required: false,
      secret: false
    },
    {
      key: status.dgis.env_key ?? "DGIS_API_KEY",
      label: "2ГИС Places API для карточек компаний",
      configured: status.dgis.configured,
      required: true,
      secret: true
    },
    {
      key: status.dadata.env_key ?? "DADATA_API_KEY",
      label: "DaData/ФНС для ИНН и численности",
      configured: status.dadata.configured,
      required: true,
      secret: true
    },
    {
      key: "EXTERNAL_ORDER_WEBHOOK_URL",
      label: "Внешняя система заказов: 1C, МойСклад или middleware",
      configured: status.external_order_webhook.configured,
      required: false,
      secret: false
    },
    {
      key: "APIFY_TOKEN",
      label: "Apify actors для защищенного research/enrichment endpoint",
      configured: status.apify.configured,
      required: false,
      secret: true
    },
    {
      key: "APIFY_DEFAULT_RESEARCH_ACTOR_ID",
      label: "Actor по умолчанию для company research",
      configured: Boolean(process.env.APIFY_DEFAULT_RESEARCH_ACTOR_ID),
      required: false,
      secret: false
    }
  ]

  const steps: LaunchGuideStep[] = [
    {
      id: "botfather",
      title: "Создать нового Telegram-бота",
      status: status.telegram_bot.configured ? "done" : "needed",
      action: "В BotFather выполнить /newbot и сохранить выданный токен в TELEGRAM_BOT_TOKEN."
    },
    {
      id: "public_url",
      title: "Подключить публичную ссылку CRM",
      status: publicBaseUrl ? "done" : "needed",
      action: "Задать PUBLIC_BASE_URL или сохранить рабочую tunnel-ссылку в logs/public_crm_url.txt."
    },
    {
      id: "secrets",
      title: "Заполнить серверные ключи",
      status: env.filter((item) => item.required).every((item) => item.configured) ? "done" : "needed",
      action: "Сначала выполнить npm run telegram:env-bootstrap -- --write, затем заполнить внешние ключи в .env.local: TELEGRAM_BOT_TOKEN, DGIS_API_KEY и DADATA_API_KEY."
    },
    {
      id: "telegram_setup",
      title: "Настроить Telegram webhook и кнопку Mini App",
      status: "needed",
      action: "После заполнения ключей запустить npm run telegram:launch. Скрипт проверит конфиг, публичные /miniapp и /api/miniapp/catalog, настроит webhook, меню, команды и выполнит preflight."
    },
    {
      id: "manager_chat",
      title: "Включить уведомления менеджеру",
      status: status.telegram_bot.manager_chat_configured ? "done" : "optional",
      action: "Отправить /whoami новому боту, взять chat id и записать его в TELEGRAM_MANAGER_CHAT_ID."
    },
    {
      id: "preflight",
      title: "Проверить запуск",
      status: "needed",
      action: "Нажать «Проверить запуск» в CRM или открыть /api/integrations/preflight с ключом доступа; проверка должна подтвердить публичные /miniapp и /api/miniapp/catalog."
    },
    {
      id: "apify_research",
      title: "Подключить Apify research",
      status: status.apify.configured && process.env.APIFY_DEFAULT_RESEARCH_ACTOR_ID ? "done" : "optional",
      action: "Для автоматического research заполнить APIFY_TOKEN и APIFY_DEFAULT_RESEARCH_ACTOR_ID, затем сначала вызвать /api/integrations/apify/research в dry_run."
    }
  ]
  const connectionChecklist: LaunchGuideConnectionItem[] = [
    {
      id: "telegram_botfather",
      title: "Новый Telegram-бот и BotFather token",
      provider: "Telegram",
      required: true,
      configured: status.telegram_bot.configured,
      status: connectionStatus(status.telegram_bot.configured, true),
      env_keys: ["TELEGRAM_BOT_TOKEN"],
      official_url: "https://t.me/BotFather",
      why_it_matters: "Без токена CRM не может настроить webhook, меню Mini App и команды /order, /cart, /cabinet, /orders, /whoami.",
      next_action: status.telegram_bot.configured ? "Токен задан; можно запускать telegram:check и telegram:launch." : "Открыть BotFather, выполнить /newbot и записать токен только на сервере.",
      crm_surface: "Telegram API: пакет запуска бота и setup preview.",
      safe_handling: "Токен не показывается в CRM, не хранится в SQLite и не отправляется клиентам."
    },
    {
      id: "telegram_public_webhook",
      title: "Публичный Mini App URL и защищенный webhook",
      provider: "Telegram Web Apps",
      required: true,
      configured: Boolean(publicBaseUrl) && status.telegram_bot.webhook_secret_configured,
      status: connectionStatus(Boolean(publicBaseUrl) && status.telegram_bot.webhook_secret_configured, true),
      env_keys: ["PUBLIC_BASE_URL", "TELEGRAM_WEBHOOK_SECRET"],
      official_url: "https://core.telegram.org/bots/webapps",
      why_it_matters: "Telegram должен открыть /miniapp клиенту и отправлять webhook в CRM без CRM key, но с Telegram secret header.",
      next_action:
        publicBaseUrl && status.telegram_bot.webhook_secret_configured
          ? "Публичная ссылка и webhook secret заданы; подтвердить через preflight."
          : "Задать PUBLIC_BASE_URL и TELEGRAM_WEBHOOK_SECRET, затем проверить /miniapp и webhook preflight.",
      crm_surface: "Mini App, /api/telegram/webhook, /api/integrations/preflight.",
      safe_handling: "Webhook secret возвращается только как признак готовности или redacted preview."
    },
    {
      id: "dgis_places",
      title: "2ГИС Places API для карточек компаний",
      provider: "2GIS",
      required: true,
      configured: status.dgis.configured,
      status: connectionStatus(status.dgis.configured, true),
      env_keys: [status.dgis.env_key ?? "DGIS_API_KEY"],
      official_url: "https://docs.2gis.com/en/api/search/places/overview",
      why_it_matters: "CRM подтягивает адрес, телефон, сайт, рубрики, филиалы и признаки размера компании для КП.",
      next_action: status.dgis.configured ? "Ключ задан; проверить 2ГИС в preflight и enrichment." : "Получить server-side API key 2ГИС Places API и записать DGIS_API_KEY.",
      crm_surface: "Компании: кнопка 2ГИС/ФНС, Mini App enrichment, company_enrichment_sources.",
      safe_handling: "Ключ используется только server-side; Mini App получает результат, а не сам ключ."
    },
    {
      id: "dadata_fns",
      title: "DaData / ФНС для ИНН и численности",
      provider: "DaData",
      required: true,
      configured: status.dadata.configured,
      status: connectionStatus(status.dadata.configured, true),
      env_keys: [status.dadata.env_key ?? "DADATA_API_KEY"],
      official_url: "https://dadata.ru/api/suggest/party/",
      why_it_matters: "CRM использует ИНН, юрназвание и доступные ФНС-сигналы численности, чтобы считать диапазон людей в офисе.",
      next_action: status.dadata.configured ? "Ключ задан; проверить DaData в preflight и enrichment." : "Получить API token DaData и записать DADATA_API_KEY.",
      crm_surface: "Mini App кабинет, Компании, расчет КП и блок источников численности.",
      safe_handling: "В КП выводится диапазон и confidence, а не ложное точное число сотрудников."
    },
    {
      id: "apify_research",
      title: "Apify Store для расширенного company research",
      provider: "Apify",
      required: false,
      configured: status.apify.configured,
      status: connectionStatus(status.apify.configured, false),
      env_keys: ["APIFY_TOKEN", "APIFY_DEFAULT_RESEARCH_ACTOR_ID"],
      official_url: "https://console.apify.com/store",
      why_it_matters: "Агенты смогут запускать подтвержденные actors для публичного B2B research и проверки сайтов.",
      next_action: status.apify.configured ? "Токен задан; запускать actors только через dry_run и confirm_run." : "Оставить optional или добавить APIFY_TOKEN для будущего research worker.",
      crm_surface: "/api/integrations/apify/research и очередь ai_tasks.",
      safe_handling: "Actor-запуски требуют dry_run/confirm_run и не меняют сделки без проверки менеджером."
    },
    {
      id: "external_order_export",
      title: "Внешний экспорт заказов",
      provider: "1C / МойСклад / middleware",
      required: false,
      configured: status.external_order_webhook.configured,
      status: connectionStatus(status.external_order_webhook.configured, false),
      env_keys: ["EXTERNAL_ORDER_WEBHOOK_URL", "EXTERNAL_ORDER_WEBHOOK_TOKEN"],
      official_url: null,
      why_it_matters: "После оформления Mini App заказа CRM сможет отправить заказ во внешнюю учетную или складскую систему.",
      next_action: status.external_order_webhook.configured ? "Webhook задан; контролировать integration_events." : "Подключить позже, когда будет выбран внешний контур заказов.",
      crm_surface: "/api/integrations/orders/export и integration_events.",
      safe_handling: "Токен внешнего webhook не возвращается в UI; события пишутся в audit-журнал."
    }
  ]
  const shareLinks: LaunchGuideShareLink[] = [
    {
      id: "client_miniapp",
      title: "Mini App для клиента",
      audience: "client",
      url: publicLink("/miniapp"),
      available: Boolean(publicBaseUrl),
      note: "Давать клиенту после настройки Telegram-бота; внутри Telegram кнопка откроет этот Mini App."
    },
    {
      id: "client_catalog",
      title: "Клиентский каталог",
      audience: "client",
      url: publicLink("/catalog") ?? "http://localhost:3011/catalog",
      available: Boolean(publicBaseUrl),
      note: "Можно отправлять как A4/PDF-ориентированный каталог без доступа к CRM."
    },
    {
      id: "telegram_webhook",
      title: "Webhook для Telegram",
      audience: "telegram",
      url: publicLink("/api/telegram/webhook"),
      available: Boolean(publicBaseUrl),
      note: "Не отправлять клиентам; этот URL используется только в setWebhook вместе с TELEGRAM_WEBHOOK_SECRET."
    },
    {
      id: "operator_crm",
      title: "CRM для менеджера",
      audience: "operator",
      url: "http://localhost:3011",
      available: true,
      note: "Для внешнего доступа нужен публичный туннель или LAN-ссылка и CRM_ACCESS_KEY; сам ключ не показывается в handoff."
    },
    {
      id: "manager_chat",
      title: "Chat id менеджера",
      audience: "manager",
      url: null,
      available: status.telegram_bot.configured,
      note: "После запуска бота менеджер отправляет /whoami, затем chat id записывается в TELEGRAM_MANAGER_CHAT_ID."
    }
  ]
  const telegramEntrypoints = [
    {
      id: "order",
      title: "Новый заказ",
      command: "/order",
      url: publicLink("/miniapp?tg_view=catalog&tg_intent=order"),
      available: Boolean(publicBaseUrl),
      note: "Клиент попадает в каталог и корзину Mini App."
    },
    {
      id: "orders",
      title: "История и повтор",
      command: "/orders",
      url: publicLink("/miniapp?tg_view=cabinet&tg_intent=orders"),
      available: Boolean(publicBaseUrl),
      note: "Клиент попадает в личный кабинет, историю заказов и повтор."
    },
    {
      id: "cart",
      title: "Корзина и оформление",
      command: "/cart",
      url: publicLink("/miniapp?tg_view=cart&tg_intent=cart"),
      available: Boolean(publicBaseUrl),
      note: "Клиент попадает сразу в корзину, доставку и оформление заказа."
    },
    {
      id: "cabinet",
      title: "Личный кабинет",
      command: "/cabinet",
      url: publicLink("/miniapp?tg_view=cabinet&tg_intent=cabinet"),
      available: Boolean(publicBaseUrl),
      note: "Клиент попадает в профиль компании, контакты, адрес доставки и расчет КП."
    },
    {
      id: "whoami",
      title: "Chat id менеджера",
      command: "/whoami",
      url: null,
      available: status.telegram_bot.configured,
      note: "Менеджер отправляет команду боту, затем полученный chat id записывается в TELEGRAM_MANAGER_CHAT_ID."
    }
  ]
  const botUrlHint = `https://t.me/${suggestedUsername.replace(/^@/, "")}`
  const startappOrderUrl = telegramStartappUrl(suggestedUsername, "order", miniappShort)
  const startappCartUrl = telegramStartappUrl(suggestedUsername, "cart", miniappShort)
  const startappCabinetUrl = telegramStartappUrl(suggestedUsername, "cabinet", miniappShort)
  const startappOrdersUrl = telegramStartappUrl(suggestedUsername, "orders", miniappShort)
  const fallbackStartappOrderUrl = telegramStartappUrl(suggestedUsername, "order", null)
  const suggestedMiniappShortName = miniappShort ?? "lunchup"
  const miniappUrl = publicLink("/miniapp")
  const shareAssets: LaunchGuideShareAsset[] = [
    shareAsset({
      id: "client_order_miniapp",
      title: "Клиенту: открыть каталог и сделать заказ",
      audience: "client",
      channel: "telegram",
      url: publicLink("/miniapp?tg_view=catalog&tg_intent=order"),
      available: Boolean(publicBaseUrl),
      message: "Откройте каталог Lunch Up, выберите позиции и отправьте заказ через корзину.",
      telegram_startapp_url: startappOrderUrl,
      note: "Основная ссылка для клиента после настройки публичного Mini App URL."
    }),
    shareAsset({
      id: "client_cart_miniapp",
      title: "Клиенту: продолжить оформление корзины",
      audience: "client",
      channel: "telegram",
      url: publicLink("/miniapp?tg_view=cart&tg_intent=cart"),
      available: Boolean(publicBaseUrl),
      message: "Перейдите в корзину Lunch Up, проверьте позиции, адрес и дату доставки.",
      telegram_startapp_url: startappCartUrl,
      note: "Использовать, когда клиент уже собрал заказ или менеджер просит завершить оформление."
    }),
    shareAsset({
      id: "client_cabinet_miniapp",
      title: "Клиенту: заполнить кабинет компании",
      audience: "client",
      channel: "telegram",
      url: publicLink("/miniapp?tg_view=cabinet&tg_intent=cabinet"),
      available: Boolean(publicBaseUrl),
      message: "Заполните кабинет компании Lunch Up: ИНН, адрес, контакт и примерное количество людей в офисе.",
      telegram_startapp_url: startappCabinetUrl,
      note: "Использовать перед КП или первым заказом, чтобы CRM сохранила профиль компании."
    }),
    shareAsset({
      id: "client_orders_startapp",
      title: "Клиенту: история и повтор заказа",
      audience: "client",
      channel: "telegram",
      url: publicLink("/miniapp?tg_view=cabinet&tg_intent=orders"),
      available: Boolean(publicBaseUrl),
      message: "Откройте историю заказов Lunch Up, чтобы повторить прошлую корзину.",
      telegram_startapp_url: startappOrdersUrl,
      note: "Использовать для повторных клиентов и после подтверждения первого заказа."
    }),
    shareAsset({
      id: "client_public_catalog",
      title: "Клиенту: web-каталог без CRM",
      audience: "client",
      channel: "web",
      url: publicLink("/catalog"),
      available: Boolean(publicBaseUrl),
      message: "Посмотрите клиентский каталог Lunch Up и выберите интересующие позиции для пилотной поставки.",
      telegram_startapp_url: null,
      note: "Подходит для отправки директору или клиенту, когда заказ через Telegram еще не подключен."
    }),
    shareAsset({
      id: "client_bot_entry",
      title: "Клиенту: ссылка на Telegram-бота",
      audience: "client",
      channel: "telegram",
      url: botUrlHint,
      available: status.telegram_bot.configured,
      message: "Откройте бота Lunch Up и отправьте /order, чтобы сделать заказ через Mini App.",
      telegram_startapp_url: startappOrderUrl,
      note: "Эта ссылка станет рабочей после создания бота в BotFather и настройки webhook."
    }),
    shareAsset({
      id: "operator_crm_entry",
      title: "Менеджеру: открыть CRM",
      audience: "operator",
      channel: "crm",
      url: publicBaseUrl ?? "http://localhost:3011",
      available: true,
      message: "Откройте CRM Lunch Up для обработки лидов, заказов и Telegram Mini App.",
      telegram_startapp_url: null,
      note: "CRM_ACCESS_KEY передается отдельно и не включается в operator_handoff или share asset."
    })
  ]

  return {
    ok: env.filter((item) => item.required).every((item) => item.configured) && Boolean(publicBaseUrl),
    generated_at: new Date().toISOString(),
    links: {
      public_base_url: publicBaseUrl,
      miniapp_url: miniappUrl,
      webhook_url: publicLink("/api/telegram/webhook"),
      local_miniapp_url: "http://localhost:3011/miniapp"
    },
    commands: {
      env_bootstrap: "npm run telegram:env-bootstrap -- --write",
      launch_telegram_bot: "npm run telegram:launch",
      setup_telegram_bot: "npm run telegram:setup",
      run_preflight: "GET /api/integrations/preflight",
      preview_telegram_setup: "GET /api/integrations/telegram/setup-preview"
    },
    env,
    steps,
    operator_handoff: {
      botfather: {
        open_url: "https://t.me/BotFather",
        bot_name: botName,
        suggested_username: suggestedUsername,
        bot_url_hint: botUrlHint,
        short_description: shortDescription,
        description,
        commands: [
          "/newbot",
          botName,
          suggestedUsername,
          "/setdescription",
          botName,
          description,
          "/setabouttext",
          botName,
          shortDescription,
          "/setcommands",
          "start - открыть каталог и личный кабинет",
          "order - оформить заказ Lunch Up",
          "cart - открыть корзину и оформление",
          "cabinet - открыть личный кабинет",
          "orders - открыть историю заказов",
          "help - показать команды и условия заказа",
          "whoami - показать chat id для уведомлений"
        ],
        token_instruction: "После /newbot BotFather выдаст TELEGRAM_BOT_TOKEN. Его нужно записать только в .env.local, не отправлять клиентам и не вставлять в CRM-сообщения.",
        miniapp_setup: {
          required: false,
          configured: Boolean(miniappShort),
          short_name_env_key: "TELEGRAM_MINIAPP_SHORT_NAME",
          short_name: miniappShort,
          suggested_short_name: suggestedMiniappShortName,
          miniapp_url: miniappUrl,
          local_miniapp_url: "http://localhost:3011/miniapp",
          fallback_startapp_url: fallbackStartappOrderUrl,
          named_startapp_url: miniappShort ? startappOrderUrl : null,
          botfather_commands: [
            "/newapp",
            suggestedUsername,
            "Lunch Up заказ",
            "Каталог, корзина и личный кабинет Lunch Up для B2B-заказов.",
            miniappUrl ?? "https://<public-crm-url>/miniapp",
            suggestedMiniappShortName
          ],
          instructions: [
            "Сначала создать бота через /newbot и сохранить TELEGRAM_BOT_TOKEN только на сервере.",
            "Затем в BotFather выполнить /newapp, выбрать этого бота и указать публичный Mini App URL.",
            "Short name записать в TELEGRAM_MINIAPP_SHORT_NAME; это не секрет, он нужен для прямых ссылок вида https://t.me/<bot>/<short>?startapp=order.",
            "Если short name еще не создан, CRM продолжит давать fallback-ссылку https://t.me/<bot>?startapp=order."
          ],
          note: "Mini App short name не заменяет webhook и токен. Он нужен, чтобы клиентская ссылка выглядела как отдельное Telegram-приложение и открывала нужный экран через startapp."
        }
      },
      env_template: [
        {
          key: "TELEGRAM_BOT_TOKEN",
          required: true,
          secret: true,
          value_hint: "token из BotFather",
          where_to_get: "BotFather после /newbot"
        },
        {
          key: "TELEGRAM_WEBHOOK_SECRET",
          required: true,
          secret: true,
          value_hint: "генерируется telegram:env-bootstrap",
          where_to_get: "npm run telegram:env-bootstrap -- --write"
        },
        {
          key: "PUBLIC_BASE_URL",
          required: true,
          secret: false,
          value_hint: publicBaseUrl ?? "https://<tunnel>.trycloudflare.com",
          where_to_get: "текущий публичный туннель CRM или production URL"
        },
        {
          key: "DGIS_API_KEY",
          required: true,
          secret: true,
          value_hint: "ключ 2ГИС Places API",
          where_to_get: "кабинет разработчика 2ГИС"
        },
        {
          key: "DADATA_API_KEY",
          required: true,
          secret: true,
          value_hint: "API token DaData",
          where_to_get: "кабинет DaData"
        },
        {
          key: "TELEGRAM_MANAGER_CHAT_ID",
          required: false,
          secret: false,
          value_hint: "chat id из /whoami",
          where_to_get: "сообщение /whoami новому боту"
        },
        {
          key: "TELEGRAM_MINIAPP_SHORT_NAME",
          required: false,
          secret: false,
          value_hint: miniappShort ?? "например lunchup",
          where_to_get: "BotFather /newapp, если нужен прямой путь https://t.me/<bot>/<short>?startapp=order"
        }
      ],
      connection_checklist: connectionChecklist,
      share_links: shareLinks,
      share_assets: shareAssets,
      telegram_entrypoints: telegramEntrypoints,
      success_criteria: [
        "npm run telegram:check показывает Config: READY.",
        "npm run telegram:launch завершает setup без вывода секретов.",
        "Preflight показывает miniapp_public=ok, miniapp_catalog=ok и telegram_webhook_public_access=ok.",
        "Команда /order в Telegram открывает каталог и корзину Mini App.",
        "Команды /cart и /cabinet открывают нужные состояния Mini App без лишних кликов.",
        "Тестовый заказ попадает в CRM во вкладку Заказы и содержит order_items."
      ]
    },
    handoff_note:
      "Передавать другому человеку нужно ссылку на Mini App или CRM с ключом доступа. Секреты .env.local, TELEGRAM_BOT_TOKEN, DGIS_API_KEY и DADATA_API_KEY не отправлять клиентам."
  }
}
