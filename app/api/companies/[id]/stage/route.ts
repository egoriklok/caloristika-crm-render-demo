import { NextResponse } from "next/server"

import { getDb } from "@/lib/db"
import { updateDealStage } from "@/lib/queries"

export const runtime = "nodejs"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const dealId = Number(params.id)
  const body = (await request.json()) as { stage_id?: number }
  const stageId = Number(body.stage_id)
  if (!Number.isInteger(dealId)) {
    return NextResponse.json({ ok: false, error: "Invalid deal id" }, { status: 400 })
  }
  if (!Number.isInteger(stageId)) {
    return NextResponse.json({ ok: false, error: "stage_id is required" }, { status: 400 })
  }
  const db = getDb()
  const stage = db.prepare("SELECT id FROM pipeline_stages WHERE id = ?").get(stageId)
  if (!stage) {
    return NextResponse.json({ ok: false, error: "Stage not found" }, { status: 404 })
  }
  const changes = updateDealStage(dealId, stageId)
  return NextResponse.json({ ok: changes > 0, changes })
}
