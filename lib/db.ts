import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const dbPath = process.env.LUNCH_UP_CRM_DB_PATH?.trim() || join(process.cwd(), "data", "lunch_up_crm.sqlite")
const sqliteBusyTimeoutMs = boundedInteger(process.env.LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS, 5000, 100, 60000)
const sqliteMmapSize = boundedInteger(process.env.LUNCH_UP_SQLITE_MMAP_SIZE, 268435456, 0, 2147483647)
const sqliteWalRequested = process.env.LUNCH_UP_SQLITE_WAL !== "0"

let db: DatabaseSync | null = null
let activeDbPath = dbPath
let snapshotMode = false
let activeSqliteWalEnabled = false

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function isDiskIoError(error: unknown) {
  const payload = error as { message?: string; errstr?: string }
  return String(payload?.message ?? "").includes("disk I/O error") || String(payload?.errstr ?? "").includes("disk I/O error")
}

function copyDbSnapshot(sourcePath: string) {
  const snapshotDir = mkdtempSync(join(tmpdir(), "lunch-up-crm-runtime-db-"))
  const snapshotName = basename(sourcePath)
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${sourcePath}${suffix}`
    if (existsSync(source)) {
      copyFileSync(source, join(snapshotDir, `${snapshotName}${suffix}`))
    }
  }
  return join(snapshotDir, snapshotName)
}

function isCloudSyncedPath(path: string) {
  return /(^|[\\/])(onedrive|dropbox|google drive|iclouddrive)([\\/]|$)/i.test(path)
}

function openDb(path: string) {
  const connection = new DatabaseSync(path)
  connection.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = ${sqliteBusyTimeoutMs};
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = ${sqliteMmapSize};
  `)
  if (sqliteWalRequested && !isCloudSyncedPath(path)) {
    connection.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA wal_autocheckpoint = 1000;
    `)
    activeSqliteWalEnabled = true
  } else {
    activeSqliteWalEnabled = false
  }
  connection.prepare("SELECT 1").get()
  return connection
}

export function getDb() {
  if (!existsSync(dbPath)) {
    throw new Error("SQLite database is missing. Run `npm run db:init` in lunch-up-crm first.")
  }
  if (!db) {
    try {
      db = openDb(dbPath)
      activeDbPath = dbPath
      snapshotMode = false
    } catch (error) {
      if (!isDiskIoError(error)) {
        throw error
      }
      activeDbPath = copyDbSnapshot(dbPath)
      db = openDb(activeDbPath)
      snapshotMode = true
    }
  }
  return db
}

export function getDbPath() {
  return activeDbPath
}

export function getDbRuntimeInfo() {
  return {
    sourcePath: dbPath,
    activePath: activeDbPath,
    snapshotMode,
    sqliteWalRequested,
    sqliteWalEnabled: activeSqliteWalEnabled,
    sqliteWalSkippedForCloudSync: sqliteWalRequested && isCloudSyncedPath(activeDbPath),
    sqliteBusyTimeoutMs,
    sqliteMmapSize
  }
}

export function assertWritableDb() {
  if (snapshotMode) {
    throw new Error("SQLite is opened from a WSL/OneDrive read-only snapshot; write operations are disabled in this runtime.")
  }
}
