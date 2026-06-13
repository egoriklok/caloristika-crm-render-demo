import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join, relative } from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const buildDir = process.env.LUNCH_UP_BUILD_DIR?.trim() || join(homedir(), ".cache", "lunch-up-crm-build")
const runInstall = process.argv.includes("--install")
const runBuild = process.argv.includes("--build")
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm"

function assertSafeBuildDir(path) {
  const normalized = path.replaceAll("\\", "/")
  if (!normalized.includes("lunch-up-crm-build")) {
    throw new Error("LUNCH_UP_BUILD_DIR must include lunch-up-crm-build")
  }
  if (normalized === "/" || normalized.length < 12) {
    throw new Error(`Refusing unsafe build directory: ${path}`)
  }
}

function shouldCopy(source) {
  const name = basename(source)
  const rel = relative(root, source).replaceAll("\\", "/")
  if (!rel || rel === ".") return true
  if ([".next", "node_modules", "logs", "outputs", ".git"].some((part) => rel === part || rel.startsWith(`${part}/`))) return false
  if (name === ".env" || name.startsWith(".env.")) return name === ".env.example"
  if (/crm-.*\.(log|err\.log|out\.log)$/.test(name)) return false
  if (rel.startsWith("data/") && /\.(sqlite|sqlite-wal|sqlite-shm)$/.test(name)) return false
  if (rel.startsWith("data/") && name.includes(".backup-")) return false
  return true
}

function quoteWindowsArg(value) {
  const text = String(value)
  if (/^[A-Za-z0-9_./:=+-]+$/.test(text)) return text
  return `"${text.replace(/(["^&|<>%])/g, "^$1")}"`
}

function run(command, args) {
  const isWindows = process.platform === "win32"
  const executable = isWindows ? process.env.ComSpec || "cmd.exe" : command
  const spawnArgs = isWindows ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArg).join(" ")] : args
  const result = spawnSync(executable, spawnArgs, {
    cwd: buildDir,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit"
  })
  if (result.status !== 0) {
    const detail = result.error ? `: ${result.error.message}` : ""
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}${detail}`)
  }
}

assertSafeBuildDir(buildDir)
rmSync(buildDir, { recursive: true, force: true })
mkdirSync(buildDir, { recursive: true })
cpSync(root, buildDir, {
  recursive: true,
  filter: shouldCopy
})

const stagedPackageLock = existsSync(join(buildDir, "package-lock.json"))
console.log(JSON.stringify({ buildDir, stagedPackageLock, runInstall, runBuild }, null, 2))

if (runInstall) run(npmExecutable, ["ci"])
if (runBuild) run(npmExecutable, ["run", "build"])
