import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { openVerifyDb } from "./verify-db.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")

if (!existsSync(dbPath)) {
  throw new Error("Missing SQLite database. Run npm run db:init")
}

const db = openVerifyDb(dbPath)
const requiredTables = [
  "settings",
  "companies",
  "contacts",
  "pipeline_stages",
  "deals",
  "activities",
  "products",
  "crm_segments",
  "segment_matrices",
  "matrix_items",
  "bot_customers",
  "miniapp_customer_profiles",
  "customer_identities",
  "orders",
  "order_items",
  "inventory_positions",
  "inventory_movements",
  "telegram_events",
  "ai_agents",
  "ai_tasks",
  "ai_task_runs",
  "ai_agent_memories",
  "cjm_events",
  "company_enrichment_profiles",
  "company_enrichment_sources",
  "integration_events"
]

const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name))
for (const table of requiredTables) {
  if (!tables.has(table)) {
    throw new Error(`Missing table: ${table}`)
  }
}

const checks = [
  ["companies", "SELECT COUNT(*) AS count FROM companies", 30],
  ["contacts", "SELECT COUNT(*) AS count FROM contacts", 30],
  ["contacts_with_phone_and_email", "SELECT COUNT(*) AS count FROM contacts WHERE COALESCE(TRIM(email), '') <> '' AND COALESCE(TRIM(phone), '') <> ''", 30],
  ["products", "SELECT COUNT(*) AS count FROM products WHERE is_active = 1", 46],
  ["crm_segments", "SELECT COUNT(*) AS count FROM crm_segments WHERE is_active = 1", 18],
  ["pipeline_stages", "SELECT COUNT(*) AS count FROM pipeline_stages", 9],
  ["deals", "SELECT COUNT(*) AS count FROM deals", 30],
  ["ai_agents", "SELECT COUNT(*) AS count FROM ai_agents", 10],
  ["ai_tasks", "SELECT COUNT(*) AS count FROM ai_tasks", 54],
  ["segment_matrices", "SELECT COUNT(*) AS count FROM segment_matrices", 3]
]

for (const [name, sql, min] of checks) {
  const row = db.prepare(sql).get()
  if (row.count < min) {
    throw new Error(`Expected ${name} >= ${min}, got ${row.count}`)
  }
}

const minOrder = db.prepare("SELECT value FROM settings WHERE key = 'min_order_amount'").get()
if (!minOrder || Number(minOrder.value) !== 7000) {
  throw new Error("Minimum order amount setting is wrong")
}

const apifyAgent = db.prepare("SELECT COUNT(*) AS count FROM ai_agents WHERE code = 'apify_actor_researcher'").get()
if (apifyAgent.count !== 1) {
  throw new Error("Missing Apify actor researcher agent")
}

const telegramChannelAgent = db.prepare("SELECT COUNT(*) AS count FROM ai_agents WHERE code = 'company_telegram_channel_researcher'").get()
if (telegramChannelAgent.count !== 1) {
  throw new Error("Missing company Telegram channel researcher agent")
}

const companyTelegramCoverage = db.prepare(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN COALESCE(TRIM(telegram_contact_status), '') <> '' THEN 1 ELSE 0 END) AS status_count,
    SUM(CASE WHEN COALESCE(TRIM(agent_contact_policy), '') <> '' THEN 1 ELSE 0 END) AS policy_count,
    SUM(CASE WHEN COALESCE(TRIM(agent_contact_readiness), '') <> '' THEN 1 ELSE 0 END) AS readiness_count,
    SUM(CASE WHEN COALESCE(TRIM(agent_contact_next_step), '') <> '' THEN 1 ELSE 0 END) AS next_step_count
  FROM companies
`).get()
if (
  companyTelegramCoverage.status_count !== companyTelegramCoverage.total ||
  companyTelegramCoverage.policy_count !== companyTelegramCoverage.total ||
  companyTelegramCoverage.readiness_count !== companyTelegramCoverage.total ||
  companyTelegramCoverage.next_step_count !== companyTelegramCoverage.total
) {
  throw new Error(`Company Telegram/AI-channel coverage is incomplete: ${JSON.stringify(companyTelegramCoverage)}`)
}

const demoOrders = db.prepare(`
  SELECT COUNT(*) AS count
  FROM orders o
  LEFT JOIN bot_customers b ON b.id = o.bot_customer_id
  WHERE o.instructions LIKE '%Демо-заказ%'
     OR b.telegram_user_id LIKE 'demo-%'
     OR b.telegram_chat_id LIKE 'qa-%'
`).get()
if (demoOrders.count > 0) {
  throw new Error(`Expected no demo orders, got ${demoOrders.count}`)
}

const demoAiTasks = db.prepare(`
  SELECT COUNT(*) AS count
  FROM ai_tasks
  WHERE lower(COALESCE(task_type, '')) LIKE 'qa_%'
     OR lower(COALESCE(prompt, '')) LIKE '%qa:%'
     OR lower(COALESCE(prompt, '')) LIKE '%тестовый outreach%'
`).get()
if (demoAiTasks.count > 0) {
  throw new Error(`Expected no demo AI tasks, got ${demoAiTasks.count}`)
}

const indexes = db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").get()
if (indexes.count < 10) {
  throw new Error(`Expected at least 10 indexes, got ${indexes.count}`)
}

const unknownCompanySegments = db.prepare(`
  SELECT DISTINCT segment
  FROM companies
  WHERE COALESCE(TRIM(segment), '') <> ''
    AND segment NOT IN (SELECT code FROM crm_segments WHERE is_active = 1)
`).all()
if (unknownCompanySegments.length > 0) {
  throw new Error(`Unknown company segments outside crm_segments: ${unknownCompanySegments.map((row) => row.segment).join(", ")}`)
}

const unknownMatrixSegments = db.prepare(`
  SELECT DISTINCT segment
  FROM segment_matrices
  WHERE COALESCE(TRIM(segment), '') <> ''
    AND segment NOT IN (SELECT code FROM crm_segments WHERE is_active = 1)
`).all()
if (unknownMatrixSegments.length > 0) {
  throw new Error(`Unknown matrix segments outside crm_segments: ${unknownMatrixSegments.map((row) => row.segment).join(", ")}`)
}

const computerClubSegment = db.prepare(`
  SELECT code, direction_code, direction_label, launch_format, is_active
  FROM crm_segments
  WHERE code = 'computer_club'
`).get()
if (
  !computerClubSegment ||
  computerClubSegment.is_active !== 1 ||
  computerClubSegment.direction_code !== "workplace" ||
  computerClubSegment.direction_label !== "Рабочие и учебные локации" ||
  computerClubSegment.launch_format !== "Компьютерный клуб snack-витрина"
) {
  throw new Error("Computer club segment must be active under workplace CRM direction")
}

const digitalOrdersSegment = db.prepare("SELECT is_active FROM crm_segments WHERE code = 'telegram_order'").get()
if (digitalOrdersSegment && digitalOrdersSegment.is_active !== 0) {
  throw new Error("Telegram order must not be active as a CRM sales segment")
}

const computerClubCounts = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM companies WHERE segment = 'computer_club') AS companies,
    (SELECT COUNT(*)
     FROM contacts ct
     JOIN companies c ON c.id = ct.company_id
     WHERE c.segment = 'computer_club'
       AND COALESCE(TRIM(ct.phone), '') <> ''
       AND COALESCE(TRIM(ct.address), '') <> ''
       AND COALESCE(TRIM(ct.dgis_url), '') <> ''
       AND ct.drive_minutes_from_production > 0) AS contacts,
    (SELECT COUNT(*)
     FROM deals d
     JOIN companies c ON c.id = d.company_id
     WHERE c.segment = 'computer_club') AS deals,
    (SELECT COUNT(*) FROM local_prospects WHERE segment = 'Компьютерные клубы') AS local_prospects,
    (SELECT COUNT(*)
     FROM company_enrichment_profiles p
     JOIN companies c ON c.id = p.company_id
     WHERE c.segment = 'computer_club'
       AND p.recommended_portions = 88
       AND p.recommended_sku = 16
       AND p.estimated_launch_budget >= 8905) AS enrichment_profiles,
    (SELECT COUNT(*)
     FROM ai_tasks t
     JOIN companies c ON c.id = t.company_id
     WHERE c.segment = 'computer_club'
       AND t.task_type IN ('computer_club_outreach', 'computer_club_matrix_review')) AS ai_tasks
`).get()
if (
  computerClubCounts.companies < 6 ||
  computerClubCounts.contacts < 6 ||
  computerClubCounts.deals < 6 ||
  computerClubCounts.local_prospects < 6 ||
  computerClubCounts.enrichment_profiles < 6 ||
  computerClubCounts.ai_tasks < 12
) {
  throw new Error(`Computer club CRM links are incomplete: ${JSON.stringify(computerClubCounts)}`)
}

const computerClubMatrix = db.prepare(`
  SELECT COUNT(mi.id) AS item_count
  FROM segment_matrices m
  JOIN matrix_items mi ON mi.matrix_id = m.id
  WHERE m.segment = 'computer_club'
`).get()
if (!computerClubMatrix || computerClubMatrix.item_count < 12) {
  throw new Error("Computer club launch matrix must include at least 12 catalog SKU")
}

const segmentMatrixBreakfastGaps = db.prepare(`
  SELECT m.segment, m.name, COUNT(DISTINCT CASE WHEN p.category = 'Завтраки' THEN p.name END) AS breakfast_sku
  FROM segment_matrices m
  JOIN matrix_items mi ON mi.matrix_id = m.id
  JOIN products p ON p.id = mi.product_id
  GROUP BY m.id
  HAVING breakfast_sku < 2
`).all()
if (segmentMatrixBreakfastGaps.length > 0) {
  throw new Error(`Segment matrices must include diverse breakfast SKU: ${JSON.stringify(segmentMatrixBreakfastGaps)}`)
}

const segmentMatrixCategoryDiversityGaps = db.prepare(`
  SELECT m.segment, m.name, p.category, COUNT(DISTINCT p.name) AS sku
  FROM segment_matrices m
  JOIN matrix_items mi ON mi.matrix_id = m.id
  JOIN products p ON p.id = mi.product_id
  WHERE p.category IN ('Салаты', 'Сэндвичи', 'Десерты')
  GROUP BY m.id, p.category
  HAVING
    (p.category = 'Сэндвичи' AND sku < 4)
    OR (p.category IN ('Салаты', 'Десерты') AND sku < 3)
`).all()
if (segmentMatrixCategoryDiversityGaps.length > 0) {
  throw new Error(`Segment matrices must avoid concentrated category SKU: ${JSON.stringify(segmentMatrixCategoryDiversityGaps)}`)
}

const launchContent = JSON.parse(readFileSync(join(root, "data", "launch-crm-content.json"), "utf-8"))
const breakfastSkuNames = new Set(["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"])
function cleanLaunchSkuName(value) {
  return String(value ?? "").trim().replace(/”/g, "»").replace(/»{2,}/g, "»")
}
function parseLaunchSkuItems(value) {
  return String(value ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)\s+x(\d+)$/i)
      return {
        name: cleanLaunchSkuName(match?.[1] ?? part),
        qty: match?.[2] ? Number(match[2]) : 1
      }
    })
}
function parseLaunchSkuText(value) {
  return parseLaunchSkuItems(value).map((item) => item.name)
}
const launchRowsWithSingleBreakfast = (launchContent.launch_matrix ?? []).filter((row) => parseLaunchSkuText(row.breakfasts).length < 2)
const segmentLaunchesWithSingleBreakfast = (launchContent.segment_launches ?? []).filter((row) => parseLaunchSkuText(row.breakfasts).length < 2)
const launchRowsWithNonBreakfastInBreakfasts = (launchContent.launch_matrix ?? []).filter((row) =>
  parseLaunchSkuText(row.breakfasts).some((name) => !breakfastSkuNames.has(name))
)
const segmentLaunchesWithNonBreakfastInBreakfasts = (launchContent.segment_launches ?? []).filter((row) =>
  parseLaunchSkuText(row.breakfasts).some((name) => !breakfastSkuNames.has(name))
)
if (
  launchRowsWithSingleBreakfast.length > 0 ||
  segmentLaunchesWithSingleBreakfast.length > 0 ||
  launchRowsWithNonBreakfastInBreakfasts.length > 0 ||
  segmentLaunchesWithNonBreakfastInBreakfasts.length > 0
) {
  throw new Error(
    `Launch breakfast SKU must be diverse and limited to breakfast catalog items: ${JSON.stringify({
      launchRowsWithSingleBreakfast: launchRowsWithSingleBreakfast.map((row) => row.name).slice(0, 10),
      segmentLaunchesWithSingleBreakfast: segmentLaunchesWithSingleBreakfast.map((row) => row.format),
      launchRowsWithNonBreakfastInBreakfasts: launchRowsWithNonBreakfastInBreakfasts.map((row) => row.name).slice(0, 10),
      segmentLaunchesWithNonBreakfastInBreakfasts: segmentLaunchesWithNonBreakfastInBreakfasts.map((row) => row.format)
    })}`
  )
}

const launchCategoryRules = [
  { field: "salads", label: "Салаты", minSku: 3 },
  { field: "sandwiches", label: "Сэндвичи", minSku: 4 },
  { field: "desserts", label: "Десерты", minSku: 3 }
]
function launchCategoryDiversityGaps(rows, source) {
  const gaps = []
  for (const row of rows ?? []) {
    for (const rule of launchCategoryRules) {
      const items = parseLaunchSkuItems(row[rule.field])
      if (items.length === 0) continue
      const total = items.reduce((sum, item) => sum + item.qty, 0)
      const maxShare = total > 0 ? Math.max(...items.map((item) => item.qty)) / total : 0
      const requiredSku = Math.min(rule.minSku, total)
      if (items.length < requiredSku || maxShare > 0.45) {
        gaps.push({
          source,
          field: rule.label,
          name: row.name ?? row.format ?? row.segment ?? "",
          sku: items.length,
          total,
          maxShare: Math.round(maxShare * 100) / 100,
          value: row[rule.field]
        })
      }
    }
  }
  return gaps
}
const launchCategoryGaps = [
  ...launchCategoryDiversityGaps(launchContent.launch_matrix, "launch_matrix"),
  ...launchCategoryDiversityGaps(launchContent.segment_launches, "segment_launches")
]
if (launchCategoryGaps.length > 0) {
  throw new Error(`Launch categories must prefer SKU variety over concentration: ${JSON.stringify(launchCategoryGaps.slice(0, 20))}`)
}

for (const [table, column] of [
  ["companies", "address"],
  ["companies", "dgis_url"],
  ["companies", "drive_minutes_from_production"],
  ["companies", "telegram_url"],
  ["companies", "telegram_username"],
  ["companies", "telegram_channel_type"],
  ["companies", "telegram_contact_status"],
  ["companies", "telegram_source_url"],
  ["companies", "telegram_source_note"],
  ["companies", "telegram_discovered_at"],
  ["companies", "agent_contact_policy"],
  ["companies", "agent_contact_readiness"],
  ["companies", "agent_contact_next_step"],
  ["contacts", "address"],
  ["contacts", "dgis_url"],
  ["contacts", "drive_minutes_from_production"],
  ["orders", "payment_date"]
]) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column)
  if (!exists) {
    throw new Error(`Missing logistics column: ${table}.${column}`)
  }
}

for (const column of ["locked_at", "locked_by", "attempts", "last_error", "result_json", "completed_at"]) {
  const exists = db.prepare("PRAGMA table_info(ai_tasks)").all().some((row) => row.name === column)
  if (!exists) {
    throw new Error(`Missing AI task runtime column: ai_tasks.${column}`)
  }
}

const missingCompanyLogistics = db.prepare(`
  SELECT name
  FROM companies
  WHERE COALESCE(TRIM(address), '') = ''
     OR COALESCE(TRIM(dgis_url), '') = ''
     OR drive_minutes_from_production IS NULL
     OR drive_minutes_from_production <= 0
  ORDER BY name
`).all()
if (missingCompanyLogistics.length > 0) {
  throw new Error(`Companies missing address/2GIS/drive minutes: ${missingCompanyLogistics.map((row) => row.name).join(", ")}`)
}

const missingContactLogistics = db.prepare(`
  SELECT c.name
  FROM contacts ct
  JOIN companies c ON c.id = ct.company_id
  WHERE COALESCE(TRIM(ct.address), '') = ''
     OR COALESCE(TRIM(ct.dgis_url), '') = ''
     OR ct.drive_minutes_from_production IS NULL
     OR ct.drive_minutes_from_production <= 0
  ORDER BY c.name
`).all()
if (missingContactLogistics.length > 0) {
  throw new Error(`Contacts missing address/2GIS/drive minutes: ${missingContactLogistics.map((row) => row.name).join(", ")}`)
}

db.close()

const requiredRuntimeFiles = [
  "app/page.tsx",
  "app/catalog/page.tsx",
  "public/admin-catalog.html",
  "public/admin-catalog.js",
  "public/admin-catalog-data.json",
  "app/api/dashboard/route.ts",
  "app/api/health/route.ts",
  "app/api/bot/catalog/route.ts",
  "app/api/bot/orders/route.ts",
  "app/api/companies/route.ts",
  "app/api/telegram/webhook/route.ts",
  "app/api/agent/manifest/route.ts",
  "app/api/agent/tasks/route.ts",
  "app/api/miniapp/catalog/route.ts",
  "app/api/miniapp/session/route.ts",
  "app/api/miniapp/orders/route.ts",
  "app/api/miniapp/orders/history/route.ts",
  "app/api/miniapp/enrichment/route.ts",
  "app/api/miniapp/agent/route.ts",
  "app/api/companies/[id]/enrichment/route.ts",
  "app/api/companies/enrichment/bulk/route.ts",
  "app/api/integrations/2gis/search/route.ts",
  "app/api/integrations/status/route.ts",
  "app/api/integrations/preflight/route.ts",
  "app/api/integrations/launch-guide/route.ts",
  "app/api/integrations/share-qr/route.ts",
  "app/api/integrations/telegram/setup-preview/route.ts",
  "app/api/integrations/orders/export/route.ts",
  "app/api/integrations/apify/research/route.ts",
  "app/api/orders/[id]/status/route.ts",
  "app/api/mcp/manifest/route.ts",
  "app/miniapp/page.tsx",
  "proxy.ts",
  ".env.example",
  "lib/active-strategy.ts",
  "lib/crm-access.ts",
  "lib/crm-segments.ts",
  "lib/queries.ts",
  "lib/types.ts",
  "lib/bot-catalog.ts",
  "lib/bot-orders.ts",
  "lib/admin-catalog.ts",
  "lib/customer-portal-auth.ts",
  "lib/inventory.ts",
  "lib/agent-manifest.ts",
  "lib/agent-runtime.ts",
  "lib/telegram-miniapp-auth.ts",
  "lib/miniapp-service.ts",
  "lib/company-enrichment.ts",
  "lib/company-enrichment-refresh.ts",
  "lib/company-lead-intake.ts",
  "lib/dgis-lead-search.ts",
  "lib/apify-research.ts",
  "lib/telegram-bot.ts",
  "lib/external-integrations.ts",
  "lib/integration-preflight.ts",
  "lib/integration-launch-guide.ts",
  "lib/telegram-setup-preview.ts",
  "lib/order-status.ts",
  "lib/mcp-manifest.ts",
  "lib/client-catalog.ts",
  "lib/competitive-analysis.ts",
  "lib/samokat-unit-economics.ts",
  "components/client-catalog-actions.tsx",
  "components/client-catalog-print-qr.tsx",
  "components/crm-dashboard-loader.tsx",
  "components/telegram-miniapp-order.tsx",
  "Dockerfile",
  ".dockerignore",
  "docker-compose.yml",
  "scripts/local-env.mjs",
  "scripts/agent-runtime-sql.mjs",
  "scripts/agent-runtime-providers.mjs",
  "scripts/migrate-agent-runtime.mjs",
  "scripts/agent-worker.mjs",
  "scripts/agent-worker-smoke.mjs",
  "scripts/agent-remote-worker.mjs",
  "scripts/agent-remote-worker-smoke.mjs",
  "scripts/agent-provider-smoke.mjs",
  "scripts/agent-readiness-check.mjs",
  "scripts/perf-baseline.mjs",
  "scripts/perf-load-smoke.mjs",
  "scripts/server-build-stage.mjs",
  "scripts/sqlite-maintenance.mjs",
  "scripts/render-postdeploy-smoke.mjs",
  "scripts/render-api-services.mjs",
  "scripts/set-render-env.ps1",
  "scripts/telegram-env-bootstrap.mjs",
  "scripts/setup-telegram-bot.mjs",
  "scripts/telegram-setup-dry-run-smoke.mjs",
  "scripts/telegram-setup-preview-smoke.mjs",
  "scripts/telegram-launch.mjs",
  "scripts/telegram-launch-check.mjs",
  "scripts/telegram-launch-check-smoke.mjs",
  "scripts/telegram-webhook-smoke.ts",
  "scripts/telegram-webhook-access-smoke.mjs",
  "scripts/telegram-webhook-post-smoke.mjs",
  "scripts/launch-guide-smoke.mjs",
  "scripts/integration-preflight-mock-smoke.mjs",
  "scripts/migrate-customer-portal.mjs",
  "scripts/miniapp-auth-smoke.mjs",
  "scripts/miniapp-enrichment-smoke.mjs",
  "scripts/miniapp-order-smoke.mjs",
  "scripts/export-admin-catalog-data.mjs",
  "scripts/company-enrichment-smoke.mjs",
  "scripts/import-project-sheet-enrichment.mjs",
  "scripts/verify-project-sheet-segments.mjs",
  "lib/telegram-intents.ts",
  "lib/product-photos.ts",
  "lib/project-sheet-enrichment.ts",
  "lib/location-logistics.ts",
  "scripts/backfill-company-logistics.mjs",
  "scripts/backfill-company-telegram-channels.mjs",
  "docs/AI_AGENT_RUNBOOK.md",
  "docs/AI_AGENT_SYSTEM_PRD.md",
  "docs/AGENT_HANDOFF.md",
  "docs/2GIS_DEMO_KEY_LIMITS.md",
  "docs/COMPANY_TELEGRAM_AGENT_CHANNELS.md",
  "docs/CRM_AI_AGENT_OPERATING_MODEL.md",
  "docs/OPERATOR_ONE_PAGE_RUNBOOK.md",
  "docs/CRM_DATA_COLLECTION_RULES.md",
  "docs/DEPLOYMENT_AND_SCALING.md",
  "docs/RENDER_DEPLOYMENT_RUNBOOK.md"
]

for (const file of requiredRuntimeFiles) {
  if (!existsSync(join(root, file))) {
    throw new Error(`Missing runtime file: ${file}`)
  }
}

const serverLauncher = readFileSync(join(root, "scripts", "server.mjs"), "utf-8")
const renderPostdeploySmokeSource = readFileSync(join(root, "scripts", "render-postdeploy-smoke.mjs"), "utf-8")
const renderApiServicesSource = readFileSync(join(root, "scripts", "render-api-services.mjs"), "utf-8")
const renderEnvSetSource = readFileSync(join(root, "scripts", "set-render-env.ps1"), "utf-8")
const localEnvSource = readFileSync(join(root, "scripts", "local-env.mjs"), "utf-8")
const envExampleSource = readFileSync(join(root, ".env.example"), "utf-8")
const nextConfigSource = readFileSync(join(root, "next.config.mjs"), "utf-8")
const packageSource = readFileSync(join(root, "package.json"), "utf-8")
const agentSwarmManifestSource = readFileSync(join(root, "agent-swarm.manifest.json"), "utf-8")
const dockerfileSource = readFileSync(join(root, "Dockerfile"), "utf-8")
const dockerComposeSource = readFileSync(join(root, "docker-compose.yml"), "utf-8")
const dockerignoreSource = readFileSync(join(root, ".dockerignore"), "utf-8")
if (serverLauncher.includes("<!doctype") || serverLauncher.includes("innerHTML")) {
  throw new Error("scripts/server.mjs must stay a Next launcher, not a standalone HTML CRM")
}
if (
  !serverLauncher.includes("ensureProductionBuildId") ||
  !serverLauncher.includes("canUseNextStart") ||
  !serverLauncher.includes("standaloneServerPath") ||
  !serverLauncher.includes("canUseStandaloneStart") ||
  !serverLauncher.includes("ensureStandaloneAssets") ||
  !serverLauncher.includes("symlinkSync") ||
  !serverLauncher.includes("middleware-manifest.json") ||
  !serverLauncher.includes("build-manifest.json") ||
  !serverLauncher.includes("routes-manifest.json") ||
  !serverLauncher.includes("writeFileSync(buildIdPath")
) {
  throw new Error("scripts/server.mjs must detect Next 16 production builds without relying only on BUILD_ID")
}
if (!serverLauncher.includes("loadLocalEnv") || !localEnvSource.includes(".env.local") || !localEnvSource.includes("process.env[parsed.key] === undefined")) {
  throw new Error("CRM launch scripts must load .env.local without overriding existing process env")
}
for (const requiredEnvKey of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_BOT_SUGGESTED_USERNAME", "TELEGRAM_MINIAPP_SHORT_NAME", "DGIS_API_KEY", "DADATA_API_KEY", "DGIS_API_BASE_URL", "DADATA_API_BASE_URL", "PUBLIC_BASE_URL", "APIFY_TOKEN", "APIFY_DEFAULT_RESEARCH_ACTOR_ID", "HOST", "CRM_NEXT_MODE", "LUNCH_UP_CRM_DB_PATH", "LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS", "LUNCH_UP_SQLITE_MMAP_SIZE", "LUNCH_UP_SQLITE_WAL", "PERF_BASE_URL", "RENDER_API_KEY", "RENDER_OWNER_ID", "AGENT_LLM_PROVIDER", "AGENT_LLM_MODEL", "OPENAI_API_KEY", "OPENAI_AGENT_MODEL", "AGENT_LLM_ENABLED", "AGENT_WORKER_ID", "AGENT_MAX_TASKS_PER_RUN", "AGENT_MAX_ATTEMPTS", "AGENT_POLL_INTERVAL_MS", "AGENT_LLM_TIMEOUT_MS", "REMOTE_CRM_BASE_URL", "REMOTE_CRM_ACCESS_KEY", "PAPERCLIP_AGENT_ENDPOINT", "PAPERCLIP_AGENT_COMMAND", "PAPERCLIP_API_KEY", "PAPERCLIP_AGENT_MODEL", "HERMES_AGENT_ENDPOINT", "HERMES_AGENT_COMMAND", "HERMES_API_KEY", "HERMES_AGENT_MODEL", "OPENCLAW_AGENT_ENDPOINT", "OPENCLAW_GATEWAY_URL", "OPENCLAW_AGENT_COMMAND", "OPENCLAW_API_KEY", "OPENCLAW_AGENT_MODEL", "OMNIROUTER_BASE_URL", "OMNIROUTER_API_KEY", "OMNIROUTER_MODEL", "OMNIROUTER_AGENT_ENDPOINT", "OMNIROUTER_AGENT_COMMAND", "OMNIROUTE_BASE_URL", "OMNIROUTE_API_KEY", "OMNIROUTE_MODEL", "OMNIROUTE_AGENT_ENDPOINT", "OMNIROUTE_AGENT_COMMAND"]) {
  if (!envExampleSource.includes(requiredEnvKey)) {
    throw new Error(`.env.example must document ${requiredEnvKey}`)
  }
}
if (!envExampleSource.includes("TELEGRAM_OUTBOUND_DISABLED")) {
  throw new Error(".env.example must document TELEGRAM_OUTBOUND_DISABLED for smoke/QA")
}

const agentManifestSource = readFileSync(join(root, "lib", "agent-manifest.ts"), "utf-8")
const agentRuntimeSource = readFileSync(join(root, "lib", "agent-runtime.ts"), "utf-8")
const agentRuntimeSqlSource = readFileSync(join(root, "scripts", "agent-runtime-sql.mjs"), "utf-8")
const agentWorkerSource = readFileSync(join(root, "scripts", "agent-worker.mjs"), "utf-8")
const agentWorkerSmokeSource = readFileSync(join(root, "scripts", "agent-worker-smoke.mjs"), "utf-8")
const agentRemoteWorkerSource = readFileSync(join(root, "scripts", "agent-remote-worker.mjs"), "utf-8")
const agentRemoteWorkerSmokeSource = readFileSync(join(root, "scripts", "agent-remote-worker-smoke.mjs"), "utf-8")
const agentProviderSource = readFileSync(join(root, "scripts", "agent-runtime-providers.mjs"), "utf-8")
const agentProviderSmokeSource = readFileSync(join(root, "scripts", "agent-provider-smoke.mjs"), "utf-8")
const agentRunbookSource = readFileSync(join(root, "docs", "AI_AGENT_RUNBOOK.md"), "utf-8")
const agentSystemPrdSource = readFileSync(join(root, "docs", "AI_AGENT_SYSTEM_PRD.md"), "utf-8")
const agentHandoffSource = readFileSync(join(root, "docs", "AGENT_HANDOFF.md"), "utf-8")
const dgisDemoKeyLimitsSource = readFileSync(join(root, "docs", "2GIS_DEMO_KEY_LIMITS.md"), "utf-8")
const companyTelegramChannelsSource = readFileSync(join(root, "docs", "COMPANY_TELEGRAM_AGENT_CHANNELS.md"), "utf-8")
const agentOperatingModelSource = readFileSync(join(root, "docs", "CRM_AI_AGENT_OPERATING_MODEL.md"), "utf-8")
const operatorOnePageRunbookSource = readFileSync(join(root, "docs", "OPERATOR_ONE_PAGE_RUNBOOK.md"), "utf-8")
const dbSource = readFileSync(join(root, "lib", "db.ts"), "utf-8")
const crmAccessSource = readFileSync(join(root, "lib", "crm-access.ts"), "utf-8")
const healthRouteSource = readFileSync(join(root, "app", "api", "health", "route.ts"), "utf-8")
const dashboardRouteSource = readFileSync(join(root, "app", "api", "dashboard", "route.ts"), "utf-8")
const crmSegmentsSource = readFileSync(join(root, "lib", "crm-segments.ts"), "utf-8")
const queriesSource = readFileSync(join(root, "lib", "queries.ts"), "utf-8")
const typesSource = readFileSync(join(root, "lib", "types.ts"), "utf-8")
const activeStrategySource = readFileSync(join(root, "lib", "active-strategy.ts"), "utf-8")
const miniappSource = readFileSync(join(root, "app", "miniapp", "page.tsx"), "utf-8")
const miniappComponentSource = readFileSync(join(root, "components", "telegram-miniapp-order.tsx"), "utf-8")
const miniappAuthSource = readFileSync(join(root, "lib", "telegram-miniapp-auth.ts"), "utf-8")
const miniappServiceSource = readFileSync(join(root, "lib", "miniapp-service.ts"), "utf-8")
const companyEnrichmentSource = readFileSync(join(root, "lib", "company-enrichment.ts"), "utf-8")
const companyEnrichmentRefreshSource = readFileSync(join(root, "lib", "company-enrichment-refresh.ts"), "utf-8")
const companyRefreshEnrichmentRouteSource = readFileSync(join(root, "app", "api", "companies", "[id]", "enrichment", "route.ts"), "utf-8")
const companyBulkEnrichmentRouteSource = readFileSync(join(root, "app", "api", "companies", "enrichment", "bulk", "route.ts"), "utf-8")
const companyLeadIntakeSource = readFileSync(join(root, "lib", "company-lead-intake.ts"), "utf-8")
const dgisLeadSearchSource = readFileSync(join(root, "lib", "dgis-lead-search.ts"), "utf-8")
const dgisLeadSearchRouteSource = readFileSync(join(root, "app", "api", "integrations", "2gis", "search", "route.ts"), "utf-8")
const agentTasksRouteSource = readFileSync(join(root, "app", "api", "agent", "tasks", "route.ts"), "utf-8")
const apifyResearchSource = readFileSync(join(root, "lib", "apify-research.ts"), "utf-8")
const apifyResearchRouteSource = readFileSync(join(root, "app", "api", "integrations", "apify", "research", "route.ts"), "utf-8")
const telegramIntentsSource = readFileSync(join(root, "lib", "telegram-intents.ts"), "utf-8")
const telegramBotSource = readFileSync(join(root, "lib", "telegram-bot.ts"), "utf-8")
const telegramWebhookSource = readFileSync(join(root, "app", "api", "telegram", "webhook", "route.ts"), "utf-8")
const telegramEnvBootstrapSource = readFileSync(join(root, "scripts", "telegram-env-bootstrap.mjs"), "utf-8")
const telegramSetupSource = readFileSync(join(root, "scripts", "setup-telegram-bot.mjs"), "utf-8")
const telegramSetupDryRunSmokeSource = readFileSync(join(root, "scripts", "telegram-setup-dry-run-smoke.mjs"), "utf-8")
const telegramSetupPreviewSmokeSource = readFileSync(join(root, "scripts", "telegram-setup-preview-smoke.mjs"), "utf-8")
const telegramLaunchSource = readFileSync(join(root, "scripts", "telegram-launch.mjs"), "utf-8")
const telegramLaunchCheckSource = readFileSync(join(root, "scripts", "telegram-launch-check.mjs"), "utf-8")
const telegramLaunchCheckSmokeSource = readFileSync(join(root, "scripts", "telegram-launch-check-smoke.mjs"), "utf-8")
const dgisKeySetSource = readFileSync(join(root, "scripts", "set-dgis-key.ps1"), "utf-8")
const dgisKeyCheckSource = readFileSync(join(root, "scripts", "check-dgis-key.mjs"), "utf-8")
const telegramWebhookSmokeSource = readFileSync(join(root, "scripts", "telegram-webhook-smoke.ts"), "utf-8")
const telegramWebhookAccessSmokeSource = readFileSync(join(root, "scripts", "telegram-webhook-access-smoke.mjs"), "utf-8")
const telegramWebhookPostSmokeSource = readFileSync(join(root, "scripts", "telegram-webhook-post-smoke.mjs"), "utf-8")
const launchGuideSmokeSource = readFileSync(join(root, "scripts", "launch-guide-smoke.mjs"), "utf-8")
const integrationPreflightMockSmokeSource = readFileSync(join(root, "scripts", "integration-preflight-mock-smoke.mjs"), "utf-8")
const miniappAuthSmokeSource = readFileSync(join(root, "scripts", "miniapp-auth-smoke.mjs"), "utf-8")
const miniappEnrichmentSmokeSource = readFileSync(join(root, "scripts", "miniapp-enrichment-smoke.mjs"), "utf-8")
const miniappOrderSmokeSource = readFileSync(join(root, "scripts", "miniapp-order-smoke.mjs"), "utf-8")
const companyEnrichmentSmokeSource = readFileSync(join(root, "scripts", "company-enrichment-smoke.mjs"), "utf-8")
const externalIntegrationsSource = readFileSync(join(root, "lib", "external-integrations.ts"), "utf-8")
const integrationPreflightSource = readFileSync(join(root, "lib", "integration-preflight.ts"), "utf-8")
const integrationLaunchGuideSource = readFileSync(join(root, "lib", "integration-launch-guide.ts"), "utf-8")
const shareQrRouteSource = readFileSync(join(root, "app", "api", "integrations", "share-qr", "route.ts"), "utf-8")
const telegramSetupPreviewSource = readFileSync(join(root, "lib", "telegram-setup-preview.ts"), "utf-8")
const telegramSetupPreviewRouteSource = readFileSync(join(root, "app", "api", "integrations", "telegram", "setup-preview", "route.ts"), "utf-8")
const integrationLaunchGuideRouteSource = readFileSync(join(root, "app", "api", "integrations", "launch-guide", "route.ts"), "utf-8")
const integrationPreflightRouteSource = readFileSync(join(root, "app", "api", "integrations", "preflight", "route.ts"), "utf-8")
const orderStatusSource = readFileSync(join(root, "lib", "order-status.ts"), "utf-8")
const mcpManifestSource = readFileSync(join(root, "lib", "mcp-manifest.ts"), "utf-8")
const readmeSource = readFileSync(join(root, "README.md"), "utf-8")
const aiInfrastructureSource = readFileSync(join(root, "docs", "AI_AGENT_INFRASTRUCTURE.md"), "utf-8")
const crmDataRulesSource = readFileSync(join(root, "docs", "CRM_DATA_COLLECTION_RULES.md"), "utf-8")
const deploymentScalingSource = readFileSync(join(root, "docs", "DEPLOYMENT_AND_SCALING.md"), "utf-8")
const renderDeploymentRunbookSource = readFileSync(join(root, "docs", "RENDER_DEPLOYMENT_RUNBOOK.md"), "utf-8")
const crmDashboardLoaderSource = readFileSync(join(root, "components", "crm-dashboard-loader.tsx"), "utf-8")
const clientCatalogSource = readFileSync(join(root, "app", "catalog", "page.tsx"), "utf-8")
const clientCatalogDataSource = readFileSync(join(root, "lib", "client-catalog.ts"), "utf-8")
const adminCatalogDataSource = readFileSync(join(root, "lib", "admin-catalog.ts"), "utf-8")
const adminCatalogHtmlSource = readFileSync(join(root, "public", "admin-catalog.html"), "utf-8")
const adminCatalogStaticSource = readFileSync(join(root, "public", "admin-catalog.js"), "utf-8")
const adminCatalogExportSource = readFileSync(join(root, "scripts", "export-admin-catalog-data.mjs"), "utf-8")
const perfBaselineSource = readFileSync(join(root, "scripts", "perf-baseline.mjs"), "utf-8")
const perfLoadSmokeSource = readFileSync(join(root, "scripts", "perf-load-smoke.mjs"), "utf-8")
const serverBuildStageSource = readFileSync(join(root, "scripts", "server-build-stage.mjs"), "utf-8")
const sqliteMaintenanceSource = readFileSync(join(root, "scripts", "sqlite-maintenance.mjs"), "utf-8")
const competitiveAnalysisSource = readFileSync(join(root, "lib", "competitive-analysis.ts"), "utf-8")
const samokatUnitEconomicsSource = readFileSync(join(root, "lib", "samokat-unit-economics.ts"), "utf-8")
const retailPriceBenchmarksSource = readFileSync(join(root, "lib", "retail-price-benchmarks.ts"), "utf-8")
const crmDashboardSource = readFileSync(join(root, "components", "crm-dashboard.tsx"), "utf-8")
const botCatalogSource = readFileSync(join(root, "lib", "bot-catalog.ts"), "utf-8")
const botOrdersSource = readFileSync(join(root, "lib", "bot-orders.ts"), "utf-8")
const clientCatalogActionsSource = readFileSync(join(root, "components", "client-catalog-actions.tsx"), "utf-8")
const clientCatalogPrintQrSource = readFileSync(join(root, "components", "client-catalog-print-qr.tsx"), "utf-8")
const globalCssSource = readFileSync(join(root, "app", "globals.css"), "utf-8")
const proxySource = readFileSync(join(root, "proxy.ts"), "utf-8")
const projectSheetEnrichmentSource = readFileSync(join(root, "lib", "project-sheet-enrichment.ts"), "utf-8")
const projectSheetImportSource = readFileSync(join(root, "scripts", "import-project-sheet-enrichment.mjs"), "utf-8")
if (
  !crmAccessSource.includes("CRM_ACCESS_KEY") ||
  !crmAccessSource.includes("crm_access") ||
  !crmAccessSource.includes("requireCrmAccess") ||
  !proxySource.includes('request.nextUrl.pathname === "/api/health"') ||
  !telegramSetupPreviewRouteSource.includes("requireCrmAccess") ||
  !integrationLaunchGuideRouteSource.includes("requireCrmAccess") ||
  !integrationPreflightRouteSource.includes("requireCrmAccess") ||
  !agentTasksRouteSource.includes("requireCrmAccess") ||
  !dgisLeadSearchRouteSource.includes("requireCrmAccess") ||
  !apifyResearchRouteSource.includes("requireCrmAccess")
) {
  throw new Error("Sensitive integration endpoints must enforce CRM access key inside route handlers, including localhost smoke tests")
}
if (
  !dbSource.includes("LUNCH_UP_CRM_DB_PATH") ||
  !dbSource.includes("PRAGMA busy_timeout") ||
  !dbSource.includes("PRAGMA journal_mode = WAL") ||
  !dbSource.includes("PRAGMA synchronous = NORMAL") ||
  !dbSource.includes("getDbRuntimeInfo") ||
  !dbSource.includes("sqliteWalSkippedForCloudSync") ||
  !serverLauncher.includes("LUNCH_UP_CRM_DB_PATH") ||
  !healthRouteSource.includes("getDbRuntimeInfo") ||
  !sqliteMaintenanceSource.includes("VACUUM INTO") ||
  !sqliteMaintenanceSource.includes("backup-before-sqlite-maintenance") ||
  !sqliteMaintenanceSource.includes("sidecarWarnings") ||
  !readmeSource.includes("LUNCH_UP_CRM_DB_PATH")
) {
  throw new Error("Runtime DB layer must support server SQLite path, WAL/busy-timeout tuning and health visibility")
}
if (
  !nextConfigSource.includes('output: "standalone"') ||
  !nextConfigSource.includes("compress: true") ||
  !nextConfigSource.includes("poweredByHeader: false") ||
  !nextConfigSource.includes("ignoreBuildErrors: true") ||
  !dockerfileSource.includes(".next/standalone") ||
  !dockerfileSource.includes("LUNCH_UP_CRM_DB_PATH=/app/data/lunch_up_crm.sqlite") ||
  !dockerComposeSource.includes("./data:/app/data") ||
  !dockerComposeSource.includes("/api/health") ||
  !dockerignoreSource.includes(".env.*") ||
  !dockerignoreSource.includes("data/*.sqlite") ||
  !packageSource.includes("\"build:server-stage\"") ||
  !serverBuildStageSource.includes("lunch-up-crm-build") ||
  !serverBuildStageSource.includes("runInstall") ||
  !serverBuildStageSource.includes("runBuild") ||
  !serverBuildStageSource.includes("node_modules") ||
  !serverBuildStageSource.includes(".next") ||
  !serverBuildStageSource.includes(".env.example") ||
  !serverBuildStageSource.includes("sqlite-wal") ||
  !deploymentScalingSource.includes("one write-capable CRM instance") ||
  !deploymentScalingSource.includes("npm run build:server-stage") ||
  !deploymentScalingSource.includes("PostgreSQL")
) {
  throw new Error("Server deployment must have standalone Next output, Docker volume wiring, secret exclusion and scaling guidance")
}
if (
  !packageSource.includes("\"perf:baseline\"") ||
  !packageSource.includes("\"perf:load-smoke\"") ||
  !perfBaselineSource.includes("root HTML must stay below 700 KB") ||
  !perfBaselineSource.includes("/api/dashboard") ||
  !perfLoadSmokeSource.includes("PERF_LOAD_CONCURRENCY") ||
  !perfLoadSmokeSource.includes("p95BudgetMs") ||
  !perfLoadSmokeSource.includes("/admin-catalog-data.json") ||
  !perfLoadSmokeSource.includes("Performance load smoke failed") ||
  !dashboardRouteSource.includes("Server-Timing") ||
  !dashboardRouteSource.includes("private, no-store") ||
  !crmDashboardLoaderSource.includes("/api/dashboard") ||
  !crmDashboardLoaderSource.includes("CrmDashboard") ||
  !crmDashboardLoaderSource.includes("credentials: \"same-origin\"") ||
  !readmeSource.includes("npm run perf:baseline") ||
  !readmeSource.includes("npm run perf:load-smoke") ||
  !deploymentScalingSource.includes("npm run perf:load-smoke")
) {
  throw new Error("CRM performance baseline must keep dashboard data out of first HTML and expose measurable API timing")
}
if (
  !packageSource.includes("\"agent:migrate\"") ||
  !packageSource.includes("\"agent:worker\"") ||
  !packageSource.includes("\"agent:worker-smoke\"") ||
  !packageSource.includes("\"agent:remote-worker\"") ||
  !packageSource.includes("\"agent:remote-worker-smoke\"") ||
  !packageSource.includes("\"agent:provider-smoke\"") ||
  !agentRuntimeSource.includes("claimNextAgentTask") ||
  !agentRuntimeSource.includes("completeAgentTask") ||
  !agentRuntimeSource.includes("failAgentTask") ||
  !agentRuntimeSource.includes("ai_task_runs") ||
  !agentRuntimeSource.includes("ai_agent_memories") ||
  !agentRuntimeSource.includes("getAgentRuntimeHealth") ||
  !healthRouteSource.includes("getAgentRuntimeHealth") ||
  !agentWorkerSource.includes("resolveAgentRuntime") ||
  !agentWorkerSource.includes("runAgentProvider") ||
  !agentWorkerSource.includes("maxAttempts") ||
  !agentWorkerSource.includes("deterministicResult") ||
  !agentRemoteWorkerSource.includes("REMOTE_CRM_BASE_URL") ||
  !agentRemoteWorkerSource.includes("x-crm-access-key") ||
  !agentRemoteWorkerSource.includes("runAgentProvider") ||
  !agentRemoteWorkerSmokeSource.includes("Agent tasks API without CRM key must be blocked") ||
  !agentProviderSource.includes("AGENT_LLM_PROVIDER") ||
  !agentProviderSource.includes("paperclip") ||
  !agentProviderSource.includes("hermes") ||
  !agentProviderSource.includes("openclaw") ||
  !agentProviderSource.includes("omniroute") ||
  !agentProviderSource.includes("OMNIROUTER_BASE_URL") ||
  !agentProviderSource.includes("callHttpProvider") ||
  !agentProviderSource.includes("callCommandProvider") ||
  !agentProviderSource.includes("callOmniroute") ||
  !agentProviderSource.includes("https://api.openai.com/v1/responses") ||
  !agentProviderSource.includes("json_schema") ||
  !agentProviderSmokeSource.includes("PAPERCLIP_AGENT_ENDPOINT") ||
  !agentProviderSmokeSource.includes("HERMES_AGENT_ENDPOINT") ||
  !agentProviderSmokeSource.includes("OPENCLAW_AGENT_ENDPOINT") ||
  !agentProviderSmokeSource.includes("OMNIROUTER_BASE_URL") ||
  !agentManifestSource.includes("supported_providers") ||
  !agentManifestSource.includes("AGENT_LLM_PROVIDER") ||
  !agentRunbookSource.includes("npm run agent:migrate") ||
  !agentRunbookSource.includes("npm run agent:worker") ||
  !agentRunbookSource.includes("npm run agent:remote-worker") ||
  !agentRunbookSource.includes("npm run agent:provider-smoke") ||
  !agentRunbookSource.includes("Provider Modes") ||
  !agentRunbookSource.includes("Human-in-the-loop") ||
  !agentRunbookSource.includes("customer_order_concierge") ||
  !agentRunbookSource.includes("inventory_replenishment_agent") ||
  !agentRunbookSource.includes("sales_demand_analyst")
) {
  throw new Error("AI agent runtime must expose migration, worker, structured output, trace, memory and operator runbook")
}

const operatingModelRequired = [
  "## 1. Source Of Truth",
  "## 2. Provider Selection",
  "## 3. Agent Permissions",
  "## 4. Evidence And Anti-Hallucination",
  "## 5. Permanent Hosting",
  "## 6. SQLite Growth Path",
  "## 7. Telegram Mini App Order Cycle",
  "## 8. Sales Metrics",
  "## 9. Safe External Keys",
  "## 10. Manager Feedback Loop",
  "## 11. GitHub PR And Merge Path",
  "## 12. Operator One-Page Runbook",
  "docs/OPERATOR_ONE_PAGE_RUNBOOK.md",
  "evidence_sources",
  "AGENT_LLM_PROVIDER",
  "PostgreSQL",
  "Telegram Mini App",
  "manager approval",
  "sales_metrics_contract",
  "PR #1"
]
for (const anchor of operatingModelRequired) {
  if (!agentOperatingModelSource.includes(anchor)) {
    throw new Error(`CRM AI agent operating model is missing anchor: ${anchor}`)
  }
}
if (
  !operatorOnePageRunbookSource.includes("AGENT_LLM_PROVIDER") ||
  !operatorOnePageRunbookSource.includes("evidence_sources") ||
  !operatorOnePageRunbookSource.includes("dry_run: true") ||
  !operatorOnePageRunbookSource.includes("Manager Approval Rule") ||
  !operatorOnePageRunbookSource.includes("Telegram Mini App") ||
  !operatorOnePageRunbookSource.includes("npm run agent:worker-smoke") ||
  !operatorOnePageRunbookSource.includes("npm run agent:provider-smoke")
) {
  throw new Error("Operator one-page runbook must cover provider selection, evidence, Telegram, dry-run and manager approval")
}
if (
  !agentRuntimeSqlSource.includes('"evidence_sources"') ||
  !agentRuntimeSqlSource.includes("required: [\"label\", \"source_type\", \"url\", \"note\"]") ||
  !agentRuntimeSqlSource.includes("result.evidence_sources = Array.isArray") ||
  !agentWorkerSource.includes("evidence_sources") ||
  !agentWorkerSmokeSource.includes("missing evidence_sources") ||
  !agentProviderSource.includes("Every recommendation must include evidence_sources") ||
  !agentProviderSmokeSource.includes("missing evidence_sources") ||
  !agentRunbookSource.includes('"evidence_sources"') ||
  !agentRuntimeSource.includes("evidence_sources")
) {
  throw new Error("Agent result contract must require evidence_sources across schema, worker, provider, smoke tests and runbook")
}
if (
  !agentManifestSource.includes("operating_model") ||
  !agentManifestSource.includes("source_of_truth") ||
  !agentManifestSource.includes("provider_decision") ||
  !agentManifestSource.includes("sales_metrics_contract") ||
  !agentManifestSource.includes("manager_feedback_loop") ||
  !agentManifestSource.includes("docs/CRM_AI_AGENT_OPERATING_MODEL.md") ||
  !agentManifestSource.includes("docs/OPERATOR_ONE_PAGE_RUNBOOK.md")
) {
  throw new Error("Agent manifest must expose the 12-point operating model, source of truth, provider decision, sales metrics and manager feedback loop")
}
if (
  !readmeSource.includes("docs/CRM_AI_AGENT_OPERATING_MODEL.md") ||
  !readmeSource.includes("docs/OPERATOR_ONE_PAGE_RUNBOOK.md") ||
  !agentSystemPrdSource.includes("12-point operating model") ||
  !agentSystemPrdSource.includes("evidence_sources") ||
  !agentHandoffSource.includes("docs/CRM_AI_AGENT_OPERATING_MODEL.md") ||
  !agentHandoffSource.includes("docs/OPERATOR_ONE_PAGE_RUNBOOK.md")
) {
  throw new Error("README, PRD and agent handoff must point future operators and agents to the operating model and one-page runbook")
}
if (
  !projectSheetEnrichmentSource.includes("1YGxYn6OP8lB7H33-1sNCqS8sUmdE0-ing90x9P0w71w") ||
  !projectSheetEnrichmentSource.includes("enrichLaunchContentFromProjectSheet") ||
  !projectSheetEnrichmentSource.includes("projectSheetSegments") ||
  !projectSheetEnrichmentSource.includes("crm_segment_code") ||
  !projectSheetEnrichmentSource.includes("launch_format") ||
  !projectSheetEnrichmentSource.includes("JTBD / сегмент") ||
  !projectSheetEnrichmentSource.includes("Контент-план") ||
  !projectSheetEnrichmentSource.includes("launch_recommendation") ||
  !projectSheetEnrichmentSource.includes("project_sheet_target_segments") ||
  !queriesSource.includes("enrichLaunchContentFromProjectSheet") ||
  !queriesSource.includes("projectSheetSegments") ||
  !typesSource.includes("ProjectSheetSegment") ||
  !typesSource.includes("launch_recommendation") ||
  !crmDashboardSource.includes("launch_recommendation") ||
  !crmDashboardSource.includes("Задачи из таблицы") ||
  !crmDashboardSource.includes("scriptBlockLabel") ||
  !projectSheetImportSource.includes("project_sheet_enrichment") ||
  !projectSheetImportSource.includes("project_sheet_sku_guidance")
) {
  throw new Error("Google Sheet project enrichment must feed CRM catalog guidance, script matrix, objection map and AI task queue")
}
if (
  !crmDashboardSource.includes("pipelineStagePlaybookTemplates") ||
  !crmDashboardSource.includes("buildPipelineStagePlaybook") ||
  !crmDashboardSource.includes("Playbook менеджера по стадиям") ||
  !crmDashboardSource.includes("Критерии перехода") ||
  !crmDashboardSource.includes("Цель: постоянное партнерство")
) {
  throw new Error("Pipeline tab must expose a segment-by-stage manager playbook with next-stage transition criteria")
}
if (
  !crmDashboardSource.includes("tabGroups") ||
  !crmDashboardSource.includes("priorityStats") ||
  !crmDashboardSource.includes("crm-command-bar") ||
  !crmDashboardSource.includes("crm-tab-rail") ||
  !globalCssSource.includes(".crm-kpi-strip") ||
  !globalCssSource.includes(".crm-tab-group")
) {
  throw new Error("CRM dashboard must keep the optimized command bar, KPI strip and grouped tab navigation")
}
if (
  !crmDashboardSource.includes("companyStrategyBrief") ||
  !crmDashboardSource.includes("companyDoctrineCards") ||
  !crmDashboardSource.includes("buildCrmSegmentGroups") ||
  !crmDashboardSource.includes("CrmSegmentFilterControls") ||
  !crmDashboardSource.includes("data-company-segment-menu") ||
  !crmDashboardSource.includes("data-crm-segment-source=\"crm_segments\"") ||
  !crmDashboardSource.includes("data-crm-segment-direction-select") ||
  !crmDashboardSource.includes("data-crm-segment-select") ||
  !crmDashboardSource.includes("data-competitive-field-panel") ||
  !crmDashboardSource.includes("Конкурентное поле сегмента") ||
  !crmDashboardSource.includes("Отстройка Lunch Up") ||
  !crmDashboardSource.includes("commercialGuardrails") ||
  !crmDashboardSource.includes("Что Lunch Up реализует и почему это покупают") ||
  !crmDashboardSource.includes("фабрика готовой охлажденной еды для B2B-каналов") ||
  !crmDashboardSource.includes("Фабрику готовой еды") ||
  !crmDashboardSource.includes("Стратегический план продажи") ||
  !crmDashboardSource.includes("Фокус переговоров")
) {
  throw new Error("About tab must include strategic positioning, competitor differentiation, sales doctrine and internal source context")
}
if (
  !crmSegmentsSource.includes("syncCrmSegments") ||
  !crmSegmentsSource.includes("direction_code") ||
  !crmSegmentsSource.includes("launch_format") ||
  !crmSegmentsSource.includes('code: "computer_club"') ||
  !crmSegmentsSource.includes('label: "Компьютерные клубы"') ||
  crmSegmentsSource.includes('direction_code: "digital_orders"') ||
  !queriesSource.includes("FROM crm_segments") ||
  !typesSource.includes("crmSegments: CrmSegment[]") ||
  !crmDashboardSource.includes("data.crmSegments") ||
  crmDashboardSource.includes("const segmentLabels") ||
  crmDashboardSource.includes("const segmentLaunchFormatByCode") ||
  crmDashboardSource.includes("companySegmentMenuGroups") ||
  queriesSource.includes("const segmentLabels")
) {
  throw new Error("CRM segment filters must be sourced from crm_segments and must not keep local segment dictionaries")
}
if (
  !crmDashboardSource.includes('["Компьютерные клубы", ["computer_club"]]') ||
  crmDashboardSource.includes('["Цифровые заказы", ["telegram_order"]]') ||
  crmDashboardSource.includes('["Telegram-заказ", ["telegram_order"]]')
) {
  throw new Error("CRM segment aliases must include computer clubs and exclude digital orders as a sales segment")
}
if (
  !crmDashboardSource.includes('const allCrmSegmentsLabel = "Все сегменты"') ||
  !crmDashboardSource.includes("allSegmentLabel = allCrmSegmentsLabel") ||
  !/selectedCompanySegmentGroup\?\.label\s*\?\?\s*allCrmSegmentsLabel/.test(crmDashboardSource) ||
  crmDashboardSource.includes("все сегменты Lunch Up")
) {
  throw new Error("Pipeline and About tabs must use the same visible label for all CRM segments")
}
if (
  !crmDashboardSource.includes("clientCatalogCrmSegmentHref(catalogSegment)") ||
  !crmDashboardSource.includes("Админ-каталог") ||
  !crmDashboardSource.includes('internalHref("/admin-catalog.html", accessKey)') ||
  crmDashboardSource.includes("encodeURIComponent(selectedCatalogLaunchFormat)") ||
  !clientCatalogDataSource.includes("slug: segment.code") ||
  !clientCatalogDataSource.includes("return `/catalog?segment=${encodeURIComponent(segment)}`")
) {
  throw new Error("CRM and client catalog segment links must use the SQLite crm_segments.code value as the shared segment URL key")
}
const pipelineTabStart = crmDashboardSource.indexOf('<TabsContent value="pipeline">')
const pipelineTabEnd = crmDashboardSource.indexOf('<TabsContent value="accounts">')
const pipelineTabSource = pipelineTabStart >= 0 && pipelineTabEnd > pipelineTabStart ? crmDashboardSource.slice(pipelineTabStart, pipelineTabEnd) : ""
if (
  !pipelineTabSource.includes("<CrmSegmentFilterControls") ||
  !pipelineTabSource.includes('id="pipeline"') ||
  pipelineTabSource.includes("JTBD") ||
  pipelineTabSource.includes("getSegmentSuffix")
) {
  throw new Error("Pipeline tab must use the shared two-level CRM segment filter without visible JTBD suffixes")
}
const scriptTabStart = crmDashboardSource.indexOf('<TabsContent value="script">')
const scriptTabEnd = crmDashboardSource.indexOf('<TabsContent value="objections">')
const scriptTabSource = scriptTabStart >= 0 && scriptTabEnd > scriptTabStart ? crmDashboardSource.slice(scriptTabStart, scriptTabEnd) : ""
if (
  !scriptTabSource.includes("<CrmSegmentFilterControls") ||
  !scriptTabSource.includes('id="script"') ||
  scriptTabSource.includes("JTBD") ||
  scriptTabSource.includes("getSegmentSuffix")
) {
  throw new Error("Script tab must use the shared two-level CRM segment filter without visible JTBD suffixes")
}
const launchTabStart = crmDashboardSource.indexOf('<TabsContent value="launch">')
const launchTabEnd = crmDashboardSource.indexOf('<TabsContent value="about">')
const launchTabSource = launchTabStart >= 0 && launchTabEnd > launchTabStart ? crmDashboardSource.slice(launchTabStart, launchTabEnd) : ""
if (
  !crmDashboardSource.includes("function launchCatalogShortName") ||
  !crmDashboardSource.includes("function launchCatalogGeneralScope") ||
  !crmDashboardSource.includes("function segmentLaunchGeneralScope") ||
  !launchTabSource.includes("data-launch-matrix-cards") ||
  !launchTabSource.includes("data-launch-catalog-short-name") ||
  !launchTabSource.includes("data-launch-segment-general-scope") ||
  !launchTabSource.includes("launchCatalogShortName(item)") ||
  !launchTabSource.includes("segmentLaunchGeneralScope(item)") ||
  launchTabSource.includes('<TableHead>Перечень из каталога</TableHead>') ||
  launchTabSource.includes("min-w-[420px]") ||
  launchTabSource.includes("<b>Завтраки:</b>") ||
  launchTabSource.includes("[item.breakfasts, item.salads, item.sandwiches, item.desserts].filter(Boolean).join")
) {
  throw new Error("Launch matrix tab must use responsive cards and short segment-launch catalog labels without full SKU lists or horizontal-scroll widths")
}
for (const [name, source] of [
  ["agent manifest", agentManifestSource],
  ["README", readmeSource],
  ["AI agent infrastructure", aiInfrastructureSource]
]) {
  if (!source.includes("Apify Store") || !source.includes("APIFY_TOKEN")) {
    throw new Error(`${name} must document the Apify Store agent integration and APIFY_TOKEN handling`)
  }
}
if (!agentManifestSource.includes("external_integrations") || !agentManifestSource.includes("GitHub OAuth") || !agentManifestSource.includes("2GIS Places API")) {
  throw new Error("Agent manifest must expose Apify Store and 2GIS as external integrations")
}
for (const [name, source] of [
  ["agent manifest", agentManifestSource],
  ["CRM dashboard", crmDashboardSource],
  ["README", readmeSource],
  ["AI agent infrastructure", aiInfrastructureSource],
  ["CRM data collection rules", crmDataRulesSource]
]) {
  const normalizedSource = source.toLowerCase()
  if (
    !normalizedSource.includes("one source of truth") ||
    !source.includes("Каталог Lunch Up") ||
    !source.includes("единой точкой истины")
  ) {
    throw new Error(`${name} must document the catalog as one source of truth for AI agents`)
  }
}
if (
  !apifyResearchSource.includes("runApifyCompanyResearch") ||
  !apifyResearchSource.includes("APIFY_TOKEN") ||
  !apifyResearchSource.includes("APIFY_DEFAULT_RESEARCH_ACTOR_ID") ||
  !apifyResearchSource.includes("dry_run") ||
  !apifyResearchSource.includes("confirm_run") ||
  !apifyResearchSource.includes("apify_actor_research") ||
  !apifyResearchSource.includes("apify_actor_result_review") ||
  !agentManifestSource.includes("run_apify_company_research") ||
  !mcpManifestSource.includes("run_apify_company_research") ||
  !readmeSource.includes("POST /api/integrations/apify/research") ||
  !aiInfrastructureSource.includes("POST /api/integrations/apify/research") ||
  !crmDashboardSource.includes("POST /api/integrations/apify/research")
) {
  throw new Error("Apify company research must expose a protected dry-run-first actor endpoint, manifests, docs and audit/task flow")
}
if (
  !dgisLeadSearchSource.includes("searchDgisLeadCandidates") ||
  !dgisLeadSearchSource.includes("DGIS_API_KEY") ||
  !dgisLeadSearchSource.includes("DGIS_API_BASE_URL") ||
  !dgisLeadSearchSource.includes("confirm_import") ||
  !dgisLeadSearchSource.includes("createOrUpdateCompanyLead") ||
  !dgisLeadSearchSource.includes("suggested_payload") ||
  !dgisLeadSearchRouteSource.includes("searchDgisLeadCandidates") ||
  !companyEnrichmentSmokeSource.includes("/api/integrations/2gis/search") ||
  !companyEnrichmentSmokeSource.includes("2GIS lead search dry-run") ||
  !companyEnrichmentSmokeSource.includes("confirm_import") ||
  !mcpManifestSource.includes("search_2gis_lead_candidates") ||
  !agentManifestSource.includes("search_2gis_lead_candidates") ||
  !readmeSource.includes("POST /api/integrations/2gis/search") ||
  !aiInfrastructureSource.includes("POST /api/integrations/2gis/search") ||
  !crmDashboardSource.includes("POST /api/integrations/2gis/search") ||
  !crmDashboardSource.includes("Поиск 2ГИС") ||
  !crmDashboardSource.includes("searchDgisLeadCandidates") ||
  !crmDashboardSource.includes("importDgisCandidate") ||
  !crmDashboardSource.includes("useDgisCandidate")
) {
  throw new Error("2GIS lead search must expose protected dry-run-first candidate search, confirmed import, manifests, docs, UI and smoke coverage")
}
const agentSwarmManifest = JSON.parse(agentSwarmManifestSource)
const swarmDgisDemoLimits = agentSwarmManifest.external_integrations?.places?.demo_key_limits
if (
  !swarmDgisDemoLimits ||
  swarmDgisDemoLimits.search_apis?.per_minute_requests_stop !== 600 ||
  swarmDgisDemoLimits.search_apis?.per_month_requests_block !== 1000 ||
  swarmDgisDemoLimits.navigation_apis?.distance_matrix?.per_day_objects_stop !== 7000 ||
  !Array.isArray(swarmDgisDemoLimits.agent_policy) ||
  !swarmDgisDemoLimits.agent_policy.some((rule) => String(rule).includes("10 companies or candidates")) ||
  !swarmDgisDemoLimits.agent_policy.some((rule) => String(rule).includes("Do not bypass 429/403/monthly block"))
) {
  throw new Error("Agent swarm manifest must expose hard 2GIS demo key quota guardrails")
}
for (const [name, source] of [
  ["2GIS demo key limits", dgisDemoKeyLimitsSource],
  ["README", readmeSource],
  ["AI agent infrastructure", aiInfrastructureSource],
  ["agent handoff", agentHandoffSource],
  ["CRM data collection rules", crmDataRulesSource]
]) {
  if (
    !source.includes("docs/2GIS_DEMO_KEY_LIMITS.md") ||
    !source.includes("10") ||
    !source.includes("429/403") ||
    !source.includes("demo key")
  ) {
    throw new Error(`${name} must document 2GIS demo key limits for AI agents`)
  }
}
if (
  !dgisDemoKeyLimitsSource.includes("600 запросов в минуту") ||
  !dgisDemoKeyLimitsSource.includes("1000 запросов в месяц") ||
  !dgisDemoKeyLimitsSource.includes("Distance Matrix API") ||
  !dgisDemoKeyLimitsSource.includes("7000 объектов в день") ||
  !dgisDemoKeyLimitsSource.includes("Не обходить блокировку созданием новых demo keys") ||
  !agentManifestSource.includes("demo_key_limits") ||
  !agentManifestSource.includes("не больше 10 компаний или кандидатов 2GIS") ||
  !mcpManifestSource.includes("dgis_demo_key_limits") ||
  !mcpManifestSource.includes("At most 10 CRM companies or 10 2GIS candidates per agent run") ||
  !mcpManifestSource.includes("Do not bypass 429/403/monthly block") ||
  !companyEnrichmentRefreshSource.includes("Math.min(10, Math.round(parsed))") ||
  !dgisLeadSearchSource.includes("Math.min(10, Math.round(parsed))") ||
  !crmDashboardSource.includes("const bulkEnrichmentLimit = 10")
) {
  throw new Error("2GIS demo key quota guardrails must be documented, machine-readable and enforced by CRM limits")
}
if (!activeStrategySource.includes("lunch_up_spb_lo_20260604") || !activeStrategySource.includes("Ленинградская область")) {
  throw new Error("Active strategy must point at the SPB+LO package and geography")
}
if (!miniappSource.includes("TelegramMiniappOrder") || !miniappComponentSource.includes("/api/miniapp/orders")) {
  throw new Error("Miniapp route must render the order Mini App with checkout API")
}
if (
  !miniappOrderSmokeSource.includes("LUNCH_UP_CRM_DB_PATH") ||
  !miniappOrderSmokeSource.includes("MINIAPP_DEMO_MODE") ||
  !miniappOrderSmokeSource.includes("/api/miniapp/orders") ||
  !miniappOrderSmokeSource.includes("/api/miniapp/catalog") ||
  !miniappOrderSmokeSource.includes("order_items") ||
  !miniappOrderSmokeSource.includes("proposal guidance") ||
  !miniappOrderSmokeSource.includes("Для КП используем диапазон") ||
  !miniappOrderSmokeSource.includes("no-write/temp-db/temp-server") ||
  !readmeSource.includes("npm run miniapp:order-smoke") ||
  !aiInfrastructureSource.includes("miniapp:order-smoke")
) {
  throw new Error("Mini App checkout must have a no-write temporary-db smoke test for catalog, basket, orders and order_items")
}
if (
  !companyEnrichmentSmokeSource.includes("LUNCH_UP_CRM_DB_PATH") ||
  !companyEnrichmentSmokeSource.includes("DGIS_API_BASE_URL") ||
  !companyEnrichmentSmokeSource.includes("DADATA_API_BASE_URL") ||
  !companyEnrichmentSmokeSource.includes("/api/companies") ||
  !companyEnrichmentSmokeSource.includes("/api/companies/enrichment/bulk") ||
  !companyEnrichmentSmokeSource.includes("dry_run") ||
  !companyEnrichmentSmokeSource.includes("Bulk enrichment dry-run") ||
  !companyEnrichmentSmokeSource.includes("Bulk enrichment cache run") ||
  !companyEnrichmentSmokeSource.includes("mock-2gis-dadata") ||
  !companyEnrichmentSmokeSource.includes("employee_count_fns") ||
  !companyEnrichmentSmokeSource.includes("employee_count_2gis") ||
  !companyEnrichmentSmokeSource.includes("employee_count_website") ||
  !companyEnrichmentSmokeSource.includes("headcount_evidence") ||
  !companyEnrichmentSmokeSource.includes("company_enrichment_profiles") ||
  !companyEnrichmentSmokeSource.includes("company_enrichment_sources") ||
  !companyEnrichmentSmokeSource.includes("proposal_summary") ||
  !companyEnrichmentSmokeSource.includes("no-write/temp-db/temp-server/mock-2gis-dadata") ||
  !readmeSource.includes("npm run company:enrichment-smoke") ||
  !aiInfrastructureSource.includes("company:enrichment-smoke")
) {
  throw new Error("Company enrichment must have a no-write temporary-db mock 2GIS/DaData/website smoke test")
}
if (
  !miniappAuthSmokeSource.includes("createHmac") ||
  !miniappAuthSmokeSource.includes("WebAppData") ||
  !miniappAuthSmokeSource.includes("TELEGRAM_BOT_TOKEN") ||
  !miniappAuthSmokeSource.includes("TELEGRAM_OUTBOUND_DISABLED") ||
  !miniappAuthSmokeSource.includes("MINIAPP_DEMO_MODE") ||
  !miniappAuthSmokeSource.includes("/api/miniapp/session") ||
  !miniappAuthSmokeSource.includes("/api/miniapp/orders") ||
  !miniappAuthSmokeSource.includes("/api/miniapp/orders/history") ||
  !miniappAuthSmokeSource.includes("Returning Mini App session must hydrate company from CRM") ||
  !miniappAuthSmokeSource.includes("miniapp_customer_profiles") ||
  !miniappAuthSmokeSource.includes("CUSTOMER_PORTAL_SHARED_ACCESS_CODE") ||
  !miniappAuthSmokeSource.includes("Email session without access code must be blocked") ||
  !miniappAuthSmokeSource.includes("Email portal session must use email auth mode") ||
  !miniappAuthSmokeSource.includes("Email portal history must include company order created through messenger auth") ||
  !miniappAuthSmokeSource.includes("customer_identities") ||
  !miniappAuthSmokeSource.includes("inventory_movements") ||
  !miniappAuthSmokeSource.includes("sales_demand_update") ||
  !miniappAuthSmokeSource.includes("invalid initData") ||
  !miniappAuthSmokeSource.includes("signed-initData") ||
  !miniappAuthSmokeSource.includes("local-demo-%") ||
  !readmeSource.includes("npm run miniapp:auth-smoke") ||
  !aiInfrastructureSource.includes("miniapp:auth-smoke")
) {
  throw new Error("Mini App must have a no-write signed initData auth smoke test without demo mode")
}
if (
  !miniappEnrichmentSmokeSource.includes("createHmac") ||
  !miniappEnrichmentSmokeSource.includes("WebAppData") ||
  !miniappEnrichmentSmokeSource.includes("TELEGRAM_BOT_TOKEN") ||
  !miniappEnrichmentSmokeSource.includes("DGIS_API_BASE_URL") ||
  !miniappEnrichmentSmokeSource.includes("DADATA_API_BASE_URL") ||
  !miniappEnrichmentSmokeSource.includes("/api/miniapp/enrichment") ||
  !miniappEnrichmentSmokeSource.includes("/api/miniapp/session") ||
  !miniappEnrichmentSmokeSource.includes("without initData must be blocked") ||
  !miniappEnrichmentSmokeSource.includes("mock-2gis-dadata") ||
  !miniappEnrichmentSmokeSource.includes("employee_count_fns") ||
  !miniappEnrichmentSmokeSource.includes("employee_count_2gis") ||
  !miniappEnrichmentSmokeSource.includes("employee_count_website") ||
  !miniappEnrichmentSmokeSource.includes("headcount_evidence") ||
  !miniappEnrichmentSmokeSource.includes("miniapp_customer_profiles") ||
  !miniappEnrichmentSmokeSource.includes("company_enrichment_sources") ||
  !miniappEnrichmentSmokeSource.includes("Enrichment preview must not create a company before session save") ||
  !miniappEnrichmentSmokeSource.includes("no-write/temp-db/temp-server/signed-initData/mock-2gis-dadata") ||
  !readmeSource.includes("npm run miniapp:enrichment-smoke") ||
  !aiInfrastructureSource.includes("miniapp:enrichment-smoke")
) {
  throw new Error("Mini App enrichment must have a no-write signed initData mock 2GIS/DaData smoke test")
}
if (
  !telegramWebhookPostSmokeSource.includes("LUNCH_UP_CRM_DB_PATH") ||
  !telegramWebhookPostSmokeSource.includes("TELEGRAM_WEBHOOK_SECRET") ||
  !telegramWebhookPostSmokeSource.includes("/api/telegram/webhook") ||
  !telegramWebhookPostSmokeSource.includes("miniapp_intent") ||
  !telegramWebhookPostSmokeSource.includes("telegram_events") ||
  !telegramWebhookPostSmokeSource.includes("bot_customers") ||
  !telegramWebhookPostSmokeSource.includes("ai_tasks") ||
  !telegramWebhookPostSmokeSource.includes("orders") ||
  !telegramWebhookPostSmokeSource.includes("no-write/temp-db/temp-server") ||
  !readmeSource.includes("npm run telegram:webhook-post-smoke") ||
  !aiInfrastructureSource.includes("telegram:webhook-post-smoke")
) {
  throw new Error("Telegram webhook POST flow must have a no-write temporary-db smoke test for Telegram commands, CRM events and ai_tasks")
}
if (
  !launchGuideSmokeSource.includes("/api/integrations/launch-guide") ||
  !launchGuideSmokeSource.includes("operator_handoff") ||
  !launchGuideSmokeSource.includes("botfather") ||
  !launchGuideSmokeSource.includes("miniapp_setup") ||
  !launchGuideSmokeSource.includes("/newapp") ||
  !launchGuideSmokeSource.includes("named_startapp_url") ||
  !launchGuideSmokeSource.includes("fallback_startapp_url") ||
  !launchGuideSmokeSource.includes("BotFather Mini App setup") ||
  !launchGuideSmokeSource.includes("open_url") ||
  !launchGuideSmokeSource.includes("bot_url_hint") ||
  !launchGuideSmokeSource.includes("telegram_entrypoints") ||
  !launchGuideSmokeSource.includes("share_links") ||
  !launchGuideSmokeSource.includes("success_criteria") ||
  !launchGuideSmokeSource.includes("TELEGRAM_BOT_TOKEN") ||
  !launchGuideSmokeSource.includes("DGIS_API_KEY") ||
  !launchGuideSmokeSource.includes("DADATA_API_KEY") ||
  !launchGuideSmokeSource.includes("secret-redaction") ||
  !launchGuideSmokeSource.includes("must not expose secret value") ||
  !readmeSource.includes("npm run launch-guide:smoke") ||
  !readmeSource.includes("miniapp_setup") ||
  !aiInfrastructureSource.includes("launch-guide:smoke") ||
  !aiInfrastructureSource.includes("miniapp_setup")
) {
  throw new Error("Integration launch guide must have a no-write smoke test for operator_handoff and secret redaction")
}
if (
  !integrationPreflightMockSmokeSource.includes("/api/integrations/preflight") ||
  !integrationPreflightMockSmokeSource.includes("DGIS_API_BASE_URL") ||
  !integrationPreflightMockSmokeSource.includes("DADATA_API_BASE_URL") ||
  !integrationPreflightMockSmokeSource.includes("TELEGRAM_WEBHOOK_SECRET") ||
  !integrationPreflightMockSmokeSource.includes("TELEGRAM_BOT_TOKEN") ||
  !integrationPreflightMockSmokeSource.includes("telegram_webhook_public_access") ||
  !integrationPreflightMockSmokeSource.includes("miniapp_public") ||
  !integrationPreflightMockSmokeSource.includes("miniapp_catalog") ||
  !integrationPreflightMockSmokeSource.includes("dgis") ||
  !integrationPreflightMockSmokeSource.includes("dadata") ||
  !integrationPreflightMockSmokeSource.includes("telegram_bot") ||
  !integrationPreflightMockSmokeSource.includes("must not expose secret value") ||
  !integrationPreflightMockSmokeSource.includes("no-write/temp-server/mock-2gis-dadata") ||
  !readmeSource.includes("npm run integration:preflight-mock-smoke") ||
  !aiInfrastructureSource.includes("integration:preflight-mock-smoke")
) {
  throw new Error("Integration preflight must have a no-write mock 2GIS/DaData smoke test for launch diagnostics")
}
for (const requiredMiniappText of ["ShoppingCart", "Кабинет клиента", "Email-вход", "CRM и AI", "Поставить AI-задачу", "/api/miniapp/agent", "authEmailValue", "2ГИС/ФНС", "Последние заказы", "Повторить заказ", "MainButton", "BackButton", "enableClosingConfirmation", "disableClosingConfirmation", "initData", "localStorage", "Черновик", "Дата заказа", "Дата доставки", "Дата оплаты", "Комментарий к заказу", "delivery_date", "payment_date", "Добрать минимум", "topUpSuggestions", "Стартовый заказ", "launchBasketSuggestions", "tg_view", "tg_intent", "miniappViewFromIntent", "Что предложить", "sourceStatusLabel", "employeeCountRows", "Источники численности", "proposal_summary", "headcount_source", "manager_next_step"]) {
  if (!miniappComponentSource.includes(requiredMiniappText)) {
    throw new Error(`Miniapp order UI is missing ${requiredMiniappText}`)
  }
}
if (!readmeSource.includes("native BackButton") || !readmeSource.includes("closing confirmation")) {
  throw new Error("README must document native Telegram BackButton and closing confirmation behavior")
}
if (!aiInfrastructureSource.includes("BackButton") || !aiInfrastructureSource.includes("enableClosingConfirmation")) {
  throw new Error("AI infrastructure docs must document native Telegram WebApp controls")
}
if (!miniappComponentSource.includes("mergeSavedProfile") || !miniappComponentSource.includes("payload.profile")) {
  throw new Error("Miniapp order UI must hydrate empty cabinet fields from the saved CRM profile")
}
if (!miniappComponentSource.includes("email, accessCode") || !miniappComponentSource.includes('setSessionStatus("Email-вход доступен")')) {
  throw new Error("Miniapp order UI must support browser email auth before calling the session API")
}
for (const requiredMiniappOrderStatusText of ["orderStatusMeta", "На проверке", "Подтвержден", "В доставке", "Комментарий менеджера"]) {
  if (!miniappComponentSource.includes(requiredMiniappOrderStatusText)) {
    throw new Error(`Miniapp order history is missing customer-facing status text: ${requiredMiniappOrderStatusText}`)
  }
}
if (!miniappComponentSource.includes("await syncSession(nextProfile)") || !miniappComponentSource.includes("Данные компании обновлены и сохранены в CRM")) {
  throw new Error("Miniapp enrichment must immediately persist the enriched company profile to CRM")
}
if (!miniappAuthSource.includes("WebAppData") || !miniappAuthSource.includes("timingSafeEqual")) {
  throw new Error("Miniapp auth must validate Telegram initData hash server-side")
}
if (
  !botOrdersSource.includes("validateDelivery") ||
  !botOrdersSource.includes("delivery_date is required for delivery") ||
  !botOrdersSource.includes("delivery_date must be on or after") ||
  !botOrdersSource.includes("payment_date must use YYYY-MM-DD") ||
  !botOrdersSource.includes("order_cutoff_time")
) {
  throw new Error("Bot orders must validate delivery address/date and order cutoff server-side")
}
if (
  !adminCatalogHtmlSource.includes("Administrator web-каталог") ||
  !adminCatalogHtmlSource.includes("admin-catalog.js") ||
  !adminCatalogHtmlSource.includes("data-preserve-key") ||
  !adminCatalogHtmlSource.includes("Дата заказа") ||
  !adminCatalogHtmlSource.includes("Дата доставки") ||
  !adminCatalogHtmlSource.includes("Дата оплаты") ||
  !adminCatalogStaticSource.includes("admin-catalog-data.json") ||
  !adminCatalogStaticSource.includes("payment_date") ||
  !adminCatalogStaticSource.includes("Заказов пока нет") ||
  !adminCatalogExportSource.includes("admin-catalog-data.json") ||
  !adminCatalogExportSource.includes("payment_date") ||
  !adminCatalogExportSource.includes("copyDbSnapshot") ||
  !packageSource.includes("\"admin:catalog-export\"") ||
  !adminCatalogDataSource.includes("getAdminCatalogData") ||
  !adminCatalogDataSource.includes("payment_date") ||
  !adminCatalogDataSource.includes("items_summary")
) {
  throw new Error("Administrator web catalog must expose clients, orders, dates and item summaries")
}
if (!miniappAuthSource.includes("MINIAPP_DEMO_MODE") || miniappAuthSource.includes("const allowLocalDemo = !botToken")) {
  throw new Error("Miniapp local demo mode must require explicit MINIAPP_DEMO_MODE")
}
if (!telegramBotSource.includes("TELEGRAM_OUTBOUND_DISABLED") || !readmeSource.includes("TELEGRAM_OUTBOUND_DISABLED=1") || !aiInfrastructureSource.includes("TELEGRAM_OUTBOUND_DISABLED=1")) {
  throw new Error("Telegram outbound calls must support explicit QA disable switch for signed Mini App auth smoke tests")
}
if (!miniappServiceSource.includes("upsertMiniappSession") || !miniappServiceSource.includes("createMiniappOrder")) {
  throw new Error("Miniapp service must persist customer sessions and orders")
}
if (
  !miniappServiceSource.includes("miniapp_customer_profiles") ||
  !miniappServiceSource.includes("ensureMiniappCustomerProfileSchema") ||
  !miniappServiceSource.includes("upsertMiniappCustomerProfile") ||
  !miniappServiceSource.includes("getMiniappCustomerProfile") ||
  !miniappServiceSource.includes("profile: getMiniappCustomerProfile")
) {
  throw new Error("Miniapp service must persist and return a server-side customer profile for the cabinet")
}
if (!miniappServiceSource.includes("exportOrderToExternalWebhook")) {
  throw new Error("Miniapp orders must attempt external webhook export through the integration layer")
}
if (
  !miniappServiceSource.includes("MiniappOrderHistory") ||
  !miniappServiceSource.includes("getMiniappOrderHistory") ||
  !miniappServiceSource.includes("sendManagerOrderNotification") ||
  !miniappServiceSource.includes("sendCustomerOrderStatusMessage") ||
  !miniappServiceSource.includes("customer_order_confirmation") ||
  !miniappServiceSource.includes("getOrderItemPreview")
) {
  throw new Error("Miniapp service must expose order history, customer confirmations and detailed manager notifications")
}
if (
  !queriesSource.includes("order_items oi") ||
  !queriesSource.includes("ordersWithItems") ||
  !queriesSource.includes("item_count") ||
  !typesSource.includes("type OrderItem") ||
  !crmDashboardSource.includes("order.items.slice") ||
  !crmDashboardSource.includes("шт. /") ||
  !readmeSource.includes("первые SKU из `order_items`") ||
  !aiInfrastructureSource.includes("order_items` SKU preview")
) {
  throw new Error("CRM order queue must expose order_items details for manager review")
}
if (
  !companyEnrichmentSource.includes("DGIS_API_KEY") ||
  !companyEnrichmentSource.includes("DADATA_API_KEY") ||
  !companyEnrichmentSource.includes("DGIS_API_BASE_URL") ||
  !companyEnrichmentSource.includes("DADATA_API_BASE_URL") ||
  !companyEnrichmentSource.includes("https://catalog.api.2gis.com/3.0/items") ||
  !companyEnrichmentSource.includes("https://suggestions.dadata.ru") ||
  !companyEnrichmentSource.includes("employee_count") ||
  !companyEnrichmentSource.includes("employee_count_website") ||
  !companyEnrichmentSource.includes("fetchWebsite") ||
  !companyEnrichmentSource.includes("office_people") ||
  !companyEnrichmentSource.includes("CommercialProposalGuidance") ||
  !companyEnrichmentSource.includes("HeadcountEvidence") ||
  !companyEnrichmentSource.includes("buildHeadcountEvidence") ||
  !companyEnrichmentSource.includes("headcount_evidence") ||
  !companyEnrichmentSource.includes("buildCommercialProposalGuidance") ||
  !companyEnrichmentSource.includes("headcount_source") ||
  !companyEnrichmentSource.includes("what_to_offer") ||
  !companyEnrichmentSource.includes("proposal_summary") ||
  !companyEnrichmentSource.includes("manager_next_step") ||
  !companyEnrichmentSource.includes("recommended_portions") ||
  !readmeSource.includes("сайт компании") ||
  !readmeSource.includes("`headcount_evidence`") ||
  !readmeSource.includes("источники численности показываются") ||
  !readmeSource.includes("DGIS_API_BASE_URL") ||
  !readmeSource.includes("DADATA_API_BASE_URL") ||
  !readmeSource.includes("Ответ enrichment также содержит `proposal`") ||
  !crmDashboardSource.includes("Источники численности для КП") ||
  !crmDashboardSource.includes("leadHeadcountEvidenceRows") ||
  !agentManifestSource.includes("headcount_evidence") ||
  !mcpManifestSource.includes("headcount_evidence") ||
  !aiInfrastructureSource.includes("DGIS_API_BASE_URL") ||
  !aiInfrastructureSource.includes("DADATA_API_BASE_URL") ||
  !aiInfrastructureSource.includes("headcount_evidence") ||
  !aiInfrastructureSource.includes("The enrichment response includes `proposal` guidance")
) {
  throw new Error("Company enrichment must include 2GIS, DaData/FNS, website open sources, office people estimate and proposal guidance")
}
if (
  !miniappServiceSource.includes("proposal.manager_next_step") ||
  !miniappServiceSource.includes("proposal.what_to_offer") ||
  !miniappServiceSource.includes("proposalInstruction") ||
  !miniappServiceSource.includes("instructions: [proposalInstruction") ||
  !readmeSource.includes("эти же формулировки сохраняются в заказе") ||
  !aiInfrastructureSource.includes("proposal guidance in `orders.instructions`")
) {
  throw new Error("Mini App order creation must persist enrichment proposal guidance into CRM order instructions")
}
if (
  !companyEnrichmentSource.includes("DEFAULT_ENRICHMENT_CACHE_TTL_HOURS") ||
  !companyEnrichmentSource.includes("readCachedCompanyEnrichment") ||
  !companyRefreshEnrichmentRouteSource.includes("force_refresh") ||
  !companyRefreshEnrichmentRouteSource.includes("cache_ttl_hours") ||
  !companyEnrichmentRefreshSource.includes("refreshCompanyEnrichmentById") ||
  !companyEnrichmentRefreshSource.includes("refreshCompanyEnrichmentBatch") ||
  !companyEnrichmentRefreshSource.includes("!dryRun && !cacheHit") ||
  !companyEnrichmentRefreshSource.includes("listCompanyEnrichmentBatchTargets") ||
  !companyBulkEnrichmentRouteSource.includes("refreshCompanyEnrichmentBatch") ||
  !companyBulkEnrichmentRouteSource.includes("CompanyEnrichmentBatchOptions") ||
  !crmDashboardSource.includes("cacheHits") ||
  !crmDashboardSource.includes("force_refresh: false") ||
  !mcpManifestSource.includes("bulk_refresh_company_enrichment") ||
  !agentManifestSource.includes("bulk_refresh_company_enrichment") ||
  !readmeSource.includes("/api/companies/enrichment/bulk") ||
  !readmeSource.includes("cache_ttl_hours") ||
  !aiInfrastructureSource.includes("/api/companies/enrichment/bulk") ||
  !aiInfrastructureSource.includes("cache_ttl_hours")
) {
  throw new Error("Company enrichment must support cached bulk refresh and forced single-company refresh")
}
if (
  !companyLeadIntakeSource.includes("createOrUpdateCompanyLead") ||
  !companyLeadIntakeSource.includes("dry_run") ||
  !companyLeadIntakeSource.includes("saveCompanyEnrichment") ||
  !companyLeadIntakeSource.includes("lead_intake_enrichment") ||
  !companyLeadIntakeSource.includes("estimateMonthlyRevenue") ||
  !agentManifestSource.includes("create_or_update_company_lead") ||
  !mcpManifestSource.includes("create_or_update_company_lead") ||
  !readmeSource.includes("POST /api/companies") ||
  !crmDashboardSource.includes("Новый лид и КП") ||
  !crmDashboardSource.includes("submitLeadIntake") ||
  !crmDashboardSource.includes("/api/companies") ||
  !crmDashboardSource.includes("dry_run")
) {
  throw new Error("Company lead intake must create/update leads with enrichment, CRM UI, dry-run preview, proposal math and agent/MCP contracts")
}
if (
  !companyLeadIntakeSource.includes("telegram_contact_status") ||
  !companyLeadIntakeSource.includes("agent_contact_policy") ||
  !dgisLeadSearchSource.includes("firstTelegramChannel") ||
  !dgisLeadSearchSource.includes("telegram_source_note") ||
  !queriesSource.includes("telegram_contact_status") ||
  !typesSource.includes("telegram_url") ||
  !crmDashboardSource.includes("Telegram/AI-канал") ||
  !crmDashboardSource.includes("telegramStatusLabel") ||
  !agentManifestSource.includes("company_telegram_channel_researcher") ||
  !mcpManifestSource.includes("telegram_contact_status") ||
  !aiInfrastructureSource.includes("Company Telegram And Agent Channels") ||
  !companyTelegramChannelsSource.includes("manual_review_required") ||
  !companyTelegramChannelsSource.includes("userbot") ||
  !companyTelegramChannelsSource.includes("2GIS")
) {
  throw new Error("Company Telegram/AI-channel layer must be schema-backed, visible in CRM, documented and guarded from unsafe userbot outreach")
}
if (
  !telegramBotSource.includes("web_app") ||
  !telegramBotSource.includes("sendMiniappEntryMessage") ||
  !telegramBotSource.includes("MiniappEntryIntent") ||
  !telegramBotSource.includes("applyMiniappIntentToUrl") ||
  !telegramWebhookSource.includes("resolveMiniappEntryIntent") ||
  !telegramWebhookSource.includes("miniapp_intent") ||
  !telegramIntentsSource.includes("telegramMiniappIntentSmokeCases") ||
  !telegramIntentsSource.includes("/^\\/orders\\b/") ||
  !telegramIntentsSource.includes("/^\\/(cart|checkout)\\b/") ||
  !telegramIntentsSource.includes("/^\\/(cabinet|profile)\\b/") ||
  !telegramIntentsSource.includes("tg_view") ||
  !telegramIntentsSource.includes("tg_intent") ||
  !telegramWebhookSmokeSource.includes("telegramMiniappIntentSmokeCases") ||
  !telegramWebhookSmokeSource.includes("tg_view=cart") ||
  !telegramWebhookSmokeSource.includes("tg_view=cabinet") ||
  !telegramWebhookSmokeSource.includes("no-database") ||
  !telegramBotSource.includes("sendManagerOrderNotification") ||
  !telegramBotSource.includes("sendCustomerOrderStatusMessage") ||
  !telegramBotSource.includes("Мои заказы и повтор") ||
  !telegramBotSource.includes("baseUrlFromMiniappUrl") ||
  !telegramBotSource.includes("public_crm_url.txt") ||
  !telegramBotSource.includes("sendTelegramHelpMessage") ||
  !telegramBotSource.includes("sendTelegramChatIdMessage") ||
  !telegramBotSource.includes("Корзина и оформление") ||
  !telegramBotSource.includes("Кабинет клиента") ||
  !telegramBotSource.includes("item_preview") ||
  !telegramBotSource.includes("Дата доставки")
) {
  throw new Error("Telegram bot helper must send Mini App entry buttons, route deep-link intents, expose smoke tests, help, chat id, detailed manager notifications and customer order status messages")
}
if (!telegramSetupSource.includes("whoami") || !telegramSetupSource.includes("help") || !telegramSetupSource.includes("cart") || !telegramSetupSource.includes("cabinet")) {
  throw new Error("Telegram setup script must register cart, cabinet, help and whoami commands")
}
if (!orderStatusSource.includes("updateOrderStatus") || !orderStatusSource.includes("order_status_updated")) {
  throw new Error("Order status service must update CRM orders and record Telegram status events")
}
if (!readmeSource.includes("Мои заказы и повтор") || !aiInfrastructureSource.includes("Mini App button back to order history")) {
  throw new Error("Customer order notifications must document the Mini App order-history return button")
}
if (
  !telegramSetupSource.includes("TELEGRAM_WEBHOOK_SECRET is required") ||
  !telegramSetupSource.includes("public_crm_url.txt") ||
  !telegramSetupSource.includes("loadLocalEnv") ||
  !telegramSetupSource.includes("--dry-run") ||
  !telegramSetupSource.includes("--json") ||
  !telegramSetupSource.includes("setupPayloads") ||
  !telegramSetupSource.includes("redactSecrets") ||
  !telegramSetupSource.includes("Dry-run does not call Telegram API") ||
  !telegramSetupSource.includes("[secret hidden]") ||
  !telegramSetupSource.includes("orders") ||
  !telegramSetupSource.includes("cart") ||
  !telegramSetupSource.includes("cabinet") ||
  !telegramSetupSource.includes("setMyDescription") ||
  !telegramSetupSource.includes("setMyShortDescription") ||
  !telegramSetupSource.includes("setChatMenuButton") ||
  !telegramSetupSource.includes("getWebhookInfo") ||
  !telegramSetupSource.includes("assertPublicMiniAppReady") ||
  !telegramSetupSource.includes("/api/miniapp/catalog") ||
  !telegramSetupSource.includes("--skip-url-preflight")
) {
  throw new Error("Telegram setup script must require webhook secret, reuse saved public CRM URL, support dry-run payload preview, verify public Mini App/catalog readiness, expose order history command and configure the bot profile")
}
if (
  !telegramSetupDryRunSmokeSource.includes("--dry-run") ||
  !telegramSetupDryRunSmokeSource.includes("--json") ||
  !telegramSetupDryRunSmokeSource.includes("--skip-url-preflight") ||
  !telegramSetupDryRunSmokeSource.includes("setWebhook") ||
  !telegramSetupDryRunSmokeSource.includes("setChatMenuButton") ||
  !telegramSetupDryRunSmokeSource.includes("setMyCommands") ||
  !telegramSetupDryRunSmokeSource.includes("/cart command") ||
  !telegramSetupDryRunSmokeSource.includes("/cabinet command") ||
  !telegramSetupDryRunSmokeSource.includes("[secret hidden]") ||
  !telegramSetupDryRunSmokeSource.includes("Setup dry-run output must not expose secret value") ||
  !readmeSource.includes("npm run telegram:setup-dry-run-smoke") ||
  !aiInfrastructureSource.includes("telegram:setup-dry-run-smoke")
) {
  throw new Error("Telegram setup dry-run must have a no-network payload smoke test and documentation")
}
if (
  !telegramSetupPreviewSource.includes("buildTelegramSetupPreview") ||
  !telegramSetupPreviewSource.includes("setWebhook") ||
  !telegramSetupPreviewSource.includes("setChatMenuButton") ||
  !telegramSetupPreviewSource.includes("setMyCommands") ||
  !telegramSetupPreviewSource.includes("[secret hidden]") ||
  !telegramSetupPreviewSource.includes("tg_intent=order") ||
  !telegramSetupPreviewSource.includes("tg_view=cart") ||
  !telegramSetupPreviewSource.includes("tg_intent=cabinet") ||
  !telegramSetupPreviewSource.includes("tg_view=cabinet") ||
  !telegramSetupPreviewSmokeSource.includes("/api/integrations/telegram/setup-preview") ||
  !telegramSetupPreviewSmokeSource.includes("without CRM key must be blocked") ||
  !telegramSetupPreviewSmokeSource.includes("setChatMenuButton") ||
  !telegramSetupPreviewSmokeSource.includes("/cart entrypoint") ||
  !telegramSetupPreviewSmokeSource.includes("/cabinet entrypoint") ||
  !telegramSetupPreviewSmokeSource.includes("Setup preview response must not expose secret value") ||
  !crmDashboardSource.includes("Server-side preview настройки Telegram") ||
  !crmDashboardSource.includes("refreshTelegramSetupPreview") ||
  !crmDashboardSource.includes("telegramSetupPreview.required.missing") ||
  !crmDashboardSource.includes("telegramSetupPreview.telegram_api") ||
  !crmDashboardSource.includes("telegramSetupPreview.telegram_entrypoints") ||
  !readmeSource.includes("npm run telegram:setup-preview-smoke") ||
  !readmeSource.includes("Server-side preview настройки Telegram") ||
  !aiInfrastructureSource.includes("telegram:setup-preview-smoke") ||
  !aiInfrastructureSource.includes("Server-side preview настройки Telegram")
) {
  throw new Error("Telegram setup preview API must expose protected redacted setup payloads with CRM UI, smoke coverage and docs")
}
if (
  !telegramEnvBootstrapSource.includes("randomBytes") ||
  !telegramEnvBootstrapSource.includes("telegram:env-bootstrap -- --write") ||
  !telegramEnvBootstrapSource.includes("Secret values are intentionally not printed") ||
  !telegramEnvBootstrapSource.includes("public_crm_url.txt") ||
  !telegramEnvBootstrapSource.includes("public_access_key.txt") ||
  !telegramEnvBootstrapSource.includes("--force") ||
  !integrationLaunchGuideSource.includes("env_bootstrap") ||
  !crmDashboardSource.includes("commands.env_bootstrap") ||
  !readmeSource.includes("npm run telegram:env-bootstrap") ||
  !aiInfrastructureSource.includes("telegram:env-bootstrap")
) {
  throw new Error("Telegram env bootstrap must support dry-run/write, saved public URL/access key reuse, hidden secrets, launch guide and docs")
}
if (
  !telegramLaunchCheckSource.includes("loadLocalEnv") ||
  !telegramLaunchCheckSource.includes("getMe") ||
  !telegramLaunchCheckSource.includes("getWebhookInfo") ||
  !telegramLaunchCheckSource.includes("Secret values are intentionally not printed") ||
  !telegramLaunchCheckSource.includes("TELEGRAM_BOT_TOKEN") ||
  !telegramLaunchCheckSource.includes("TELEGRAM_BOT_SUGGESTED_USERNAME") ||
  !telegramLaunchCheckSource.includes("TELEGRAM_MINIAPP_SHORT_NAME") ||
  !telegramLaunchCheckSource.includes("DGIS_API_KEY") ||
  !telegramLaunchCheckSource.includes("APIFY_DEFAULT_RESEARCH_ACTOR_ID") ||
  !telegramLaunchCheckSource.includes("--strict") ||
  !telegramLaunchCheckSource.includes("botfather") ||
  !telegramLaunchCheckSource.includes("https://t.me/BotFather") ||
  !telegramLaunchCheckSource.includes("bot_url_hint") ||
  !telegramLaunchCheckSource.includes("telegramStartappUrl") ||
  !telegramLaunchCheckSource.includes("startapp_url") ||
  !telegramLaunchCheckSource.includes("telegram_entrypoints") ||
  !telegramLaunchCheckSource.includes("tg_intent=order") ||
  !telegramLaunchCheckSource.includes("tg_view=cart") ||
  !telegramLaunchCheckSource.includes("tg_intent=cabinet") ||
  !telegramLaunchCheckSource.includes("tg_view=cabinet") ||
  !telegramLaunchCheckSource.includes("Telegram entrypoints")
) {
  throw new Error("Telegram launch check must safely validate env, Telegram API, BotFather handoff, Mini App entrypoints and enrichment readiness without printing secrets")
}
if (
  !telegramLaunchCheckSmokeSource.includes("--json") ||
  !telegramLaunchCheckSmokeSource.includes("--no-network") ||
  !telegramLaunchCheckSmokeSource.includes("TELEGRAM_BOT_SUGGESTED_USERNAME") ||
  !telegramLaunchCheckSmokeSource.includes("TELEGRAM_MINIAPP_SHORT_NAME") ||
  !telegramLaunchCheckSmokeSource.includes("https://t.me/BotFather") ||
  !telegramLaunchCheckSmokeSource.includes("startapp=order") ||
  !telegramLaunchCheckSmokeSource.includes("startapp=cart") ||
  !telegramLaunchCheckSmokeSource.includes("telegram_entrypoints") ||
  !telegramLaunchCheckSmokeSource.includes("/cart Mini App entrypoint") ||
  !telegramLaunchCheckSmokeSource.includes("/cabinet Mini App entrypoint") ||
  !telegramLaunchCheckSmokeSource.includes("secret values: redacted") ||
  !telegramLaunchCheckSmokeSource.includes("Launch check output must not expose secret value") ||
  !readmeSource.includes("npm run telegram:launch-check-smoke") ||
  !aiInfrastructureSource.includes("telegram:launch-check-smoke")
) {
  throw new Error("Telegram launch check must have a no-network smoke test for operator handoff and secret redaction")
}
if (
  !telegramLaunchSource.includes("telegram-launch-check.mjs") ||
  !telegramLaunchSource.includes("setup-telegram-bot.mjs") ||
  !telegramLaunchSource.includes("/api/integrations/preflight") ||
  !telegramLaunchSource.includes("--dry-run") ||
  !telegramLaunchSource.includes("Step 2/4 preview: Telegram setup payloads") ||
  !telegramLaunchSource.includes("--skip-url-preflight") ||
  !telegramLaunchSource.includes("--no-network") ||
  !telegramLaunchSource.includes("Secret values are intentionally not printed") ||
  !integrationLaunchGuideSource.includes("launch_telegram_bot") ||
  !crmDashboardSource.includes("commands.launch_telegram_bot") ||
  !readmeSource.includes("npm run telegram:launch")
) {
  throw new Error("Telegram launch orchestrator must safely combine check, setup, protected preflight and operator documentation")
}
if (!externalIntegrationsSource.includes("EXTERNAL_ORDER_WEBHOOK_URL") || !externalIntegrationsSource.includes("integration_events")) {
  throw new Error("External integration layer must support outbound order webhook and audit events")
}
if (!externalIntegrationsSource.includes("public_crm_url.txt")) {
  throw new Error("Integration status must reuse saved public CRM URL when PUBLIC_BASE_URL is absent")
}
if (
  !integrationPreflightSource.includes("getWebhookInfo") ||
  !integrationPreflightSource.includes("checkTelegramWebhookPublicAccess") ||
  !integrationPreflightSource.includes("telegram_webhook_public_access") ||
  !integrationPreflightSource.includes("x-telegram-bot-api-secret-token") ||
  !integrationPreflightSource.includes("checkMiniappPublicRoutes") ||
  !integrationPreflightSource.includes("15000") ||
  !integrationPreflightSource.includes("_next\\/static") ||
  !integrationPreflightSource.includes("/api/miniapp/catalog") ||
  !integrationPreflightSource.includes("miniapp_public") ||
  !integrationPreflightSource.includes("miniapp_catalog") ||
  !integrationPreflightSource.includes("DGIS_API_KEY") ||
  !integrationPreflightSource.includes("DADATA_API_KEY") ||
  !integrationPreflightSource.includes("DGIS_API_BASE_URL") ||
  !integrationPreflightSource.includes("DADATA_API_BASE_URL") ||
  !integrationPreflightSource.includes("https://catalog.api.2gis.com/3.0/items") ||
  !integrationPreflightSource.includes("https://suggestions.dadata.ru") ||
  !integrationPreflightSource.includes("runIntegrationPreflight") ||
  !readmeSource.includes("фактическая доступность `/miniapp`") ||
  !readmeSource.includes("без CRM key") ||
  !readmeSource.includes("Для 2ГИС/DaData проверка использует `DGIS_API_BASE_URL`") ||
  !aiInfrastructureSource.includes("without CRM key") ||
  !aiInfrastructureSource.includes("2GIS/DaData checks use `DGIS_API_BASE_URL`") ||
  !aiInfrastructureSource.includes("public `/api/telegram/webhook`")
) {
  throw new Error("Integration preflight must check public Mini App/catalog, Telegram webhook, 2GIS and DaData readiness")
}
if (
  !integrationLaunchGuideSource.includes("buildIntegrationLaunchGuide") ||
  !integrationLaunchGuideSource.includes("TELEGRAM_BOT_TOKEN") ||
  !integrationLaunchGuideSource.includes("DGIS_API_KEY") ||
  !integrationLaunchGuideSource.includes("DADATA_API_KEY") ||
  !integrationLaunchGuideSource.includes("LaunchGuideOperatorHandoff") ||
  !integrationLaunchGuideSource.includes("LaunchGuideConnectionItem") ||
  !integrationLaunchGuideSource.includes("LaunchGuideShareAsset") ||
  !integrationLaunchGuideSource.includes("telegramShareUrl") ||
  !integrationLaunchGuideSource.includes("telegramStartappUrl") ||
  !integrationLaunchGuideSource.includes("TELEGRAM_MINIAPP_SHORT_NAME") ||
  !integrationLaunchGuideSource.includes("telegram_startapp_url") ||
  !integrationLaunchGuideSource.includes("qr_payload_url") ||
  !integrationLaunchGuideSource.includes("qr_image_url") ||
  !integrationLaunchGuideSource.includes("/api/integrations/share-qr") ||
  !integrationLaunchGuideSource.includes("operator_handoff") ||
  !integrationLaunchGuideSource.includes("botfather") ||
  !integrationLaunchGuideSource.includes("miniapp_setup") ||
  !integrationLaunchGuideSource.includes("/newapp") ||
  !integrationLaunchGuideSource.includes("named_startapp_url") ||
  !integrationLaunchGuideSource.includes("fallback_startapp_url") ||
  !integrationLaunchGuideSource.includes("TELEGRAM_MINIAPP_SHORT_NAME") ||
  !integrationLaunchGuideSource.includes("open_url") ||
  !integrationLaunchGuideSource.includes("bot_url_hint") ||
  !integrationLaunchGuideSource.includes("telegram_entrypoints") ||
  !integrationLaunchGuideSource.includes("tg_intent=order") ||
  !integrationLaunchGuideSource.includes("tg_view=cart") ||
  !integrationLaunchGuideSource.includes("tg_intent=cabinet") ||
  !integrationLaunchGuideSource.includes("tg_view=cabinet") ||
  !integrationLaunchGuideSource.includes("share_links") ||
  !integrationLaunchGuideSource.includes("share_assets") ||
  !integrationLaunchGuideSource.includes("env_template") ||
  !integrationLaunchGuideSource.includes("connection_checklist") ||
  !integrationLaunchGuideSource.includes("docs.2gis.com") ||
  !integrationLaunchGuideSource.includes("dadata.ru/api/suggest/party") ||
  !integrationLaunchGuideSource.includes("console.apify.com/store") ||
  !integrationLaunchGuideSource.includes("safe_handling") ||
  !integrationLaunchGuideSource.includes("crm_surface") ||
  !integrationLaunchGuideSource.includes("success_criteria") ||
  !integrationLaunchGuideSource.includes("handoff_note") ||
  !integrationLaunchGuideSource.includes("preview_telegram_setup") ||
  !launchGuideSmokeSource.includes("connection_checklist") ||
  !launchGuideSmokeSource.includes("2GIS official URL") ||
  !launchGuideSmokeSource.includes("DaData official URL") ||
  !launchGuideSmokeSource.includes("/cart Mini App entrypoint") ||
  !launchGuideSmokeSource.includes("/cabinet Mini App entrypoint") ||
  !launchGuideSmokeSource.includes("share_assets") ||
  !launchGuideSmokeSource.includes("telegram_startapp_url") ||
  !launchGuideSmokeSource.includes("miniappSetup") ||
  !launchGuideSmokeSource.includes("named_startapp_url") ||
  !launchGuideSmokeSource.includes("fallback_startapp_url") ||
  !launchGuideSmokeSource.includes("startapp=orders") ||
  !launchGuideSmokeSource.includes("Telegram share URL") ||
  !launchGuideSmokeSource.includes("QR payload") ||
  !launchGuideSmokeSource.includes("qr_image_url") ||
  !launchGuideSmokeSource.includes("image/svg+xml") ||
  !launchGuideSmokeSource.includes("QR SVG endpoint") ||
  !shareQrRouteSource.includes("QRCode.toString") ||
  !shareQrRouteSource.includes("image/svg+xml") ||
  !shareQrRouteSource.includes("safeQrValue") ||
  !proxySource.includes("/api/integrations/share-qr") ||
  !crmDashboardSource.includes("/api/integrations/launch-guide") ||
  !crmDashboardSource.includes("Пакет запуска бота") ||
  !crmDashboardSource.includes("Панель подключений") ||
  !crmDashboardSource.includes("connection_checklist") ||
  !crmDashboardSource.includes("Открыть официальный источник") ||
  !crmDashboardSource.includes("Кому какую ссылку") ||
  !crmDashboardSource.includes("Готовые ссылки для отправки") ||
  !crmDashboardSource.includes("telegram_startapp_url") ||
  !crmDashboardSource.includes("Mini App в BotFather") ||
  !crmDashboardSource.includes("miniapp_setup") ||
  !crmDashboardSource.includes("named_startapp_url") ||
  !crmDashboardSource.includes("fallback_startapp_url") ||
  !crmDashboardSource.includes("startapp:") ||
  !crmDashboardSource.includes("QR payload") ||
  !crmDashboardSource.includes("Открыть QR") ||
  !crmDashboardSource.includes("qr_image_url") ||
  !crmDashboardSource.includes("BotFather") ||
  !crmDashboardSource.includes("Команды клиента в Telegram") ||
  !crmDashboardSource.includes("bot_url_hint") ||
  !crmDashboardSource.includes("telegram_entrypoints") ||
  !crmDashboardSource.includes("Готовность запуска") ||
  !readmeSource.includes("`operator_handoff`") ||
  !readmeSource.includes("`connection_checklist`") ||
  !readmeSource.includes("`share_assets`") ||
  !readmeSource.includes("`Готовые ссылки для отправки`") ||
  !readmeSource.includes("`startapp`") ||
  !readmeSource.includes("TELEGRAM_MINIAPP_SHORT_NAME") ||
  !readmeSource.includes("`qr_image_url`") ||
  !readmeSource.includes("/api/integrations/share-qr") ||
  !readmeSource.includes("Панель подключений") ||
  !aiInfrastructureSource.includes("The `operator_handoff` block includes") ||
  !aiInfrastructureSource.includes("`connection_checklist`") ||
  !aiInfrastructureSource.includes("`share_assets`") ||
  !aiInfrastructureSource.includes("`startapp`") ||
  !aiInfrastructureSource.includes("TELEGRAM_MINIAPP_SHORT_NAME") ||
  !aiInfrastructureSource.includes("Telegram share URL") ||
  !aiInfrastructureSource.includes("`qr_image_url`") ||
  !aiInfrastructureSource.includes("/api/integrations/share-qr") ||
  !aiInfrastructureSource.includes("Панель подключений")
) {
  throw new Error("Integration launch guide must expose a safe operator handoff for Telegram, Mini App and enrichment setup")
}
if (
  !crmDashboardSource.includes('className="no-print shrink-0 rounded-md border bg-white p-2"') ||
  !crmDashboardSource.includes('className="no-print inline-flex items-center gap-1 text-primary hover:underline"') ||
  !crmDashboardSource.includes('className="no-print mt-2 break-all text-xs text-muted-foreground">QR payload')
) {
  throw new Error("CRM launch share QR image, QR link and QR payload must stay available on screen but hidden from print/PDF")
}
if (
  !crmDashboardSource.includes('className="no-print rounded-md border bg-background p-3"') ||
  !crmDashboardSource.includes('<div className="dense-label">GET /api/bot/catalog</div>') ||
  !crmDashboardSource.includes('className="no-print overflow-auto rounded-md bg-foreground')
) {
  throw new Error("CRM technical API reference and machine JSON examples must stay hidden from print/PDF")
}
if (
  !mcpManifestSource.includes("export_order_to_external_webhook") ||
  !mcpManifestSource.includes("enrich_company_for_proposal") ||
  !mcpManifestSource.includes("refresh_crm_company_enrichment") ||
  !mcpManifestSource.includes("bulk_refresh_company_enrichment") ||
  !mcpManifestSource.includes("/api/companies/enrichment/bulk") ||
  !mcpManifestSource.includes("search_2gis_lead_candidates") ||
  !mcpManifestSource.includes("/api/integrations/2gis/search") ||
  !mcpManifestSource.includes("run_apify_company_research") ||
  !mcpManifestSource.includes("run_integration_preflight") ||
  !mcpManifestSource.includes("read_integration_launch_guide") ||
  !mcpManifestSource.includes("preview_telegram_setup") ||
  !mcpManifestSource.includes("/api/integrations/telegram/setup-preview") ||
  !agentManifestSource.includes("read_integration_launch_guide") ||
  !agentManifestSource.includes("preview_telegram_setup") ||
  !agentManifestSource.includes("bulk_refresh_company_enrichment") ||
  !agentManifestSource.includes("search_2gis_lead_candidates") ||
  !mcpManifestSource.includes("read_miniapp_order_history") ||
  !mcpManifestSource.includes("update_order_status")
) {
  throw new Error("MCP manifest must expose Mini App enrichment, launch preflight and order export tools")
}
for (const [name, source] of [
  ["agent manifest", agentManifestSource],
  ["bot catalog", botCatalogSource]
]) {
  if (!source.includes("DEFAULT_STRATEGY_TOKEN") || !source.includes("active_strategy")) {
    throw new Error(`${name} must expose the active default strategy`)
  }
}
if (!clientCatalogDataSource.includes("lo_delivery_terms") || !botCatalogSource.includes("lo_delivery_terms")) {
  throw new Error("Catalog APIs must expose LO delivery terms separately from free SPB delivery")
}
if (!proxySource.includes('request.nextUrl.pathname === "/catalog"')) {
  throw new Error("Client catalog route must stay public for customer links")
}
if (!proxySource.includes('request.nextUrl.pathname === "/icon.svg"')) {
  throw new Error("App icon route must stay public so customer catalog links do not emit favicon 401 errors")
}
if (!proxySource.includes('request.nextUrl.pathname === "/miniapp"')) {
  throw new Error("Miniapp route must stay public for strategy links")
}
if (!proxySource.includes('request.nextUrl.pathname.startsWith("/api/miniapp/")')) {
  throw new Error("Miniapp APIs must be reachable by Telegram auth, without CRM access key")
}
if (
  !proxySource.includes('request.nextUrl.pathname === "/api/telegram/webhook"') ||
  !proxySource.includes("x-telegram-bot-api-secret-token") ||
  !proxySource.includes("telegramAuthorized") ||
  !telegramWebhookAccessSmokeSource.includes("TELEGRAM_WEBHOOK_SECRET") ||
  !telegramWebhookAccessSmokeSource.includes("wrong Telegram secret") ||
  !telegramWebhookAccessSmokeSource.includes("without CRM key") ||
  !telegramWebhookAccessSmokeSource.includes("no-write/temp-server")
) {
  throw new Error("Telegram webhook must be reachable without CRM key only through Telegram secret header")
}
const strategyPackageDirCandidates = [
  join(root, "docs", "strategy", "lunch_up_spb_lo_20260604"),
  join(root, "outputs", "lunch_up_spb_lo_20260604"),
  join(root, "..", "outputs", "lunch_up_spb_lo_20260604")
]
const strategyPackageDir = strategyPackageDirCandidates.find((dir) => existsSync(dir)) ?? strategyPackageDirCandidates[0]
for (const file of [
  "209498707_lunch_up_spb_lo_20260604.json",
  "lunch_up_spb_lo_manifest_20260604.json",
  "lunch_up_spb_lo_full_interview_20260604.md",
  "lunch_up_spb_lo_strategy_20260604.html"
]) {
  if (!existsSync(join(strategyPackageDir, file))) {
    throw new Error(`Missing SPB+LO strategy package file: ${file}`)
  }
}
if (!clientCatalogActionsSource.includes("Печать A4") || !clientCatalogDataSource.includes("selected_segment")) {
  throw new Error("Client catalog must support A4 printing and segment-specific rendering")
}
if (
  !clientCatalogSource.includes("client-catalog-print-brief") ||
  !clientCatalogSource.includes("Следующий шаг") ||
  !clientCatalogActionsSource.includes("@/components/ui/button") ||
  !globalCssSource.includes(".client-catalog-print-brief") ||
  !globalCssSource.includes("white-space: normal") ||
  clientCatalogActionsSource.includes("className=\"size-4\"")
) {
  throw new Error("Client catalog must print a decision-ready A4 handoff without service controls")
}
if (
  clientCatalogSource.includes("ClientCatalogPrintQr") ||
  clientCatalogSource.includes("client-catalog-print-qr") ||
  clientCatalogSource.includes("QR ведет") ||
  clientCatalogSource.includes("QR в печати") ||
  clientCatalogSource.includes("Онлайн-версия") ||
  clientCatalogSource.includes("Открыть эту страницу после встречи") ||
  clientCatalogActionsSource.includes("lunchup:catalog-sync-print-qr") ||
  clientCatalogActionsSource.includes("preloadImage") ||
  globalCssSource.includes(".client-catalog-print-qr") ||
  globalCssSource.includes("grid-template-columns: minmax(0, 1fr) 58mm") ||
  !clientCatalogPrintQrSource.includes("ClientCatalogPrintQr") ||
  !clientCatalogPrintQrSource.includes("enabled = false") ||
  !clientCatalogPrintQrSource.includes("if (!enabled) return null") ||
  !clientCatalogPrintQrSource.includes("ClientCatalogPrintQrBody") ||
  !clientCatalogPrintQrSource.includes("window.location.href") ||
  !clientCatalogPrintQrSource.includes("useLayoutEffect") ||
  !clientCatalogPrintQrSource.includes("beforeprint") ||
  !clientCatalogPrintQrSource.includes('window.matchMedia("print")') ||
  !clientCatalogPrintQrSource.includes("/api/integrations/share-qr?url=") ||
  !clientCatalogPrintQrSource.includes("QR проверен перед печатью") ||
  !shareQrRouteSource.includes("QRCode.toString")
) {
  throw new Error("Client catalog must keep dormant QR generation available for later, but never output QR/online-version service information in print or PDF")
}
if (
  !clientCatalogSource.includes('params?.view === "all"') ||
  !clientCatalogSource.includes("getClientCatalogData(isAllItemsView ? undefined : params?.segment)") ||
  !clientCatalogSource.includes("Коммерческое предложение: Офисная витрина") ||
  !clientCatalogSource.includes("officeShowcasePrintDecision") ||
  !clientCatalogSource.includes("Все позиции PDF") ||
  !clientCatalogSource.includes("Скачать PDF A4") ||
  !clientCatalogSource.includes("Санкт-Петербург и Ленинградская область") ||
  !clientCatalogSource.includes('Запуск "Офисная витрина"') ||
  !clientCatalogSource.includes("Запустить офисную витрину Lunch-UP на 7-10 дней: 10-12 SKU, две поставки в неделю, контроль списаний.") ||
  !clientCatalogSource.includes("Стартовый набор готовой еды с расчетом закупки, сценариями выкупа и понятной экономикой пилота.") ||
  !clientCatalogSource.includes("Минимальный заказ") ||
  !clientCatalogSource.includes("7 000 ₽") ||
  !clientCatalogSource.includes("за 2 дня до 15:00") ||
  !clientCatalogSource.includes("Санкт-Петербург, Понедельник-четверг") ||
  !clientCatalogSource.includes("12 044 ₽ / 97 порций") ||
  !clientCatalogSource.includes("5 рабочих дней") ||
  !clientCatalogSource.includes("22 покупки в день") ||
  !clientCatalogSource.includes("86 человек") ||
  !clientCatalogSource.includes("client-catalog-commercial-terms") ||
  !clientCatalogSource.includes("client-catalog-commercial-metrics") ||
  !clientCatalogSource.includes("shouldRenderPrintDecision") ||
  !clientCatalogSource.includes("isCommercialPrintMaterial || isReferenceView") ||
  !clientCatalogSource.includes('params?.print === "1"') ||
  !clientCatalogSource.includes("shouldRenderOfferSections") ||
  !clientCatalogSource.includes("is-commercial-print-material") ||
  !clientCatalogSource.includes("is-print-form") ||
  !clientCatalogActionsSource.includes('url.searchParams.set("print", "1")') ||
  !clientCatalogActionsSource.includes("window.print()") ||
  clientCatalogSource.includes(["Коммерческое предложение: ", "готовая витрина Lunch Up"].join("")) ||
  clientCatalogSource.includes(["Стартовый набор готовой еды ", "для B2B-витрины"].join("")) ||
  clientCatalogSource.includes(["Санкт-Петербург и ЛО", ", Пн-Чт"].join("")) ||
  clientCatalogSource.includes(["Запуск ", "готовой витрины Lunch Up"].join("")) ||
  clientCatalogSource.includes(["Полный цветной", " каталог SKU ", "без привязки", " к стартовым наборам"].join("")) ||
  clientCatalogSource.includes(["Все позиции Lunch Up ", "без привязки", " к стартовым наборам"].join("")) ||
  clientCatalogSource.includes(["На карточках", " нет меток ", "стартовых наборов", " и сегментных запусков."].join("")) ||
  clientCatalogSource.includes("Решение по витрине") ||
  clientCatalogSource.includes("Решение по отстройке") ||
  clientCatalogSource.includes("Решение по пилоту") ||
  clientCatalogSource.includes("Решение по ассортименту") ||
  clientCatalogSource.includes("Подтвердить первый запуск") ||
  clientCatalogSource.includes("Выбрать сегмент каталога для первого КП") ||
  !clientCatalogSource.includes("isOfferView || isAllItemsView") ||
  !clientCatalogSource.includes("isOfferView && !selectedSegment && product.launch_segments.length") ||
  !globalCssSource.includes(".client-catalog-commercial-terms") ||
  !globalCssSource.includes(".client-catalog-commercial-metrics") ||
  !globalCssSource.includes(".client-catalog-page.is-commercial-print-material .client-proposal-metrics") ||
  !globalCssSource.includes(".client-catalog-page.is-commercial-print-material .client-financial-model") ||
  !globalCssSource.includes(".client-catalog-top") ||
  !globalCssSource.includes("display: none !important")
) {
  throw new Error("Client catalog print forms must use the Office Showcase proposal header and never revert to removed screenshot/service copy")
}
if (
  !clientCatalogDataSource.includes("productStorageProfile") ||
  !clientCatalogDataSource.includes("storage_temperature") ||
  !clientCatalogDataSource.includes("storage_condition") ||
  !clientCatalogDataSource.includes("+2...+6 °C") ||
  !clientCatalogDataSource.includes("ОСГ взят из ассортимента Lunch Up 2026") ||
  !clientCatalogDataSource.includes("Роль в матрице") ||
  !clientCatalogDataSource.includes("Охлажденная порционная позиция") ||
  !clientCatalogSource.includes("Условия хранения") ||
  !clientCatalogSource.includes("client-menu-card-price") ||
  !clientCatalogSource.includes("client-menu-card-description") ||
  !clientCatalogSource.includes("client-menu-commercial-meta") ||
  !clientCatalogSource.includes("Коммерческие цены") ||
  !globalCssSource.includes(".client-menu-commercial-badge") ||
  !globalCssSource.includes(".client-menu-technical-meta") ||
  !globalCssSource.includes("Bahnschrift") ||
  !globalCssSource.includes(".client-menu-card-description")
) {
  throw new Error("Client catalog SKU cards must separate commercial prices from technical metadata, use distinct price typography, professional descriptions and storage conditions")
}
if (
  !clientCatalogDataSource.includes("commercial_offer") ||
  !clientCatalogDataSource.includes("package_total") ||
  !clientCatalogDataSource.includes("full_sellout_days") ||
  !clientCatalogDataSource.includes("financial_model") ||
  !clientCatalogDataSource.includes("retail_price_source") ||
  !clientCatalogDataSource.includes("clientRetailTaxRate") ||
  !clientCatalogDataSource.includes("optimizePilotMatrixForDiversity") ||
  !clientCatalogDataSource.includes("selloutDeadlineDays") ||
  !clientCatalogDataSource.includes("forecast_daily_people") ||
  !clientCatalogDataSource.includes("required_daily_sales") ||
  !clientCatalogDataSource.includes("Рекомендация: набрать больше разных SKU") ||
  !clientCatalogSource.includes("Финансовая модель pilot") ||
  !clientCatalogSource.includes("Финансовая модель pilot P&L") ||
  !clientCatalogSource.includes("Итого выручка по РРЦ") ||
  !clientCatalogSource.includes("Итого налоги") ||
  !clientCatalogSource.includes("Итого маржа") ||
  !clientCatalogSource.includes("Food cost") ||
  !clientCatalogSource.includes("P&L модель стартового набора") ||
  !clientCatalogSource.includes("Финансовая модель набора") ||
  !clientCatalogSource.includes("Выручка по РРЦ") ||
  !clientCatalogSource.includes("ROI к закупке") ||
  !clientCatalogSource.includes("Без списаний") ||
  !clientCatalogDataSource.includes("revenue_after_tax") ||
  !clientCatalogDataSource.includes("gross_margin_percent") ||
  !clientCatalogDataSource.includes("food_cost_percent") ||
  !clientCatalogDataSource.includes("tax_scenario_note") ||
  !clientCatalogSource.includes("Модель выкупа") ||
  !clientCatalogSource.includes("Итого набор") ||
  !clientCatalogSource.includes("Стартовые наборы: срок годности и выкуп") ||
  !clientCatalogSource.includes("!selectedCrmSegment && data.segment_groups.length") ||
  !clientCatalogSource.includes("Прогноз заказа") ||
  !clientCatalogSource.includes("План/день") ||
  !globalCssSource.includes(".client-launch-readiness")
) {
  throw new Error("Client catalog segment pages must render commercial offer totals, no-writeoff pilot economics, retail prices, taxes and sell-through modeling")
}
if (
  !clientCatalogDataSource.includes('"Компьютерный клуб snack-витрина"') ||
  !clientCatalogDataSource.includes("computer_club:") ||
  clientCatalogDataSource.includes("digital_orders:") ||
  clientCatalogDataSource.includes("telegram_order:")
) {
  throw new Error("Client catalog segment source must include computer clubs and exclude digital orders as a catalog segment")
}
if (
  !clientCatalogSource.includes("view=competition") ||
  !clientCatalogSource.includes("Конкурентный анализ") ||
  !clientCatalogSource.includes("competitivePlayers") ||
  !competitiveAnalysisSource.includes("Caloristika B2B") ||
  !competitiveAnalysisSource.includes("Самокат") ||
  !competitiveAnalysisSource.includes("Сытоедов") ||
  !competitiveAnalysisSource.includes("Петровский Крендель") ||
  !competitiveAnalysisSource.includes("lunchUpCompetitiveBaseline") ||
  !globalCssSource.includes(".client-competitive-table") ||
  !globalCssSource.includes(".client-catalog-view-tabs")
) {
  throw new Error("Client catalog must expose a sourced competitive analysis tab for SPb ready-food competitors")
}
if (
  !clientCatalogSource.includes("view=samokat") ||
  !clientCatalogSource.includes("Экономика с Самокатом") ||
  !clientCatalogSource.includes("Lunch Up закупка") ||
  !clientCatalogSource.includes("Рекоменд. продажа") ||
  !clientCatalogSource.includes("Рынок продажа") ||
  !clientCatalogSource.includes("Прибыль после НДС") ||
  !clientCatalogSource.includes("Потенциал по точным SKU") ||
  !clientCatalogSource.includes("is-samokat-view") ||
  !clientCatalogSource.includes("`${samokatEconomics.summary.skuCount} SKU`") ||
  !clientCatalogSource.includes("единый каталог Lunch Up берется из SQLite CRM") ||
  !clientCatalogSource.includes("только для точных внешних SKU") ||
  !clientCatalogSource.includes("client-samokat-product-photo") ||
  !clientCatalogSource.includes("Источник сравнения") ||
  !clientCatalogSource.includes("Двухуровневое меню экономики Самоката") ||
  !clientCatalogSource.includes("samokatGroups") ||
  !clientCatalogSource.includes("@/components/ui/table") ||
  !clientCatalogSource.includes("@/components/ui/card") ||
  !clientCatalogSource.includes("@/components/ui/badge") ||
  !clientCatalogSource.includes("TableHeader") ||
  !samokatUnitEconomicsSource.includes("buildSamokatUnitEconomics") ||
  !samokatUnitEconomicsSource.includes("samokatTaxRate = 0.22") ||
  !samokatUnitEconomicsSource.includes("НДС 22%") ||
  !samokatUnitEconomicsSource.includes("imageUrl") ||
  !samokatUnitEconomicsSource.includes("productUrl") ||
  !samokatUnitEconomicsSource.includes("CRM SQLite products") ||
  !samokatUnitEconomicsSource.includes("SKU, закупочная цена, вес, фото") ||
  !samokatUnitEconomicsSource.includes("recommendedProfitAfterTax") ||
  !samokatUnitEconomicsSource.includes("marketPriceProfitAfterTax") ||
  !samokatUnitEconomicsSource.includes("только для") ||
  !samokatUnitEconomicsSource.includes("точным публичным совпадением") ||
  !samokatUnitEconomicsSource.includes("точный публичный SKU не найден") ||
  !retailPriceBenchmarksSource.includes("RetailBenchmarkConfidence") ||
  !retailPriceBenchmarksSource.includes("findRetailBenchmark") ||
  !retailPriceBenchmarksSource.includes('provider: "Перекресток"') ||
  !retailPriceBenchmarksSource.includes('provider: "Окей"') ||
  !retailPriceBenchmarksSource.includes("Точный весовой SKU") ||
  clientCatalogDataSource.includes('from "@/lib/retail-price-benchmarks"') ||
  clientCatalogSource.includes("client-menu-retail-source") ||
  globalCssSource.includes(".client-menu-retail-source") ||
  !clientCatalogDataSource.includes("clientRetailSource") ||
  retailPriceBenchmarksSource.includes("Релевантный аналог") ||
  retailPriceBenchmarksSource.includes("Категорийный бенчмарк") ||
  !globalCssSource.includes(".client-catalog-page.is-samokat-view .client-catalog-subtitle") ||
  !globalCssSource.includes("white-space: nowrap") ||
  !globalCssSource.includes(".client-samokat-shadcn-menu") ||
  !globalCssSource.includes(".client-samokat-shadcn-table") ||
  !globalCssSource.includes(".client-samokat-product-photo") ||
  !globalCssSource.includes(".client-samokat-metrics")
) {
  throw new Error("Client catalog must expose a shadcn/ui unit-economics tab from the shared SQLite catalog with product photos, two-level navigation, VAT-aware margin and sourced retail benchmarks for exact matches only")
}
if (
  !clientCatalogDataSource.includes("selected_crm_segment") ||
  !clientCatalogDataSource.includes("commercial_proposal") ||
  !clientCatalogDataSource.includes("segment_groups") ||
  !clientCatalogDataSource.includes("resolveSelectedCrmSegment") ||
  !clientCatalogDataSource.includes("buildCommercialProposal") ||
  !clientCatalogDataSource.includes("projectSheetSegments") ||
  !clientCatalogDataSource.includes("sales_scripts") ||
  !clientCatalogDataSource.includes("objection_map") ||
  !clientCatalogDataSource.includes("вкладка О компании") ||
  !clientCatalogDataSource.includes("psychology") ||
  !clientCatalogDataSource.includes("Paradox of Choice") ||
  !clientCatalogDataSource.includes("Risk Reversal") ||
  !clientCatalogDataSource.includes("Jobs to Be Done") ||
  !clientCatalogSource.includes("Коммерческое предложение") ||
  !clientCatalogSource.includes("Почему это актуально") ||
  !clientCatalogSource.includes("Предложение Lunch Up") ||
  !clientCatalogSource.includes("Типовое возражение") ||
  !clientCatalogSource.includes("Закрытие первой поставки") ||
  !clientCatalogSource.includes("aria-label=\"Коммерческие предложения по сегментам CRM\"") ||
  !globalCssSource.includes(".client-proposal-brief") ||
  !globalCssSource.includes(".client-proposal-decision") ||
  !globalCssSource.includes(".client-proposal-handoff")
) {
  throw new Error("Client catalog must render CRM-backed segment commercial proposals with scripts, objections, psychology framing and print styling")
}
if (
  !globalCssSource.includes("@page client-catalog") ||
  !globalCssSource.includes(".client-catalog-page .client-catalog-footer") ||
  !globalCssSource.includes(".client-catalog-page .client-catalog-date")
) {
  throw new Error("Client catalog print CSS must keep A4 mode and hide service footer/date")
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"))
if (!String(packageJson.scripts?.build ?? "").includes("--webpack")) {
  throw new Error("Next build script must include --webpack on this Windows runtime")
}
if (packageJson.scripts?.["telegram:setup"] !== "node scripts/setup-telegram-bot.mjs") {
  throw new Error("Package scripts must expose telegram:setup")
}
if (packageJson.scripts?.["telegram:setup-dry-run-smoke"] !== "node scripts/telegram-setup-dry-run-smoke.mjs") {
  throw new Error("Package scripts must expose telegram:setup-dry-run-smoke")
}
if (packageJson.scripts?.["telegram:setup-preview-smoke"] !== "node scripts/telegram-setup-preview-smoke.mjs") {
  throw new Error("Package scripts must expose telegram:setup-preview-smoke")
}
if (packageJson.scripts?.["telegram:check"] !== "node scripts/telegram-launch-check.mjs") {
  throw new Error("Package scripts must expose telegram:check")
}
if (packageJson.scripts?.["telegram:launch-check-smoke"] !== "node scripts/telegram-launch-check-smoke.mjs") {
  throw new Error("Package scripts must expose telegram:launch-check-smoke")
}
if (packageJson.scripts?.["telegram:env-bootstrap"] !== "node scripts/telegram-env-bootstrap.mjs") {
  throw new Error("Package scripts must expose telegram:env-bootstrap")
}
if (packageJson.scripts?.["agent:readiness"] !== "node scripts/agent-readiness-check.mjs") {
  throw new Error("Package scripts must expose agent:readiness")
}
if (packageJson.scripts?.["dgis:set-key"] !== "pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/set-dgis-key.ps1") {
  throw new Error("Package scripts must expose dgis:set-key")
}
if (packageJson.scripts?.["dgis:check"] !== "node scripts/check-dgis-key.mjs") {
  throw new Error("Package scripts must expose dgis:check")
}
if (packageJson.scripts?.["crm:backfill-telegram"] !== "node scripts/backfill-company-telegram-channels.mjs") {
  throw new Error("Package scripts must expose crm:backfill-telegram")
}
if (packageJson.scripts?.["render:env"] !== "pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/set-render-env.ps1") {
  throw new Error("Package scripts must expose render:env")
}
if (
  packageJson.scripts?.["render:smoke"] !== "node scripts/render-postdeploy-smoke.mjs" ||
  !renderPostdeploySmokeSource.includes("/api/health") ||
  !renderPostdeploySmokeSource.includes("loadLocalEnv(root)") ||
  !renderPostdeploySmokeSource.includes("/catalog") ||
  !renderPostdeploySmokeSource.includes("/miniapp") ||
  !renderPostdeploySmokeSource.includes("/?key=<hidden>") ||
  !readmeSource.includes("npm run render:smoke") ||
  !readmeSource.includes("https://<render-service>.onrender.com") ||
  !readmeSource.includes("не печатает значение ключа")
) {
  throw new Error("Render post-deploy smoke must check health, catalog, Mini App and protected CRM without leaking keys")
}
if (
  packageJson.scripts?.["render:api"] !== "node scripts/render-api-services.mjs" ||
  !renderApiServicesSource.includes("https://api.render.com/v1") ||
  !renderApiServicesSource.includes("Render migration preflight") ||
  !renderApiServicesSource.includes("renderBlueprintLink") ||
  !renderApiServicesSource.includes("repoPreflight") ||
  !renderApiServicesSource.includes("dashboard deploy") ||
  !renderApiServicesSource.includes("localPath") ||
  !renderApiServicesSource.includes("/owners?limit=100") ||
  !renderApiServicesSource.includes("/services?ownerId=") ||
  !renderApiServicesSource.includes("RENDER_API_KEY is missing") ||
  !renderApiServicesSource.includes("RENDER_OWNER_ID") ||
  !renderApiServicesSource.includes("CRM_ACCESS_KEY") ||
  !renderApiServicesSource.includes("caloristika-crm-demo") ||
  !renderApiServicesSource.includes("caloristika-b2b-crm-demo") ||
  !renderApiServicesSource.includes("agentic-crm-product-blueprint") ||
  !renderApiServicesSource.includes("DGIS_API_KEY") ||
  !renderApiServicesSource.includes("APIFY_TOKEN") ||
  !renderApiServicesSource.includes("<set>") ||
  !readmeSource.includes("npm run render:api -- preflight") ||
  !readmeSource.includes("npm run render:api -- workspaces") ||
  !readmeSource.includes("RENDER_OWNER_ID") ||
  !renderDeploymentRunbookSource.includes("npm run render:api -- preflight")
) {
  throw new Error("Render API automation must preflight/plan/list/create services without leaking secrets")
}
if (
  !renderEnvSetSource.includes('Read-Host $Prompt -AsSecureString') ||
  !renderEnvSetSource.includes("RENDER_API_KEY") ||
  !renderEnvSetSource.includes("CRM_ACCESS_KEY") ||
  !renderEnvSetSource.includes("RENDER_OWNER_ID") ||
  !renderEnvSetSource.includes(".env.local") ||
  !renderEnvSetSource.includes("Значения секретов не выводились") ||
  !renderEnvSetSource.includes("-OwnerId <tea_...>") ||
  !readmeSource.includes("npm run render:env") ||
  !readmeSource.includes("npm run render:env -- -OwnerId <tea_...>") ||
  !renderDeploymentRunbookSource.includes("npm run render:env")
) {
  throw new Error("Render env setup must save API/CRM keys locally with hidden input and owner-id follow-up")
}
if (
  !dgisKeySetSource.includes('Read-Host "Введите demo API key 2GIS" -AsSecureString') ||
  !dgisKeySetSource.includes("DGIS_API_KEY=") ||
  !dgisKeySetSource.includes(".env.local") ||
  !dgisKeySetSource.includes("Значение ключа не выводилось") ||
  !dgisKeyCheckSource.includes("loadLocalEnv(root)") ||
  !dgisKeyCheckSource.includes("DGIS_API_KEY") ||
  !dgisKeyCheckSource.includes("https://catalog.api.2gis.com/3.0/items") ||
  !dgisKeyCheckSource.includes("maskSecret") ||
  !dgisKeyCheckSource.includes("secret value was not printed") ||
  !readmeSource.includes("npm run dgis:set-key") ||
  !readmeSource.includes("npm run dgis:check")
) {
  throw new Error("2GIS demo key setup must save locally, load local env, use official API, mask secrets and be documented")
}
if (packageJson.scripts?.["telegram:webhook-smoke"] !== "node --experimental-strip-types scripts/telegram-webhook-smoke.ts") {
  throw new Error("Package scripts must expose telegram:webhook-smoke")
}
if (packageJson.scripts?.["telegram:webhook-access-smoke"] !== "node scripts/telegram-webhook-access-smoke.mjs") {
  throw new Error("Package scripts must expose telegram:webhook-access-smoke")
}
if (packageJson.scripts?.["telegram:webhook-post-smoke"] !== "node scripts/telegram-webhook-post-smoke.mjs") {
  throw new Error("Package scripts must expose telegram:webhook-post-smoke")
}
if (packageJson.scripts?.["launch-guide:smoke"] !== "node scripts/launch-guide-smoke.mjs") {
  throw new Error("Package scripts must expose launch-guide:smoke")
}
if (!packageJson.dependencies?.qrcode || !packageJson.devDependencies?.["@types/qrcode"]) {
  throw new Error("Package dependencies must include qrcode and @types/qrcode for share QR generation")
}
if (packageJson.scripts?.["integration:preflight-mock-smoke"] !== "node scripts/integration-preflight-mock-smoke.mjs") {
  throw new Error("Package scripts must expose integration:preflight-mock-smoke")
}
if (packageJson.scripts?.["miniapp:auth-smoke"] !== "node scripts/miniapp-auth-smoke.mjs") {
  throw new Error("Package scripts must expose miniapp:auth-smoke")
}
if (packageJson.scripts?.["miniapp:order-smoke"] !== "node scripts/miniapp-order-smoke.mjs") {
  throw new Error("Package scripts must expose miniapp:order-smoke")
}
if (packageJson.scripts?.["company:enrichment-smoke"] !== "node scripts/company-enrichment-smoke.mjs") {
  throw new Error("Package scripts must expose company:enrichment-smoke")
}
if (packageJson.scripts?.["project-sheet:import"] !== "node scripts/import-project-sheet-enrichment.mjs") {
  throw new Error("Package scripts must expose project-sheet:import")
}
if (packageJson.scripts?.["telegram:launch"] !== "node scripts/telegram-launch.mjs") {
  throw new Error("Package scripts must expose telegram:launch")
}
if (!readmeSource.includes("npm run telegram:webhook-smoke") || !aiInfrastructureSource.includes("telegram:webhook-smoke")) {
  throw new Error("Telegram webhook smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run telegram:launch-check-smoke") || !aiInfrastructureSource.includes("telegram:launch-check-smoke")) {
  throw new Error("Telegram launch check smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run telegram:setup-dry-run-smoke") || !aiInfrastructureSource.includes("telegram:setup-dry-run-smoke")) {
  throw new Error("Telegram setup dry-run smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run telegram:setup-preview-smoke") || !aiInfrastructureSource.includes("telegram:setup-preview-smoke")) {
  throw new Error("Telegram setup preview smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run telegram:webhook-access-smoke") || !aiInfrastructureSource.includes("telegram:webhook-access-smoke")) {
  throw new Error("Telegram webhook access smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run telegram:webhook-post-smoke") || !aiInfrastructureSource.includes("telegram:webhook-post-smoke")) {
  throw new Error("Telegram webhook POST smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run launch-guide:smoke") || !aiInfrastructureSource.includes("launch-guide:smoke")) {
  throw new Error("Launch guide smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run integration:preflight-mock-smoke") || !aiInfrastructureSource.includes("integration:preflight-mock-smoke")) {
  throw new Error("Integration preflight mock smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run miniapp:auth-smoke") || !aiInfrastructureSource.includes("miniapp:auth-smoke")) {
  throw new Error("Mini App signed auth smoke command must be documented for operator launch")
}
if (!readmeSource.includes("npm run company:enrichment-smoke") || !aiInfrastructureSource.includes("company:enrichment-smoke")) {
  throw new Error("Company enrichment smoke command must be documented for operator launch")
}

const productPhotosPath = join(root, "data", "product-photos.json")
if (!existsSync(productPhotosPath)) {
  throw new Error("Missing product photo catalog source")
}
const productPhotosText = readFileSync(productPhotosPath, "utf-8")
const clientUnsafeCatalogNotes = [
  /Точная карточка/i,
  /не опубликован[а-я]*/i,
  /использован отдельный ракурс/i,
  /аналог с сайта/i
]
for (const pattern of clientUnsafeCatalogNotes) {
  if (pattern.test(productPhotosText)) {
    throw new Error(`Client catalog contains unsafe photo note: ${pattern}`)
  }
}

await import("./verify-script-matrix.mjs")
await import("./verify-project-sheet-segments.mjs")
await import("./verify-contacts.mjs")

console.log("CRM SQLite verification passed")
console.log(`Database: ${dbPath}`)
