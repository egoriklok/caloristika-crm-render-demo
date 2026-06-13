import { NextResponse } from "next/server"

import { getDashboardData } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const started = performance.now()
  const response = NextResponse.json(getDashboardData())
  response.headers.set("Cache-Control", "private, no-store")
  response.headers.set("Server-Timing", `dashboard;dur=${Math.round(performance.now() - started)}`)
  return response
}
