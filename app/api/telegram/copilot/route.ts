import { NextResponse } from "next/server"

import { requireCrmAccess } from "@/lib/crm-access"
import {
  listTelegramCopilotItems,
  rejectTelegramCopilotDraft,
  saveTelegramCopilotDraft,
  sendTelegramCopilotDraft
} from "@/lib/telegram-copilot"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const unauthorized = requireCrmAccess(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  return NextResponse.json({
    ok: true,
    items: listTelegramCopilotItems({
      status: url.searchParams.get("status"),
      limit: Number(url.searchParams.get("limit") ?? 50)
    })
  })
}

export async function PATCH(request: Request) {
  const unauthorized = requireCrmAccess(request)
  if (unauthorized) return unauthorized

  const body = (await request.json()) as {
    action?: "save" | "send" | "reject"
    draft_id?: number
    draft_text?: string
    reviewed_by?: string
  }
  if (!body.draft_id || !body.action) {
    return NextResponse.json({ ok: false, error: "draft_id and action are required" }, { status: 400 })
  }

  try {
    if (body.action === "save") {
      return NextResponse.json(saveTelegramCopilotDraft({
        draftId: body.draft_id,
        draftText: body.draft_text ?? "",
        reviewedBy: body.reviewed_by ?? "CRM manager"
      }))
    }
    if (body.action === "reject") {
      return NextResponse.json(rejectTelegramCopilotDraft({
        draftId: body.draft_id,
        reviewedBy: body.reviewed_by ?? "CRM manager"
      }))
    }
    if (body.action === "send") {
      return NextResponse.json(await sendTelegramCopilotDraft({
        draftId: body.draft_id,
        draftText: body.draft_text,
        reviewedBy: body.reviewed_by ?? "CRM manager"
      }))
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram copilot action failed" },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 })
}
