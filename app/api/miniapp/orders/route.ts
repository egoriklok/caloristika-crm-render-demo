import { NextResponse } from "next/server"

import { createMiniappOrder } from "@/lib/miniapp-service"
import { BotOrderValidationError } from "@/lib/bot-orders"
import { CustomerPortalAuthError } from "@/lib/customer-portal-auth"
import { TelegramMiniAppAuthError } from "@/lib/telegram-miniapp-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const result = await createMiniappOrder(await request.json())
    return NextResponse.json(
      {
        ...result.body,
        external_export: {
          status: result.external_export.status,
          integration_event_id: result.external_export.integration_event_id,
          response_status: "response_status" in result.external_export ? result.external_export.response_status : null
        },
        manager_notification: {
          ok: result.manager_notification.ok,
          skipped: "skipped" in result.manager_notification ? result.manager_notification.skipped : false
        },
        customer_order_confirmation: {
          ok: result.customer_order_confirmation.ok,
          skipped: "skipped" in result.customer_order_confirmation ? result.customer_order_confirmation.skipped : false
        },
        inventory_ai_task_ids: result.body.inventory_ai_task_ids,
        insights: result.insights,
        customer: result.session.customer,
        enrichment_proposal: result.session.enrichment?.proposal ?? null,
        orders: result.orders
      },
      { status: result.statusCode }
    )
  } catch (error) {
    if (error instanceof CustomerPortalAuthError || error instanceof TelegramMiniAppAuthError || error instanceof BotOrderValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    throw error
  }
}
