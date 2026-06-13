import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
loadLocalEnv(root)

const args = new Set(process.argv.slice(2))
const dryRun = args.has("--dry-run")
const noNetwork = args.has("--no-network")
const skipSetup = args.has("--skip-setup")
const skipPreflight = args.has("--skip-preflight")
const skipUrlPreflight = args.has("--skip-url-preflight") || args.has("--skip-url-check")

function configured(name) {
  return Boolean(process.env[name]?.trim())
}

function readFileTrimmed(path) {
  if (!existsSync(path)) return null
  const value = readFileSync(path, "utf-8").trim()
  return value || null
}

function readSavedPublicBaseUrl() {
  const savedUrl = readFileTrimmed(join(root, "logs", "public_crm_url.txt"))
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

function runNodeScript(scriptName, scriptArgs = []) {
  const result = spawnSync(process.execPath, [join(root, "scripts", scriptName), ...scriptArgs], {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  })
  if (result.error) {
    throw result.error
  }
  return result.status ?? 0
}

function missingRequiredEnv() {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim() || readSavedPublicBaseUrl()
  const required = [
    ["TELEGRAM_BOT_TOKEN", configured("TELEGRAM_BOT_TOKEN")],
    ["TELEGRAM_WEBHOOK_SECRET", configured("TELEGRAM_WEBHOOK_SECRET")],
    ["PUBLIC_BASE_URL or logs/public_crm_url.txt", Boolean(publicBaseUrl)],
    ["DGIS_API_KEY or TWO_GIS_API_KEY", configured("DGIS_API_KEY") || configured("TWO_GIS_API_KEY")],
    ["DADATA_API_KEY or DADATA_TOKEN", configured("DADATA_API_KEY") || configured("DADATA_TOKEN")]
  ]
  return required.filter(([, ok]) => !ok).map(([name]) => name)
}

async function runProtectedPreflight() {
  const accessKey = process.env.CRM_ACCESS_KEY?.trim() || readFileTrimmed(join(root, "logs", "public_access_key.txt"))
  if (!accessKey) {
    console.warn("Protected CRM preflight skipped: CRM access key is not available.")
    return false
  }

  const url = new URL("http://localhost:3011/api/integrations/preflight")
  url.searchParams.set("key", accessKey)
  try {
    const response = await fetch(url, { cache: "no-store" })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.checks) {
      console.warn(`Protected CRM preflight failed: HTTP ${response.status}`)
      return false
    }

    const blocked = payload.checks.filter((item) => item.status === "blocked")
    const warnings = payload.checks.filter((item) => item.status === "warning")
    console.log(`Protected CRM preflight: ${blocked.length} blocked, ${warnings.length} warnings`)
    for (const item of [...blocked, ...warnings]) {
      console.log(`- ${item.label}: ${item.message}`)
    }
    return blocked.length === 0
  } catch (error) {
    console.warn(`Protected CRM preflight skipped: ${error instanceof Error ? error.message : "unknown error"}`)
    return false
  }
}

console.log("Telegram Mini App launch")
console.log(`Mode: ${dryRun ? "dry-run" : "execute"}`)
console.log("")

const checkArgs = []
if (noNetwork) checkArgs.push("--no-network")
console.log("Step 1/4: launch configuration check")
runNodeScript("telegram-launch-check.mjs", checkArgs)

const missing = missingRequiredEnv()
if (missing.length) {
  console.log("")
  console.log("Launch stopped: required values are missing.")
  for (const key of missing) console.log(`- ${key}`)
  console.log("Secret values are intentionally not printed.")
  process.exitCode = dryRun ? 0 : 1
} else if (dryRun) {
  console.log("")
  console.log("Step 2/4 preview: Telegram setup payloads")
  const setupStatus = runNodeScript("setup-telegram-bot.mjs", ["--dry-run", "--skip-url-preflight"])
  if (setupStatus !== 0) {
    process.exitCode = setupStatus
  } else {
    console.log("")
    console.log("Dry-run complete: required values are present. Run npm run telegram:launch without --dry-run to configure Telegram.")
  }
} else if (noNetwork) {
  console.log("")
  console.log("Launch stopped: --no-network prevents Telegram setup.")
  process.exitCode = 1
} else {
  if (!skipSetup) {
    console.log("")
    console.log("Step 2/4: configure Telegram webhook, commands and Mini App menu")
    const setupArgs = skipUrlPreflight ? ["--skip-url-preflight"] : []
    const setupStatus = runNodeScript("setup-telegram-bot.mjs", setupArgs)
    if (setupStatus !== 0) {
      process.exitCode = setupStatus
    }
  } else {
    console.log("")
    console.log("Step 2/4 skipped: Telegram setup disabled by --skip-setup")
  }

  if (!process.exitCode) {
    console.log("")
    console.log("Step 3/4: verify Telegram webhook state")
    const strictStatus = runNodeScript("telegram-launch-check.mjs", ["--strict"])
    if (strictStatus !== 0) {
      process.exitCode = strictStatus
    }
  }

  if (!process.exitCode && !skipPreflight) {
    console.log("")
    console.log("Step 4/4: protected CRM integration preflight")
    const preflightOk = await runProtectedPreflight()
    if (!preflightOk) {
      process.exitCode = 1
    }
  } else if (skipPreflight) {
    console.log("")
    console.log("Step 4/4 skipped: protected CRM preflight disabled by --skip-preflight")
  }
}
