import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = process.env.LUNCH_UP_CRM_DB_PATH?.trim() || join(root, "data", "lunch_up_crm.sqlite")
const outputPath = join(root, "public", "admin-catalog-data.json")

if (!existsSync(dbPath)) {
  throw new Error(`SQLite database is missing: ${dbPath}`)
}

function copyDbSnapshot(sourcePath) {
  const snapshotDir = mkdtempSync(join(tmpdir(), "lunch-up-admin-catalog-"))
  const snapshotName = basename(sourcePath)
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${sourcePath}${suffix}`
    if (existsSync(source)) {
      copyFileSync(source, join(snapshotDir, `${snapshotName}${suffix}`))
    }
  }
  return join(snapshotDir, snapshotName)
}

const db = new DatabaseSync(copyDbSnapshot(dbPath))
db.exec("PRAGMA foreign_keys = ON;")

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column)
}

const hasPaymentDate = columnExists("orders", "payment_date")
const paymentDateSelect = hasPaymentDate ? "o.payment_date" : "NULL AS payment_date"

const stats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM companies) AS clients,
    (SELECT COUNT(DISTINCT company_id) FROM orders WHERE company_id IS NOT NULL) AS clients_with_orders,
    COUNT(*) AS orders,
    COALESCE(SUM(total_amount), 0) AS total_revenue,
    SUM(CASE WHEN ${hasPaymentDate ? "payment_date" : "NULL"} IS NULL THEN 1 ELSE 0 END) AS unpaid_orders,
    SUM(CASE WHEN delivery_date >= date('now') THEN 1 ELSE 0 END) AS upcoming_deliveries
  FROM orders
`).get()

const clients = db.prepare(`
  SELECT
    c.id AS company_id,
    c.name AS company_name,
    c.segment,
    c.lead_status,
    ct.name AS contact_name,
    ct.email AS contact_email,
    ct.phone AS contact_phone,
    ct.preferred_channel,
    COUNT(o.id) AS orders_count,
    COALESCE(SUM(o.total_amount), 0) AS total_revenue,
    MAX(o.created_at) AS last_order_at,
    MIN(CASE WHEN o.delivery_date >= date('now') THEN o.delivery_date ELSE NULL END) AS next_delivery_date,
    SUM(CASE WHEN ${hasPaymentDate ? "o.payment_date" : "NULL"} IS NULL AND o.id IS NOT NULL THEN 1 ELSE 0 END) AS unpaid_orders
  FROM companies c
  LEFT JOIN contacts ct ON ct.id = (
    SELECT id
    FROM contacts
    WHERE company_id = c.id
    ORDER BY
      CASE WHEN COALESCE(email, '') <> '' THEN 0 ELSE 1 END,
      CASE WHEN COALESCE(phone, '') <> '' THEN 0 ELSE 1 END,
      id DESC
    LIMIT 1
  )
  LEFT JOIN orders o ON o.company_id = c.id
  GROUP BY c.id
  ORDER BY orders_count DESC, total_revenue DESC, c.lead_score DESC, c.name
`).all()

const orders = db.prepare(`
  SELECT
    o.id,
    c.id AS company_id,
    c.name AS company_name,
    ct.name AS contact_name,
    ct.email AS contact_email,
    ct.phone AS contact_phone,
    o.channel,
    o.status,
    o.created_at,
    o.delivery_date,
    ${paymentDateSelect},
    o.delivery_address,
    o.total_amount,
    o.manager_comment,
    COALESCE(SUM(oi.quantity), 0) AS item_count,
    COUNT(oi.id) AS sku_count,
    GROUP_CONCAT(p.name || ' x' || oi.quantity, '; ') AS items_summary
  FROM orders o
  LEFT JOIN companies c ON c.id = o.company_id
  LEFT JOIN contacts ct ON ct.id = (
    SELECT id
    FROM contacts
    WHERE company_id = c.id
    ORDER BY
      CASE WHEN COALESCE(email, '') <> '' THEN 0 ELSE 1 END,
      CASE WHEN COALESCE(phone, '') <> '' THEN 0 ELSE 1 END,
      id DESC
    LIMIT 1
  )
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products p ON p.id = oi.product_id
  GROUP BY o.id
  ORDER BY o.created_at DESC, o.id DESC
  LIMIT 250
`).all()

const payload = {
  generated_at: new Date().toISOString(),
  stats: {
    clients: Number(stats.clients ?? 0),
    clients_with_orders: Number(stats.clients_with_orders ?? 0),
    orders: Number(stats.orders ?? 0),
    total_revenue: Number(stats.total_revenue ?? 0),
    unpaid_orders: Number(stats.unpaid_orders ?? 0),
    upcoming_deliveries: Number(stats.upcoming_deliveries ?? 0)
  },
  clients,
  orders
}

db.close()
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8")
console.log(`Admin catalog data exported: ${outputPath}`)
console.log(`Clients: ${payload.clients.length}; orders: ${payload.orders.length}`)
