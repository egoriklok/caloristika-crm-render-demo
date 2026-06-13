import { getPublicBaseUrl } from "@/lib/external-integrations"

type TelegramSetupPayload = {
  method: string
  optional: boolean
  payload: Record<string, unknown>
}

function limitText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength - 1).trimEnd() : value
}

function redactedWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET ? "[secret hidden]" : "[not configured]"
}

function botDisplayName() {
  return process.env.TELEGRAM_BOT_DISPLAY_NAME?.trim() || "Lunch Up заказы"
}

function botDescription() {
  return (
    process.env.TELEGRAM_BOT_DESCRIPTION?.trim() ||
    "Каталог Lunch Up для юридических лиц: личный кабинет, корзина, история заказов и повтор заказа через Telegram Mini App."
  )
}

function botShortDescription() {
  return process.env.TELEGRAM_BOT_SHORT_DESCRIPTION?.trim() || "Lunch Up: каталог, корзина и B2B-заказы для СПб и Ленинградской области."
}

function menuButtonText() {
  return process.env.TELEGRAM_MENU_BUTTON_TEXT?.trim() || "Lunch Up заказ"
}

function publicOrLocalMiniappUrl(publicBaseUrl: string | null) {
  return publicBaseUrl ? `${publicBaseUrl}/miniapp` : "http://localhost:3011/miniapp"
}

function publicWebhookUrl(publicBaseUrl: string | null) {
  return publicBaseUrl ? `${publicBaseUrl}/api/telegram/webhook` : null
}

function setupPayloads(publicBaseUrl: string | null): TelegramSetupPayload[] {
  const miniappUrl = publicOrLocalMiniappUrl(publicBaseUrl)
  const webhookUrl = publicWebhookUrl(publicBaseUrl)
  return [
    {
      method: "setMyName",
      optional: true,
      payload: {
        name: limitText(botDisplayName(), 64)
      }
    },
    {
      method: "setMyDescription",
      optional: true,
      payload: {
        description: limitText(botDescription(), 512)
      }
    },
    {
      method: "setMyShortDescription",
      optional: true,
      payload: {
        short_description: limitText(botShortDescription(), 120)
      }
    },
    {
      method: "setWebhook",
      optional: false,
      payload: {
        url: webhookUrl,
        secret_token: redactedWebhookSecret(),
        allowed_updates: ["message", "callback_query"]
      }
    },
    {
      method: "setChatMenuButton",
      optional: false,
      payload: {
        menu_button: {
          type: "web_app",
          text: limitText(menuButtonText(), 64),
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

export function buildTelegramSetupPreview() {
  const publicBaseUrl = getPublicBaseUrl()
  const missing = [
    process.env.TELEGRAM_BOT_TOKEN ? null : "TELEGRAM_BOT_TOKEN",
    process.env.TELEGRAM_WEBHOOK_SECRET ? null : "TELEGRAM_WEBHOOK_SECRET",
    publicBaseUrl ? null : "PUBLIC_BASE_URL or logs/public_crm_url.txt"
  ].filter(Boolean)
  const miniappUrl = publicOrLocalMiniappUrl(publicBaseUrl)
  const webhookUrl = publicWebhookUrl(publicBaseUrl)

  return {
    ok: missing.length === 0,
    mode: "server-side-preview",
    generated_at: new Date().toISOString(),
    links: {
      public_base_url: publicBaseUrl,
      miniapp_url: miniappUrl,
      webhook_url: webhookUrl
    },
    required: {
      missing,
      telegram_bot_token_configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      telegram_webhook_secret_configured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
      public_base_url_configured: Boolean(publicBaseUrl)
    },
    telegram_api: setupPayloads(publicBaseUrl),
    telegram_entrypoints: [
      {
        command: "/order",
        title: "Новый заказ",
        url: `${miniappUrl}?tg_view=catalog&tg_intent=order`,
        note: "Открывает каталог и корзину Mini App."
      },
      {
        command: "/cart",
        title: "Корзина",
        url: `${miniappUrl}?tg_view=cart&tg_intent=cart`,
        note: "Открывает корзину, доставку и оформление заказа."
      },
      {
        command: "/cabinet",
        title: "Кабинет",
        url: `${miniappUrl}?tg_view=cabinet&tg_intent=cabinet`,
        note: "Открывает профиль компании, контакты, адрес доставки и расчет КП."
      },
      {
        command: "/orders",
        title: "История и повтор",
        url: `${miniappUrl}?tg_view=cabinet&tg_intent=orders`,
        note: "Открывает кабинет клиента, историю заказов и повтор заказа."
      },
      {
        command: "/whoami",
        title: "Chat id менеджера",
        url: null,
        note: "Менеджер отправляет команду боту после setup, затем chat id записывается в TELEGRAM_MANAGER_CHAT_ID."
      }
    ],
    note: "Preview does not call Telegram API. TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are never returned."
  }
}
