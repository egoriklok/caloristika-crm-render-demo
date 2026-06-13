import { NextResponse } from "next/server"

import { upsertMiniappSession, type MiniappSessionInput } from "@/lib/miniapp-service"
import { CustomerPortalAuthError } from "@/lib/customer-portal-auth"
import { TelegramMiniAppAuthError } from "@/lib/telegram-miniapp-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MiniappSessionInput
    return NextResponse.json(await upsertMiniappSession(body))
  } catch (error) {
    if (error instanceof CustomerPortalAuthError || error instanceof TelegramMiniAppAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    throw error
  }
}
