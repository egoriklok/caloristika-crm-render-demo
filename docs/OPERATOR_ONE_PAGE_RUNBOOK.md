# Operator One-Page Runbook

Use this when you need to run Lunch Up CRM, check that it works, or connect AI agents without touching secrets in public places.

## Open CRM

Local CRM:

```text
http://localhost:3011
```

Local network CRM:

```text
http://<laptop-ip>:3011
```

If `CRM_ACCESS_KEY` is enabled, use:

```text
http://<laptop-ip>:3011/?key=<access-key>
```

Do not send the key in screenshots, public chats or GitHub issues.

## Check Health

Open these URLs before giving access to another person:

```text
/api/health
/api/integrations/status
/api/agent/manifest
/miniapp
/catalog
```

Expected result: CRM opens, catalog opens, Mini App opens, and status endpoints return JSON without secret values.

## Choose Agent Provider

Default:

```text
AGENT_LLM_PROVIDER=offline
```

Use this for safe checks and deterministic recommendations.

External providers:

```text
AGENT_LLM_PROVIDER=paperclip
AGENT_LLM_PROVIDER=hermes
AGENT_LLM_PROVIDER=openclaw
AGENT_LLM_PROVIDER=omniroute
AGENT_LLM_PROVIDER=openai
```

Provider endpoints, commands and API keys must stay only in server env or `.env.local`. Never put tokens into CRM fields, public URLs, screenshots or README examples.

## Run Agent Checks

Safe checks that use a temporary database copy:

```bash
npm run agent:worker-smoke
npm run agent:provider-smoke
npm run agent:remote-worker-smoke
npm run verify
```

If one of these fails, do not run a real agent batch until the error is fixed.

## Run One Agent Pass

Offline pass:

```bash
npm run agent:worker -- --once --limit=3 --no-llm
```

External provider pass:

```bash
AGENT_LLM_PROVIDER=paperclip npm run agent:worker -- --once --limit=3
```

Every agent result must include `evidence_sources`. If evidence is missing, the result is not ready for manager review.

Render CRM with OmniRouter on VPS:

```bash
REMOTE_CRM_BASE_URL=https://caloristika-crm-demo.onrender.com
REMOTE_CRM_ACCESS_KEY=<CRM_ACCESS_KEY from Render>
AGENT_LLM_PROVIDER=omniroute
OMNIROUTER_AGENT_COMMAND=node scripts/omniroute-crm-agent-adapter.mjs
npm run agent:remote-worker -- --once --limit=1
```

Do not put the VPS localhost OmniRouter URL into Render web-service env.

## Telegram Mini App

Current demo channel:

```text
Bot: https://t.me/b2b_food_crm_demo_bot
Mini App: https://caloristika-crm-demo.onrender.com/miniapp
Dialogs: https://caloristika-crm-demo.onrender.com/crm?tab=dialogs
```

Basic flow:

1. Send the bot link to the client.
2. Client opens `/order`, `/cart`, `/cabinet` or `/orders` from Telegram.
3. Mini App writes profile/order data into CRM.
4. Non-service Telegram messages appear in `Диалоги` as manager-reviewable drafts.
5. Manager edits/rejects/sends; AI never sends customer messages without approval.

For a new bot:

1. Create the bot in BotFather with `/newbot`.
2. Run `npm run telegram:set-token`; do not paste the token into chat or docs.
3. Run the checks below.

Useful checks:

```bash
npm run telegram:launch-check-smoke
npm run telegram:setup-preview-smoke
npm run telegram:webhook-post-smoke
npm run miniapp:auth-smoke
npm run miniapp:enrichment-smoke
npm run miniapp:order-smoke
```

`npm run telegram:check -- --json` can show `ok=false` when `DADATA_API_KEY` is missing. If `telegram.bot_ok=true` and `telegram.webhook_ok=true`, the Telegram channel is working and only INN/FNS enrichment is incomplete.

## External Enrichment

Use 2GIS, DaData/FNS and Apify only from server-side endpoints:

```text
POST /api/companies
POST /api/companies/enrichment/bulk
POST /api/integrations/2gis/search
POST /api/integrations/apify/research
```

Start with `dry_run: true`. Use confirmed runs only after the preview looks correct.

## Manager Approval Rule

Agent may prepare:

- recommended next actions;
- evidence sources;
- customer message draft;
- manager note;
- bounded memory updates.

Manager must approve before:

- sending a customer message;
- changing an order;
- changing a deal stage;
- changing catalog SKU, price or stock;
- exporting data to another system;
- running a paid or large external Apify/2GIS batch.

## Backup Rule

Before a real import, enrichment batch, external provider batch or production deployment:

```bash
npm run verify
```

Then copy the active SQLite file from `LUNCH_UP_CRM_DB_PATH` or `data/lunch_up_crm.sqlite` to a dated backup location.

## When Something Breaks

1. Do not keep clicking or rerunning a batch.
2. Check `/api/health`.
3. Check `/api/integrations/status`.
4. Run `npm run verify`.
5. Run the relevant smoke command.
6. Fix the first failing check before sharing the link or running agents again.
