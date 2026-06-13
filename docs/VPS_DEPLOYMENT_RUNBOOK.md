# VPS Deployment Runbook

## Target State

- Ubuntu VPS.
- Repository cloned to `/opt/lunch-up-crm`.
- App user: `lunchup`.
- Environment file: `/etc/lunch-up-crm/lunch-up-crm.env`.
- SQLite DB: `/opt/lunch-up-crm/data/lunch_up_crm.sqlite` for simple restore, or `/var/lib/lunch-up-crm/lunch_up_crm.sqlite` for production hardening.
- App port: `3011`.
- Reverse proxy: Nginx or Cloudflare Tunnel.

## 1. Install Base Packages

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates nginx sqlite3
```

Install Node.js 24 using your preferred official method. Verify:

```bash
node --version
npm --version
```

## 2. Create App User

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin lunchup
sudo mkdir -p /opt/lunch-up-crm /etc/lunch-up-crm /var/backups/lunch-up-crm
sudo chown -R lunchup:lunchup /opt/lunch-up-crm /var/backups/lunch-up-crm
```

## 3. Clone Repository

```bash
sudo -u lunchup git clone <GITHUB_REPO_URL> /opt/lunch-up-crm
cd /opt/lunch-up-crm
```

## 4. Configure Environment

```bash
sudo cp /opt/lunch-up-crm/.env.example /etc/lunch-up-crm/lunch-up-crm.env
sudo nano /etc/lunch-up-crm/lunch-up-crm.env
sudo chown root:lunchup /etc/lunch-up-crm/lunch-up-crm.env
sudo chmod 640 /etc/lunch-up-crm/lunch-up-crm.env
```

Minimum required values:

```env
CRM_ACCESS_KEY=<long-random-key>
CUSTOMER_PORTAL_SHARED_ACCESS_CODE=<long-random-code>
PUBLIC_BASE_URL=https://crm.example.com
PORT=3011
HOST=0.0.0.0
CRM_NEXT_MODE=standalone
LUNCH_UP_CRM_DB_PATH=/opt/lunch-up-crm/data/lunch_up_crm.sqlite
```

Do not commit this file.

## 5. Install and Build

```bash
cd /opt/lunch-up-crm
sudo -u lunchup npm ci
sudo -u lunchup npm run verify
sudo -u lunchup node ./node_modules/typescript/bin/tsc --noEmit
sudo -u lunchup npm run build
```

## 6. Start with systemd

```bash
sudo cp /opt/lunch-up-crm/ops/systemd/lunch-up-crm.service /etc/systemd/system/lunch-up-crm.service
sudo systemctl daemon-reload
sudo systemctl enable --now lunch-up-crm
sudo systemctl status lunch-up-crm
```

Health check:

```bash
curl -fsS http://127.0.0.1:3011/api/health
```

## 7. Configure Nginx

```bash
sudo cp /opt/lunch-up-crm/ops/nginx/lunch-up-crm.conf /etc/nginx/sites-available/lunch-up-crm.conf
sudo ln -s /etc/nginx/sites-available/lunch-up-crm.conf /etc/nginx/sites-enabled/lunch-up-crm.conf
sudo nginx -t
sudo systemctl reload nginx
```

Add TLS using Certbot or Cloudflare in front of the VPS.

## 8. Docker Alternative

```bash
cd /opt/lunch-up-crm
cp .env.example .env
nano .env
docker compose up -d --build
docker compose ps
```

## 9. Smoke Test

```bash
curl -fsS http://127.0.0.1:3011/api/health
curl -fsS "http://127.0.0.1:3011/catalog?view=all&print=1&key=$CRM_ACCESS_KEY" > /tmp/catalog.html
```

Open:

- `https://crm.example.com/?key=<CRM_ACCESS_KEY>`
- `https://crm.example.com/catalog?key=<CRM_ACCESS_KEY>`

## 10. Update Procedure

```bash
cd /opt/lunch-up-crm
sudo -u lunchup git pull --ff-only
sudo -u lunchup npm ci
sudo -u lunchup npm run verify
sudo -u lunchup npm run build
sudo systemctl restart lunch-up-crm
curl -fsS http://127.0.0.1:3011/api/health
```

## 11. Rollback

```bash
cd /opt/lunch-up-crm
sudo -u lunchup git log --oneline -10
sudo -u lunchup git checkout <known-good-sha>
sudo -u lunchup npm ci
sudo -u lunchup npm run build
sudo systemctl restart lunch-up-crm
```

If data changed, restore SQLite using `docs/BACKUP_RESTORE.md`.

