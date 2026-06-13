---
name: using-gstack-for-crm
description: >-
  Applies the installed garrytan/gstack workflow set to Lunch-UP CRM work.
  Use when the user asks to use gstack, adapt Claude/OpenClaw skills for Codex,
  review CRM architecture, validate miniapp flows, or run product/design/QA
  checks for this project.
mode: planning
---

# Using gstack for CRM

## When to Use

Trigger this skill when the user asks for:

- gstack setup or usage inside Lunch-UP CRM
- Codex adaptation of Claude/OpenClaw skills
- product, engineering, design, QA, or documentation review of CRM changes
- local miniapp/browser verification backed by a structured review flow

Do not use this skill for live deployment, Telegram mutation, webhook mutation,
or external account setup unless the user explicitly requests that operation.

## Installation Facts

- gstack repo: `/home/egori/.gstack/repos/gstack`
- gstack Codex skills: `/home/egori/.codex/skills/gstack-*`
- gstack browser binary: `/home/egori/.gstack/repos/gstack/browse/dist/browse`
- CRM root: `/mnt/c/Users/egori/OneDrive/Onenote/OneNote/Voice bot about CJM/lunch-up-crm`

The upstream `gstack-team-init` is intentionally not used here because this CRM
folder is not currently a Git checkout and that initializer writes Claude team
mode files.

## Workflow

### Phase 1: Scope

- Confirm whether the request is product, architecture, UI/miniapp, QA, docs, or
  installation work.
- Prefer native CRM scripts for project truth: `npm run verify`, smoke scripts,
  and `npm run build`.
- Prefer the Codex Browser plugin for local localhost inspection. Use
  `gstack-browse` or `gstack-qa` only when independent browser tooling is useful.

### Phase 2: Route

- Product or scope review: `gstack-plan-ceo-review`
- Architecture or multi-module change: `gstack-plan-eng-review`
- UI and miniapp review: `gstack-plan-design-review`
- Implementation spec: `gstack-spec`
- Bug investigation: `gstack-investigate`
- Code review: `gstack-review`
- Documentation: `gstack-document-generate` or `gstack-document-release`
- Risk pause: `gstack-careful` or `gstack-guard`

Avoid release/deploy skills unless the user explicitly asks for deployment:
`gstack-ship`, `gstack-land-and-deploy`, `gstack-canary`,
`gstack-setup-deploy`.

### Phase 3: Validate

Run from the CRM root:

```bash
npm run gstack:check
npm run verify
npm run build
```

For UI changes, start the local app on port `3011` and inspect the changed route
with the Codex Browser plugin.

## Error Handling

| Error | Cause | Resolution |
|---|---|---|
| `gstack:check` fails | gstack is missing or not generated in WSL | Re-run `/home/egori/.gstack/repos/gstack/setup --host codex --no-team --no-prefix` from WSL with Bun on PATH |
| Codex cannot see this skill yet | Skills are loaded at session start | Restart/open a fresh Codex session for discovery |
| `gstack-team-init` fails | CRM folder has no `.git` | Do not use team mode until the real Git checkout is restored |
| Browser QA fails on local route | App server is not running | Run `npm run web` or `npm run dev`, then retry the Browser plugin |
