import { spawn } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const loadedEnvKeys = loadLocalEnv(root)
const dbPath = process.env.LUNCH_UP_CRM_DB_PATH?.trim() || join(root, "data", "lunch_up_crm.sqlite")
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const standaloneServerPath = join(root, ".next", "standalone", "server.js")
const accessKeyPath = join(root, "logs", "public_access_key.txt")

function ensureLinkOrCopy(source, target, type) {
  if (existsSync(target)) return
  mkdirSync(dirname(target), { recursive: true })
  try {
    symlinkSync(source, target, type)
  } catch {
    cpSync(source, target, { recursive: true })
  }
}

function ensureStandaloneAssets() {
  if (!canUseStandaloneStart) return
  ensureLinkOrCopy(join(root, "public"), join(root, ".next", "standalone", "public"), "dir")
  ensureLinkOrCopy(join(root, ".next", "static"), join(root, ".next", "standalone", ".next", "static"), "dir")
}

function ensureProductionBuildId() {
  const buildIdPath = join(root, ".next", "BUILD_ID")
  if (existsSync(buildIdPath)) return true
  if (!existsSync(join(root, ".next", "server", "middleware-manifest.json"))) return false
  if (!existsSync(join(root, ".next", "build-manifest.json"))) return false

  const staticDir = join(root, ".next", "static")
  if (!existsSync(staticDir)) return false
  const buildId = readdirSync(staticDir, { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && !["chunks", "css"].includes(entry.name)
  )?.name
  if (!buildId) return false

  writeFileSync(buildIdPath, `${buildId}\n`)
  return true
}

const canUseNextStart =
  existsSync(join(root, ".next", "routes-manifest.json")) &&
  existsSync(join(root, ".next", "required-server-files.json")) &&
  existsSync(join(root, ".next", "prerender-manifest.json")) &&
  ensureProductionBuildId()
const canUseStandaloneStart =
  existsSync(standaloneServerPath) &&
  existsSync(join(root, ".next", "static")) &&
  existsSync(join(root, "public"))
const requestedMode = process.env.CRM_NEXT_MODE
const mode =
  (requestedMode === "start" || requestedMode === "standalone") && canUseStandaloneStart
    ? "standalone"
    : requestedMode === "start" && canUseNextStart
    ? "start"
    : "dev"
const port = process.env.PORT || "3011"
const host = process.env.HOST || "0.0.0.0"

if (!existsSync(dbPath)) {
  console.error("SQLite database is missing. Run: npm run db:init")
  process.exit(1)
}

if (!process.env.CRM_ACCESS_KEY && existsSync(accessKeyPath)) {
  const savedAccessKey = readFileSync(accessKeyPath, "utf-8").trim()
  if (savedAccessKey) {
    process.env.CRM_ACCESS_KEY = savedAccessKey
  }
}

if (mode === "standalone") {
  ensureStandaloneAssets()
}

const args =
  mode === "standalone"
    ? [standaloneServerPath]
    : mode === "start"
    ? [nextBin, "start", "-H", host, "-p", port]
    : [nextBin, "dev", "--webpack", "-H", host, "-p", port]
const childEnv = {
  ...process.env,
  PORT: port,
  HOSTNAME: process.env.HOSTNAME || host,
  NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS || "1"
}

console.log(`Lunch Up CRM Next runtime: http://localhost:${port}`)
console.log(`Network bind: http://${host}:${port}`)
console.log(`SQLite: ${dbPath}`)
console.log(`Next mode: ${mode}`)
console.log(`CRM access key: ${process.env.CRM_ACCESS_KEY ? "enabled" : "disabled"}`)
console.log(`Local env: ${loadedEnvKeys.length ? `${loadedEnvKeys.length} keys loaded` : "not loaded"}`)

const child = spawn(process.execPath, args, {
  cwd: root,
  env: childEnv,
  stdio: "inherit",
  windowsHide: false
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
