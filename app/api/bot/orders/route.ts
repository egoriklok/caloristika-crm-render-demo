import { NextResponse } from "next/server"

import { BotOrderValidationError, createBotOrder, type BotOrderPayload } from "@/lib/bot-orders"

export const runtime = "nodejs"

function badRequest(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const result = createBotOrder((await request.json()) as BotOrderPayload)
    return NextResponse.json(result.body, { status: result.statusCode })
  } catch (error) {
    if (error instanceof BotOrderValidationError) {
      return badRequest(error.message, error.status)
    }
    throw error
  }
}
