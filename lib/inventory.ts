import { getDb } from "@/lib/db"
import { createAiTask } from "@/lib/queries"

export type InventoryOrderItem = {
  product_id: number
  quantity: number
}

export type InventoryHealthRow = {
  product_id: number
  name: string
  category: string
  on_hand_quantity: number
  reserved_quantity: number
  reorder_point: number
  target_stock: number
  available_quantity: number
}

export function ensureInventorySchema() {
  const db = getDb()
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
}

export function ensureCustomerPortalAgents() {
  const db = getDb()
  const insert = db.prepare(`
    INSERT INTO ai_agents(code, name, mission, trigger_rule)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      mission = excluded.mission,
      trigger_rule = excluded.trigger_rule,
      is_active = 1
  `)
  insert.run(
    "customer_order_concierge",
    "AI Customer Order Concierge",
    "Ведет заказ со стороны клиента: проверяет профиль, дату, состав корзины, статус и следующий шаг.",
    "Клиент вошел в web-каталог, оформил заказ или запросил сопровождение"
  )
  insert.run(
    "inventory_replenishment_agent",
    "AI Inventory Replenishment Agent",
    "Следит за остатками, резервами и точками пополнения после клиентских заказов.",
    "SKU ушел ниже точки пополнения или заказ резко увеличил резерв"
  )
  insert.run(
    "sales_demand_analyst",
    "AI Sales Demand Analyst",
    "Анализирует продажи по SKU, клиентам и повторным заказам для поддержания остатков.",
    "Появился новый заказ, повторный заказ или накопилась недельная статистика"
  )
}

export function recordCustomerIdentity(input: {
  identityType: "telegram" | "email" | "local_demo"
  identityKey: string
  botCustomerId: number
  companyId: number | null
  email?: string | null
  telegramChatId?: string | null
  verified: boolean
  warnings?: string[]
}) {
  ensureInventorySchema()
  const db = getDb()
  db.prepare(`
    INSERT INTO customer_identities(
      identity_type, identity_key, bot_customer_id, company_id, email, telegram_chat_id, verified_at, warnings_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(identity_key) DO UPDATE SET
      identity_type = excluded.identity_type,
      bot_customer_id = excluded.bot_customer_id,
      company_id = COALESCE(excluded.company_id, company_id),
      email = COALESCE(excluded.email, email),
      telegram_chat_id = COALESCE(excluded.telegram_chat_id, telegram_chat_id),
      verified_at = COALESCE(excluded.verified_at, verified_at),
      warnings_json = excluded.warnings_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    input.identityType,
    input.identityKey,
    input.botCustomerId,
    input.companyId,
    input.email ?? null,
    input.telegramChatId ?? null,
    input.verified ? new Date().toISOString() : null,
    JSON.stringify(input.warnings ?? [])
  )
}

export function recordOrderInventoryReservation(orderId: number, items: InventoryOrderItem[]) {
  ensureInventorySchema()
  const db = getDb()
  const updatePosition = db.prepare(`
    UPDATE inventory_positions
    SET
      reserved_quantity = reserved_quantity + ?,
      on_hand_quantity = MAX(0, on_hand_quantity - ?),
      updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ?
  `)
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements(product_id, order_id, quantity_delta, reason)
    VALUES (?, ?, ?, 'order_created')
  `)
  for (const item of items) {
    updatePosition.run(item.quantity, item.quantity, item.product_id)
    insertMovement.run(item.product_id, orderId, -item.quantity)
  }
}

export function getLowStockRows(limit = 8) {
  ensureInventorySchema()
  const db = getDb()
  return db.prepare(`
    SELECT
      p.id AS product_id,
      p.name,
      p.category,
      ip.on_hand_quantity,
      ip.reserved_quantity,
      ip.reorder_point,
      ip.target_stock,
      CASE WHEN ip.on_hand_quantity > ip.reserved_quantity THEN ip.on_hand_quantity - ip.reserved_quantity ELSE 0 END AS available_quantity
    FROM inventory_positions ip
    JOIN products p ON p.id = ip.product_id
    WHERE p.is_active = 1
      AND CASE WHEN ip.on_hand_quantity > ip.reserved_quantity THEN ip.on_hand_quantity - ip.reserved_quantity ELSE 0 END <= ip.reorder_point
    ORDER BY available_quantity ASC, ip.reorder_point DESC, p.name
    LIMIT ?
  `).all(limit) as InventoryHealthRow[]
}

export function getInventorySummary() {
  ensureInventorySchema()
  const db = getDb()
  const row = db.prepare(`
    SELECT
      COUNT(*) AS sku_count,
      SUM(on_hand_quantity) AS on_hand,
      SUM(reserved_quantity) AS reserved,
      SUM(
        CASE
          WHEN CASE WHEN on_hand_quantity > reserved_quantity THEN on_hand_quantity - reserved_quantity ELSE 0 END <= reorder_point
          THEN 1
          ELSE 0
        END
      ) AS low_stock_sku
    FROM inventory_positions
  `).get() as { sku_count: number; on_hand: number | null; reserved: number | null; low_stock_sku: number | null }
  return {
    sku_count: Number(row.sku_count ?? 0),
    on_hand: Number(row.on_hand ?? 0),
    reserved: Number(row.reserved ?? 0),
    low_stock_sku: Number(row.low_stock_sku ?? 0),
    low_stock: getLowStockRows(5)
  }
}

export function queueInventoryAgentTasks(input: {
  orderId: number
  companyId: number
  dealId: number | null
  items: InventoryOrderItem[]
}) {
  ensureCustomerPortalAgents()
  const lowStock = getLowStockRows(5)
  const taskIds: Array<number | null> = []
  taskIds.push(
    createAiTask({
      agentCode: "sales_demand_analyst",
      companyId: input.companyId,
      dealId: input.dealId,
      taskType: "sales_demand_update",
      priority: 72,
      prompt: `Обновить анализ продаж после заказа #${input.orderId}: SKU=${input.items.map((item) => `${item.product_id}x${item.quantity}`).join(", ")}. Найти повторяемость, ходовые позиции и риск нехватки.`
    })
  )
  if (lowStock.length > 0) {
    taskIds.push(
      createAiTask({
        agentCode: "inventory_replenishment_agent",
        companyId: input.companyId,
        dealId: input.dealId,
        taskType: "inventory_replenishment",
        priority: 88,
        prompt: `После заказа #${input.orderId} проверить пополнение SKU ниже точки заказа: ${lowStock.map((row) => `${row.name}: доступно ${row.available_quantity}, цель ${row.target_stock}`).join("; ")}.`
      })
    )
  }
  return taskIds
}
