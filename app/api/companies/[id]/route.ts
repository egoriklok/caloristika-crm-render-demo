import { NextResponse } from "next/server"

import { CompanyEditError, updateCompanyFromWebUi, type CompanyEditInput } from "@/lib/company-edit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const companyId = Number(params.id)
    const body = (await request.json()) as CompanyEditInput
    const result = updateCompanyFromWebUi(companyId, body)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CompanyEditError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown company edit error"
      },
      { status: 500 }
    )
  }
}
