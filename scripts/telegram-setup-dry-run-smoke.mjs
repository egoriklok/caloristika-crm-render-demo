import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const fakeSecrets = [
  "123456:TELEGRAM_SETUP_DRY_RUN_SMOKE_TOKEN",
  "telegram-setup-dry-run-smoke-webhook-secret"
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function runSetup(args) {
  const result = spawnSync(process.execPath, [join(root, "scripts", "setup-telegram-bot.mjs"), ...args], {
    cwd: root,
    env: {
      ...process.env,
      TELEGRAM_BOT_TOKEN: fakeSecrets[0],
      TELEGRAM_WEBHOOK_SECRET: fakeSecrets[1],
      PUBLIC_BASE_URL: "https://telegram-setup-dry-run-smoke.example",
      TELEGRAM_BOT_DISPLAY_NAME: "Lunch Up dry run bot",
      TELEGRAM_BOT_DESCRIPTION: "Dry-run description for Lunch Up Telegram setup.",
      TELEGRAM_BOT_SHORT_DESCRIPTION: "Dry-run short description.",
      TELEGRAM_MENU_BUTTON_TEXT: "Lunch Up заказ"
    },
    encoding: "utf-8"
  })
  if (result.error) throw result.error
  return result
}

const jsonRun = runSetup(["--dry-run", "--json", "--skip-url-preflight"])
assert(jsonRun.status === 0, `setup-telegram-bot dry-run JSON failed: ${jsonRun.stderr || jsonRun.stdout}`)
const payload = JSON.parse(jsonRun.stdout)
assert(payload.mode === "dry-run", "Dry-run setup payload must report mode=dry-run")
assert(payload.links?.miniapp_url === "https://telegram-setup-dry-run-smoke.example/miniapp", "Dry-run setup must expose Mini App URL")
assert(payload.links?.webhook_url === "https://telegram-setup-dry-run-smoke.example/api/telegram/webhook", "Dry-run setup must expose webhook URL")
assert(payload.telegram_api?.some((item) => item.method === "setWebhook" && item.payload?.secret_token === "[secret hidden]"), "Dry-run setup must redact webhook secret")
assert(payload.telegram_api?.some((item) => item.method === "setChatMenuButton" && item.payload?.menu_button?.web_app?.url === payload.links.miniapp_url), "Dry-run setup must include Mini App menu button payload")
const commands = payload.telegram_api?.find((item) => item.method === "setMyCommands")?.payload?.commands ?? []
assert(commands.some((item) => item.command === "order"), "Dry-run setup must include /order command")
assert(commands.some((item) => item.command === "cart"), "Dry-run setup must include /cart command")
assert(commands.some((item) => item.command === "cabinet"), "Dry-run setup must include /cabinet command")
assert(commands.some((item) => item.command === "orders"), "Dry-run setup must include /orders command")
assert(commands.some((item) => item.command === "whoami"), "Dry-run setup must include /whoami command")
assert(payload.telegram_api?.some((item) => item.method === "setMyName"), "Dry-run setup must include bot name payload")
assert(payload.telegram_api?.some((item) => item.method === "setMyDescription"), "Dry-run setup must include bot description payload")
assert(payload.telegram_api?.some((item) => item.method === "setMyShortDescription"), "Dry-run setup must include bot short description payload")

const textRun = runSetup(["--dry-run", "--skip-url-preflight"])
assert(textRun.status === 0, `setup-telegram-bot dry-run text failed: ${textRun.stderr || textRun.stdout}`)
assert(textRun.stdout.includes("Telegram bot setup dry-run"), "Dry-run setup must print text header")
assert(textRun.stdout.includes("setWebhook"), "Dry-run setup text must print setWebhook")
assert(textRun.stdout.includes("setChatMenuButton"), "Dry-run setup text must print setChatMenuButton")
assert(textRun.stdout.includes("setMyCommands"), "Dry-run setup text must print setMyCommands")
assert(textRun.stdout.includes("[secret hidden]"), "Dry-run setup text must print redacted secret marker")

const combinedOutput = `${jsonRun.stdout}\n${jsonRun.stderr}\n${textRun.stdout}\n${textRun.stderr}`
for (const secret of fakeSecrets) {
  assert(!combinedOutput.includes(secret), `Setup dry-run output must not expose secret value: ${secret}`)
}

console.log("Telegram setup dry-run smoke passed")
console.log("Mode: no-network/dry-run/payloads/secret-redaction")
console.log("- payloads: setWebhook, setChatMenuButton, setMyCommands")
console.log("- commands: /order, /cart, /cabinet, /orders, /whoami")
console.log("- secret values: redacted")
