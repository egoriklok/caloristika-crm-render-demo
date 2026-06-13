import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const fakeSecrets = [
  "123456:TELEGRAM_LAUNCH_CHECK_SMOKE_TOKEN",
  "telegram-launch-check-smoke-webhook-secret",
  "telegram-launch-check-smoke-dgis-key",
  "telegram-launch-check-smoke-dadata-key",
  "telegram-launch-check-smoke-apify-token"
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function runCheck(args) {
  const result = spawnSync(process.execPath, [join(root, "scripts", "telegram-launch-check.mjs"), ...args], {
    cwd: root,
    env: {
      ...process.env,
      TELEGRAM_BOT_TOKEN: fakeSecrets[0],
      TELEGRAM_WEBHOOK_SECRET: fakeSecrets[1],
      PUBLIC_BASE_URL: "https://telegram-launch-check-smoke.example",
      TELEGRAM_BOT_DISPLAY_NAME: "Lunch Up smoke bot",
      TELEGRAM_BOT_SUGGESTED_USERNAME: "lunch_up_smoke_orders_bot",
      TELEGRAM_MINIAPP_SHORT_NAME: "lunchup",
      DGIS_API_KEY: fakeSecrets[2],
      DADATA_API_KEY: fakeSecrets[3],
      APIFY_TOKEN: fakeSecrets[4],
      APIFY_DEFAULT_RESEARCH_ACTOR_ID: "telegram-launch-check-smoke-actor",
      TELEGRAM_MANAGER_CHAT_ID: "100200300"
    },
    encoding: "utf-8"
  })
  if (result.error) throw result.error
  return result
}

const jsonRun = runCheck(["--json", "--no-network"])
assert(jsonRun.status === 0, `telegram-launch-check --json --no-network failed: ${jsonRun.stderr || jsonRun.stdout}`)
const payload = JSON.parse(jsonRun.stdout)
assert(payload.config_ready === true, "Launch check smoke must report config_ready=true with fake required env")
assert(payload.telegram?.checked === false, "Launch check smoke must skip Telegram network calls in --no-network mode")
assert(payload.botfather?.open_url === "https://t.me/BotFather", "Launch check must include BotFather open URL")
assert(payload.botfather?.bot_url_hint === "https://t.me/lunch_up_smoke_orders_bot", "Launch check must include future bot URL hint")
assert(payload.botfather?.startapp_url_hint === "https://t.me/lunch_up_smoke_orders_bot/lunchup?startapp=order", "Launch check must include future startapp URL hint")
assert(payload.botfather?.token_instruction?.includes("TELEGRAM_BOT_TOKEN"), "Launch check must include token storage instruction")
assert(payload.links?.miniapp_url === "https://telegram-launch-check-smoke.example/miniapp", "Launch check must include public Mini App URL")
assert(payload.links?.webhook_url === "https://telegram-launch-check-smoke.example/api/telegram/webhook", "Launch check must include public webhook URL")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/order" && item.url.includes("tg_intent=order")), "Launch check must include /order Mini App entrypoint")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/order" && item.startapp_url.includes("startapp=order")), "Launch check must include /order startapp entrypoint")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/cart" && item.url.includes("tg_view=cart")), "Launch check must include /cart Mini App entrypoint")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/cart" && item.startapp_url.includes("startapp=cart")), "Launch check must include /cart startapp entrypoint")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/cabinet" && item.url.includes("tg_intent=cabinet")), "Launch check must include /cabinet Mini App entrypoint")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/cabinet" && item.startapp_url.includes("startapp=cabinet")), "Launch check must include /cabinet startapp entrypoint")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/orders" && item.url.includes("tg_view=cabinet")), "Launch check must include /orders Mini App entrypoint")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/orders" && item.startapp_url.includes("startapp=orders")), "Launch check must include /orders startapp entrypoint")
assert(payload.telegram_entrypoints?.some((item) => item.command === "/whoami"), "Launch check must include /whoami manager entrypoint")

const textRun = runCheck(["--no-network"])
assert(textRun.status === 0, `telegram-launch-check --no-network failed: ${textRun.stderr || textRun.stdout}`)
assert(textRun.stdout.includes("BotFather"), "Text launch check must print BotFather section")
assert(textRun.stdout.includes("Telegram entrypoints"), "Text launch check must print Telegram entrypoints section")
assert(textRun.stdout.includes("startapp=order"), "Text launch check must print startapp links")
assert(textRun.stdout.includes("/order"), "Text launch check must print /order command")
assert(textRun.stdout.includes("/cart"), "Text launch check must print /cart command")
assert(textRun.stdout.includes("/cabinet"), "Text launch check must print /cabinet command")
assert(textRun.stdout.includes("/orders"), "Text launch check must print /orders command")
assert(textRun.stdout.includes("/whoami"), "Text launch check must print /whoami command")

const combinedOutput = `${jsonRun.stdout}\n${jsonRun.stderr}\n${textRun.stdout}\n${textRun.stderr}`
for (const secret of fakeSecrets) {
  assert(!combinedOutput.includes(secret), `Launch check output must not expose secret value: ${secret}`)
}

console.log("Telegram launch check smoke passed")
console.log("Mode: no-network/secret-redaction/operator-handoff")
console.log("- botfather: present")
console.log("- entrypoints: /order, /cart, /cabinet, /orders, /whoami")
console.log("- secret values: redacted")
