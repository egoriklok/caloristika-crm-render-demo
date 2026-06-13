import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { openVerifyDb } from "./verify-db.mjs"
import {
  buildClientLineScript,
  scriptBlockLabels,
  scriptFocusLabels,
  segmentRoleProfiles,
  stageScriptBlocks
} from "../lib/sales-script-matrix.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const contentPath = join(root, "data", "launch-crm-content.json")

if (!existsSync(dbPath)) {
  throw new Error("Missing SQLite database. Run npm run db:init")
}
if (!existsSync(contentPath)) {
  throw new Error("Missing launch CRM content")
}

const horecaFrameworkSegments = new Set([
  "coffee_bakery",
  "coffee_chain",
  "horeca_cluster",
  "horeca_ready_food",
  "healthcare_clinic",
  "foodservice_operator",
  "bath_spa"
])
const requiredCrossFoci = ["objections", "closing", "email"]

function parseLaunchSkuList(segment) {
  const fields = [
    ["breakfasts", "Завтраки"],
    ["salads", "Салаты"],
    ["sandwiches", "Сэндвичи"],
    ["desserts", "Десерты"]
  ]
  const items = []
  for (const [key, label] of fields) {
    const raw = segment?.[key]
    if (!raw) continue
    for (const part of String(raw).split(";")) {
      const value = part.trim()
      if (!value) continue
      const match = value.match(/^(.*?)\s+x(\d+)$/i)
      items.push({
        segment: segment.format,
        category: label,
        name: (match?.[1] ?? value).trim(),
        quantity: match?.[2] ? Number(match[2]) : null
      })
    }
  }
  return items
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function getObjection(stageCode, objections) {
  const byStage = {
    lead: "Локальные лиды",
    qualified: "Локальные лиды",
    contacted: "Закупки",
    tasting: "Продажи",
    trial: "Операции",
    repeat: "Экономика",
    contract: "Документы",
    won: "Закрытие"
  }
  return (
    objections.find((item) => item.stage === byStage[stageCode]) ??
    objections.find((item) => item.stage === "Локальные лиды") ??
    objections[0] ??
    null
  )
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const db = openVerifyDb(dbPath)
const crmSegments = db
  .prepare("SELECT code, label, launch_format FROM crm_segments WHERE is_active = 1 ORDER BY direction_position, segment_position")
  .all()
  .map((row) => ({
    code: String(row.code),
    label: String(row.label),
    launch_format: String(row.launch_format)
  }))
const crmSegmentByCode = new Map(crmSegments.map((segment) => [segment.code, segment]))
const stages = db
  .prepare("SELECT code, name FROM pipeline_stages WHERE code <> 'lost' ORDER BY position")
  .all()
  .map((row) => ({ code: String(row.code), name: String(row.name) }))
const segments = db
  .prepare(
    `SELECT DISTINCT c.segment AS code
     FROM companies c
     JOIN deals d ON d.company_id = c.id
     ORDER BY c.segment`
  )
  .all()
  .map((row) => String(row.code))
db.close()

const content = JSON.parse(readFileSync(contentPath, "utf-8"))
const launches = content.segment_launches ?? []
const launchByFormat = new Map(launches.map((launch) => [launch.format, launch]))
const objections = content.objection_map ?? []
const manualScripts = content.sales_scripts ?? []
const forbiddenPlaceholders = [/\[[^\]]+\]/, /\bundefined\b/i, /\bnull\b/i, /Набор уточнить/i]

assert(stages.length > 0, "Script matrix needs pipeline stages")
assert(segments.length > 0, "Script matrix needs lead segments")
assert(crmSegments.length >= 18, "Script matrix needs active CRM segments from crm_segments")
assert(Object.keys(scriptFocusLabels).length === 6, "Expected 6 script foci")
assert(Object.keys(scriptBlockLabels).length === 7, "Expected 7 script blocks")
assert(manualScripts.length > 0, "Expected base manual scripts")

for (const [index, script] of manualScripts.entries()) {
  for (const field of ["block", "audience", "script", "offer", "closing_question"]) {
    assert(String(script[field] ?? "").trim().length > 0, `Manual sales script ${index} has empty ${field}`)
  }
  assert(String(script.script).length >= 60, `Manual sales script ${index} script text is too short`)
  assert(String(script.offer).length >= 20, `Manual sales script ${index} offer text is too short`)
  assert(String(script.closing_question).length >= 20, `Manual sales script ${index} closing question is too short`)
  const joined = [script.block, script.audience, script.script, script.offer, script.closing_question].join(" ")
  for (const pattern of forbiddenPlaceholders) {
    assert(!pattern.test(joined), `Manual sales script ${index} contains placeholder: ${joined}`)
  }
}

const rows = []
const segmentStageKeys = new Set()

for (const segmentCode of segments) {
  const roles = segmentRoleProfiles[segmentCode]
  const crmSegment = crmSegmentByCode.get(segmentCode)
  assert(crmSegment, `Missing crm_segments row for segment ${segmentCode}`)
  const segmentLabel = crmSegment.label
  const launchFormat = crmSegment.launch_format
  const launch = launchByFormat.get(launchFormat)

  assert(roles?.length > 0, `Missing role profile for segment ${segmentCode}`)
  assert(launch, `Missing launch format "${launchFormat}" for segment ${segmentCode}`)

  for (const stage of stages) {
    const blocks = stageScriptBlocks[stage.code]
    assert(blocks?.length > 0, `Missing script blocks for stage ${stage.code}`)

    const framework = horecaFrameworkSegments.has(segmentCode) ? "HoReCa FAB" : "SPIN"
    const objection = getObjection(stage.code, objections)
    const base = {
      key: `${segmentCode}-${stage.code}`,
      segmentCode,
      segmentLabel,
      stageCode: stage.code,
      stageName: stage.name,
      audience: roles[0],
      launchName: launch.format,
      goal: `Продвинуть клиента через этап "${stage.name}" без потери продуктовой логики.`,
      offer: `${launch.pitch} KPI: ${launch.kpi}`,
      skuItems: parseLaunchSkuList(launch),
      framework,
      close: "Зафиксировать следующий проверяемый шаг.",
      spin: {
        situation: `Как сейчас сегмент "${segmentLabel}" закрывает готовую еду, пополнение и решение по пилоту?`,
        needPayoff: "Какой показатель подтвердит, что тест можно переводить в регулярную поставку?"
      },
      objection,
      proof: objection?.proof_or_asset ?? "Матрица запуска, каталог SKU и условия сотрудничества.",
      nextQuestion: objection?.next_question ?? "Какой следующий шаг фиксируем?"
    }

    segmentStageKeys.add(base.key)
    for (const role of roles) {
      for (const block of blocks) {
        rows.push(buildClientLineScript(base, block, role))
      }
    }
  }
}

const expectedRows = segments.reduce((total, segmentCode) => {
  const roleCount = segmentRoleProfiles[segmentCode]?.length ?? 0
  const blockCount = stages.reduce((sum, stage) => sum + (stageScriptBlocks[stage.code]?.length ?? 0), 0)
  return total + roleCount * blockCount
}, 0)

assert(rows.length === expectedRows, `Expected ${expectedRows} generated scripts, got ${rows.length}`)
assert(segmentStageKeys.size === segments.length * stages.length, "Missing segment x stage SPIN/FAB bases")

const focusCodes = unique(rows.map((row) => row.focus))
for (const focus of Object.keys(scriptFocusLabels)) {
  assert(focusCodes.includes(focus), `Missing focus ${focus}`)
}

for (const segmentCode of segments) {
  const segmentRows = rows.filter((row) => row.segmentCode === segmentCode)
  const roles = segmentRoleProfiles[segmentCode]
  const expectedPrimaryFocus =
    segmentCode === "vending_micromarket" ? "vending" : horecaFrameworkSegments.has(segmentCode) ? "horeca" : "spin"

  assert(segmentRows.length > 0, `No scripts for segment ${segmentCode}`)
  assert(segmentRows.some((row) => row.focus === expectedPrimaryFocus), `Missing primary focus for segment ${segmentCode}`)
  for (const focus of requiredCrossFoci) {
    assert(segmentRows.some((row) => row.focus === focus), `Missing ${focus} focus for segment ${segmentCode}`)
  }

  for (const role of roles) {
    const roleRows = segmentRows.filter((row) => row.role === role)
    const roleBlocks = unique(roleRows.map((row) => row.block))
    for (const block of Object.values(scriptBlockLabels)) {
      assert(roleBlocks.includes(block), `Missing block "${block}" for ${segmentCode} / ${role}`)
    }
  }

  for (const stage of stages) {
    const stageRows = segmentRows.filter((row) => row.stageCode === stage.code)
    const expectedStageRows = roles.length * stageScriptBlocks[stage.code].length
    assert(
      stageRows.length === expectedStageRows,
      `Expected ${expectedStageRows} scripts for ${segmentCode} / ${stage.code}, got ${stageRows.length}`
    )
  }
}

for (const row of rows) {
  const joined = [row.block, row.role, row.script, row.offer, row.closingQuestion, row.logic].join(" ")
  for (const pattern of forbiddenPlaceholders) {
    assert(!pattern.test(joined), `Generated script contains placeholder for ${row.key}`)
  }
  assert(row.script.length >= 80, `Script text is too short for ${row.key}`)
  assert(row.offer.length >= 20, `Offer text is too short for ${row.key}`)
  assert(row.closingQuestion.length >= 20, `Closing question is too short for ${row.key}`)
  assert(row.logic.includes(row.segmentLabel), `Logic must include segment for ${row.key}`)
  assert(row.logic.includes(row.stageName), `Logic must include stage for ${row.key}`)
  assert(row.logic.includes(row.launchName), `Logic must include launch for ${row.key}`)
  assert(row.logic.includes(row.framework), `Logic must include framework for ${row.key}`)

  if (row.blockCode === "opening") {
    assert(row.script.includes("Санкт-Петербурге"), `Opening script misses geography for ${row.key}`)
    assert(row.script.includes("Ленинградской области"), `Opening script misses region for ${row.key}`)
  }
  if (row.blockCode === "qualification") {
    assert(row.script.includes("KPI"), `Qualification script misses KPI for ${row.key}`)
  }
  if (row.blockCode === "offer") {
    assert(row.script.includes(row.launchName), `Offer script misses launch name for ${row.key}`)
  }
  if (row.blockCode === "proof" || row.blockCode === "follow_up") {
    for (const token of ["3-10 суток", "7 000", "2 дня", "СПб/ЛО"]) {
      assert(row.script.includes(token), `${row.block} script misses product term "${token}" for ${row.key}`)
    }
  }
  if (row.blockCode === "objection") {
    assert(row.script.includes("Если клиент говорит"), `Objection script misses objection setup for ${row.key}`)
    assert(row.script.includes("Материал"), `Objection script misses proof asset for ${row.key}`)
  }
  if (row.blockCode === "closing") {
    assert(row.script.includes("следующий проверяемый шаг"), `Closing script misses next-step logic for ${row.key}`)
  }
}

console.log("Sales script matrix verification passed")
console.log(
  `Scripts: ${rows.length}; segments: ${segments.length}; stages: ${stages.length}; blocks: ${
    Object.keys(scriptBlockLabels).length
  }; roles: ${unique(rows.map((row) => `${row.segmentCode}:${row.role}`)).length}; foci: ${focusCodes.length}`
)
