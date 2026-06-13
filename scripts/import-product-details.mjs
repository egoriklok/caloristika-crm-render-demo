import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const detailsPath = join(root, "data", "product-details-from-assortment.json")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const launchPath = join(root, "data", "launch-crm-content.json")

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8")
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[”“"]/g, "«")
    .replace(/\s+/g, " ")
    .trim()
}

function backupSqlite() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
  const backupPath = join(root, "data", `lunch_up_crm.backup-before-product-details-${stamp}.sqlite`)
  copyFileSync(dbPath, backupPath)
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${dbPath}${suffix}`
    if (existsSync(sidecar)) copyFileSync(sidecar, `${backupPath}${suffix}`)
  }
  return backupPath
}

if (!existsSync(detailsPath)) throw new Error(`Missing product details: ${detailsPath}`)
if (!existsSync(dbPath)) throw new Error(`Missing SQLite database: ${dbPath}`)

const details = readJson(detailsPath)
const products = Array.isArray(details.products) ? details.products : []
if (!products.length) throw new Error("Product details file has no products")

const detailsByName = new Map(products.map((product) => [normalizeName(product.name), product]))
const detailsByBarcode = new Map(products.map((product) => [String(product.barcode), product]))
const backup = backupSqlite()

const db = new DatabaseSync(dbPath)
db.exec("BEGIN")
let updated = 0
try {
  const rows = db.prepare("SELECT id, name, barcode FROM products WHERE is_active = 1").all()
  const update = db.prepare(`
    UPDATE products
    SET composition = ?, nutrition = ?, source_file = ?, net_weight = COALESCE(?, net_weight)
    WHERE id = ?
  `)
  for (const row of rows) {
    const detail = detailsByBarcode.get(String(row.barcode)) ?? detailsByName.get(normalizeName(row.name))
    if (!detail) continue
    update.run(detail.composition, detail.nutrition, "Внешний Ассортимент Lunch-UP 2026.docx", detail.net_weight ?? null, row.id)
    updated += 1
  }
  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
} finally {
  db.close()
}

let launchUpdated = 0
if (existsSync(launchPath)) {
  const launch = readJson(launchPath)
  if (Array.isArray(launch.catalog_analysis)) {
    launch.catalog_analysis = launch.catalog_analysis.map((item) => {
      const detail = detailsByName.get(normalizeName(item.name))
      if (!detail) return item
      launchUpdated += 1
      return {
        ...item,
        composition: detail.composition,
        nutrition: detail.nutrition
      }
    })
    writeJson(launchPath, launch)
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      products_in_source: products.length,
      db_products_updated: updated,
      launch_catalog_rows_updated: launchUpdated,
      backup
    },
    null,
    2
  )
)
