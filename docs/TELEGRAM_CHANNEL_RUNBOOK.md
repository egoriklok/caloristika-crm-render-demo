# Telegram Client Channel Runbook

Last verified: 2026-06-17.

This document describes the live Telegram communication channel for the CRM and the rules future AI agents must follow when operating or cloning it.

## Live State

- CRM on Render: `https://caloristika-crm-demo.onrender.com/crm?tab=dialogs`
- Public Mini App catalog: `https://caloristika-crm-demo.onrender.com/miniapp`
- Telegram bot: `https://t.me/b2b_food_crm_demo_bot`
- Webhook endpoint: `https://caloristika-crm-demo.onrender.com/api/telegram/webhook`
- Manager dialog queue: CRM tab `Диалоги`, backed by `GET/PATCH /api/telegram/copilot`.

The bot is already created through official BotFather and connected through the official Telegram Bot API. The implementation does not use a personal Telegram userbot, Telethon user session, Telegram Web session scraping, hidden human imitation, or mass first-contact automation.

## What The Channel Can Do Now

- Send clients to the Mini App catalog from Telegram.
- Open focused Mini App screens:
  - `/order` opens catalog and cart.
  - `/cart` opens checkout.
  - `/cabinet` opens the client cabinet.
  - `/orders` opens order history and repeat-order flow.
  - `/help` returns bot commands, minimum order and geography.
  - `/whoami` returns the chat id for manager notification setup.
- Validate Telegram Web App `initData` server-side with `TELEGRAM_BOT_TOKEN`.
- Link Telegram users to `bot_customers`.
- Store incoming updates in `telegram_events`.
- Create `telegram_copilot_messages` for incoming text/callbacks.
- Create manager-reviewable drafts in `telegram_copilot_drafts` for non-service client messages.
- Queue `telegram_reply_copilot` / related `ai_tasks` for manager review.
- Send approved replies through `sendMessage` via the official Bot API.
- Send order/status notifications when `TELEGRAM_MANAGER_CHAT_ID` is configured.

Service commands and clear Mini App intents are treated as bot-handled events. They do not create active manager drafts unless the client sends a message that requires a human answer.

## Architecture

```text
Telegram client
  -> official Telegram Bot API
  -> POST /api/telegram/webhook
  -> telegram_events + bot_customers
  -> service intent router OR Telegram Copilot
  -> Mini App links / ai_tasks / manager drafts
  -> manager approval in CRM
  -> official Bot API sendMessage
```

Relevant files:

- `app/api/telegram/webhook/route.ts`
- `app/api/telegram/copilot/route.ts`
- `lib/telegram-bot.ts`
- `lib/telegram-copilot.ts`
- `lib/telegram-intents.ts`
- `components/telegram-miniapp-order.tsx`
- `scripts/setup-telegram-bot.mjs`
- `scripts/set-telegram-bot-token.ps1`
- `scripts/render-update-env.mjs`

## Current Configuration

Configured on Render:

- `PUBLIC_BASE_URL`
- `CRM_ACCESS_KEY`
- `DGIS_API_KEY`
- `APIFY_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_DISPLAY_NAME`
- `TELEGRAM_BOT_DESCRIPTION`
- `TELEGRAM_BOT_SHORT_DESCRIPTION`
- `TELEGRAM_MENU_BUTTON_TEXT`
- `TELEGRAM_MANAGER_CHAT_ID`

Not configured yet:

- `DADATA_API_KEY`
- `TELEGRAM_MINIAPP_SHORT_NAME`
- `EXTERNAL_ORDER_WEBHOOK_URL`
- `APIFY_DEFAULT_RESEARCH_ACTOR_ID`

`DADATA_API_KEY` is not required for Telegram messaging. It is required for INN/FNS enrichment and stronger employee-count evidence.

## Operator Workflow

Client entry:

1. Send the bot link: `https://t.me/b2b_food_crm_demo_bot`.
2. Client presses Start or uses `/order`.
3. Client opens the Mini App catalog, cabinet or cart.
4. Client fills company/order data.
5. CRM stores the session/order in the same SQLite-backed pipeline.

Manager workflow:

1. Open `https://caloristika-crm-demo.onrender.com/crm?tab=dialogs`.
2. Review incoming Telegram messages and generated drafts.
3. Edit the draft if needed.
4. Send only after human approval.
5. Use order/status controls in CRM for follow-up.

AI-agent rule: agents may research, classify, draft and recommend. They must not send unapproved customer messages or mutate contacts/orders/SKU without manager approval.

## Setup For A New Bot Or New Client

1. Create a bot in `@BotFather` with `/newbot`.
2. Do not paste the BotFather token into chat, docs, Git or CRM notes.
3. On the operator machine, run:

```bash
npm run telegram:set-token
```

The script prompts for the token without printing it, writes `.env.local`, updates Render env, queues deploy and runs `npm run telegram:setup`.

Manual setup is still possible:

```bash
npm run telegram:env-bootstrap -- --write
npm run render:env:update -- --public-url https://<render-service>.onrender.com --deploy
npm run telegram:setup
```

Use manual setup only when the token already exists in `.env.local` or process env.

For a cloned client project:

- Use a new BotFather bot and a new token.
- Use a new private GitHub repo and Render service.
- Use the new client's own catalog source.
- Replace display name, descriptions, menu text, strategy token and SQLite database.
- Do not reuse Lunch Up, Caloristika or previous demo SKU data unless the operator explicitly approves the source and records provenance.

## Verification

Core commands:

```bash
npm run render:smoke -- https://caloristika-crm-demo.onrender.com
npm run telegram:check -- --json
npm run telegram:webhook-access-smoke
npm run build
```

Expected current Telegram state:

- `telegram.bot_ok = true`
- `telegram.username = @b2b_food_crm_demo_bot`
- `telegram.webhook_ok = true`
- `telegram.webhook_url = https://caloristika-crm-demo.onrender.com/api/telegram/webhook`
- `TELEGRAM_MANAGER_CHAT_ID configured = true`
- `DADATA_API_KEY configured = false`

Because `DADATA_API_KEY` is still missing, `telegram:check` can report `ok=false` / `config_ready=false` while the Telegram bot and webhook are working. Treat that as "Telegram ready, enrichment incomplete", not as a bot failure.

Real smoke that was verified on 2026-06-17:

- `/start` returned a Mini App entry button.
- Mini App opened inside Telegram and showed the Caloristika catalog.
- `/help` returned Caloristika B2B bot commands, minimum order and Saint Petersburg geography.
- A natural message through the webhook created a manager-reviewable draft in `telegram_copilot_drafts`.
- Test drafts were rejected after smoke so the live queue was left clean.

## Security And Guardrails

- `.env.local` is ignored and must never be committed.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRM_ACCESS_KEY`, API keys and Render API key must never be printed.
- `TELEGRAM_MANAGER_CHAT_ID` is treated as sensitive operational metadata and redacted by `scripts/render-update-env.mjs`.
- Telegram webhook must accept unauthenticated public traffic only when `X-Telegram-Bot-Api-Secret-Token` matches `TELEGRAM_WEBHOOK_SECRET`.
- CRM operator APIs still require `CRM_ACCESS_KEY`.
- No personal-account userbot automation is part of the approved product surface.
- No mass first-contact outreach is allowed from AI agents.

## Troubleshooting

`telegram:check` says `Unauthorized`:

- Token is wrong or revoked in BotFather.
- Re-run `npm run telegram:set-token`.

Webhook is missing:

- Run `npm run telegram:setup`.
- Then run `npm run telegram:check -- --json`.

Mini App opens but catalog is empty:

- Check `GET /api/miniapp/catalog`.
- Verify active SQLite database and product count.
- Run `npm run render:smoke -- https://caloristika-crm-demo.onrender.com`.

Client messages do not create drafts:

- Service commands and intent messages are handled by the bot.
- Send a non-service text such as a КП/request question.
- Check `GET /api/telegram/copilot?key=<CRM_ACCESS_KEY>&status=all`.

Manager notifications do not arrive:

- Send `/whoami` to the bot.
- Put that chat id into `TELEGRAM_MANAGER_CHAT_ID`.
- Run `npm run render:env:update -- --public-url https://caloristika-crm-demo.onrender.com --deploy`.

DaData warning remains:

- Add `DADATA_API_KEY` only when INN/FNS enrichment is needed.
- Telegram ordering and CRM dialogs do not require DaData.
