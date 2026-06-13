# Lunch Up CRM System PRD

## Purpose

This repository packages the Lunch Up CRM, client catalog, Telegram-ready web app APIs, configurable AI-agent runtime scaffolding, SQLite data backup, and deployment instructions so another AI agent can restore the system on a VPS.

Current live references at packaging time:

- CRM: `https://martin-template-theories-noble.trycloudflare.com/?key=<CRM_ACCESS_KEY>`
- Client catalog: `https://martin-template-theories-noble.trycloudflare.com/catalog?key=<CRM_ACCESS_KEY>`

The Cloudflare URL is temporary. Treat the repository as the durable source of truth.

## Product Scope

Lunch Up CRM is a B2B sales and product-development CRM for a prepared-food factory. It combines:

- Internal CRM dashboard with leads, companies, contacts, orders, operations, scripts, launch matrix, objection map, equipment and integrations.
- Public client catalog with product photos, commercial proposal views, print/PDF mode, unit economics and segment filters.
- SQLite-backed canonical data store.
- Bot-ready APIs for Telegram Mini App ordering, catalog browsing, cart/order workflows and external order export.
- AI-agent infrastructure for enrichment, Apify research, 2GIS/DaData enrichment and future workflow automation.
- Configurable agent runtime providers: `offline`, `paperclip`, `hermes`, `openclaw`, and optional legacy `openai`.
- A 12-point operating model for source of truth, provider selection, permissions, evidence, hosting, SQLite growth, Telegram order flow, sales metrics, safe keys, manager feedback, GitHub PR handoff and operator usage.
- Docker/systemd deployment path for VPS.

## Primary Users

- Business development director.
- Sales manager.
- Product development manager.
- AI agent maintaining data, leads, catalog, scripts and integrations.
- External client receiving a client catalog or commercial proposal.

## Core URLs

- `/` - CRM workspace.
- `/catalog` - client catalog.
- `/catalog?view=all&print=1` - clean A4 print/PDF catalog mode.
- `/miniapp` - Telegram Mini App surface.
- `/api/health` - health check.
- `/api/dashboard` - CRM dashboard data.
- `/api/bot/catalog` and `/api/bot/orders` - bot-facing catalog/order API.
- `/api/miniapp/*` - Mini App session, catalog, orders, enrichment and agent endpoints.
- `/api/integrations/*` - 2GIS, Apify, Telegram setup, export and preflight endpoints.
- `/api/agent/*` and `/api/mcp/manifest` - agent runtime and MCP-facing descriptors.

## Data Model Summary

Authoritative runtime database:

- `data/lunch_up_crm.sqlite`

Supporting source files:

- `data/launch-crm-content.json` - launch matrix and segment content.
- `data/product-details-from-assortment.json` - extracted product details.
- `data/product-photos.json` - product image mapping.
- `data/public-contacts.json` - public contact enrichment.
- `public/admin-catalog-data.json` - static admin catalog export.

Important object groups:

- Companies and contacts.
- Products and categories.
- Launch segments and segment groups.
- Deals/opportunities and stages.
- Scripts and objections.
- Orders and operations.
- Agent tasks/runs.
- Integration status and external tools.

## Functional Requirements

1. CRM must start from the repository with `npm ci`, `npm run build`, and `npm run web`.
2. CRM must read/write SQLite from `LUNCH_UP_CRM_DB_PATH`.
3. Client catalog must work from the same SQLite/catalog source as CRM.
4. Print catalog mode must not include stale internal proposal blocks; use `print=1`.
5. Telegram Mini App endpoints must be deployable after setting Telegram secrets.
6. External enrichment integrations must be disabled until keys are provided.
7. Public access must require `CRM_ACCESS_KEY`.
8. The project must be restorable from GitHub code + committed private SQLite backup + `.env.example`.
9. No real `.env.local` or tokens may be committed.
10. AI-agent execution must not be hardcoded to OpenAI. The worker must support `AGENT_LLM_PROVIDER=offline|paperclip|hermes|openclaw|openai`.
11. Paperclip, Hermes and OpenClaw must be connectable through either a server-side HTTP endpoint or a local command adapter.
12. External agent runtimes must receive bounded CRM context and return structured JSON only; CRM mutations remain approval-gated.
13. Every agent result must include `evidence_sources` so manager recommendations can be traced to CRM context, 2GIS, DaData/FNS, Apify, website or other source notes.
14. Director and operator guidance must be maintained in `docs/CRM_AI_AGENT_OPERATING_MODEL.md` and `docs/OPERATOR_ONE_PAGE_RUNBOOK.md`.
15. For cloned client projects, the launch matrix and all catalog surfaces must use only the target company's own website/catalog/price-list/PDF/spreadsheet/operator file as the SKU source; previous Lunch Up, Caloristika or demo SKU data is not a valid fallback without explicit approval and provenance.
16. Render deployment for cloned projects must use a distinct private GitHub repo, Render service, SQLite database filename, strategy token and public URL, then verify `/api/health`, `/api/dashboard`, `/catalog` and `/miniapp`.

## Non-Functional Requirements

- Node.js 24 runtime.
- Docker Compose and systemd deployment supported.
- Non-root VPS runtime user.
- SQLite WAL/busy timeout configured.
- Health endpoint available for monitoring.
- Agent actions must be observable and approval-gated before sensitive external writes.
- Agent provider status must be visible through health/integration status and documented in `.env.example`.
- The 12-point operating model must be visible through docs and `/api/agent/manifest`.
- Provider smoke tests must validate Paperclip, Hermes and OpenClaw adapters without mutating the working SQLite database.
- Backups must be versioned and restorable without rebuilding the AI context.

## Acceptance Criteria

- `npm run verify` passes.
- `npm run agent:provider-smoke` passes.
- `node ./node_modules/typescript/bin/tsc --noEmit` passes.
- `npm run build` passes.
- `GET /api/health` returns HTTP 200.
- `GET /catalog?view=all&print=1&key=<CRM_ACCESS_KEY>` returns HTTP 200.
- `docs/CRM_AI_AGENT_OPERATING_MODEL.md` covers all 12 director questions.
- `docs/OPERATOR_ONE_PAGE_RUNBOOK.md` provides a one-page operator path.
- Agent worker and provider smoke tests fail if `evidence_sources` is missing.
- Another AI agent can deploy the system using `docs/VPS_DEPLOYMENT_RUNBOOK.md`.
- Another AI agent can restore data using `docs/BACKUP_RESTORE.md`.
