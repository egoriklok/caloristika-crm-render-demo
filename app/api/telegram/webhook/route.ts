import { NextResponse } from "next/server"

import { getDb } from "@/lib/db"
import { createAiTask } from "@/lib/queries"
import { resolveMiniappEntryIntent } from "@/lib/telegram-intents"
import {
  sendMiniappEntryMessage,
  sendTelegramChatIdMessage,
  sendTelegramHelpMessage
} from "@/lib/telegram-bot"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type TelegramUser = {
  id?: number
  first_name?: string
  last_name?: string
  username?: string
}

type TelegramChat = TelegramUser & {
  title?: string
  type?: string
}

type TelegramUpdate = {
  update_id?: number
  message?: {
    message_id?: number
    text?: string
    chat?: TelegramChat
    from?: TelegramUser
  }
  callback_query?: {
    id?: string
    data?: string
    from?: TelegramUser
    message?: {
      chat?: TelegramChat
    }
  }
}

function displayName(user?: TelegramUser | TelegramChat) {
  if (!user) return null
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username || ("title" in user ? user.title : null) || null
}

function extractChat(update: TelegramUpdate) {
  const chat = update.message?.chat ?? update.callback_query?.message?.chat
  const user = update.message?.from ?? update.callback_query?.from ?? chat
  return {
    telegramChatId: chat?.id ? String(chat.id) : null,
    telegramUserId: user?.id ? String(user.id) : null,
    displayName: displayName(user)
  }
}

function queueTelegramTask(eventId: number, chatId: string | null, text: string | undefined) {
  try {
    return createAiTask({
      agentCode: "telegram_order_validator",
      taskType: "telegram_update",
      priority: text ? 70 : 45,
      prompt: `Разобрать Telegram update event #${eventId}${chatId ? ` из chat ${chatId}` : ""}: определить намерение клиента, нужен ли заказ, какие данные запросить дальше.`
    })
  } catch {
    return null
  }
}

function isHelpCommand(text: string | undefined) {
  return /^\/help\b/i.test(text ?? "")
}

function isWhoamiCommand(text: string | undefined) {
  return /^\/(whoami|id|chatid)\b/i.test(text ?? "")
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/telegram/webhook",
    secret_configured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)
  })
}

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "Invalid Telegram webhook secret" }, { status: 401 })
  }

  const update = (await request.json()) as TelegramUpdate
  const { telegramChatId, telegramUserId, displayName: name } = extractChat(update)
  const db = getDb()
  let botCustomerId: number | null = null

  if (telegramChatId) {
    db.prepare(`
      INSERT INTO bot_customers(telegram_user_id, telegram_chat_id, display_name, state)
      VALUES (?, ?, ?, 'webhook_seen')
      ON CONFLICT(telegram_chat_id) DO UPDATE SET
        telegram_user_id = COALESCE(excluded.telegram_user_id, telegram_user_id),
        display_name = COALESCE(excluded.display_name, display_name),
        state = 'webhook_seen',
        last_seen_at = CURRENT_TIMESTAMP
    `).run(telegramUserId, telegramChatId, name)
    botCustomerId = (db.prepare("SELECT id FROM bot_customers WHERE telegram_chat_id = ?").get(telegramChatId) as { id: number }).id
  }

  const eventId = Number(
    db.prepare(`
      INSERT INTO telegram_events(bot_customer_id, event_type, payload_json)
      VALUES (?, 'telegram_update', ?)
    `).run(botCustomerId, JSON.stringify(update)).lastInsertRowid
  )
  const taskId = queueTelegramTask(eventId, telegramChatId, update.message?.text ?? update.callback_query?.data)
  const incomingText = update.message?.text ?? update.callback_query?.data
  const serviceMessage =
    telegramChatId && isWhoamiCommand(incomingText)
      ? await sendTelegramChatIdMessage(telegramChatId)
      : telegramChatId && isHelpCommand(incomingText)
        ? await sendTelegramHelpMessage(telegramChatId, request.url)
        : null
  const miniappIntent = resolveMiniappEntryIntent(incomingText)
  const entryMessage =
    !serviceMessage && telegramChatId && miniappIntent
      ? await sendMiniappEntryMessage(telegramChatId, request.url, miniappIntent)
      : null

  return NextResponse.json({
    ok: true,
    event_id: eventId,
    bot_customer_id: botCustomerId,
    ai_task_id: taskId,
    miniapp_intent: miniappIntent,
    service_message: serviceMessage,
    miniapp_entry_message: entryMessage
  })
}
