# AI Agent Handoff

## Mission

Restore, operate, or extend Lunch Up CRM from this repository without relying on the original Codex thread.

## Start Here

1. Read `README.md`.
2. Read `docs/AI_AGENT_SYSTEM_PRD.md`.
3. Read `docs/CRM_AI_AGENT_OPERATING_MODEL.md`.
4. Read `docs/OPERATOR_ONE_PAGE_RUNBOOK.md`.
5. Read `docs/VPS_DEPLOYMENT_RUNBOOK.md`.
6. Read `docs/BACKUP_RESTORE.md`.
7. Inspect `.env.example`.
8. Run the verification commands below before changing behavior.

## Verification Commands

```bash
npm ci
npm run verify
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
```

## Runtime Commands

```bash
CRM_NEXT_MODE=standalone PORT=3011 HOST=0.0.0.0 npm run web
```

Health:

```bash
curl -fsS http://127.0.0.1:3011/api/health
```

## Required Environment

Use `.env.example` as the contract. Required for core CRM:

- `CRM_ACCESS_KEY`
- `CUSTOMER_PORTAL_SHARED_ACCESS_CODE`
- `PUBLIC_BASE_URL`
- `PORT`
- `HOST`
- `CRM_NEXT_MODE`
- `LUNCH_UP_CRM_DB_PATH`

Optional integrations:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_MANAGER_CHAT_ID`
- `DGIS_API_KEY`
- `DADATA_API_KEY`
- `APIFY_TOKEN`
- `AGENT_LLM_PROVIDER`
- `PAPERCLIP_AGENT_ENDPOINT` or `PAPERCLIP_AGENT_COMMAND`
- `HERMES_AGENT_ENDPOINT` or `HERMES_AGENT_COMMAND`
- `OPENCLAW_AGENT_ENDPOINT`, `OPENCLAW_GATEWAY_URL` or `OPENCLAW_AGENT_COMMAND`
- `OPENAI_API_KEY` only for optional legacy OpenAI mode

## Data Safety Rules

- Do not commit `.env.local`.
- Do not print secrets in logs or chat.
- Private CRM repo may include the current SQLite backup only because the user explicitly requested a GitHub backup.
- Generic product repo must not include Lunch Up private data.
- Before schema/data migrations, make a SQLite backup.

## Current Live Links at Handoff

- CRM: `https://martin-template-theories-noble.trycloudflare.com/?key=<CRM_ACCESS_KEY>`
- Client catalog: `https://martin-template-theories-noble.trycloudflare.com/catalog?key=<CRM_ACCESS_KEY>`

These are temporary laptop-tunnel links. Do not hardcode them into production.

## Agent Roles

- Deployment agent: VPS, Docker/systemd, Nginx, health checks.
- Data agent: SQLite backup, restore, migrations, catalog consistency.
- CRM agent: dashboard, leads, contacts, orders, pipeline.
- Catalog agent: product catalog, print mode, product photos and commercial proposal views.
- Integration agent: Telegram, Apify, 2GIS, DaData, Paperclip/Hermes/OpenClaw agent runtime, external order webhooks.
- QA agent: `npm run verify`, TypeScript, build, health, page smoke tests.

## Known Operational Notes

- The app is Next.js 16 / React 19 with Node 24.
- SQLite is used directly through Node runtime APIs and local scripts.
- The CRM is protected by access key middleware.
- Client catalog and CRM share the same product/catalog data.
- Print/PDF mode should use `print=1`.
