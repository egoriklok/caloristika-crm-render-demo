import { assertWritableDb, getDb } from "@/lib/db"
import { sendTelegramTextMessage } from "@/lib/telegram-bot"
import { resolveMiniappEntryIntent } from "@/lib/telegram-intents"
import type { TelegramCopilotItem } from "@/lib/types"

type CaptureInput = {
  botCustomerId: number | null
  telegramEventId: number
  telegramChatId: string | null
  telegramUserId: string | null
  telegramMessageId?: number | string | null
  senderDisplayName?: string | null
  text?: string | null
  callbackData?: string | null
}

const serviceCommandPattern = /^\/(start|order|cart|checkout|cabinet|profile|orders|help|whoami|id|chatid)\b/i

function trimText(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max)
}

function isServiceInbound(input: { text?: string | null; callbackData?: string | null; inboundText: string }) {
  if (input.callbackData) return true
  if (serviceCommandPattern.test(input.inboundText)) return true
  return Boolean(resolveMiniappEntryIntent(input.text ?? input.inboundText))
}

function ensureTelegramCopilotAgent() {
  const db = getDb()
  db.prepare(`
    INSERT INTO ai_agents(code, name, mission, trigger_rule)
    VALUES (
      'telegram_reply_copilot',
      'AI Telegram Reply Copilot',
      'Готовит черновики ответов клиентам Telegram по каталогу, заказам, условиям и статусам. Отправка только после подтверждения менеджером через официальный Bot API.',
      'В Telegram webhook пришло клиентское сообщение, не являющееся сервисной командой Mini App'
    )
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      mission = excluded.mission,
      trigger_rule = excluded.trigger_rule,
      is_active = 1
  `).run()
}

export function ensureTelegramCopilotSchema() {
  assertWritableDb()
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_copilot_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE SET NULL,
      telegram_event_id INTEGER UNIQUE REFERENCES telegram_events(id) ON DELETE SET NULL,
      telegram_chat_id TEXT NOT NULL,
      telegram_user_id TEXT,
      telegram_message_id TEXT,
      sender_display_name TEXT,
      direction TEXT NOT NULL DEFAULT 'inbound',
      message_kind TEXT NOT NULL DEFAULT 'text',
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'needs_reply',
      ai_task_id INTEGER REFERENCES ai_tasks(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS telegram_copilot_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES telegram_copilot_messages(id) ON DELETE CASCADE,
      bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE SET NULL,
      ai_task_id INTEGER REFERENCES ai_tasks(id) ON DELETE SET NULL,
      draft_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      safety_note TEXT NOT NULL DEFAULT 'Отправка только после подтверждения менеджером. Личный Telegram-аккаунт не используется.',
      reviewed_by TEXT,
      telegram_result_json TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_telegram_copilot_messages_status ON telegram_copilot_messages(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_telegram_copilot_messages_chat ON telegram_copilot_messages(telegram_chat_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_telegram_copilot_drafts_status ON telegram_copilot_drafts(status, created_at DESC);
  `)
  ensureTelegramCopilotAgent()
}

function buildFallbackDraft(input: { text: string; displayName?: string | null }) {
  const text = input.text.toLowerCase()
  const hello = input.displayName ? `${input.displayName}, здравствуйте!` : "Здравствуйте!"
  if (/цен|прайс|стоим|коммерчес|кп|предлож/.test(text)) {
    return [
      hello,
      "Подготовим предложение по готовой еде для вашей точки или офиса.",
      "Пришлите, пожалуйста, адрес, примерное количество людей и желаемый формат: витрина, офисный заказ, регулярная поставка или тестовая дегустация.",
      "После этого менеджер соберет стартовую матрицу SKU и расчет."
    ].join("\n")
  }
  if (/достав|адрес|когда|срок/.test(text)) {
    return [
      hello,
      "Доставку и сроки проверим по адресу. Пришлите точный адрес, дату и желаемый интервал.",
      "Менеджер сверит маршрут, минимальную сумму заказа и подтвердит условия."
    ].join("\n")
  }
  if (/заказ|корзин|повтор|статус/.test(text)) {
    return [
      hello,
      "Поможем с заказом. Можно открыть каталог и корзину в Mini App, а если удобнее сообщением - напишите позиции, количество, адрес и дату доставки.",
      "Менеджер проверит минимум, наличие и подтвердит заказ."
    ].join("\n")
  }
  return [
    hello,
    "Спасибо за сообщение. Уточните, пожалуйста, компанию, адрес, примерное количество людей и что нужно решить: каталог, пробная поставка, регулярная доставка или статус заказа.",
    "Менеджер проверит данные в CRM и вернется с конкретным следующим шагом."
  ].join("\n")
}

function queueReplyCopilotTask(input: { messageId: number; chatId: string; displayName?: string | null; text: string }) {
  const db = getDb()
  const agent = db.prepare("SELECT id FROM ai_agents WHERE code = 'telegram_reply_copilot' AND is_active = 1").get() as
    | { id: number }
    | undefined
  if (!agent) return null
  const result = db.prepare(`
    INSERT INTO ai_tasks(agent_id, task_type, priority, prompt, due_at)
    VALUES (?, 'telegram_reply_draft', 80, ?, datetime('now', '+2 hours'))
  `).run(
    agent.id,
    [
      `Подготовить черновик ответа для Telegram Copilot message #${input.messageId}.`,
      `Чат: ${input.chatId}.`,
      input.displayName ? `Клиент: ${input.displayName}.` : null,
      `Сообщение клиента: ${input.text}`,
      "Ответ должен быть коротким, на русском, от лица менеджера B2B CRM, без обещаний без проверки. Не отправлять автоматически."
    ]
      .filter(Boolean)
      .join("\n")
  )
  return Number(result.lastInsertRowid)
}

export function captureTelegramCopilotIncoming(input: CaptureInput) {
  const inboundText = trimText(input.text ?? input.callbackData)
  if (!input.telegramChatId || !inboundText) return null

  ensureTelegramCopilotSchema()
  const db = getDb()
  const messageKind = input.text ? "text" : input.callbackData ? "callback_query" : "unknown"
  const initialStatus = isServiceInbound({ text: input.text, callbackData: input.callbackData, inboundText }) ? "handled_by_bot" : "needs_reply"

  db.prepare(`
    INSERT OR IGNORE INTO telegram_copilot_messages(
      bot_customer_id,
      telegram_event_id,
      telegram_chat_id,
      telegram_user_id,
      telegram_message_id,
      sender_display_name,
      message_kind,
      text,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.botCustomerId,
    input.telegramEventId,
    input.telegramChatId,
    input.telegramUserId,
    input.telegramMessageId ? String(input.telegramMessageId) : null,
    input.senderDisplayName ?? null,
    messageKind,
    inboundText,
    initialStatus
  )

  const message = db.prepare("SELECT id, status FROM telegram_copilot_messages WHERE telegram_event_id = ?").get(input.telegramEventId) as
    | { id: number; status: string }
    | undefined
  if (!message || message.status === "handled_by_bot") {
    return message ? { message_id: message.id, draft_id: null, ai_task_id: null, status: message.status } : null
  }

  const existingDraft = db.prepare("SELECT id, ai_task_id FROM telegram_copilot_drafts WHERE message_id = ?").get(message.id) as
    | { id: number; ai_task_id: number | null }
    | undefined
  if (existingDraft) return { message_id: message.id, draft_id: existingDraft.id, ai_task_id: existingDraft.ai_task_id, status: "draft_ready" }

  const aiTaskId = queueReplyCopilotTask({
    messageId: message.id,
    chatId: input.telegramChatId,
    displayName: input.senderDisplayName,
    text: inboundText
  })
  const draftText = buildFallbackDraft({ text: inboundText, displayName: input.senderDisplayName })
  const draftResult = db.prepare(`
    INSERT INTO telegram_copilot_drafts(message_id, bot_customer_id, ai_task_id, draft_text)
    VALUES (?, ?, ?, ?)
  `).run(message.id, input.botCustomerId, aiTaskId, draftText)
  db.prepare(`
    UPDATE telegram_copilot_messages
    SET status = 'draft_ready', ai_task_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(aiTaskId, message.id)
  return {
    message_id: message.id,
    draft_id: Number(draftResult.lastInsertRowid),
    ai_task_id: aiTaskId,
    status: "draft_ready"
  }
}

export function listTelegramCopilotItems(input: { limit?: number | null; status?: string | null } = {}) {
  ensureTelegramCopilotSchema()
  const db = getDb()
  const limit = Math.min(100, Math.max(1, Number(input.limit ?? 50) || 50))
  const status = trimText(input.status, 40)
  const where = status && status !== "all" ? "WHERE COALESCE(d.status, m.status) = ?" : ""
  const rows = db.prepare(`
    SELECT
      m.id AS message_id,
      d.id AS draft_id,
      m.bot_customer_id,
      m.telegram_chat_id,
      m.telegram_user_id,
      m.telegram_message_id,
      m.sender_display_name,
      c.name AS company_name,
      m.text AS inbound_text,
      m.message_kind,
      m.status AS message_status,
      d.draft_text,
      d.status AS draft_status,
      d.safety_note,
      m.ai_task_id,
      t.status AS ai_task_status,
      t.result_summary AS ai_result_summary,
      d.telegram_result_json,
      d.sent_at,
      m.created_at,
      COALESCE(d.updated_at, m.updated_at) AS updated_at
    FROM telegram_copilot_messages m
    LEFT JOIN telegram_copilot_drafts d ON d.message_id = m.id
    LEFT JOIN bot_customers b ON b.id = m.bot_customer_id
    LEFT JOIN companies c ON c.id = b.company_id
    LEFT JOIN ai_tasks t ON t.id = m.ai_task_id
    ${where}
    ORDER BY
      CASE COALESCE(d.status, m.status)
        WHEN 'draft' THEN 0
        WHEN 'failed' THEN 1
        WHEN 'needs_reply' THEN 2
        WHEN 'handled_by_bot' THEN 3
        WHEN 'sent' THEN 4
        ELSE 5
      END,
      m.created_at DESC
    LIMIT ?
  `).all(...(where ? [status, limit] : [limit]))
  return rows.map((row) => ({ ...(row as Record<string, unknown>) })) as TelegramCopilotItem[]
}

export function saveTelegramCopilotDraft(input: { draftId: number; draftText: string; reviewedBy?: string | null }) {
  ensureTelegramCopilotSchema()
  const db = getDb()
  const draftText = trimText(input.draftText, 4000)
  if (!draftText) throw new Error("Draft text is required")
  const result = db.prepare(`
    UPDATE telegram_copilot_drafts
    SET draft_text = ?, reviewed_by = COALESCE(?, reviewed_by), status = 'draft', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status IN ('draft', 'failed')
  `).run(draftText, input.reviewedBy ?? null, input.draftId)
  if (!result.changes) throw new Error("Draft is not editable")
  return { ok: true }
}

export function rejectTelegramCopilotDraft(input: { draftId: number; reviewedBy?: string | null }) {
  ensureTelegramCopilotSchema()
  const db = getDb()
  const result = db.prepare(`
    UPDATE telegram_copilot_drafts
    SET status = 'rejected', reviewed_by = COALESCE(?, reviewed_by), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status IN ('draft', 'failed')
  `).run(input.reviewedBy ?? null, input.draftId)
  if (!result.changes) throw new Error("Draft is not rejectable")
  return { ok: true }
}

export async function sendTelegramCopilotDraft(input: { draftId: number; draftText?: string | null; reviewedBy?: string | null }) {
  ensureTelegramCopilotSchema()
  const db = getDb()
  const draft = db.prepare(`
    SELECT
      d.id,
      d.message_id,
      d.draft_text,
      d.status,
      m.telegram_chat_id,
      m.bot_customer_id
    FROM telegram_copilot_drafts d
    JOIN telegram_copilot_messages m ON m.id = d.message_id
    WHERE d.id = ?
  `).get(input.draftId) as
    | {
        id: number
        message_id: number
        draft_text: string
        status: string
        telegram_chat_id: string
        bot_customer_id: number | null
      }
    | undefined
  if (!draft) throw new Error("Draft not found")
  if (!["draft", "failed"].includes(draft.status)) throw new Error("Draft is not sendable")

  const draftText = trimText(input.draftText ?? draft.draft_text, 4000)
  if (!draftText) throw new Error("Draft text is required")

  db.prepare(`
    UPDATE telegram_copilot_drafts
    SET draft_text = ?, status = 'approved', reviewed_by = COALESCE(?, reviewed_by), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(draftText, input.reviewedBy ?? null, draft.id)

  const telegramResult = await sendTelegramTextMessage(draft.telegram_chat_id, draftText)
  const sent = Boolean((telegramResult as { ok?: boolean })?.ok)
  db.prepare(`
    UPDATE telegram_copilot_drafts
    SET
      status = ?,
      telegram_result_json = ?,
      sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE sent_at END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sent ? "sent" : "failed", JSON.stringify(telegramResult), sent ? 1 : 0, draft.id)
  db.prepare(`
    UPDATE telegram_copilot_messages
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sent ? "sent" : "send_failed", draft.message_id)

  if (sent) {
    const responseMessageId = (telegramResult as { result?: { message_id?: number } })?.result?.message_id
    db.prepare(`
      INSERT INTO telegram_copilot_messages(
        bot_customer_id,
        telegram_chat_id,
        telegram_message_id,
        direction,
        message_kind,
        text,
        status
      )
      VALUES (?, ?, ?, 'outbound', 'text', ?, 'sent')
    `).run(draft.bot_customer_id, draft.telegram_chat_id, responseMessageId ? String(responseMessageId) : null, draftText)
  }

  return {
    ok: sent,
    draft_id: draft.id,
    telegram_result: telegramResult
  }
}
