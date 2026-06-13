import { existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const dbPath = process.env.LUNCH_UP_CRM_DB_PATH?.trim() || join(root, "data", "lunch_up_crm.sqlite")

if (!existsSync(dbPath)) {
  throw new Error(`SQLite database is missing: ${dbPath}`)
}

const db = new DatabaseSync(dbPath)
db.exec("PRAGMA foreign_keys = ON;")

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column)
}

if (!columnExists("orders", "payment_date")) {
  db.exec("ALTER TABLE orders ADD COLUMN payment_date TEXT;")
}

db.exec(`
  CREATE TABLE IF NOT EXISTS customer_identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_type TEXT NOT NULL,
    identity_key TEXT NOT NULL UNIQUE,
    bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    email TEXT,
    telegram_chat_id TEXT,
    verified_at TEXT,
    warnings_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_positions (
    product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    on_hand_quantity INTEGER NOT NULL DEFAULT 48,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 18,
    target_stock INTEGER NOT NULL DEFAULT 96,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    quantity_delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_customer_identities_bot_customer ON customer_identities(bot_customer_id);
  CREATE INDEX IF NOT EXISTS idx_customer_identities_company ON customer_identities(company_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_positions_available ON inventory_positions(on_hand_quantity, reserved_quantity, reorder_point);
  CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_inventory_movements_order ON inventory_movements(order_id);
`)

db.exec(`
  INSERT OR IGNORE INTO inventory_positions(product_id, on_hand_quantity, reserved_quantity, reorder_point, target_stock)
  SELECT id, 48, 0, 18, 96
  FROM products
  WHERE is_active = 1;
`)

const insertAgent = db.prepare(`
  INSERT INTO ai_agents(code, name, mission, trigger_rule)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(code) DO UPDATE SET
    name = excluded.name,
    mission = excluded.mission,
    trigger_rule = excluded.trigger_rule,
    is_active = 1
`)

const agents = [
  [
    "customer_order_concierge",
    "AI Customer Order Concierge",
    "Ведет заказ со стороны клиента: проверяет профиль, дату, состав корзины, статус и следующий шаг.",
    "Клиент вошел в web-каталог, оформил заказ или запросил сопровождение"
  ],
  [
    "inventory_replenishment_agent",
    "AI Inventory Replenishment Agent",
    "Следит за остатками, резервами и точками пополнения после клиентских заказов.",
    "SKU ушел ниже точки пополнения или заказ резко увеличил резерв"
  ],
  [
    "sales_demand_analyst",
    "AI Sales Demand Analyst",
    "Анализирует продажи по SKU, клиентам и повторным заказам для поддержания остатков.",
    "Появился новый заказ, повторный заказ или накопилась недельная статистика"
  ]
]
agents.forEach((agent) => insertAgent.run(...agent))

const counts = {
  identities: db.prepare("SELECT COUNT(*) AS count FROM customer_identities").get().count,
  inventory_positions: db.prepare("SELECT COUNT(*) AS count FROM inventory_positions").get().count,
  portal_agents: db.prepare("SELECT COUNT(*) AS count FROM ai_agents WHERE code IN ('customer_order_concierge', 'inventory_replenishment_agent', 'sales_demand_analyst')").get().count
}

db.close()
console.log(`Customer portal migration applied: ${dbPath}`)
console.log(JSON.stringify(counts, null, 2))
