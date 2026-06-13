import { existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const root = join(import.meta.dirname, "..")
const demoDbPath = join(root, "data", "caloristika_demo_crm.sqlite")

process.env.NODE_ENV ||= "production"
process.env.CRM_NEXT_MODE ||= "start"
process.env.HOST ||= "0.0.0.0"
process.env.PORT ||= "10000"
process.env.NEXT_TELEMETRY_DISABLED ||= "1"
process.env.LUNCH_UP_CRM_DB_PATH ||= demoDbPath
process.env.LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS ||= "5000"
process.env.LUNCH_UP_SQLITE_MMAP_SIZE ||= "268435456"
process.env.LUNCH_UP_SQLITE_WAL ||= "0"

if (!existsSync(process.env.LUNCH_UP_CRM_DB_PATH)) {
  const result = spawnSync(process.execPath, [join(root, "scripts", "create-caloristika-demo-db.mjs")], {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

await import("./server.mjs")
