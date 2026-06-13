import { NextResponse } from "next/server"

import {
  CompanyLeadIntakeError,
  createOrUpdateCompanyLead,
  type CompanyLeadIntakeInput
} from "@/lib/company-lead-intake"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompanyLeadIntakeInput
    const result = await createOrUpdateCompanyLead(body)
    return NextResponse.json(result, { status: result.dry_run ? 200 : result.created_company ? 201 : 200 })
  } catch (error) {
    if (error instanceof CompanyLeadIntakeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown company intake error"
      },
      { status: 500 }
    )
  }
}
