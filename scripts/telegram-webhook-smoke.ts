import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  applyMiniappIntentToUrl,
  miniappViewForIntent,
  resolveMiniappEntryIntent,
  telegramMiniappIntentSmokeCases
} from "../lib/telegram-intents.ts"

const smokeMode = "no-network/no-database"

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

function publicBaseUrl() {
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || readSavedPublicBaseUrl() || "http://localhost:3011"
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const baseMiniappUrl = `${publicBaseUrl()}/miniapp`
const rows = telegramMiniappIntentSmokeCases.map((item) => {
  const actualIntent = resolveMiniappEntryIntent(item.text)
  const actualView = actualIntent ? miniappViewForIntent(actualIntent) : null
  const miniappUrl = actualIntent ? applyMiniappIntentToUrl(baseMiniappUrl, actualIntent) : null
  assert(
    actualIntent === item.expected_intent,
    `Intent mismatch for "${item.text}": expected ${item.expected_intent}, got ${actualIntent}`
  )
  assert(
    actualView === item.expected_view,
    `View mismatch for "${item.text}": expected ${item.expected_view}, got ${actualView}`
  )
  if (actualIntent === "orders") {
    assert(miniappUrl?.includes("tg_view=cabinet"), `Orders URL must open cabinet view: ${miniappUrl}`)
    assert(miniappUrl?.includes("tg_intent=orders"), `Orders URL must preserve orders intent: ${miniappUrl}`)
  }
  if (actualIntent === "cart") {
    assert(miniappUrl?.includes("tg_view=cart"), `Cart URL must open cart view: ${miniappUrl}`)
    assert(miniappUrl?.includes("tg_intent=cart"), `Cart URL must preserve cart intent: ${miniappUrl}`)
  }
  if (actualIntent === "cabinet") {
    assert(miniappUrl?.includes("tg_view=cabinet"), `Cabinet URL must open cabinet view: ${miniappUrl}`)
    assert(miniappUrl?.includes("tg_intent=cabinet"), `Cabinet URL must preserve cabinet intent: ${miniappUrl}`)
  }
  if (actualIntent === "catalog") {
    assert(!miniappUrl?.includes("tg_view="), `Catalog URL should stay clean: ${miniappUrl}`)
  }
  return {
    text: item.text,
    intent: actualIntent ?? "-",
    view: actualView ?? "-",
    url: miniappUrl ?? "-"
  }
})

console.log("Telegram webhook Mini App intent smoke passed")
console.log(`Mode: ${smokeMode}`)
console.log(`Base Mini App URL: ${baseMiniappUrl}`)
for (const row of rows) {
  console.log(`- ${row.text}: intent=${row.intent}; view=${row.view}; url=${row.url}`)
}
