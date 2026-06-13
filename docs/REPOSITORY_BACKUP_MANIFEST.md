# Repository Backup Manifest

## Repository Type

Private GitHub backup and deployment repository for the current Lunch Up CRM system.

## Included

- `app/` - Next.js routes, API endpoints, CRM/catalog/Mini App pages.
- `components/` - UI components and CRM dashboard.
- `lib/` - domain logic, catalog builders, integrations, Telegram helpers, AI-agent models.
- `scripts/` - migrations, imports, smoke checks, verification and agent worker scripts.
- `public/` - static admin catalog and equipment/product assets.
- `data/` - current SQLite CRM data and supporting JSON source files.
- `docs/` - architecture, deployment, AI-agent, backup and operations docs.
- `Dockerfile` and `docker-compose.yml` - container deployment.
- `ops/` - systemd and Nginx examples.
- `.github/workflows/ci.yml` - minimum validation workflow.
- `catalog-*.pdf` - current generated catalog/proposal PDF artifacts.

## Excluded

- `.env.local`
- `.env`
- `node_modules/`
- `.next/`
- runtime logs
- Cloudflare tunnel logs
- server logs
- TypeScript build cache

## Restore Entry Point

1. Clone repo.
2. Copy `.env.example` to a real environment file.
3. Set `CRM_ACCESS_KEY` and `CUSTOMER_PORTAL_SHARED_ACCESS_CODE`.
4. Run `npm ci`.
5. Run `npm run verify`.
6. Run `npm run build`.
7. Start with `CRM_NEXT_MODE=standalone PORT=3011 HOST=0.0.0.0 npm run web`.
8. Open `/api/health`, `/`, and `/catalog`.

## Current Data Snapshot

Primary SQLite file:

- `data/lunch_up_crm.sqlite`

If WAL files exist in a local working copy, checkpoint before deployment. The repository should restore from the main SQLite file.

