import { NextResponse } from "next/server"

import { getBotCatalog } from "@/lib/bot-catalog"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json(getBotCatalog())
}

