# Lunch Up CRM: deployment and scaling

This app is a Next.js CRM with SQLite as the current operational data source for customers, orders, catalog, inventory, and AI-agent tasks.

## Server shape

- Run the app on Linux with Node.js 24.
- Keep SQLite on a persistent local disk or attached volume, not inside the application image.
- Set `LUNCH_UP_CRM_DB_PATH` to the mounted database path.
- Keep `CRM_ACCESS_KEY`, Telegram, 2GIS, DaData, Apify, and external webhook values in server environment variables.
- Put Nginx, Caddy, Cloudflare Tunnel, or another reverse proxy in front of port `3011`.

Recommended server environment:

```bash
NODE_ENV=production
PORT=3011
HOST=0.0.0.0
CRM_NEXT_MODE=start
LUNCH_UP_CRM_DB_PATH=/app/data/lunch_up_crm.sqlite
LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS=5000
LUNCH_UP_SQLITE_MMAP_SIZE=268435456
LUNCH_UP_SQLITE_WAL=1
```

## Production start

Do not use a Windows OneDrive directory as the production build workspace. Stage the project into a Linux filesystem first:

```bash
npm run build:server-stage
cd ~/.cache/lunch-up-crm-build
npm ci
npm run verify
npm run build
```

To run install and build from the staging command:

```bash
npm run build:server-stage -- --install --build
```

```bash
npm ci
npm run verify
npm run db:migrate-customer-portal
npm run admin:catalog-export
npm run build
CRM_NEXT_MODE=start npm run web
```

`next build` is configured for fast server packaging and does not repeat TypeScript validation. Keep `npm run verify` and `tsc --noEmit` in CI before build.
With `output: "standalone"`, `npm run web` starts `.next/standalone/server.js` and links `public/` plus `.next/static` into the standalone runtime.

The app exposes `/api/health`. The response includes the active SQLite path, whether the runtime had to fall back to a snapshot, and SQLite performance settings. On a real server, `db.snapshotMode` should be `false`.

## Container start

The Docker image uses Next standalone output and expects `/app/data/lunch_up_crm.sqlite` from a volume.

```bash
docker compose build
CRM_ACCESS_KEY=change-me docker compose up -d
```

The compose file mounts `./data:/app/data`. Move `data/lunch_up_crm.sqlite` plus its `-wal` and `-shm` files together when migrating an active local database. Stop local writers before copying, or run a SQLite checkpoint first.

For a clean local copy before migration:

```bash
npm run db:sqlite-maintenance
npm run db:sqlite-maintenance -- --replace
```

The replace mode creates `backup-before-sqlite-maintenance-*` files before writing the compacted SQLite database.

## Performance checks

Use the baseline command against the local or deployed server:

```bash
PERF_BASE_URL=http://127.0.0.1:3011 npm run perf:baseline
PERF_BASE_URL=http://127.0.0.1:3011 npm run perf:load-smoke
```

The check measures `/`, `/api/health`, `/api/dashboard`, `/admin-catalog.html`, and `/admin-catalog-data.json`. The root HTML budget is intentionally low because the CRM now loads dashboard data after the shell instead of embedding the full database snapshot in the first page.
The load smoke repeats the same critical routes with bounded concurrency and fails on non-2xx responses or route-level P95 budget breaches.

Verified local staging baseline on Linux FS, using `CRM_NEXT_MODE=start` and SQLite on `/home/egori/.cache/lunch-up-crm-build/data/lunch_up_crm.sqlite`:

| Route | Status | Time | Size |
| --- | ---: | ---: | ---: |
| `/` | 200 | 682 ms | 7.3 KB |
| `/api/health` | 200 | 32 ms | 429 B |
| `/api/dashboard` | 200 | 389 ms | 1.4 MB |
| `/admin-catalog.html` | 200 | 35 ms | 6.3 KB |
| `/admin-catalog-data.json` | 200 | 31 ms | 44 KB |

The same staging run completed `npm ci` in 47 seconds and `npm run build` in 33.5 seconds on the Linux filesystem. Building directly from the Windows OneDrive workspace is not a deployment-grade path.

## Scaling limits

SQLite is acceptable for the current single-server CRM, order intake, and AI-task queue. Do not run multiple write-capable app replicas against a network-mounted SQLite file. For horizontal scaling, move operational tables to PostgreSQL first:

- `companies`, `contacts`, `deals`, `orders`, `order_items`
- `inventory_positions`, `inventory_movements`
- `ai_tasks`, `integration_events`, `telegram_events`

Until PostgreSQL migration, scale safely by:

- one write-capable CRM instance;
- reverse proxy caching only for static assets and public catalog pages;
- nightly SQLite backup plus WAL checkpoint;
- separate read-only exports such as `public/admin-catalog-data.json` for shareable administrator views.
