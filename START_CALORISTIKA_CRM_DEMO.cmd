@echo off
setlocal
cd /d "%~dp0"
if not exist "data\caloristika_demo_crm.sqlite" (
  npm run db:demo:caloristika
)
set LUNCH_UP_CRM_DB_PATH=%~dp0data\caloristika_demo_crm.sqlite
npm run dev
