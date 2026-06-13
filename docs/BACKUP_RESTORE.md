# Backup and Restore

## Backup Scope

This repository intentionally includes a private snapshot of the current CRM system for AI-agent handoff:

- Source code.
- Public assets.
- SQLite database: `data/lunch_up_crm.sqlite`.
- Catalog JSON sources.
- Current generated PDF catalog files in the repository root.
- Deployment and agent handoff documentation.

Never commit:

- `.env.local`
- access tokens
- Telegram bot token
- Apify token
- 2GIS/DaData keys
- server/tunnel logs
- `node_modules`
- `.next`

## SQLite Backup

For a live VPS, use SQLite backup mode or stop the app before copying the DB.

Simple stopped-service backup:

```bash
sudo systemctl stop lunch-up-crm
cp /opt/lunch-up-crm/data/lunch_up_crm.sqlite /var/backups/lunch-up-crm/lunch_up_crm_$(date +%Y%m%d_%H%M%S).sqlite
sudo systemctl start lunch-up-crm
```

If WAL mode is enabled and the service is running, checkpoint before copying:

```bash
sqlite3 /opt/lunch-up-crm/data/lunch_up_crm.sqlite "PRAGMA wal_checkpoint(TRUNCATE); VACUUM INTO '/var/backups/lunch-up-crm/lunch_up_crm_$(date +%Y%m%d_%H%M%S).sqlite';"
```

## Assets Backup

```bash
tar -czf /var/backups/lunch-up-crm/public_assets_$(date +%Y%m%d_%H%M%S).tar.gz -C /opt/lunch-up-crm public
tar -czf /var/backups/lunch-up-crm/data_json_$(date +%Y%m%d_%H%M%S).tar.gz -C /opt/lunch-up-crm data --exclude='*.sqlite-shm' --exclude='*.sqlite-wal'
```

## Restore

1. Stop the app.
2. Save the current DB aside.
3. Copy the selected backup to `data/lunch_up_crm.sqlite`.
4. Restore public assets if needed.
5. Fix ownership.
6. Start the app.
7. Run health check.
8. Open CRM and catalog with access key.

```bash
sudo systemctl stop lunch-up-crm
cp /opt/lunch-up-crm/data/lunch_up_crm.sqlite /opt/lunch-up-crm/data/lunch_up_crm.before_restore_$(date +%Y%m%d_%H%M%S).sqlite
cp /var/backups/lunch-up-crm/<backup>.sqlite /opt/lunch-up-crm/data/lunch_up_crm.sqlite
sudo chown lunchup:lunchup /opt/lunch-up-crm/data/lunch_up_crm.sqlite
sudo systemctl start lunch-up-crm
curl -fsS http://127.0.0.1:3011/api/health
```

## Restore Acceptance

- `/api/health` returns 200.
- CRM opens with `?key=<CRM_ACCESS_KEY>`.
- `/catalog?key=<CRM_ACCESS_KEY>` opens.
- `/catalog?view=all&print=1&key=<CRM_ACCESS_KEY>` opens.
- Companies, contacts, products and orders are visible.
- Product images render.
- No secrets appear in Git history.

