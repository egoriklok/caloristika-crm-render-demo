import { NextResponse } from "next/server"

import { requireCrmAccess } from "@/lib/crm-access"
import { buildTelegramSetupPreview } from "@/lib/telegram-setup-preview"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const unauthorized = requireCrmAccess(request)
  if (unauthorized) return unauthorized

  return NextResponse.json(buildTelegramSetupPreview())
}
