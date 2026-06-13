import { NextResponse } from "next/server"

import { getMcpManifest } from "@/lib/mcp-manifest"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json(getMcpManifest())
}

