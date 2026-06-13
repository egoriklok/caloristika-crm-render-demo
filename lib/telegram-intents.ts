export type MiniappEntryIntent = "catalog" | "cart" | "cabinet" | "orders"

export type TelegramMiniappIntentSmokeCase = {
  text: string
  expected_intent: MiniappEntryIntent | null
  expected_view: "catalog" | "cart" | "cabinet" | null
}

export const telegramMiniappIntentSmokeCases: TelegramMiniappIntentSmokeCase[] = [
  { text: "/start", expected_intent: "catalog", expected_view: "catalog" },
  { text: "/order", expected_intent: "catalog", expected_view: "catalog" },
  { text: "каталог", expected_intent: "catalog", expected_view: "catalog" },
  { text: "/orders", expected_intent: "orders", expected_view: "cabinet" },
  { text: "/start orders", expected_intent: "orders", expected_view: "cabinet" },
  { text: "мои заказы", expected_intent: "orders", expected_view: "cabinet" },
  { text: "повторить заказ", expected_intent: "orders", expected_view: "cabinet" },
  { text: "/cart", expected_intent: "cart", expected_view: "cart" },
  { text: "/start cart", expected_intent: "cart", expected_view: "cart" },
  { text: "оформить корзину", expected_intent: "cart", expected_view: "cart" },
  { text: "/cabinet", expected_intent: "cabinet", expected_view: "cabinet" },
  { text: "/start cabinet", expected_intent: "cabinet", expected_view: "cabinet" },
  { text: "реквизиты компании", expected_intent: "cabinet", expected_view: "cabinet" },
  { text: "/help", expected_intent: null, expected_view: null }
]

export function resolveMiniappEntryIntent(text: string | undefined): MiniappEntryIntent | null {
  const value = String(text ?? "").trim().toLowerCase()
  if (!value) return null
  if (/^\/orders\b/.test(value) || /^\/start\s+(orders|history|repeat)\b/.test(value) || /истор|повтор|мои заказ/.test(value)) {
    return "orders"
  }
  if (/^\/(cabinet|profile)\b/.test(value) || /^\/start\s+(cabinet|profile)\b/.test(value) || /кабинет|профил|реквизит/.test(value)) {
    return "cabinet"
  }
  if (/^\/(cart|checkout)\b/.test(value) || /^\/start\s+(cart|checkout)\b/.test(value) || /корзин|оформ/.test(value)) {
    return "cart"
  }
  if (/^\/(start|order)\b/i.test(value) || /каталог|заказ|mini/.test(value)) {
    return "catalog"
  }
  return null
}

export function miniappViewForIntent(intent?: MiniappEntryIntent | null) {
  if (intent === "orders") return "cabinet"
  if (intent === "cart") return "cart"
  if (intent === "cabinet") return "cabinet"
  return "catalog"
}

export function applyMiniappIntentToUrl(miniappUrl: string, intent?: MiniappEntryIntent | null) {
  const url = new URL(miniappUrl)
  const view = miniappViewForIntent(intent)
  if (view !== "catalog") {
    url.searchParams.set("tg_view", view)
    url.searchParams.set("tg_intent", intent ?? view)
  } else {
    url.searchParams.delete("tg_view")
    url.searchParams.delete("tg_intent")
  }
  return url.toString()
}
