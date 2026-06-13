import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = process.env.LUNCH_UP_CRM_DB_PATH?.trim() || join(root, "data", "lunch_up_crm.sqlite")
const replace = process.argv.includes("--replace")

if (!existsSync(dbPath)) {
  throw new Error(`SQLite database is missing: ${dbPath}`)
}

function sqlPath(path) {
  return path.replaceAll("'", "''")
}

function copySnapshot(sourcePath, targetDir) {
  const snapshotName = basename(sourcePath)
  const snapshotPath = join(targetDir, snapshotName)
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${sourcePath}${suffix}`
    if (existsSync(source)) {
      copyFileSync(source, `${snapshotPath}${suffix}`)
    }
  }
  return snapshotPath
}

function counts(db) {
  return {
    companies: Number(db.prepare("SELECT COUNT(*) AS count FROM companies").get().count),
    products: Number(db.prepare("SELECT COUNT(*) AS count FROM products").get().count),
    orders: Number(db.prepare("SELECT COUNT(*) AS count FROM orders").get().count),
    order_items: Number(db.prepare("SELECT COUNT(*) AS count FROM order_items").get().count)
  }
}

const workDir = mkdtempSync(join(tmpdir(), "lunch-up-sqlite-maintenance-"))
const snapshotPath = copySnapshot(dbPath, workDir)
const recoveredPath = join(workDir, "lunch_up_crm.recovered.sqlite")

const snapshotDb = new DatabaseSync(snapshotPath)
const snapshotCounts = counts(snapshotDb)
snapshotDb.exec(`VACUUM INTO '${sqlPath(recoveredPath)}'`)
snapshotDb.close()

const recoveredDb = new DatabaseSync(recoveredPath)
const recoveredCounts = counts(recoveredDb)
recoveredDb.close()

const result = {
  source: dbPath,
  snapshot: snapshotPath,
  recovered: recoveredPath,
  replace,
  snapshotCounts,
  recoveredCounts,
  sidecarWarnings: []
}

if (JSON.stringify(snapshotCounts) !== JSON.stringify(recoveredCounts)) {
  console.log(JSON.stringify(result, null, 2))
  throw new Error("Recovered SQLite counts do not match snapshot counts")
}

if (replace) {
  const backupStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "")
  const backupBase = `${dbPath}.backup-before-sqlite-maintenance-${backupStamp}`
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${dbPath}${suffix}`
    if (existsSync(source)) {
      copyFileSync(source, `${backupBase}${suffix}`)
    }
  }
  mkdirSync(dirname(dbPath), { recursive: true })
  copyFileSync(recoveredPath, dbPath)
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${dbPath}${suffix}`
    if (existsSync(sidecar)) {
      try {
        unlinkSync(sidecar)
      } catch (error) {
        if (suffix === "-wal") {
          try {
            writeFileSync(sidecar, "")
          } catch {
            // Keep the backed-up sidecar and report the lock below.
          }
        }
        result.sidecarWarnings.push(`${sidecar}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  result.backup = backupBase
}

console.log(JSON.stringify(result, null, 2))

if (!replace) {
  rmSync(workDir, { recursive: true, force: true })
}
