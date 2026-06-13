import { assertWritableDb, getDb } from "@/lib/db"
import { ensureCustomerPortalAgents, ensureInventorySchema, queueInventoryAgentTasks, recordOrderInventoryReservation } from "@/lib/inventory"
import { createAiTask } from "@/lib/queries"

export type BotOrderPayload = {
  telegram_user_id?: string
  telegram_chat_id: string
  display_name?: string
  company_name: string
  contact_role?: string
  contact_email?: string
  contact_phone?: string
  inn?: string
  office_people?: number
  channel?: "telegram" | "web_catalog"
  delivery_method?: "delivery" | "pickup"
  delivery_address?: string
  delivery_date?: string
  payment_date?: string
  instructions?: string
  items: Array<{ product_id: number; quantity: number }>
}

type ProductRow = {
  id: number
  name: string
  wholesale_price: number
}

type ValidatedItem = {
  product: ProductRow
  quantity: number
  lineTotal: number
}

type OrderSettings = {
  minOrder: number
  orderLeadTimeDays: number
  orderCutoffTime: string
}

export class BotOrderValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = "BotOrderValidationError"
  }
}

function requireText(value: string | undefined, field: string) {
  if (!value?.trim()) {
    throw new BotOrderValidationError(`${field} is required`)
  }
  return value.trim()
}

function cleanText(value: string | undefined) {
  return value?.trim() || null
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function cutoffMinutes(value: string | null | undefined) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? "")
  if (!match) return 15 * 60
  return Number(match[1]) * 60 + Number(match[2])
}

function earliestDeliveryDate(settings: OrderSettings, now = new Date()) {
  const todayMinutes = now.getHours() * 60 + now.getMinutes()
  const extraDay = todayMinutes >= cutoffMinutes(settings.orderCutoffTime) ? 1 : 0
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + settings.orderLeadTimeDays + extraDay)
  return dateInputValue(date)
}

function validDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && dateInputValue(date) === value
}

function getOrderSettings() {
  const db = getDb()
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  return {
    minOrder: Number(settings.min_order_amount ?? 7000),
    orderLeadTimeDays: Number(settings.order_lead_time_days ?? 2),
    orderCutoffTime: settings.order_cutoff_time ?? "15:00"
  } satisfies OrderSettings
}

function validateDelivery(payload: BotOrderPayload, settings: OrderSettings) {
  const deliveryMethod = payload.delivery_method ?? "delivery"
  const deliveryAddress = cleanText(payload.delivery_address)
  const deliveryDate = cleanText(payload.delivery_date)
  const paymentDate = cleanText(payload.payment_date)

  if (deliveryMethod === "delivery" && !deliveryAddress) {
    throw new BotOrderValidationError("delivery_address is required for delivery")
  }
  if (deliveryMethod === "delivery" && !deliveryDate) {
    throw new BotOrderValidationError("delivery_date is required for delivery")
  }
  if (deliveryDate && !validDateInput(deliveryDate)) {
    throw new BotOrderValidationError("delivery_date must use YYYY-MM-DD")
  }
  if (paymentDate && !validDateInput(paymentDate)) {
    throw new BotOrderValidationError("payment_date must use YYYY-MM-DD")
  }

  const minDeliveryDate = earliestDeliveryDate(settings)
  if (deliveryDate && deliveryDate < minDeliveryDate) {
    throw new BotOrderValidationError(`delivery_date must be on or after ${minDeliveryDate}`)
  }

  return { deliveryMethod, deliveryAddress, deliveryDate, paymentDate, minDeliveryDate }
}

function queueOrderValidationTask(orderId: number, companyId: number, dealId: number | null, total: number) {
  try {
    return createAiTask({
      agentCode: "telegram_order_validator",
      companyId,
      dealId,
      taskType: "telegram_order_validation",
      priority: total >= 7000 ? 90 : 75,
      prompt: `Проверить Telegram-заказ #${orderId}: минимум, дату поставки, адрес, юридическое лицо, состав SKU и комментарий менеджеру.`
    })
  } catch {
    return null
  }
}

export function createBotOrder(payload: BotOrderPayload) {
  const telegramChatId = requireText(payload.telegram_chat_id, "telegram_chat_id")
  const companyName = requireText(payload.company_name, "company_name")
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new BotOrderValidationError("items are required")
  }

  const db = getDb()
  assertWritableDb()
  ensureInventorySchema()
  ensureCustomerPortalAgents()
  const settings = getOrderSettings()
  const delivery = validateDelivery(payload, settings)
  const items: ValidatedItem[] = []
  let total = 0

  for (const item of payload.items) {
    if (!Number.isInteger(item.product_id) || item.product_id <= 0) {
      throw new BotOrderValidationError("product_id must be a positive integer")
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new BotOrderValidationError("quantity must be a positive integer")
    }

    const product = db.prepare("SELECT id, name, wholesale_price FROM products WHERE id = ? AND is_active = 1").get(item.product_id) as
      | ProductRow
      | undefined
    if (!product) {
      throw new BotOrderValidationError(`product_id ${item.product_id} not found`, 404)
    }

    const lineTotal = Number(product.wholesale_price) * item.quantity
    total += lineTotal
    items.push({ product, quantity: item.quantity, lineTotal })
  }

  const status = total >= settings.minOrder ? "manager_review" : "blocked_minimum"
  const managerComment =
    total >= settings.minOrder
      ? "Заказ из Telegram принят в проверку менеджером."
      : `Сумма ниже минимального заказа ${settings.minOrder} руб.; бот должен предложить добрать позиции.`

  db.exec("BEGIN IMMEDIATE")
  try {
    const existingCompany = db.prepare("SELECT id FROM companies WHERE lower(name) = lower(?)").get(companyName) as
      | { id: number }
      | undefined
    const customerNotes = [
      payload.inn ? `ИНН: ${payload.inn}` : null,
      payload.office_people ? `Ориентир по офису: ${payload.office_people} человек.` : null,
      "Проверить юридическое лицо и адрес доставки."
    ].filter(Boolean).join(" ")
    const companyId = existingCompany
      ? existingCompany.id
      : Number(
          db.prepare(`
            INSERT INTO companies(name, segment, region, city, district, website, public_contact_url, source, lead_status, lead_score, fit_reason, notes)
            VALUES (?, 'telegram_order', 'Санкт-Петербург и Ленинградская область', 'Не указано', NULL, NULL, NULL, 'telegram_bot', 'contacted', 60, 'Компания создана из Telegram-заказа.', ?)
          `).run(companyName, customerNotes).lastInsertRowid
        )

    db.prepare(`
      INSERT INTO bot_customers(telegram_user_id, telegram_chat_id, display_name, company_id, state)
      VALUES (?, ?, ?, ?, 'order_started')
      ON CONFLICT(telegram_chat_id) DO UPDATE SET
        telegram_user_id = COALESCE(excluded.telegram_user_id, telegram_user_id),
        display_name = COALESCE(excluded.display_name, display_name),
        company_id = COALESCE(excluded.company_id, company_id),
        state = 'order_started',
        last_seen_at = CURRENT_TIMESTAMP
    `).run(payload.telegram_user_id ?? null, telegramChatId, payload.display_name ?? null, companyId)

    const botCustomer = db.prepare("SELECT id FROM bot_customers WHERE telegram_chat_id = ?").get(telegramChatId) as { id: number }

    if (!existingCompany) {
      db.prepare(`
        INSERT INTO contacts(company_id, name, role, email, phone, preferred_channel, telegram_handle, notes)
        VALUES (?, ?, ?, ?, ?, 'telegram', NULL, 'Контакт создан из Telegram-бота. Нужна проверка юридического лица.')
      `).run(
        companyId,
        payload.display_name ?? "Telegram-контакт",
        payload.contact_role ?? "Заказчик",
        cleanText(payload.contact_email),
        cleanText(payload.contact_phone)
      )
    } else if (payload.contact_email || payload.contact_phone) {
      db.prepare(`
        INSERT INTO contacts(company_id, name, role, email, phone, preferred_channel, telegram_handle, notes)
        VALUES (?, ?, ?, ?, ?, 'telegram', NULL, 'Контакт добавлен из повторного Telegram-заказа.')
      `).run(
        companyId,
        payload.display_name ?? "Telegram-контакт",
        payload.contact_role ?? "Заказчик",
        cleanText(payload.contact_email),
        cleanText(payload.contact_phone)
      )
    }

    const deal = db.prepare("SELECT id FROM deals WHERE company_id = ? ORDER BY id DESC LIMIT 1").get(companyId) as
      | { id: number }
      | undefined
    const orderId = Number(
      db.prepare(`
        INSERT INTO orders(company_id, bot_customer_id, deal_id, channel, status, delivery_method, delivery_address, delivery_date, payment_date, instructions, total_amount, payment_method, manager_comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'invoice', ?)
      `).run(
        companyId,
        botCustomer.id,
        deal?.id ?? null,
        payload.channel ?? "telegram",
        status,
        delivery.deliveryMethod,
        delivery.deliveryAddress,
        delivery.deliveryDate,
        delivery.paymentDate,
        [payload.instructions, customerNotes].filter(Boolean).join(" ") || null,
        total,
        managerComment
      ).lastInsertRowid
    )

    const insertItem = db.prepare("INSERT INTO order_items(order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)")
    for (const item of items) {
      insertItem.run(orderId, item.product.id, item.quantity, item.product.wholesale_price, item.lineTotal)
    }
    recordOrderInventoryReservation(
      orderId,
      items.map((item) => ({ product_id: item.product.id, quantity: item.quantity }))
    )

    db.prepare(`
      INSERT INTO telegram_events(bot_customer_id, event_type, payload_json, processed_at)
      VALUES (?, 'order_created', ?, CURRENT_TIMESTAMP)
    `).run(botCustomer.id, JSON.stringify(payload))

    db.exec("COMMIT")
    const taskId = queueOrderValidationTask(orderId, companyId, deal?.id ?? null, total)
    const inventoryTaskIds = queueInventoryAgentTasks({
      orderId,
      companyId,
      dealId: deal?.id ?? null,
      items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity }))
    })

    return {
      statusCode: total >= settings.minOrder ? 201 : 202,
      body: {
        ok: total >= settings.minOrder,
        order_id: orderId,
        status,
        total_amount: total,
        minimum_order_amount: settings.minOrder,
        minimum_delivery_date: delivery.minDeliveryDate,
        manager_comment: managerComment,
        ai_task_id: taskId,
        inventory_ai_task_ids: inventoryTaskIds
      }
    }
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}
