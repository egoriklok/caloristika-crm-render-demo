import { NextResponse } from "next/server"

import {
  CompanyEnrichmentRefreshError,
  refreshCompanyEnrichmentById
} from "@/lib/company-enrichment-refresh"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RefreshEnrichmentBody = {
  force_refresh?: boolean
  cache_ttl_hours?: number
  cacheTtlHours?: number
  dry_run?: boolean
  dryRun?: boolean
}

async function readRefreshBody(request: Request): Promise<RefreshEnrichmentBody> {
  try {
    return (await request.json()) as RefreshEnrichmentBody
  } catch {
    return {}
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const companyId = Number(params.id)
  if (!Number.isInteger(companyId)) {
    return NextResponse.json({ ok: false, error: "Invalid company id" }, { status: 400 })
  }
  const body = await readRefreshBody(request)
  try {
    const result = await refreshCompanyEnrichmentById(companyId, body)
    return NextResponse.json({
      ok: true,
      company_id: result.company_id,
      company_name: result.company_name,
      dry_run: result.dry_run,
      saved: result.saved,
      cache_hit: result.cache_hit,
      source_statuses: result.source_statuses,
      enrichment: result.enrichment,
      cache: result.cache
    })
  } catch (error) {
    if (error instanceof CompanyEnrichmentRefreshError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown enrichment error" },
      { status: 500 }
    )
  }
}
