import { copyFileSync, existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const productPhotosPath = join(root, "data", "product-photos.json")

function normalizeProductPhotoKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»“”"]/g, "")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function backupSqlite() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
  const backupPath = join(root, "data", `lunch_up_crm.backup-before-product-photos-${stamp}.sqlite`)
  copyFileSync(dbPath, backupPath)
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${dbPath}${suffix}`
    if (existsSync(sidecar)) copyFileSync(sidecar, `${backupPath}${suffix}`)
  }
  return backupPath
}

function ensureColumn(db, existingColumns, name, definition) {
  if (existingColumns.has(name)) return false
  db.exec(`ALTER TABLE products ADD COLUMN ${name} ${definition}`)
  existingColumns.add(name)
  return true
}

if (!existsSync(dbPath)) throw new Error(`Missing SQLite database: ${dbPath}`)
if (!existsSync(productPhotosPath)) throw new Error(`Missing product photo catalog: ${productPhotosPath}`)

const payload = JSON.parse(readFileSync(productPhotosPath, "utf-8"))
const photoItems = Array.isArray(payload.items) ? payload.items : []
const photoByName = new Map(photoItems.map((item) => [normalizeProductPhotoKey(item.name), item]))
const backup = backupSqlite()

const db = new DatabaseSync(dbPath)
const columns = new Set(db.prepare("PRAGMA table_info(products)").all().map((row) => row.name))

let columnsAdded = 0
let updated = 0
db.exec("BEGIN")
try {
  for (const [name, definition] of [
    ["image_url", "TEXT"],
    ["product_url", "TEXT"],
    ["image_source", "TEXT"],
    ["image_match", "TEXT"],
    ["image_note", "TEXT"],
    ["site_title", "TEXT"]
  ]) {
    if (ensureColumn(db, columns, name, definition)) columnsAdded += 1
  }

  const rows = db.prepare("SELECT id, name FROM products WHERE is_active = 1").all()
  const update = db.prepare(`
    UPDATE products
    SET
      image_url = ?,
      product_url = ?,
      image_source = ?,
      image_match = ?,
      image_note = ?,
      site_title = ?
    WHERE id = ?
  `)

  for (const row of rows) {
    const photo = photoByName.get(normalizeProductPhotoKey(row.name))
    if (!photo) continue
    update.run(
      photo.image_url ?? null,
      photo.product_url ?? null,
      photo.product_url ?? "https://lunch-up.ru/",
      photo.image_match ?? null,
      photo.image_note ?? null,
      photo.site_title ?? null,
      row.id
    )
    updated += 1
  }

  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
} finally {
  db.close()
}

console.log(
  JSON.stringify(
    {
      ok: true,
      columns_added: columnsAdded,
      active_products_updated: updated,
      backup
    },
    null,
    2
  )
)
