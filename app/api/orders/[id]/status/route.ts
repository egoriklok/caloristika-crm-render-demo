import { NextResponse } from "next/server"

import { OrderStatusError, updateOrderStatus } from "@/lib/order-status"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const orderId = Number(params.id)
    const body = (await request.json()) as {
      status?: string
      manager_comment?: string | null
      notify_customer?: boolean
    }
    const result = await updateOrderStatus({
      order_id: orderId,
      status: body.status ?? "",
      manager_comment: body.manager_comment,
      notify_customer: body.notify_customer
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }
    throw error
  }
}
