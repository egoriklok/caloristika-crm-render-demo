import { NextResponse } from "next/server"

import { requireCrmAccess } from "@/lib/crm-access"
import {
  DgisLeadSearchError,
  searchDgisLeadCandidates,
  type DgisLeadSearchInput
} from "@/lib/dgis-lead-search"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function readSearchBody(request: Request): Promise<DgisLeadSearchInput> {
  try {
    return (await request.json()) as DgisLeadSearchInput
  } catch {
    return {}
  }
}

export async function POST(request: Request) {
  const unauthorized = requireCrmAccess(request)
  if (unauthorized) return unauthorized

  try {
    const body = await readSearchBody(request)
    const result = await searchDgisLeadCandidates(body)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DgisLeadSearchError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown 2GIS search error" },
      { status: 500 }
    )
  }
}
