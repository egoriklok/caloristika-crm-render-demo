import { NextResponse } from "next/server"

import {
  CompanyEnrichmentRefreshError,
  refreshCompanyEnrichmentBatch,
  type CompanyEnrichmentBatchOptions
} from "@/lib/company-enrichment-refresh"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function readBulkBody(request: Request): Promise<CompanyEnrichmentBatchOptions> {
  try {
    return (await request.json()) as CompanyEnrichmentBatchOptions
  } catch {
    return {}
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBulkBody(request)
    const result = await refreshCompanyEnrichmentBatch(body)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CompanyEnrichmentRefreshError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown bulk enrichment error" },
      { status: 500 }
    )
  }
}
