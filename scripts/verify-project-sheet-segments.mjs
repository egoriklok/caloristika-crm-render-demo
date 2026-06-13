import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { enrichLaunchContentFromProjectSheet, projectSheetSegments } from "../lib/project-sheet-enrichment.ts"
import { segmentRoleProfiles } from "../lib/sales-script-matrix.ts"
import { openVerifyDb } from "./verify-db.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const crmDashboardSource = readFileSync(join(root, "components", "crm-dashboard.tsx"), "utf-8")
const queriesSource = readFileSync(join(root, "lib", "queries.ts"), "utf-8")
const typesSource = readFileSync(join(root, "lib", "types.ts"), "utf-8")
const dgisLeadSearchSource = readFileSync(join(root, "lib", "dgis-lead-search.ts"), "utf-8")
const crmSegmentsSource = readFileSync(join(root, "lib", "crm-segments.ts"), "utf-8")
const launchContent = JSON.parse(readFileSync(join(root, "data", "launch-crm-content.json"), "utf-8"))
const enrichedLaunch = enrichLaunchContentFromProjectSheet(launchContent)
const launchFormats = new Set((launchContent.segment_launches ?? []).map((item) => item.format))
if (!existsSync(dbPath)) {
  throw new Error("Missing SQLite database. Run npm run db:init")
}
const db = openVerifyDb(dbPath)
const crmSegments = db
  .prepare("SELECT code, label, launch_format FROM crm_segments WHERE is_active = 1")
  .all()
  .map((row) => ({ code: String(row.code), label: String(row.label), launch_format: String(row.launch_format) }))
db.close()
const crmSegmentByCode = new Map(crmSegments.map((segment) => [segment.code, segment]))
const newSegmentCodes = [
  "production_logistics",
  "healthcare_clinic",
  "foodservice_operator",
  "education_campus",
  "residential_apart",
  "lo_anchor",
  "rail_partner",
  "bath_spa"
]

assert(projectSheetSegments.length === 13, `Expected 13 project sheet JTBD segments, got ${projectSheetSegments.length}`)
assert(new Set(projectSheetSegments.map((item) => item.segment)).size === 13, "Project sheet segment names must be unique")

for (const segment of projectSheetSegments) {
  for (const field of [
    "segment",
    "jtbd",
    "pain",
    "need",
    "solution",
    "crm_segment_code",
    "crm_segment_label",
    "launch_format",
    "route_logic",
    "manager_focus",
    "source_sheet_url"
  ]) {
    assert(String(segment[field] ?? "").trim().length > 0, `Project sheet segment "${segment.segment}" misses ${field}`)
  }
  assert(launchFormats.has(segment.launch_format), `Launch format "${segment.launch_format}" is missing for ${segment.segment}`)
  assert(segmentRoleProfiles[segment.crm_segment_code]?.length > 0, `Missing script roles for ${segment.crm_segment_code}`)
  const crmSegment = crmSegmentByCode.get(segment.crm_segment_code)
  assert(crmSegment, `crm_segments misses CRM segment code ${segment.crm_segment_code}`)
  assert(
    crmSegment.launch_format === segment.launch_format,
    `crm_segments launch format mismatch for ${segment.crm_segment_code}: ${crmSegment.launch_format} vs ${segment.launch_format}`
  )
}

for (const code of newSegmentCodes) {
  assert(crmSegmentsSource.includes(code), `CRM segment seed misses new segment ${code}`)
  assert(crmSegmentByCode.has(code), `crm_segments table misses new segment ${code}`)
  assert(dgisLeadSearchSource.includes(code) || dgisLeadSearchSource.includes("вендинговый оператор"), `2GIS search routing should cover ${code}`)
}

const jtbdScripts = enrichedLaunch.sales_scripts.filter((item) => item.block === "JTBD / сегмент")
assert(jtbdScripts.length === 13, `Expected 13 JTBD sales scripts, got ${jtbdScripts.length}`)
for (const script of jtbdScripts) {
  assert(script.crm_segment_code, `JTBD script "${script.audience}" misses crm_segment_code`)
  assert(script.launch_format, `JTBD script "${script.audience}" misses launch_format`)
  assert(script.jtbd, `JTBD script "${script.audience}" misses jtbd`)
}

const jtbdObjections = (enrichedLaunch.objection_map ?? []).filter((item) => item.stage === "JTBD сегменты")
assert(jtbdObjections.length === 13, `Expected 13 JTBD objection rows, got ${jtbdObjections.length}`)

const enrichedCatalogRows = (enrichedLaunch.catalog_analysis ?? []).filter((item) => item.launch_recommendation)
assert(enrichedCatalogRows.length > 0, "Catalog must keep Google Sheet SKU launch recommendations")

for (const marker of [
  "JTBD из таблицы проекта",
  "JTBD-сегменты для текущего запуска",
  "Матрица запуска из каталога",
  "buildJtbdSpeechBasis",
  "launchMatrixCompact",
  "projectSheetSegmentsByCrmSegment",
  "segmentOptionCodes",
  "selectedCatalogJtbdSegments",
  "CrmSegmentFilterControls",
  "data-crm-segment-source=\"crm_segments\""
]) {
  assert(crmDashboardSource.includes(marker), `Dashboard misses project-sheet UI marker: ${marker}`)
}

assert(
  crmDashboardSource.includes("buildManagerElevatorSpeech") &&
    crmDashboardSource.includes("elevatorParagraphs") &&
    crmDashboardSource.includes("data-elevator-speech") &&
    crmDashboardSource.includes("Добрый день. Я представляю Lunch Up") &&
    crmDashboardSource.includes("главная задача конечного клиента") &&
    crmDashboardSource.includes("Для вашей компании выгода") &&
    crmDashboardSource.includes("дополнительный чек") &&
    crmDashboardSource.includes("удерживаете спрос внутри своей локации") &&
    crmDashboardSource.includes("Оффер пилота") &&
    crmDashboardSource.includes("buildLaunchMatrixSummary"),
  "Elevator speech must be first-person, readable, client-task-backed, revenue-oriented and catalog-matrix-linked"
)
assert(
  !crmDashboardSource.includes("я начинаю не с общего рассказа о Lunch Up") &&
    !crmDashboardSource.includes("Мы заходим не как очередной поставщик, а как партнер по запуску готовой категории"),
  "Elevator speech must not use the old analytical/generic wording"
)

assert(
  crmDashboardSource.includes("buildCrmSegmentGroups") &&
    crmDashboardSource.includes("companySegmentGroupRows") &&
    crmDashboardSource.includes("data-company-segment-menu") &&
    crmDashboardSource.includes("data-crm-segment-direction-select") &&
    crmDashboardSource.includes("data-crm-segment-select") &&
    crmDashboardSource.includes("crmSegmentGroups") &&
    !crmDashboardSource.includes("companySegmentMenuGroups"),
  "Company positioning must use two compact CRM-segment dropdowns sourced from crm_segments"
)
assert(
  crmDashboardSource.includes("data-competitive-field-panel") &&
    crmDashboardSource.includes("data-competitive-field-segment") &&
    crmDashboardSource.includes("Конкурентное поле сегмента") &&
    crmDashboardSource.includes("Отстройка Lunch Up") &&
    crmDashboardSource.includes("Оператор сравнивает Lunch Up со снековой полкой") &&
    crmDashboardSource.includes("Сотрудник БЦ выбирает между столовой") &&
    crmDashboardSource.includes("Покупатель на АЗС выбирает между хот-догом") &&
    crmDashboardSource.includes("Пассажир сравнивает Lunch Up с очередью в кафе"),
  "Competitive field must be segment-specific and synchronized with the selected menu context"
)
assert(
  !crmDashboardSource.includes("competitiveAlternativeMap") &&
    !crmDashboardSource.includes("competitorFrames") &&
    !crmDashboardSource.includes("текущий поставщик, который закрывает только часть полки") &&
    !crmDashboardSource.includes("Использовать как рамку разговора: сравниваем Lunch Up с альтернативой клиента"),
  "Competitive field panel must not fall back to generic market alternatives"
)

assert(typesSource.includes("ProjectSheetSegment"), "Dashboard types must expose ProjectSheetSegment")

console.log("Project sheet segment coherence verification passed")
console.log(
  `JTBD segments: ${projectSheetSegments.length}; CRM segment codes: ${
    new Set(projectSheetSegments.map((item) => item.crm_segment_code)).size
  }; launch formats: ${new Set(projectSheetSegments.map((item) => item.launch_format)).size}`
)
