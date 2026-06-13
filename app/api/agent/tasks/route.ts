import { NextResponse } from "next/server"

import {
  claimNextAgentTask,
  completeAgentTask,
  failAgentTask,
  listAgentTasks,
  type AgentResult
} from "@/lib/agent-runtime"
import { createAiTask } from "@/lib/queries"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  return NextResponse.json({
    ok: true,
    tasks: listAgentTasks({
      status: url.searchParams.get("status"),
      limit: Number(url.searchParams.get("limit") ?? 50)
    })
  })
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    agent_code?: string
    company_id?: number
    deal_id?: number
    task_type?: string
    priority?: number
    prompt?: string
  }
  if (!body.agent_code || !body.task_type || !body.prompt) {
    return NextResponse.json({ ok: false, error: "agent_code, task_type and prompt are required" }, { status: 400 })
  }
  const taskId = createAiTask({
    agentCode: body.agent_code,
    companyId: body.company_id ?? null,
    dealId: body.deal_id ?? null,
    taskType: body.task_type,
    priority: body.priority ?? 50,
    prompt: body.prompt
  })
  return NextResponse.json({ ok: true, task_id: taskId }, { status: 201 })
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    action?: "claim_next" | "complete" | "fail"
    worker_id?: string
    allowed_agent_codes?: string[]
    max_attempts?: number
    task_id?: number
    mode?: string
    model?: string | null
    started_at?: string | null
    latency_ms?: number | null
    input?: unknown
    result?: AgentResult
    error?: string
    requeue?: boolean
  }
  const workerId = body.worker_id?.trim() || "api-agent-worker"

  if (body.action === "claim_next") {
    return NextResponse.json({
      ok: true,
      claim: claimNextAgentTask({
        workerId,
        allowedAgentCodes: body.allowed_agent_codes,
        maxAttempts: body.max_attempts
      })
    })
  }

  if (body.action === "complete") {
    if (!body.task_id || !body.result) {
      return NextResponse.json({ ok: false, error: "task_id and result are required" }, { status: 400 })
    }
    return NextResponse.json(
      completeAgentTask({
        taskId: body.task_id,
        workerId,
        mode: body.mode ?? "api",
        model: body.model,
        startedAt: body.started_at,
        latencyMs: body.latency_ms,
        input: body.input,
        result: body.result
      })
    )
  }

  if (body.action === "fail") {
    if (!body.task_id || !body.error) {
      return NextResponse.json({ ok: false, error: "task_id and error are required" }, { status: 400 })
    }
    return NextResponse.json(
      failAgentTask({
        taskId: body.task_id,
        workerId,
        mode: body.mode,
        model: body.model,
        error: body.error,
        input: body.input,
        requeue: body.requeue
      })
    )
  }

  return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 })
}
