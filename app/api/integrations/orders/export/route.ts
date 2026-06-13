import { NextResponse } from "next/server"

import { exportOrderToExternalWebhook } from "@/lib/external-integrations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json()) as { order_id?: number }
  if (!Number.isInteger(body.order_id) || Number(body.order_id) <= 0) {
    return NextResponse.json({ ok: false, error: "order_id is required" }, { status: 400 })
  }
  try {
    const result = await exportOrderToExternalWebhook(Number(body.order_id))
    return NextResponse.json(result, { status: result.ok ? 200 : result.status === "not_configured" ? 202 : 502 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Export failed" }, { status: 500 })
  }
}

