import { NextResponse } from "next/server"

import {
  createReferenceRow,
  listReferenceConfigs,
  readReferenceRows,
  ReferenceAdminError,
  updateReferenceRow
} from "@/lib/reference-admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function errorResponse(error: unknown) {
  if (error instanceof ReferenceAdminError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
  }
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : "Unknown reference admin error" },
    { status: 500 }
  )
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const ref = url.searchParams.get("ref")
    if (!ref) {
      return NextResponse.json({ ok: true, configs: listReferenceConfigs() })
    }
    return NextResponse.json(
      readReferenceRows({
        ref,
        q: url.searchParams.get("q"),
        limit: Number(url.searchParams.get("limit") ?? 60)
      })
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ref?: string; values?: Record<string, unknown> }
    return NextResponse.json(createReferenceRow({ ref: body.ref ?? "", values: body.values ?? {} }), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { ref?: string; id?: unknown; values?: Record<string, unknown> }
    return NextResponse.json(updateReferenceRow({ ref: body.ref ?? "", id: body.id, values: body.values ?? {} }))
  } catch (error) {
    return errorResponse(error)
  }
}
