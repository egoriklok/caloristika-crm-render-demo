# Frontier Agent Readiness: Questions And Answers

This document answers the question: if we wanted this repo to be ready for stronger frontier LLMs, AGI-like coding agents and multi-agent swarms, what should we have asked GitHub/Codex to prepare?

## 1. What should the owner ask for?

Ask for a repo that a new AI agent can operate from without hidden tribal knowledge:

> Prepare this CRM repository for future frontier LLM agents and agent swarms. Add machine-readable manifests, orchestration contracts, data boundaries, eval scenarios, guardrails, setup/test commands, backup/restore proof points and secret-safety checks. Make the repo self-describing enough that another AI agent can rebuild it on a VPS and safely extend it.

## 2. What is the highest-leverage missing layer?

Machine-readable context. README and PRD are useful for people, but future agents need a compact contract they can parse before acting. This repo now uses `agent-swarm.manifest.json` as the first file an agent should read.

## 3. What data must be canonical?

For Lunch Up, the canonical source is `data/lunch_up_crm.sqlite`. Agents must treat it as the source of truth for companies, contacts, deals, products, orders, AI tasks and enrichment records. Product catalog, CRM views, client catalog and Mini App must read from the same product source.

## 4. What should a paperclip-like orchestrator optimize?

Only bounded business objectives: data completeness, catalog consistency, verified deployability, lead enrichment quality and operator workflow speed. It must not optimize unbounded outreach, scraping, paid actor runs or database mutations without human approval.

## 5. What subagents are useful?

- `repo_cartographer`: maps code, data, commands and current risks.
- `data_steward`: protects SQLite, backups, provenance and enrichment rules.
- `product_catalog_agent`: keeps CRM catalog, client catalog and Mini App catalog aligned.
- `integration_operator`: prepares Telegram, 2GIS, DaData, Apify and API handoffs with dry-run first.
- `qa_skeptic`: verifies claims, runs eval gates and checks secret leakage.

## 6. What must stop an autonomous agent?

The agent must stop for production deploys, paid API/actor execution, external outreach, secret changes, destructive database changes, public URL/access policy changes and any missing provenance for public claims.

## 7. How do we know the repo is ready?

The repo is ready when the following pass from a clean checkout:

```bash
npm ci
npm run agent:readiness
npm run verify
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
```

`npm run agent:readiness` verifies the agent manifest, contracts, eval scenarios, guardrail docs and obvious secret-leak patterns.

## 8. What was implemented from this answer?

- `agent-swarm.manifest.json`
- `contracts/agent-orchestrator.contract.json`
- `contracts/sqlite-data-boundaries.contract.json`
- `evals/swarm-readiness.scenarios.json`
- `docs/PAPERCLIP_ORCHESTRATOR_CONTRACT.md`
- `docs/AGENT_EVAL_GATES.md`
- `scripts/agent-readiness-check.mjs`
- CI gate for agent readiness
