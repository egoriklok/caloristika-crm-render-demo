import { NextResponse } from "next/server"

import { getAgentRuntimeHealth } from "@/lib/agent-runtime"
import { getDb, getDbRuntimeInfo } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const db = getDb()
  const companies = db.prepare("SELECT COUNT(*) AS count FROM companies").get() as { count: number }
  const products = db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active = 1").get() as { count: number }
  const queuedTasks = db.prepare("SELECT COUNT(*) AS count FROM ai_tasks WHERE status = 'queued'").get() as { count: number }

  return NextResponse.json({
    ok: true,
    service: "lunch-up-crm",
    db: getDbRuntimeInfo(),
    agents: getAgentRuntimeHealth(),
    counts: {
      companies: companies.count,
      active_products: products.count,
      queued_ai_tasks: queuedTasks.count
    }
  })
}
