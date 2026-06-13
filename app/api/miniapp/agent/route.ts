import { NextResponse } from "next/server"

import { CustomerPortalAuthError } from "@/lib/customer-portal-auth"
import { createCustomerPortalAgentTask, type MiniappSessionInput } from "@/lib/miniapp-service"
import { TelegramMiniAppAuthError } from "@/lib/telegram-miniapp-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MiniappSessionInput & { intent?: string | null; message?: string | null }
    return NextResponse.json(createCustomerPortalAgentTask(body), { status: 201 })
  } catch (error) {
    if (error instanceof CustomerPortalAuthError || error instanceof TelegramMiniAppAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    throw error
  }
}
