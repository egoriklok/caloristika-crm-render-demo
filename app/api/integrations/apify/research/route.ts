import { NextResponse } from "next/server"

import { runApifyCompanyResearch, type ApifyCompanyResearchInput } from "@/lib/apify-research"
import { requireCrmAccess } from "@/lib/crm-access"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const unauthorized = requireCrmAccess(request)
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json()) as ApifyCompanyResearchInput
    const result = await runApifyCompanyResearch(body)
    const status = result.ok ? 200 : result.status === "not_configured" ? 202 : 502
    return NextResponse.json(result, { status })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Apify research failed"
      },
      { status: 400 }
    )
  }
}
