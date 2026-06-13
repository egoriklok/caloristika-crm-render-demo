import { NextResponse } from "next/server"

import { getIntegrationStatus, getRecentIntegrationEvents } from "@/lib/external-integrations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: getIntegrationStatus(),
    recent_events: getRecentIntegrationEvents()
  })
}

