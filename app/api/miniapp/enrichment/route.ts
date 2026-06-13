import { NextResponse } from "next/server"

import { lookupCompanyEnrichment, type CompanyEnrichmentInput } from "@/lib/company-enrichment"
import { authenticateCustomerPortal, CustomerPortalAuthError } from "@/lib/customer-portal-auth"
import { TelegramMiniAppAuthError } from "@/lib/telegram-miniapp-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompanyEnrichmentInput & { initData?: string; email?: string; accessCode?: string }
    authenticateCustomerPortal(body)
    if (!body.company_name?.trim()) {
      return NextResponse.json({ ok: false, error: "company_name is required" }, { status: 400 })
    }
    const enrichment = await lookupCompanyEnrichment(body)
    return NextResponse.json({ ok: true, enrichment })
  } catch (error) {
    if (error instanceof CustomerPortalAuthError || error instanceof TelegramMiniAppAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    throw error
  }
}
