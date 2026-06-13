import { assertWritableDb, getDb } from "@/lib/db"
import { sendCustomerOrderStatusMessage } from "@/lib/telegram-bot"

export const orderStatuses = [
  "draft",
  "manager_review",
  "confirmed",
  "in_delivery",
  "completed",
  "blocked_minimum",
  "cancelled"
] as const

export type OrderStatusCode = (typeof orderStatuses)[number]

type OrderStatusRow = {
  id: number
  status: string
  total_amount: number
  manager_comment: string | null
  bot_customer_id: number | null
  telegram_chat_id: string | null
}

export class OrderStatusError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = "OrderStatusError"
  }
}

export function isOrderStatus(value: string): value is OrderStatusCode {
  return orderStatuses.includes(value as OrderStatusCode)
}

export async function updateOrderStatus(input: {
  order_id: number
  status: string
  manager_comment?: string | null
  notify_customer?: boolean
}) {
  if (!Number.isInteger(input.order_id) || input.order_id <= 0) {
    throw new OrderStatusError("Invalid order id")
  }
  if (!isOrderStatus(input.status)) {
    throw new OrderStatusError("Invalid order status")
  }

  const db = getDb()
  assertWritableDb()
  const existing = db.prepare(`
    SELECT
      o.id,
      o.status,
      o.total_amount,
      o.manager_comment,
      o.bot_customer_id,
      b.telegram_chat_id
    FROM orders o
    LEFT JOIN bot_customers b ON b.id = o.bot_customer_id
    WHERE o.id = ?
  `).get(input.order_id) as OrderStatusRow | undefined

  if (!existing) {
    throw new OrderStatusError("Order not found", 404)
  }

  const managerComment = input.manager_comment?.trim() || existing.manager_comment || null
  db.prepare(`
    UPDATE orders
    SET status = ?, manager_comment = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(input.status, managerComment, input.order_id)

  db.prepare(`
    INSERT INTO telegram_events(bot_customer_id, event_type, payload_json, processed_at)
    VALUES (?, 'order_status_updated', ?, CURRENT_TIMESTAMP)
  `).run(
    existing.bot_customer_id,
    JSON.stringify({
      order_id: input.order_id,
      previous_status: existing.status,
      status: input.status,
      manager_comment: managerComment,
      notify_customer: input.notify_customer !== false
    })
  )

  const customerNotification =
    input.notify_customer === false
      ? { ok: false, skipped: true, error: "Customer notification disabled" }
      : await sendCustomerOrderStatusMessage({
          chat_id: existing.telegram_chat_id,
          order_id: input.order_id,
          status: input.status,
          total_amount: existing.total_amount,
          manager_comment: managerComment
        })

  return {
    ok: true,
    order: {
      id: input.order_id,
      status: input.status,
      manager_comment: managerComment,
      total_amount: existing.total_amount
    },
    customer_notification: customerNotification
  }
}
