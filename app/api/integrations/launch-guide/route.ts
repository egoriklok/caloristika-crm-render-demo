import { NextResponse } from "next/server"

import { requireCrmAccess } from "@/lib/crm-access"
import { buildIntegrationLaunchGuide } from "@/lib/integration-launch-guide"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const unauthorized = requireCrmAccess(request)
  if (unauthorized) return unauthorized

  return NextResponse.json(buildIntegrationLaunchGuide())
}
