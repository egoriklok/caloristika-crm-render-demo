# CRM AI Agent Operating Model

This document turns the 12 director-level questions into implemented operating rules for Lunch Up CRM. It is written for the product development director, sales operators and future AI agents that will work with the CRM.

## Purpose

Lunch Up CRM must stay usable for local B2B sales in Saint Petersburg and Leningrad Oblast while becoming ready for Telegram, Apify, 2GIS, DaData, Paperclip, Hermes and OpenClaw workflows. The rule is simple: CRM remains the business source of truth, agents prepare evidence-backed drafts, and a manager approves business mutations.

## 1. Source Of Truth

Implemented solution: SQLite is the current operational source of truth. The active database is `data/lunch_up_crm.sqlite` or the path from `LUNCH_UP_CRM_DB_PATH`. The `products` table is the source for SKU names, prices, photos, active status and catalog content. Companies, contacts, deals, orders, order items, enrichment sources, agent tasks and agent memories also live in SQLite. Google Sheets and external research are source layers, not canonical CRM records until imported and verified.

Clone policy: for every new company deployment, the `products` table must be
rebuilt from that company's own website/catalog/price list/PDF/spreadsheet or
operator-provided source. Launch matrices must be generated from those active
SKU only. Lunch Up, Caloristika and other previous demo catalogs are examples,
not fallback data sources, unless the operator explicitly approves reuse and
records provenance.

Operating rule: if a company, contact, SKU, deal or order already exists in CRM, an agent must update or reference that record instead of creating a parallel copy.

Verification evidence: `npm run verify` checks runtime files, CRM tables, product catalog consistency, logistics fields, contacts and one-source catalog rules. `docs/AI_AGENT_RUNBOOK.md` defines the primary tables. `/api/agent/manifest` exposes the runtime contract.

## 2. Provider Selection

Implemented solution: the agent worker supports `offline`, `paperclip`, `hermes`, `openclaw` and `openai`. The selected provider is controlled by server-side `AGENT_LLM_PROVIDER`. Paperclip, Hermes and OpenClaw can be connected through HTTP endpoints or local commands.

Selection policy:

- `offline`: default mode for deterministic recommendations, smoke tests and work without external runtime.
- `paperclip`: use for workflow orchestration across multiple agent steps and team-facing agent pipelines.
- `hermes`: use as a persistent gateway/personal agent when it is the stable operator entrypoint.
- `openclaw`: use for local assistant and agent gateway workflows controlled from this machine.
- `openai`: optional legacy fallback through the Responses API.

Verification evidence: `scripts/agent-runtime-providers.mjs` resolves provider modes. `npm run agent:provider-smoke` proves Paperclip/Hermes/OpenClaw adapters with a temporary SQLite copy. `.env.example` lists the server-side provider variables.

## 3. Agent Permissions

Implemented solution: agents may write recommendations, traces and bounded memories. They must not directly mutate orders, prices, products, contacts, companies, deal stages, exports or Telegram customer messages without manager approval.

Allowed without separate approval:

- read bounded CRM context;
- create or complete `ai_tasks`;
- write `ai_task_runs`;
- write `ai_tasks.result_json` and `result_summary`;
- write `ai_agent_memories` with bounded confidence.

Needs manager approval:

- change order status, order lines or stock targets;
- send customer-facing messages;
- export orders to an external system;
- create or change commercial offers, prices or catalog SKU;
- enrich, merge or overwrite CRM master records at scale.

Verification evidence: `docs/AI_AGENT_RUNBOOK.md` has the human-in-the-loop contract. `scripts/agent-worker.mjs` returns manager-reviewable results. `lib/agent-runtime.ts` controls task claim, complete and failure paths.

## 4. Evidence And Anti-Hallucination

Implemented solution: every agent result must include `evidence_sources`. The schema requires evidence items with `label`, `source_type`, `url` and `note`. Internal CRM evidence uses `url: null`; external evidence should include the source link when available.

Operating rule: no agent recommendation is treated as fact unless it points to CRM context or external source notes. Headcount must remain a range with confidence unless a verified source proves an exact number.

Verification evidence: `scripts/agent-runtime-sql.mjs` requires and normalizes `evidence_sources`. `scripts/agent-provider-smoke.mjs` and `scripts/agent-worker-smoke.mjs` fail when evidence is missing. `docs/AI_AGENT_RUNBOOK.md` documents the complete-result payload.

## 5. Permanent Hosting

Implemented solution: laptop hosting is acceptable for demos and local testing. Permanent CRM should run on a VPS or private server with a persistent public domain, HTTPS, backup, process supervisor and server-only secrets.

Deployment rule:

- use the laptop URL only for temporary review;
- use a VPS/Docker/systemd/Nginx deployment for production;
- keep `/api/health` and `/api/integrations/status` available for checks;
- keep `CRM_ACCESS_KEY` or another access control layer enabled for private CRM;
- never hardcode temporary tunnel URLs in the source.

Verification evidence: `Dockerfile`, `docker-compose.yml`, `ops/systemd/lunch-up-crm.service`, `ops/nginx/lunch-up-crm.conf` and `docs/DEPLOYMENT_AND_SCALING.md` define the deployment path. `npm run build` proves the production build.

## 6. SQLite Growth Path

Implemented solution: SQLite is the current database because one CRM instance and one write-capable worker are enough for the current sales pilot. The project already supports `LUNCH_UP_CRM_DB_PATH`, WAL-related configuration and maintenance scripts.

Scale rule:

- keep one write-capable SQLite CRM instance;
- use backups before agent batches or import jobs;
- use WAL/busy timeout configuration for local durability;
- move to PostgreSQL or a dedicated queue service when there are multiple concurrent users, multiple write workers, frequent integrations or a production team workflow.

Verification evidence: `.env.example` includes SQLite runtime variables. `scripts/sqlite-maintenance.mjs` exists for maintenance. `docs/DEPLOYMENT_AND_SCALING.md` describes the growth path.

## 7. Telegram Mini App Order Cycle

Implemented solution: Telegram Mini App has the CRM-backed customer cycle: Telegram identity, company profile, enrichment, catalog, cart, server-side price recalculation, order creation, history and repeat order flow.

Cycle:

1. BotFather creates the bot and Mini App.
2. CRM stores server-side `TELEGRAM_BOT_TOKEN`, webhook secret and public URL.
3. Telegram webhook receives `/order`, `/cart`, `/cabinet` and `/orders`.
4. Mini App validates Telegram `initData`.
5. Customer fills company profile.
6. CRM enriches company via 2GIS, DaData/FNS, website and CRM context.
7. Customer adds catalog SKU to cart.
8. Server recalculates prices and minimum order.
9. Order is saved to `orders + order_items`.
10. Manager reviews order and status.
11. Telegram notification can be sent only through controlled server flow.
12. Customer can repeat from order history.

Verification evidence: `npm run miniapp:auth-smoke`, `npm run miniapp:enrichment-smoke`, `npm run miniapp:order-smoke`, `npm run telegram:webhook-post-smoke` and `npm run telegram:launch-check-smoke`.

## 8. Sales Metrics

Implemented solution: CRM must track whether it helps sales, not just whether it stores records.

Machine contract name: `sales_metrics_contract`.

Required metrics:

- lead count by segment and stage;
- phone/email/address/2GIS coverage;
- time to first contact;
- stage conversion;
- pipeline value;
- first orders;
- repeat orders;
- order revenue;
- average order value;
- blocked minimum-order cases;
- SKU sell-through;
- agent queue SLA;
- accepted vs rejected agent recommendations.

Operating rule: each new sales or agent feature should improve at least one of these metrics or reduce manual work needed to collect them.

Verification evidence: `/api/dashboard` exposes leads, companies, contacts, deals, catalog and orders. `README.md` documents visible sales data. Agent tasks and results are stored in `ai_tasks` and `ai_task_runs`.

## 9. Safe External Keys

Implemented solution: all sensitive tokens stay server-side. The UI, client catalog, Mini App responses and public links must not expose Apify, 2GIS, DaData, Telegram, OpenAI, Paperclip, Hermes or OpenClaw secrets.

Required keys:

- `APIFY_TOKEN`
- `APIFY_DEFAULT_RESEARCH_ACTOR_ID`
- `DGIS_API_KEY`
- `DADATA_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- provider keys for Paperclip, Hermes, OpenClaw or OpenAI

Operating rule: use dry-run/preflight first, then confirmed run. Never paste secrets into CRM text fields, README examples, GitHub issues, screenshots or public URLs.

Verification evidence: `npm run launch-guide:smoke`, `npm run integration:preflight-mock-smoke`, `npm run telegram:setup-preview-smoke` and `docs/AI_AGENT_INFRASTRUCTURE.md` check that launch payloads do not leak secrets.

## 10. Manager Feedback Loop

Implemented solution: agent output is saved as a recommendation and trace. The manager decides whether to accept, reject or adjust the recommendation. The result can then be turned into bounded memory.

Feedback categories:

- accepted;
- rejected because data was weak;
- rejected because offer did not match segment;
- rejected because timing was wrong;
- accepted after manual edit;
- needs new external source.

Operating rule: only proven manager feedback should become reusable knowledge. Agent memory must reference the source task and confidence. Strategic documentation is updated only after a pattern is validated, not after a single guess.

Verification evidence: `ai_task_runs`, `ai_tasks.result_json` and `ai_agent_memories` exist in the schema. `lib/agent-runtime.ts` writes memory with `source_task_id`. `scripts/verify.mjs` checks the runtime tables.

## 11. GitHub PR And Merge Path

Implemented solution: the current GitHub handoff is PR #1 on branch `codex/agent-provider-runtime`: `https://github.com/egoriklok/lunch-up-crm-agent-handoff/pull/1`.

Merge rule:

- do not treat local laptop edits as production source after PR approval;
- push all implementation and docs to the PR branch;
- after merge, deploy from the GitHub repository;
- run `npm run verify`, `npm run agent:worker-smoke`, `npm run agent:provider-smoke`, TypeScript check and production build;
- create a database backup before production agent batches;
- verify `/api/health`, `/api/agent/manifest`, `/api/integrations/status`, `/miniapp` and `/catalog`.

Verification evidence: the staging repo at `C:\tmp\lunch-up-crm-agent-handoff` holds the PR branch. GitHub PR #1 is the handoff for review and merge.

## 12. Operator One-Page Runbook

Implemented solution: a short operator document exists at `docs/OPERATOR_ONE_PAGE_RUNBOOK.md`. It explains how to open the CRM, check health, choose an agent provider, run smoke checks, connect Telegram and avoid leaking secrets.

Operating rule: when a non-technical operator asks how to run the CRM or agents, start with the one-page runbook, then use the deeper documents only if needed.

Verification evidence: `npm run verify` checks that this operating model and the one-page runbook exist and include the required operational anchors.

## Verification Map

Use this map before declaring the 12 solutions complete.

| Point | Proof |
| --- | --- |
| 1. Source of truth | `npm run verify`, `docs/AI_AGENT_RUNBOOK.md`, `/api/agent/manifest` |
| 2. Provider selection | `scripts/agent-runtime-providers.mjs`, `npm run agent:provider-smoke` |
| 3. Agent permissions | `docs/AI_AGENT_RUNBOOK.md`, `scripts/agent-worker.mjs` |
| 4. Evidence | `evidence_sources` schema, worker smoke, provider smoke |
| 5. Hosting | `docs/DEPLOYMENT_AND_SCALING.md`, Docker/systemd/Nginx files |
| 6. SQLite growth | `LUNCH_UP_CRM_DB_PATH`, SQLite env keys, deployment docs |
| 7. Telegram Mini App | Mini App and Telegram smoke commands |
| 8. Sales metrics | `/api/dashboard`, CRM tables, agent task traces |
| 9. Safe keys | launch-guide/preflight/Telegram smoke commands |
| 10. Feedback loop | `ai_task_runs`, `ai_agent_memories`, `source_task_id` |
| 11. GitHub PR | PR #1 branch `codex/agent-provider-runtime` |
| 12. Operator runbook | `docs/OPERATOR_ONE_PAGE_RUNBOOK.md` |
