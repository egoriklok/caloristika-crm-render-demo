# Company Telegram And Agent Channels

This CRM treats Telegram as a company-level B2B channel, not as a personal outreach shortcut.

## Source Of Truth

Telegram company-channel fields live on `companies`:

- `telegram_url`
- `telegram_username`
- `telegram_channel_type`
- `telegram_contact_status`
- `telegram_source_url`
- `telegram_source_note`
- `telegram_discovered_at`
- `agent_contact_policy`
- `agent_contact_readiness`
- `agent_contact_next_step`

Contact-level `contacts.telegram_handle` can still store a known person or public channel handle, but company-level decisions must read the `companies` fields first.

## Statuses

- `not_found`: no public Telegram channel found in CRM, 2GIS or saved open sources.
- `needs_verification`: an open source mentions Telegram, but exact URL or username is not saved yet.
- `public_found`: a public Telegram URL or username was found in an official/open source.
- `approved_to_contact`: manager has approved first contact for this public B2B channel.
- `opted_out`: do not contact through Telegram.

## AI-Agent Policy

Default policy is `manual_review_required`.

An AI-agent may:

- search 2GIS, official websites and saved public sources for public company Telegram, company bot, website chat or agent-ready endpoint;
- save evidence and source notes through `/api/companies`;
- create a draft first message and next step;
- queue `telegram_channel_research` tasks.

An AI-agent must not:

- use a personal userbot to write first messages at scale;
- treat a private employee account as a company channel;
- bypass platform limits, opt-out, 429/403 blocks or closed-source authorization;
- mark a channel `approved_to_contact` without manager approval.

## 2GIS Rule

2GIS lead search may save Telegram only when it appears in official API response fields such as `contact_groups` or `links`. If 2GIS does not return Telegram, the CRM stores `not_found` or `needs_verification`; it must not invent handles.

For demo 2GIS keys, follow `docs/2GIS_DEMO_KEY_LIMITS.md`: dry-run first, no parallel calls, at most 10 candidates or companies per agent run, stop on quota/block errors.

## Product Direction

The monetizable product idea is an AI-agent contact layer for B2B CRM:

- seller agent researches companies, channels and offer fit;
- company-side channel is tagged as human operator, company bot, public channel or agent-ready endpoint;
- first contact stays reviewable and evidence-backed;
- future extension can add WhatsApp Business, website chat, contact forms, MCP endpoints and API procurement channels with the same `agent_contact_policy` model.
