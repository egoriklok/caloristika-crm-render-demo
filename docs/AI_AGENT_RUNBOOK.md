# AI Agent Runbook

This runbook is the operating contract for AI agents connected to Lunch Up CRM.

## Architecture

```text
CRM server
  Next.js App Router
  SQLite source of truth
  /api/agent/manifest
  /api/agent/tasks
  /api/mcp/manifest

Agent worker
  scripts/agent-worker.mjs
  claims queued ai_tasks
  reads bounded CRM context
  returns structured JSON
  writes ai_task_runs, result_json and ai_agent_memories

Remote worker
  scripts/agent-remote-worker.mjs
  runs on VPS when CRM is on Render
  pulls protected tasks through /api/agent/tasks
  calls local OmniRouter on the VPS when AGENT_LLM_PROVIDER=omniroute
```

The worker does not replace the CRM. It runs beside the CRM process and uses the same SQLite database path.

## Required Commands

Prepare the SQLite runtime schema:

```bash
npm run agent:migrate
```

Run a local/offline worker pass without an external LLM call:

```bash
npm run agent:worker -- --once --limit=3 --no-llm
```

Run the smoke test against a temporary SQLite copy:

```bash
npm run agent:worker-smoke
```

Run provider integration smoke tests against a temporary SQLite copy:

```bash
npm run agent:provider-smoke
```

Run the Render-style remote worker smoke test:

```bash
npm run agent:remote-worker-smoke
```

Run with an external agent runtime on the server:

```bash
AGENT_LLM_PROVIDER=paperclip npm run agent:worker -- --once --limit=3
```

For a persistent server process, run CRM and the worker as two services:

```bash
npm run web
npm run agent:worker
```

## Server Environment

Keep these values only on the server:

```text
AGENT_LLM_PROVIDER
AGENT_LLM_ENABLED
AGENT_WORKER_ID
AGENT_ALLOWED_CODES
AGENT_MAX_TASKS_PER_RUN
AGENT_MAX_ATTEMPTS
AGENT_POLL_INTERVAL_MS
AGENT_LLM_TIMEOUT_MS
AGENT_LLM_MODEL
REMOTE_CRM_BASE_URL
REMOTE_CRM_ACCESS_KEY
PAPERCLIP_AGENT_ENDPOINT
PAPERCLIP_AGENT_COMMAND
PAPERCLIP_API_KEY
HERMES_AGENT_ENDPOINT
HERMES_AGENT_COMMAND
HERMES_API_KEY
OPENCLAW_AGENT_ENDPOINT
OPENCLAW_GATEWAY_URL
OPENCLAW_AGENT_COMMAND
OPENCLAW_API_KEY
OMNIROUTER_BASE_URL
OMNIROUTER_API_KEY
OMNIROUTER_MODEL
OMNIROUTER_AGENT_ENDPOINT
OMNIROUTER_AGENT_COMMAND
OPENAI_API_KEY
OPENAI_AGENT_MODEL
LUNCH_UP_CRM_DB_PATH
CRM_ACCESS_KEY
```

Default mode is offline. The worker uses an external runtime only when `AGENT_LLM_PROVIDER` is set to `paperclip`, `hermes`, `openclaw`, `omniroute` or `openai`. `AGENT_LLM_ENABLED=1` remains a legacy shortcut for `openai` when no provider is selected.

## Agent Roles

`customer_order_concierge`

Handles customer-side order guidance. It checks profile completeness, delivery date, cart, order history, repeat-order signals and next step for the manager.

`inventory_replenishment_agent`

Watches `inventory_positions` and `inventory_movements`. It recommends replenishment when available stock drops below reorder point. It must not change stock targets without approval.

`sales_demand_analyst`

Analyzes orders, repeat demand, high-velocity SKU and customer-level buying patterns. It produces manager-reviewable recommendations for stock and sales follow-up.

Existing sales agents remain available:

```text
lead_research
outreach_writer
followup_scheduler
sku_matrix_analyst
telegram_order_validator
apify_actor_researcher
```

## Human-in-the-loop

Agents may write:

```text
ai_tasks.result_summary
ai_tasks.result_json
ai_task_runs
ai_agent_memories
```

Agents must not directly mutate these without separate manager approval:

```text
orders.status
orders.total_amount
order_items
products
inventory_positions
contacts
companies
deals.stage_id
external exports
Telegram customer notifications
```

Allowed output is a structured recommendation. The CRM manager decides whether to apply it.

## Task Lifecycle

```text
queued -> running -> needs_review -> done
queued -> running -> failed
```

`needs_review` means the agent produced a result but a manager must inspect it.

`done` is allowed only for low-risk analysis that does not require a business mutation.

`failed` keeps `last_error` for debugging.

## Source Of Truth

Agents must read from CRM APIs or SQLite tables, not invent parallel records.

Primary tables:

```text
products                 catalog and prices
orders + order_items      customer orders
inventory_positions       current stock/reserve/reorder points
inventory_movements       stock movement audit
companies + contacts      CRM account base
bot_customers             Telegram/customer identity link
ai_agents + ai_tasks      agent registry and task queue
ai_task_runs              execution trace
ai_agent_memories         bounded long-term agent memory
```

## API Contract

Read the machine contract:

```http
GET /api/agent/manifest
GET /api/mcp/manifest
```

Create a task:

```http
POST /api/agent/tasks
```

List tasks:

```http
GET /api/agent/tasks?status=queued&limit=20
```

Claim the next task:

```http
PATCH /api/agent/tasks
{
  "action": "claim_next",
  "worker_id": "server-worker-1",
  "max_attempts": 3
}
```

Complete a task:

```http
PATCH /api/agent/tasks
{
  "action": "complete",
  "task_id": 123,
  "worker_id": "server-worker-1",
  "mode": "openai_responses",
  "result": {
    "summary": "...",
    "confidence": "medium",
    "risk_level": "medium",
    "recommended_actions": [],
    "customer_message_draft": null,
    "manager_note": "...",
    "evidence_sources": [
      {
        "label": "CRM task context",
        "source_type": "crm",
        "url": null,
        "note": "Internal CRM queue, catalog, order, company or contact context used by the recommendation."
      }
    ],
    "inventory_watchlist": [],
    "memory_updates": [],
    "next_status": "needs_review"
  }
}
```

## Guardrails

- Region scope is Saint Petersburg and Leningrad Oblast.
- `products` is the single source of truth for SKU names, prices, photos and active status.
- Orders below 7000 RUB remain `blocked_minimum`.
- Use public B2B contact channels only.
- Do not expose `OPENAI_API_KEY`, Paperclip/Hermes/OpenClaw API keys, Telegram token, 2GIS key, DaData key, Apify token or export webhook token.
- Do not send customer messages automatically from the worker.
- Keep worker limits enabled: max tasks, max attempts, timeout and bounded context.
- Record every run in `ai_task_runs`.

## Provider Modes

The worker supports these provider modes:

```text
offline    no external model call; deterministic manager-reviewable recommendation
paperclip  HTTP endpoint or local command for Paperclip orchestration
hermes     HTTP endpoint or local command for Hermes Agent
openclaw   gateway endpoint or local command for OpenClaw
omniroute  OpenAI-compatible local OmniRouter, HTTP endpoint or local command
openai     optional legacy OpenAI Responses API mode
```

Paperclip, Hermes, OpenClaw and OmniRoute receive the same `lunch-up-crm-agent-runtime.v1` payload where endpoint/command mode is used: bounded CRM context, result schema and guardrails. OmniRoute chat-completions mode receives the same context and schema as OpenAI-compatible messages. All providers must return JSON matching the schema. The JSON result is validated and normalized before it is saved to CRM.

HTTP mode is selected when the provider endpoint env is set:

```text
PAPERCLIP_AGENT_ENDPOINT
HERMES_AGENT_ENDPOINT
OPENCLAW_AGENT_ENDPOINT or OPENCLAW_GATEWAY_URL
OMNIROUTER_AGENT_ENDPOINT or OMNIROUTE_AGENT_ENDPOINT
```

Command mode is selected when endpoint is empty and command env is set:

```text
PAPERCLIP_AGENT_COMMAND
HERMES_AGENT_COMMAND
OPENCLAW_AGENT_COMMAND
OMNIROUTER_AGENT_COMMAND or OMNIROUTE_AGENT_COMMAND
```

External agent output is not treated as fact. It is a recommendation against CRM context.

OpenAI-compatible OmniRouter mode is selected when endpoint and command are empty but base URL is set:

```text
AGENT_LLM_PROVIDER=omniroute
OMNIROUTER_BASE_URL=http://127.0.0.1:18790/v1
OMNIROUTER_MODEL=<model>
```

## Remote Worker For Render CRM

Render cannot reach `127.0.0.1` on the VPS. If OmniRouter is installed on the VPS, run the worker on the VPS and let it pull work from Render CRM:

```bash
REMOTE_CRM_BASE_URL=https://caloristika-crm-demo.onrender.com
REMOTE_CRM_ACCESS_KEY=<CRM_ACCESS_KEY from Render>
AGENT_LLM_PROVIDER=omniroute
OMNIROUTER_BASE_URL=http://127.0.0.1:18790/v1
OMNIROUTER_MODEL=<model>
npm run agent:remote-worker -- --once --limit=1
```

`/api/agent/tasks` requires `CRM_ACCESS_KEY`. The remote worker sends it as `x-crm-access-key`, so the key is not placed in public URLs.

## Server Deployment Shape

Run CRM as the web process:

```bash
CRM_NEXT_MODE=start npm run web
```

Run the worker as a separate process:

```bash
AGENT_LLM_PROVIDER=paperclip npm run agent:worker
```

Both processes must use the same `LUNCH_UP_CRM_DB_PATH`.

For scale-out, keep only one write-capable SQLite CRM instance. If multiple agent workers are required later, move the data layer to PostgreSQL or introduce a dedicated queue service.
