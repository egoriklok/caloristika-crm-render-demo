import { DatabaseSync } from "node:sqlite"
import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

export function openVerifyDb(dbPath) {
  try {
    const db = new DatabaseSync(dbPath)
    db.prepare("SELECT 1").get()
    return db
  } catch (error) {
    const message = String(error?.message ?? "")
    const errstr = String(error?.errstr ?? "")
    if (!message.includes("disk I/O error") && !errstr.includes("disk I/O error")) {
      throw error
    }
    const snapshotDir = mkdtempSync(join(tmpdir(), "lunch-up-crm-db-"))
    const snapshotName = basename(dbPath)
    for (const suffix of ["", "-wal", "-shm"]) {
      const source = `${dbPath}${suffix}`
      if (existsSync(source)) {
        copyFileSync(source, join(snapshotDir, `${snapshotName}${suffix}`))
      }
    }
    return new DatabaseSync(join(snapshotDir, snapshotName))
  }
}
