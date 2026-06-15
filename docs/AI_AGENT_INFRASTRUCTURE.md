# AI Agent And Telegram Infrastructure

## Runtime

CRM runs as a Next.js App Router application. The old standalone HTML server has been replaced by `scripts/server.mjs`, which only launches Next.

Local dev/LAN command:

```bash
npm run web
```

Default address:

```text
http://localhost:3011
```

## Access

Set `CRM_ACCESS_KEY` to protect the CRM UI and API:

```bash
set CRM_ACCESS_KEY=strong-key
```

Open with:

```text
http://localhost:3011/?key=strong-key
```

The key is stored in an httpOnly cookie by `proxy.ts`.

## Telegram

## Company Telegram And Agent Channels

Company-level Telegram/agent-channel evidence is stored on `companies`, not only on `contacts`. The CRM tracks `telegram_url`, `telegram_username`, `telegram_contact_status`, `telegram_source_url`, `telegram_source_note`, `agent_contact_policy`, `agent_contact_readiness` and `agent_contact_next_step`.

Use `npm run crm:backfill-telegram` after schema changes or data imports. The script reads existing CRM/public sources, adds the fields if needed, marks channels as `public_found`, `needs_verification` or `not_found`, and queues `company_telegram_channel_researcher` tasks.

AI-agents may research and draft, but must not use personal userbot outreach or mass first messages. A Telegram channel becomes contactable only when it is a confirmed public B2B/company channel and the manager approves the first contact. Full field contract and guardrails are in `docs/COMPANY_TELEGRAM_AGENT_CHANNELS.md`.

Webhook endpoint:

```http
POST /api/telegram/webhook
```

Optional secret:

```bash
set TELEGRAM_WEBHOOK_SECRET=telegram-secret
```

Telegram must send the secret in:

```text
X-Telegram-Bot-Api-Secret-Token
```

The webhook records every update in `telegram_events`, upserts `bot_customers`, queues `telegram_order_validator` in `ai_tasks`, and sends a Telegram Mini App entry button when the client sends `/start`, `/order`, `/cart`, `/cabinet`, `/orders`, or matching text intent. `/cart` is routed as `tg_view=cart&tg_intent=cart`, `/cabinet` as `tg_view=cabinet&tg_intent=cabinet`, and `/orders` as `tg_view=cabinet&tg_intent=orders`. CRM access key protection must not block Telegram: `/api/telegram/webhook` is reachable without `?key=` only when Telegram sends `X-Telegram-Bot-Api-Secret-Token`.

Telegram Copilot adds a safe manager outbox on top of the webhook. Every text/callback update is normalized into `telegram_copilot_messages`; non-service client messages create a draft in `telegram_copilot_drafts` and queue `telegram_reply_copilot` in `ai_tasks`. The CRM `Диалоги` tab lets a manager edit, reject or send the draft. Sending uses `sendMessage` through the official Telegram Bot API and never uses a personal Telegram account, Telethon session, user API automation or hidden human imitation.

Protected operator API:

```http
GET   /api/telegram/copilot
PATCH /api/telegram/copilot
```

Bot creation still starts in `@BotFather`. After the operator receives a token, run:

```bash
set TELEGRAM_BOT_TOKEN=telegram-bot-token
set PUBLIC_BASE_URL=https://example.trycloudflare.com
set TELEGRAM_WEBHOOK_SECRET=telegram-secret
set TELEGRAM_BOT_DISPLAY_NAME=Lunch Up заказы
set TELEGRAM_BOT_DESCRIPTION=Каталог Lunch Up для юридических лиц
set TELEGRAM_BOT_SHORT_DESCRIPTION=Каталог, корзина и B2B-заказы Lunch Up
set TELEGRAM_MENU_BUTTON_TEXT=Lunch Up заказ
set TELEGRAM_MINIAPP_SHORT_NAME=lunchup
npm run telegram:env-bootstrap
npm run telegram:check
npm run telegram:launch-check-smoke
npm run telegram:setup-dry-run-smoke
npm run telegram:setup-preview-smoke
npm run telegram:webhook-smoke
npm run telegram:webhook-access-smoke
npm run telegram:webhook-post-smoke
npm run launch-guide:smoke
npm run integration:preflight-mock-smoke
npm run miniapp:auth-smoke
npm run miniapp:enrichment-smoke
npm run miniapp:order-smoke
npm run company:enrichment-smoke
npm run project-sheet:import
npm run telegram:launch
npm run telegram:setup
```

For persistent local operation, copy `.env.example` to `.env.local` and put server-side values there, or run `npm run telegram:env-bootstrap -- --write` after checking the dry-run output. `npm run web`, `npm run telegram:check`, `npm run telegram:launch`, and `npm run telegram:setup` load `.env.local` automatically without overriding already configured process environment variables. `.env.local` is intentionally ignored and must not be shared with clients or committed.

`npm run telegram:env-bootstrap` is dry-run by default. It reuses saved `logs/public_crm_url.txt` and `logs/public_access_key.txt`, generates `TELEGRAM_WEBHOOK_SECRET` only in memory, and never prints secret values. Writing `.env.local` requires `npm run telegram:env-bootstrap -- --write`; existing filled values are preserved unless `--force` is passed.

The setup script first checks that the public `/miniapp` URL is reachable and `/api/miniapp/catalog` returns products, then validates the token with `getMe`, configures bot name/description, `setWebhook`, `setChatMenuButton`, `/start`, `/order`, `/cart`, `/cabinet`, `/orders`, `/help`, `/whoami`, and reads `getWebhookInfo` for operator confirmation. The URL preflight can be skipped only for controlled internal tests with `--skip-url-preflight`. For safe review without Telegram mutation, `node scripts/setup-telegram-bot.mjs --dry-run --json --skip-url-preflight` prints the planned Telegram API payloads with `secret_token` redacted. `/whoami` returns the current Telegram chat id so the operator can put it into `TELEGRAM_MANAGER_CHAT_ID` for manager notifications.

The launch script is the primary operator command. `npm run telegram:launch` runs the safe check, executes setup only when required keys are present, verifies Telegram webhook state, and calls protected CRM integration preflight. Use `npm run telegram:launch -- --dry-run --no-network` for a non-mutating readiness preview; when all required keys are present, dry-run also prints the planned `setWebhook`, `setChatMenuButton`, and `setMyCommands` payloads with the webhook secret redacted.

The check script reads the same configuration, verifies `getMe/getWebhookInfo` when a token is present, prints Mini App/webhook URLs, BotFather URL, future bot URL hint, Telegram entrypoints for `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami`, and reports missing keys without printing secret values.

`npm run telegram:launch-check-smoke` is a no-network smoke test for the operator-facing launch check. It runs `telegram-launch-check.mjs` with fake env values, validates JSON and text output for BotFather handoff and Mini App entrypoints, and confirms fake secret values are not printed.

`npm run telegram:setup-dry-run-smoke` is a no-network smoke test for setup payload generation. It runs `setup-telegram-bot.mjs --dry-run --json --skip-url-preflight` with fake env values, validates `setWebhook`, `setChatMenuButton`, `setMyCommands`, `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami`, and confirms fake secret values are not printed.

`npm run telegram:setup-preview-smoke` is a no-write temporary-server smoke test for the protected CRM/MCP setup preview API. It calls `/api/integrations/telegram/setup-preview`, verifies CRM-key protection, `setWebhook`, `setChatMenuButton`, `setMyCommands`, `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami`, and confirms fake secret values are not returned.

`npm run telegram:webhook-smoke` is a no-network, no-database smoke test for command routing. It verifies that `/order` opens the catalog, `/cart` opens checkout with `tg_view=cart&tg_intent=cart`, `/cabinet` opens the cabinet with `tg_view=cabinet&tg_intent=cabinet`, `/orders` opens the cabinet/history view with `tg_view=cabinet&tg_intent=orders`, and `/help` stays a service command rather than an order intent.

`npm run telegram:webhook-access-smoke` is a no-write temporary-server smoke test for proxy access. It verifies that `/api/telegram/webhook` is blocked without credentials, blocked with a wrong Telegram secret, readable with the CRM key for operators, and reachable without CRM key when `X-Telegram-Bot-Api-Secret-Token` matches `TELEGRAM_WEBHOOK_SECRET`.

`npm run telegram:webhook-post-smoke` is a no-write temporary-database smoke test for real Telegram webhook POSTs. It starts a temporary CRM server with `LUNCH_UP_CRM_DB_PATH` pointing to a copied SQLite file, posts `/order`, `/cart`, `/cabinet`, `/orders`, `/help`, `/whoami`, and one natural client message to `/api/telegram/webhook`, verifies the Telegram secret-header guard, checks `telegram_events`, `bot_customers`, `ai_tasks`, `telegram_copilot_messages`, `telegram_copilot_drafts`, confirms the protected copilot approval API, and confirms that webhook commands do not create CRM orders.

`npm run launch-guide:smoke` is a no-write temporary-server smoke test for the operator launch handoff. It starts CRM with fake secret env values, calls `/api/integrations/launch-guide`, verifies `operator_handoff`, BotFather commands, `miniapp_setup` for BotFather `/newapp`, the `https://t.me/BotFather` open URL, future bot URL hint, Telegram-native named/fallback `startapp` links, `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami` Mini App entrypoints, audience-specific share links, ready-to-send `share_assets` with message text, Telegram share URL, QR payload and `qr_image_url`, verifies the public SVG `/api/integrations/share-qr` endpoint, launch success criteria, and confirms that secret values are not exposed in the JSON response.

`npm run integration:preflight-mock-smoke` is a no-write temporary-server smoke test for protected launch diagnostics. It starts CRM with a local public base URL, mock 2GIS/DaData endpoints through `DGIS_API_BASE_URL` and `DADATA_API_BASE_URL`, verifies public Mini App/catalog, Telegram webhook access through the secret header, 2GIS and DaData proxy checks, and confirms the response does not expose secret values while remaining blocked without `TELEGRAM_BOT_TOKEN`.

`npm run miniapp:auth-smoke` is a no-write temporary-database smoke test for the real Telegram Web App authorization path. It signs test `initData` with a fake `TELEGRAM_BOT_TOKEN`, verifies that missing or tampered initData is rejected, creates a Mini App session, persists the server-side customer profile, verifies returning-session profile hydration without local draft data, creates an order and order history without `MINIAPP_DEMO_MODE`, and uses `TELEGRAM_OUTBOUND_DISABLED=1` to skip outbound Telegram API calls while preserving server-side signature validation.

`npm run miniapp:enrichment-smoke` is a no-write temporary-database smoke test for the Mini App company autofill path. It signs Telegram Web App `initData`, starts mock 2GIS/DaData/company-website endpoints through `DGIS_API_BASE_URL` and `DADATA_API_BASE_URL`, verifies `/api/miniapp/enrichment` rejects missing initData, reads public contact data and employee-count signals, returns `headcount_evidence`, calculates the office range and proposal guidance, then persists the enriched cabinet profile through `/api/miniapp/session` without mutating the working CRM database.

`npm run miniapp:order-smoke` is a no-write temporary-database smoke test for checkout. It starts a temporary CRM server with `MINIAPP_DEMO_MODE=1` and `LUNCH_UP_CRM_DB_PATH` pointing to a copied SQLite file, reads the Mini App catalog, builds a basket above 7000 RUB, posts to `/api/miniapp/orders`, verifies `orders + order_items`, order history, and proposal guidance in `orders.instructions`, then exits without mutating the working CRM database.

`npm run company:enrichment-smoke` is a no-write temporary-database smoke test for the company intake enrichment path. It starts a mock 2GIS/DaData/company-website source server, starts CRM with `LUNCH_UP_CRM_DB_PATH`, `DGIS_API_BASE_URL`, and `DADATA_API_BASE_URL`, checks `dry_run`, creates a lead only in the temporary SQLite copy, verifies `company_enrichment_profiles`, `company_enrichment_sources`, FNS/DaData employee count, 2GIS employee count, website employee count, `headcount_evidence`, office range, `proposal_summary`, and checks `POST /api/integrations/2gis/search` for dry-run candidate preview plus confirmed import.

## Bot Catalog And Orders

```http
GET /api/bot/catalog
POST /api/bot/orders
```

`POST /api/bot/orders` validates items before writing, uses a SQLite transaction, creates `orders` and `order_items`, and queues an AI validation task.

## Telegram Mini App

```http
GET  /miniapp
GET  /api/miniapp/catalog
POST /api/miniapp/session
POST /api/miniapp/enrichment
POST /api/miniapp/orders
POST /api/miniapp/orders/history
POST /api/companies/{company_id}/enrichment
POST /api/companies/enrichment/bulk
```

Mini App authentication validates Telegram `initData` server-side with `TELEGRAM_BOT_TOKEN`. The CRM maps Telegram users into `bot_customers`, stores cabinet fields in `miniapp_customer_profiles`, links them to `companies`, writes contacts, and stores orders in the same CRM pipeline. `TELEGRAM_OUTBOUND_DISABLED=1` is reserved for smoke/QA so tests can validate signed initData without sending real Telegram API messages.

The Mini App UI includes a mobile catalog, client cabinet, server-side CRM profile hydration, 2GIS/open-source enrichment, launch-basket assembly from the proposal estimate, local draft recovery for profile/cart/delivery date/customer instructions/proposal estimate, cart, minimum-order top-up suggestions, order history, repeat-order flow, minimum-order validation, and checkout. It reads `tg_view`, `view`, `tg_intent`, or Telegram `start_param` to open the right section from bot commands. Native Telegram WebApp controls are used: `MainButton` submits checkout, `BackButton` returns cabinet/cart users to the catalog, and `enableClosingConfirmation` protects filled drafts from accidental close. On returning sessions it fills empty cabinet fields from the saved CRM profile without overwriting the local draft. After 2GIS/FNS enrichment, the Mini App immediately posts the enriched profile to `/api/miniapp/session` so CRM managers can see the company, contact, address, phone, email, website, office-size estimate, and source records before an order is placed. It also shows proposal guidance: headcount source, office-size label, launch scenario, what to offer, assumptions, and manager next step. Server-side order creation always recalculates prices from `products`; it also validates delivery address, delivery date, lead time, cutoff, and writes enrichment-based proposal guidance into `orders.instructions` before writing the CRM order. The browser only sends product IDs and quantities while delivery date and customer instructions are written into the CRM order. When `TELEGRAM_BOT_TOKEN` is configured, order creation sends a customer Telegram confirmation with a `Мои заказы и повтор` Mini App button and a detailed manager notification.

The CRM dashboard order queue includes delivery address, delivery date, total, `order_items` SKU preview, quantity and unit price so the manager can review the actual basket before confirming or updating status.

Bot launch is performed by `npm run telegram:launch` after the operator creates the bot in `@BotFather`. The lower-level setup step requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`; the script uses `PUBLIC_BASE_URL` or the saved public tunnel URL from `logs/public_crm_url.txt`, verifies the public Mini App and catalog API before mutating Telegram webhook/menu state, and only then configures the bot. `TELEGRAM_MANAGER_CHAT_ID` enables manager notifications for new Mini App orders, including delivery date, address, customer instructions, total, and the first order SKU lines.

## Company Enrichment

The enrichment layer records company data and office-size estimates in:

```text
company_enrichment_profiles
company_enrichment_sources
```

Adapters:

- 2GIS Places API via `DGIS_API_KEY`.
- DaData/FNS organization lookup via `DADATA_API_KEY`, including `employee_count` when available.
- Company website from 2GIS, CRM or incoming payload: public phone/email plus public phrases about team size.
- CRM/local lead data.
- Apify actor workflow via `POST /api/integrations/apify/research` when `APIFY_TOKEN` and an actor id are configured.
- Heuristic office-size estimate when direct employee data is unavailable.

Commercial proposals should use a range such as "80-120 people" with confidence and source notes, not a false exact employee claim. The enrichment response includes `headcount_evidence` for FNS/DaData, 2GIS, company website and CRM segment context, marking which source was used for the office estimate. The enrichment response includes `proposal` guidance with `headcount_source`, `office_size_label`, `launch_scenario`, `what_to_offer`, `proposal_summary`, `manager_next_step`, and assumptions so agents can draft a commercial offer without inventing exact headcount.

For QA, proxy routing, or no-network tests, `DGIS_API_BASE_URL` and `DADATA_API_BASE_URL` can redirect server-side enrichment calls to an internal mock/proxy. Leave them empty in normal operation so CRM uses the official 2GIS and DaData endpoints.

2GIS demo key limits are documented in `docs/2GIS_DEMO_KEY_LIMITS.md` and must
be treated as hard guardrails by AI agents. Demo key usage is limited to targeted
company enrichment, not mass scraping: one agent run may process at most 10 CRM
companies or 10 2GIS candidates, must use cache/dry-run by default, must not
parallelize 2GIS calls, and must not bypass 429/403/monthly blocks by creating
new demo keys. If a quota or block error appears, the agent stops 2GIS calls and
creates a manager review task.

`POST /api/companies` is the protected lead-intake route for Telegram, Apify, AI agents and external systems. It accepts `company_name` plus optional INN, website, address, segment and contact data, performs 2GIS/DaData/company-website/CRM enrichment, creates or updates the company without duplicate deals, stores `company_enrichment_profiles`, calculates office range, launch portions/SKU and budget, and queues a `lead_intake_enrichment` AI task. Use `dry_run: true` to preview enrichment and proposal math without writing to SQLite.

CRM operators can use `Новый лид и КП` in the Companies tab to preview a proposal with `dry_run`, then create the company, contact and deal through the same `/api/companies` intake route. They can also force-refresh one company with `2ГИС/ФНС` or refresh the currently filtered view with `Заполнить видимые`. Bulk refresh is intentionally capped at 10 companies per run on a demo key and uses the enrichment cache by default to control API quotas. Agent calls to `POST /api/companies/{company_id}/enrichment` can pass `force_refresh: true` for a fresh lookup or `cache_ttl_hours` for a custom freshness window; cache hits do not create duplicate source history rows. Agent calls to `POST /api/companies/enrichment/bulk` can batch CRM companies with `company_ids`, `only_missing`, `segment`, `limit`, `force_refresh`, `cache_ttl_hours`, and `dry_run`; the response returns `source_statuses`, `cache_hit`, `saved`, `headcount_evidence`, office range, and proposal guidance per company. The lead table surfaces enriched phone, email, website, INN, address, office range, recommended launch portions/SKU, launch budget and all employee-count evidence rows visible to the manager.

## External Systems And MCP

```http
GET  /api/integrations/status
GET  /api/integrations/preflight
GET  /api/integrations/launch-guide
GET  /api/integrations/share-qr
GET  /api/integrations/telegram/setup-preview
POST /api/integrations/orders/export
POST /api/integrations/apify/research
POST /api/integrations/2gis/search
POST /api/companies/enrichment/bulk
POST /api/orders/{order_id}/status
GET  /api/mcp/manifest
```

`GET /api/integrations/preflight` is a protected operator and MCP-agent check for launch readiness. It verifies the public CRM URL, public `/miniapp`, public `/api/miniapp/catalog`, public `/api/telegram/webhook` access through Telegram secret header without CRM key, Telegram webhook secret, Telegram `getMe/getWebhookInfo`, 2GIS Places API, DaData/FNS, manager notifications, and external export readiness without returning secret values to the browser. 2GIS/DaData checks use `DGIS_API_BASE_URL` and `DADATA_API_BASE_URL` when QA/proxy/mock routing is configured; otherwise they use the official endpoints. The MCP manifest exposes it as `run_integration_preflight`.

`GET /api/integrations/launch-guide` returns a safe operator handoff package for the Telegram launch: public Mini App/webhook links, setup command, required env key names, readiness flags, and launch steps without exposing token values. The `operator_handoff` block includes the BotFather open URL, BotFather commands, the suggested bot name and username, future bot URL hint, Telegram-native `startapp` links, `miniapp_setup` with BotFather `/newapp`, `TELEGRAM_MINIAPP_SHORT_NAME`, named/fallback `startapp` URLs, token storage instruction, an env template with where-to-get notes, a `connection_checklist` with official URLs for Telegram/2GIS/DaData/Apify, audience-specific share links, ready-to-send `share_assets` for clients and operators with Telegram share URL, QR payload and `qr_image_url`, Telegram entrypoints for `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami`, and success criteria for launch validation.

`GET /api/integrations/share-qr?url=...` returns an SVG QR code for a safe http/https share asset URL. It does not read SQLite, does not accept tokens, and does not encode the CRM access key.

The CRM `Telegram API` tab renders the connection checklist as `Панель подключений`: Telegram BotFather token, public Mini App/webhook, 2GIS Places API, DaData/FNS, Apify research, and external order export. It also renders `Готовые ссылки для отправки`, where each share asset includes the target URL, Telegram `startapp` URL, client-facing message, Telegram share URL, QR payload, SVG QR image and safe note without returning secret values. The `Mini App в BotFather` block renders `/newapp`, the short name env key, named/fallback `startapp` links, and the Mini App URL that the operator should register in BotFather.

`GET /api/integrations/telegram/setup-preview` returns the protected no-mutation Telegram setup preview for CRM and MCP agents. It exposes planned `setWebhook`, `setChatMenuButton`, and `setMyCommands` payloads plus `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami` entrypoints while redacting `secret_token` and never returning `TELEGRAM_BOT_TOKEN`.

The CRM `Telegram API` tab renders this as the operator-facing `Server-side preview настройки Telegram` block, including missing keys, planned Telegram API methods, Mini App/webhook URLs, and customer entrypoints without exposing token values.

External order export is configured with:

```bash
set EXTERNAL_ORDER_WEBHOOK_URL=https://external-system.example/orders
set EXTERNAL_ORDER_WEBHOOK_TOKEN=external-secret
set EXTERNAL_ORDER_WEBHOOK_PROVIDER=moisklad-or-1c
```

When `EXTERNAL_ORDER_WEBHOOK_URL` is configured, Mini App order creation attempts an outbound export after the CRM order is created. The exported payload includes order data, customer data, order items, and enrichment fields. Every attempt is recorded in `integration_events` with provider, endpoint, response status, and error text when applicable.

`POST /api/integrations/apify/research` prepares or starts an Apify Actor run for public company research. It defaults to `dry_run` so agents can inspect the payload without starting a paid or external run. Real execution requires `APIFY_TOKEN`, `actor_id` or `APIFY_DEFAULT_RESEARCH_ACTOR_ID`, `dry_run: false`, and `confirm_run: true`. Started runs are recorded as `apify_actor_research` in `integration_events`; successful starts queue `apify_actor_result_review` for the `apify_actor_researcher` agent before any CRM mutation.

`POST /api/integrations/2gis/search` is the protected 2GIS lead sourcing endpoint for Saint Petersburg and Leningrad Oblast. Agents can search by segment, district, city and query, then receive `candidates` with public B2B contact fields, address, INN, 2GIS employee signal when present, and `suggested_payload`. The endpoint defaults to `dry_run`, caps demo-key searches at 10 candidates per run and does not mutate SQLite. Import is allowed only with `dry_run: false` and `confirm_import: true`; confirmed candidates are passed through `/api/companies` lead intake so the same enrichment, office-size estimate, headcount evidence and proposal guidance are stored and reviewed consistently.

`/api/orders/{order_id}/status` lets the CRM update order lifecycle states such as `confirmed`, `in_delivery`, `completed`, `blocked_minimum`, and `cancelled`. When Telegram is configured, the customer receives a status message through the bot with a Mini App button back to order history.

`/api/mcp/manifest` exposes a machine-readable contract for future AI/MCP agents. It lists CRM resources and tools for reading the catalog, reading the launch guide, previewing Telegram setup, enriching a company for a proposal, searching 2GIS lead candidates, creating a Mini App order, running Apify company research, and exporting an order to an external webhook. It is protected by the normal CRM access key.

## Agent Manifest

```http
GET /api/agent/manifest
POST /api/agent/tasks
GET /api/agent/tasks
PATCH /api/agent/tasks
```

The manifest is the machine-readable contract for future AI agents. It lists available agents, API tools, guardrails, and the current region scope.

Agent data rule: use one source of truth. If an entity already exists in CRM, an agent must reuse it and must not create a duplicate table, card, catalog, SKU entity, deal, contact, or company. Каталог Lunch Up является единой точкой истины. The Lunch Up catalog is the single source of truth for SKU names, prices, photos, descriptions, additions and removals; CRM screens, Mini App, commercial offers, Samokat economics and bot catalog must read catalog data from that source so one catalog change updates every dependent surface.

For cloned projects, replace that catalog source with the target company's own catalog. An AI agent must build `products`, `segment_matrices`, `matrix_items`, client catalog, Mini App catalog, sales scripts and proposal math only from the new company's website, public catalog, approved price list, PDF, spreadsheet or operator-provided file. It must not carry over Lunch Up, Caloristika or another previous demo's SKU, photos, prices, descriptions or launch-matrix quantities unless the operator explicitly approves that source and records provenance. Missing price, shelf life, weight or photo data must be marked as needing confirmation rather than written as a confident sales claim.

Render deployment rule for agents: each cloned project needs a distinct private GitHub repository, Render service, database filename, strategy token and public URL. Default deployment uses `render.yaml`, `npm run build:render`, `npm run start:render`, `LUNCH_UP_CRM_DB_PATH=<client demo sqlite>`, `LUNCH_UP_SQLITE_WAL=0`, then public checks for `/api/health`, `/api/dashboard`, `/catalog` and `/miniapp`.

## Agent Worker Runtime

The CRM now has an executable worker layer for queued AI tasks:

```bash
npm run agent:migrate
npm run agent:worker -- --once --limit=3 --no-llm
npm run agent:worker-smoke
npm run agent:provider-smoke
```

Production provider mode is enabled only with server-side env:

```bash
set AGENT_LLM_PROVIDER=paperclip
set PAPERCLIP_AGENT_ENDPOINT=http://127.0.0.1:3100/api/agents/lunch-up
npm run agent:worker
```

Supported providers are `offline`, `paperclip`, `hermes`, `openclaw`, `omniroute` and optional legacy `openai`. Paperclip, Hermes, OpenClaw and OmniRoute can be connected through HTTP endpoint env or through a local command that reads the CRM task JSON from stdin and writes the result JSON to stdout. OmniRoute also supports OpenAI-compatible chat completions through `OMNIROUTER_BASE_URL` and `OMNIROUTER_MODEL`.

### Render CRM + VPS OmniRouter

When CRM is hosted on Render and OmniRouter is installed on a VPS, do not put `OMNIROUTER_BASE_URL=http://127.0.0.1:18790/v1` into Render. On Render, `127.0.0.1` means the Render container, not the VPS.

Use this shape instead:

```text
Render CRM: https://caloristika-crm-demo.onrender.com
VPS worker: npm run agent:remote-worker
VPS OmniRouter: http://127.0.0.1:18790/v1
```

On the VPS, set:

```bash
REMOTE_CRM_BASE_URL=https://caloristika-crm-demo.onrender.com
REMOTE_CRM_ACCESS_KEY=<same value as Render CRM_ACCESS_KEY>
AGENT_LLM_PROVIDER=omniroute
OMNIROUTER_BASE_URL=http://127.0.0.1:18790/v1
OMNIROUTER_MODEL=<omnirouter model name>
npm run agent:remote-worker -- --once --limit=1
```

The remote worker authenticates with `x-crm-access-key`, claims one protected CRM task, calls local OmniRouter on the VPS, and writes the result back to Render CRM. The `ssh -L 18790:127.0.0.1:18790 -L 18792:127.0.0.1:18792 root@100.102.225.118` tunnel is useful only for the operator laptop; it does not make VPS localhost available to Render.

Safe smoke test:

```bash
npm run agent:remote-worker-smoke
```

The worker reads `ai_tasks`, claims one task at a time with `locked_at`, `locked_by`, and `attempts`, builds a bounded CRM context, and writes structured output to `result_json`. Every execution is recorded in `ai_task_runs`. Reusable bounded observations are stored in `ai_agent_memories`.

The worker supports these core roles:

- `customer_order_concierge` - customer-side order guidance and next-step recommendations.
- `inventory_replenishment_agent` - stock watchlist and replenishment recommendations.
- `sales_demand_analyst` - sales pattern and repeat-order analysis.

Human-in-the-loop is mandatory: the worker may write analysis, memory and run trace, but it must not directly mutate orders, contacts, SKU, inventory targets, external exports or Telegram customer messages without manager approval. Operational details are in `docs/AI_AGENT_RUNBOOK.md`.

## Project Sheet Enrichment

CRM uses the Google Sheet `Шаблон проекта` as a business-analysis source:

```text
https://docs.google.com/spreadsheets/d/1YGxYn6OP8lB7H33-1sNCqS8sUmdE0-ing90x9P0w71w/edit
```

`lib/project-sheet-enrichment.ts` turns that sheet into CRM-ready guidance: JTBD target segments, pain/solution rows, content-plan scripts, objection-map rows, and SKU launch recommendations. The dashboard catalog shows the launch recommendation next to each matched SKU. `npm run project-sheet:import` adds idempotent AI tasks for lead research, SKU matrix analysis, outreach writing, and pilot follow-up scheduling.

## Apify Store

```text
https://console.apify.com/store
```

Apify Store is recorded as an external tool source for CRM AI agents. The operator has connected Apify Console through GitHub OAuth, so the agent layer can select Apify Actors for public B2B lead research, site checks, catalog monitoring, and enrichment for Saint Petersburg and Leningrad Oblast leads.

The CRM seed includes `apify_actor_researcher` as the queue role for Apify results. This agent should prepare actor choices, source links, limits, and draft enrichment tasks. It must not write contacts, deals, or orders directly without manager confirmation.

For automatic actor runs, add `APIFY_TOKEN` only as a server-side secret and add `APIFY_DEFAULT_RESEARCH_ACTOR_ID` or pass `actor_id` in the protected request. Do not store the token in SQLite, the client UI, public links, logs, or task prompts.

## Guardrails

- Sales scope is only Saint Petersburg and Leningrad Oblast.
- Use public B2B contact channels, not personal employee data.
- Orders below 7000 RUB must remain `blocked_minimum`.
- Before bulk outreach, confirm contact freshness and lawful communication basis.
