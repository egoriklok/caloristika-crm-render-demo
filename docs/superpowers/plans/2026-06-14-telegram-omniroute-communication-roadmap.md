# Telegram OmniRoute Communication Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Telegram voice bot and OmniRoute work into a CRM-native communication layer between supplier-side agents, customer-side contacts, managers, Telegram Mini App, email and phone.

**Architecture:** CRM remains the source of truth. Telegram is an ingress, notification and Mini App UI layer. AI agents may classify intent, prepare drafts and update bounded memories, but customer-facing messages, order mutations, price promises and first outreach stay approval-gated through CRM.

**Tech Stack:** Next.js App Router, TypeScript, SQLite for current demo runtime, future Postgres-ready domain boundaries, Telegram Bot API webhook, Telegram Mini App initData validation, existing AI task queue, existing MCP/agent manifests, OmniRoute-compatible provider layer, GitHub issues/projects for delivery tracking.

---

## Where The Roadmap Must Live

The roadmap should be embedded in four places, each with a different purpose:

1. `docs/superpowers/plans/2026-06-14-telegram-omniroute-communication-roadmap.md`
   - Worker-facing implementation plan.
   - Source for task breakdown and PR sequence.

2. `docs/AI_AGENT_SYSTEM_PRD.md` and `docs/CRM_AI_AGENT_OPERATING_MODEL.md`
   - Director-facing product contract.
   - Defines what the product is allowed to do and what remains manager-approved.

3. `/api/agent/manifest` and `/api/mcp/manifest`
   - Agent-readable contract.
   - Future agents should discover the roadmap, constraints, tools and guardrails from API, not from chat history.

4. CRM UI
   - Operational surface for managers.
   - Roadmap should appear inside the existing AI/Telegram/integrations area as work status, not as marketing text.

GitHub should hold the delivery backlog:

- One GitHub milestone: `Telegram OmniRoute Communication Layer MVP`.
- Issues grouped by phases below.
- One PR per phase, with smoke tests and evidence.

---

## Current Evidence From The Repo

Existing CRM surfaces that should be reused:

- `app/api/telegram/webhook/route.ts` receives Telegram updates, saves `telegram_events` and creates AI tasks.
- `lib/telegram-bot.ts` sends Mini App entry messages, manager notifications and customer order status messages.
- `lib/telegram-miniapp-auth.ts` validates Telegram Mini App `initData` server-side.
- `lib/miniapp-service.ts` links Mini App identity, company profile, enrichment, orders and agent tasks.
- `app/api/miniapp/catalog/route.ts`, `app/api/miniapp/orders/route.ts`, `app/api/miniapp/session/route.ts` are the current customer order API.
- `scripts/agent-runtime-sql.mjs`, `scripts/agent-worker.mjs` and `app/api/agent/tasks/route.ts` are the current AI task queue.
- `lib/agent-manifest.ts` and `lib/mcp-manifest.ts` expose agent-readable rules and tools.
- `docs/COMPANY_TELEGRAM_AGENT_CHANNELS.md` already defines Telegram as company-level B2B channel evidence.

Existing bot repo capabilities to reuse conceptually:

- `telegram-voice-agent-factory-skill` gives an intake/factory pattern for adapting bots to new domains.
- `telegram-voice-cjm-bot` gives voice-first intake, Vosk transcription, temporary session memory, OmniRoute adaptive questioning, Mini App output and export/privacy patterns.

---

## Phase 1: Roadmap Contract In Docs And Agent Manifest

**Files:**

- Modify: `docs/AI_AGENT_SYSTEM_PRD.md`
- Modify: `docs/CRM_AI_AGENT_OPERATING_MODEL.md`
- Modify: `lib/agent-manifest.ts`
- Modify: `lib/mcp-manifest.ts`
- Test: `scripts/verify.mjs`

- [ ] **Step 1: Add PRD roadmap section**

Add a section to `docs/AI_AGENT_SYSTEM_PRD.md` after `Functional Requirements`:

```markdown
## Telegram OmniRoute Communication Roadmap

The Telegram/OmniRoute roadmap is part of the CRM product, not a separate bot product.

Approved implementation order:

1. Telegram order and repeat-order MVP.
2. CRM conversation inbox linked to companies, contacts, orders and AI tasks.
3. Voice intake bridge for Telegram messages.
4. Approval-gated outbox for customer-facing messages.
5. OmniRoute intent classification and supplier/customer agent handoff.
6. Production hardening: persistent DB, audit log, throttled outbox, retention policy and tenant isolation.

Operating rule: Telegram accelerates communication, but CRM remains the source of truth. AI outputs are drafts until approved by a manager.
```

- [ ] **Step 2: Add operating model section**

Add a section to `docs/CRM_AI_AGENT_OPERATING_MODEL.md` after `## 7. Telegram Mini App Order Cycle`:

```markdown
## 7A. Telegram And OmniRoute Communication Roadmap

Telegram is a communication layer for catalog, orders, repeat orders, status updates and manager-approved replies.

AI agents may:

- classify incoming Telegram, Mini App, email and phone transcript events;
- create `ai_tasks`;
- prepare customer message drafts;
- propose next actions for a manager;
- update bounded `ai_agent_memories` with evidence.

AI agents must not:

- confirm prices, discounts, delivery dates or legal terms without approval;
- mutate orders, contacts, companies, products or stock directly;
- send first outreach to a public Telegram channel without manager approval;
- treat Telegram as the legal source of truth when CRM, email or signed documents disagree.
```

- [ ] **Step 3: Expose roadmap in agent manifest**

Modify `lib/agent-manifest.ts` and add a `telegram_omniroute_roadmap` object near `operating_model`:

```ts
telegram_omniroute_roadmap: {
  status: "planned",
  plan_path: "docs/superpowers/plans/2026-06-14-telegram-omniroute-communication-roadmap.md",
  product_rule:
    "Telegram is an ingress, Mini App and notification layer. CRM is the source of truth. AI prepares drafts and manager-reviewable actions.",
  phases: [
    "telegram_order_repeat_mvp",
    "crm_conversation_inbox",
    "telegram_voice_intake_bridge",
    "approval_gated_outbox",
    "omniroute_intent_and_agent_handoff",
    "production_hardening"
  ]
}
```

- [ ] **Step 4: Expose roadmap as MCP resource metadata**

Modify `lib/mcp-manifest.ts` and add a resource:

```ts
{
  uri: "lunchup://roadmap/telegram-omniroute",
  endpoint: "/api/agent/manifest",
  description:
    "Telegram and OmniRoute communication roadmap: order MVP, conversation inbox, voice intake, approval outbox, agent handoff and production hardening."
}
```

- [ ] **Step 5: Verify docs and manifest checks**

Run:

```powershell
npm run verify
```

Expected: command exits successfully. If it fails because `scripts/verify.mjs` has explicit manifest/doc expectations, update that verifier to assert the new roadmap strings instead of bypassing the check.

- [ ] **Step 6: Commit Phase 1**

Run:

```powershell
git add docs/AI_AGENT_SYSTEM_PRD.md docs/CRM_AI_AGENT_OPERATING_MODEL.md lib/agent-manifest.ts lib/mcp-manifest.ts scripts/verify.mjs
git commit -m "docs: add telegram omniroute roadmap contract"
```

---

## Phase 2: GitHub Backlog And Milestone

**Files:**

- Create: `docs/github/telegram-omniroute-roadmap-issues.md`
- External: GitHub repo `egoriklok/caloristika-crm-render-demo`

- [ ] **Step 1: Create GitHub issue seed document**

Create `docs/github/telegram-omniroute-roadmap-issues.md`:

```markdown
# Telegram OmniRoute Roadmap GitHub Issues

Milestone: Telegram OmniRoute Communication Layer MVP

## Issue 1: Telegram repeat-order MVP

Goal: Customer can open Telegram Mini App, see order history and repeat the last order with changed quantity/date/address.

Acceptance:

- `/orders` opens Mini App cabinet/history.
- Previous order items are visible.
- Repeat order creates a new manager-review order.
- Manager receives Telegram notification.
- `npm run miniapp:order-smoke` passes.

## Issue 2: CRM conversation inbox

Goal: Manager sees Telegram events, customer profile, related company, related order and AI task in one CRM section.

Acceptance:

- New `communications` or `conversation_threads` storage exists.
- Telegram webhook writes normalized message records.
- CRM UI shows latest messages by company/contact.
- Duplicate Telegram updates do not create duplicate business events.

## Issue 3: Voice intake bridge

Goal: Telegram voice messages become transcripts and manager-reviewable AI tasks.

Acceptance:

- Voice file is stored with retention policy.
- Transcript is linked to company/customer/order when possible.
- AI task includes transcript, intent and evidence.
- No voice processing runs synchronously inside webhook.

## Issue 4: Approval-gated outbox

Goal: AI drafts customer replies, but customer-facing sending requires manager approval.

Acceptance:

- Draft messages are stored separately from sent messages.
- Manager can approve/reject/edit.
- Outbox sends through Telegram with audit status.
- AI cannot directly send customer promises.

## Issue 5: OmniRoute intent and agent handoff

Goal: OmniRoute classifies incoming messages and routes them to order, support, sales, enrichment or manager handoff tasks.

Acceptance:

- Intent schema is documented and tested.
- Tasks use bounded CRM context.
- Result includes evidence sources.
- Fallback offline classifier exists for demo mode.

## Issue 6: Production hardening

Goal: Demo flow is safe to sell as a product after storage, rate limit, audit and deployment constraints are resolved.

Acceptance:

- Persistent DB plan exists for production.
- Outbox rate limiting and retry policy exist.
- Raw Telegram payload/audio/transcript retention is documented.
- Tenant isolation requirements are documented before multi-client launch.
```

- [ ] **Step 2: Create milestone**

Run:

```powershell
gh api repos/egoriklok/caloristika-crm-render-demo/milestones -f title="Telegram OmniRoute Communication Layer MVP" -f description="CRM-native Telegram/Mini App/OmniRoute communication roadmap with approval-gated AI agent workflows."
```

Expected: GitHub returns JSON with a milestone `number`.

- [ ] **Step 3: Create issues from the seed document**

Use the issue titles and acceptance criteria from `docs/github/telegram-omniroute-roadmap-issues.md`.

Run one command per issue:

```powershell
gh issue create --title "Telegram repeat-order MVP" --body-file docs/github/telegram-omniroute-roadmap-issues.md --label "roadmap,telegram,miniapp"
```

Expected: each command returns a GitHub issue URL. If labels do not exist, create labels first or omit labels and add them later.

- [ ] **Step 4: Commit GitHub issue seed**

Run:

```powershell
git add docs/github/telegram-omniroute-roadmap-issues.md
git commit -m "docs: seed telegram omniroute github backlog"
```

---

## Phase 3: Conversation Inbox Data Model

**Files:**

- Create: `lib/communications.ts`
- Modify: `app/api/telegram/webhook/route.ts`
- Modify: `lib/agent-manifest.ts`
- Modify: `scripts/verify.mjs`
- Test: `scripts/telegram-webhook-post-smoke.mjs`

- [ ] **Step 1: Define normalized communication tables**

Create `lib/communications.ts` with a function that ensures these SQLite tables:

```sql
CREATE TABLE IF NOT EXISTS conversation_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel, external_thread_id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_label TEXT,
  external_message_id TEXT,
  body_text TEXT,
  payload_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(thread_id, external_message_id)
);
```

- [ ] **Step 2: Add Telegram webhook normalization**

In `app/api/telegram/webhook/route.ts`, after `telegram_events` insert, call a helper:

```ts
upsertTelegramConversationMessage({
  botCustomerId,
  telegramChatId,
  telegramMessageId: update.message?.message_id ? String(update.message.message_id) : null,
  displayName: name,
  text: update.message?.text ?? update.callback_query?.data ?? "",
  payload: update
})
```

Expected behavior: existing webhook response shape remains unchanged, but a normalized message is now visible in `conversation_messages`.

- [ ] **Step 3: Extend webhook smoke**

Modify `scripts/telegram-webhook-post-smoke.mjs` to assert:

```sql
SELECT COUNT(*) AS count
FROM conversation_messages
WHERE body_text LIKE '%/order%'
```

Expected: count is at least 1 after smoke POST.

- [ ] **Step 4: Run smoke**

Run:

```powershell
npm run telegram:webhook-post-smoke
```

Expected: command exits successfully and reports the webhook POST smoke passed.

- [ ] **Step 5: Commit Phase 3**

Run:

```powershell
git add lib/communications.ts app/api/telegram/webhook/route.ts scripts/telegram-webhook-post-smoke.mjs lib/agent-manifest.ts scripts/verify.mjs
git commit -m "feat: add crm conversation inbox storage"
```

---

## Phase 4: CRM UI Placement

**Files:**

- Modify: main CRM dashboard component that renders tabs/sections.
- Modify or create: `components/communications-inbox.tsx`
- Test: `scripts/verify.mjs`

- [ ] **Step 1: Place roadmap and inbox under AI/Telegram operations**

Do not create a large new top-level marketing page. Add an operational section in the existing CRM UI near `ИИ-агенты` and `Telegram API`.

Recommended visible structure:

- `Продажи`
- `Клиенты`
- `Заказы`
- `Каталог`
- `ИИ-агенты`
- `Коммуникации`
- `Интеграции`

Inside `Коммуникации`, show:

- Telegram messages
- AI draft status
- manager approval status
- linked company/order
- channel: Telegram, email, phone transcript

- [ ] **Step 2: Use non-technical Russian labels**

Client-facing and manager-facing labels must avoid:

- `JTBD`
- `agent memory`
- `task generation`
- `OmniRoute`
- `Mini App workflow`

Use:

- `Сообщения`
- `Черновик ответа`
- `Требует подтверждения`
- `История заказов`
- `Повтор заказа`
- `Связаться с менеджером`

- [ ] **Step 3: Add verifier checks**

Modify `scripts/verify.mjs` to assert that the CRM source includes:

```js
"Коммуникации"
"Черновик ответа"
"Требует подтверждения"
```

and does not include removed customer-facing technical terms in the new section.

- [ ] **Step 4: Run verify**

Run:

```powershell
npm run verify
```

Expected: command exits successfully.

- [ ] **Step 5: Commit Phase 4**

Run:

```powershell
git add components/communications-inbox.tsx scripts/verify.mjs
git commit -m "feat: add communications operations section"
```

---

## Phase 5: Approval-Gated Outbox

**Files:**

- Create: `lib/communication-outbox.ts`
- Modify: `lib/telegram-bot.ts`
- Modify: `app/api/agent/tasks/route.ts`
- Create or modify: CRM API route for approving outbound drafts.
- Test: new smoke script `scripts/communication-outbox-smoke.mjs`

- [ ] **Step 1: Add outbox tables**

Add:

```sql
CREATE TABLE IF NOT EXISTS communication_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER REFERENCES conversation_threads(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  ai_task_id INTEGER REFERENCES ai_tasks(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  recipient_external_id TEXT,
  draft_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by TEXT,
  approved_at TEXT,
  sent_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Allowed statuses:

- `draft`
- `approved`
- `sending`
- `sent`
- `rejected`
- `failed`

- [ ] **Step 2: Convert AI customer messages to drafts**

When `ai_tasks.result_json.customer_message_draft` exists, create a `communication_outbox` row with `status='draft'`.

Expected: AI result does not call Telegram directly.

- [ ] **Step 3: Add manager approval endpoint**

Create an API route that accepts:

```json
{
  "outbox_id": 1,
  "action": "approve",
  "edited_text": "Здравствуйте! Заказ передали менеджеру, подтвердим детали в этом чате."
}
```

Expected: route changes status to `approved` and then sends through the controlled Telegram sender.

- [ ] **Step 4: Add outbox smoke**

Create `scripts/communication-outbox-smoke.mjs` that:

1. Creates a fake draft.
2. Approves it with outbound disabled.
3. Verifies status becomes `sent` or `failed` with a recorded reason.
4. Verifies the draft is linked to a thread/company/task.

- [ ] **Step 5: Run smoke**

Run:

```powershell
node scripts/communication-outbox-smoke.mjs
```

Expected: command exits successfully without using real Telegram secrets.

- [ ] **Step 6: Commit Phase 5**

Run:

```powershell
git add lib/communication-outbox.ts lib/telegram-bot.ts app/api/agent/tasks/route.ts scripts/communication-outbox-smoke.mjs
git commit -m "feat: add approval gated communication outbox"
```

---

## Phase 6: Voice Intake Bridge

**Files:**

- Create: `lib/telegram-voice-intake.ts`
- Modify: `app/api/telegram/webhook/route.ts`
- Modify: `lib/agent-manifest.ts`
- Test: `scripts/telegram-webhook-post-smoke.mjs`

- [ ] **Step 1: Define voice intake contract**

The CRM webhook should not run Vosk or LLM synchronously. It should store metadata and enqueue a task:

```ts
{
  agentCode: "telegram_order_validator",
  taskType: "telegram_voice_intake",
  priority: 80,
  prompt: "Разобрать голосовое сообщение Telegram: определить намерение клиента, какие данные нужны для заказа, нужен ли менеджер."
}
```

- [ ] **Step 2: Add voice metadata extraction**

In webhook parsing, detect:

```ts
update.message?.voice
```

Store Telegram `file_id`, duration and message id in the normalized message payload.

- [ ] **Step 3: Add worker boundary**

Document in `lib/agent-manifest.ts`:

```ts
voice_intake_rule:
  "Webhook stores voice metadata and queues a task. Transcription and LLM work must run in a worker, never synchronously in the webhook."
```

- [ ] **Step 4: Run webhook smoke**

Run:

```powershell
npm run telegram:webhook-post-smoke
```

Expected: existing text webhook smoke still passes. Voice-specific smoke can use a synthetic payload with `voice.file_id`.

- [ ] **Step 5: Commit Phase 6**

Run:

```powershell
git add lib/telegram-voice-intake.ts app/api/telegram/webhook/route.ts lib/agent-manifest.ts scripts/telegram-webhook-post-smoke.mjs
git commit -m "feat: add telegram voice intake bridge"
```

---

## Phase 7: Production Readiness Gate

**Files:**

- Modify: `docs/RENDER_DEPLOYMENT_RUNBOOK.md`
- Modify: `docs/VPS_DEPLOYMENT_RUNBOOK.md`
- Modify: `docs/AI_AGENT_INFRASTRUCTURE.md`
- Modify: `lib/integration-preflight.ts`

- [ ] **Step 1: Document demo vs production**

Add this rule to deployment docs:

```markdown
Render Free + local SQLite is approved for demo only. A production communication layer with Telegram orders, customer messages, voice transcripts and AI tasks requires persistent storage, backups, audit logs and an approval-gated outbox.
```

- [ ] **Step 2: Add preflight warnings**

Modify `lib/integration-preflight.ts` so production preflight warns when:

- `TELEGRAM_BOT_TOKEN` is missing.
- `TELEGRAM_WEBHOOK_SECRET` is missing.
- `PUBLIC_BASE_URL` is missing.
- database path is local demo path on Render.
- outbox tables are missing after Phase 5.

- [ ] **Step 3: Run integration smoke**

Run:

```powershell
npm run integration:preflight-mock-smoke
```

Expected: command exits successfully and shows warnings without exposing secrets.

- [ ] **Step 4: Commit Phase 7**

Run:

```powershell
git add docs/RENDER_DEPLOYMENT_RUNBOOK.md docs/VPS_DEPLOYMENT_RUNBOOK.md docs/AI_AGENT_INFRASTRUCTURE.md lib/integration-preflight.ts
git commit -m "docs: add telegram communication production gate"
```

---

## Recommended Execution Order

1. Phase 1 first because it makes the roadmap discoverable to future AI agents.
2. Phase 2 second because it turns the roadmap into GitHub work.
3. Phase 3 and Phase 4 together because conversation storage needs a UI.
4. Phase 5 before any real AI customer replies.
5. Phase 6 after the inbox exists, because voice transcripts need a place to land.
6. Phase 7 before selling this as production.

---

## Self-Review

Spec coverage:

- Roadmap location is defined across docs, API manifests, CRM UI and GitHub backlog.
- Telegram remains a communication layer; CRM remains source of truth.
- AI output remains manager-reviewable and approval-gated.
- Voice bot/OmniRoute work is reused through intake, memory, classification and worker patterns.
- Production constraints are explicit.

Placeholder scan:

- No unresolved placeholder language remains.

Scope check:

- This plan intentionally stops before implementation. It is the implementation plan for the roadmap itself. Each phase can become a separate PR.
