import { NextResponse } from "next/server"

import { getAgentManifest } from "@/lib/agent-manifest"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json(getAgentManifest())
}
