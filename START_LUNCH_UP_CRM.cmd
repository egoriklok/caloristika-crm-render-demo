@echo off
setlocal
cd /d "%~dp0"

if not exist "data\lunch_up_crm.sqlite" (
  echo Creating SQLite database...
  npm run db:init
)

echo Verifying CRM database...
npm run verify
if errorlevel 1 (
  echo Verification failed.
  pause
  exit /b 1
)

echo Starting Lunch Up CRM at http://localhost:3011
start "" http://localhost:3011
npm run web
