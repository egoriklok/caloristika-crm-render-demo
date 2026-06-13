import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { getDb } from "@/lib/db"

export const DEFAULT_STRATEGY_TOKEN = "209498707_lunch_up_spb_lo_20260604"
export const STRATEGY_PACKAGE_SLUG = "lunch_up_spb_lo_20260604"

export type ActiveStrategySummary = {
  token: string
  package_slug: string
  name: string
  description: string
  generated_at: string
  geography: string
  stage: string
  default_segment: string
  first_offer: string
  monthly_goal: string
  minimum_success: string
  spb_delivery_terms: string
  lo_delivery_terms: string
  min_order_amount: number
  miniapp_url: string
  local_miniapp_path: string
  workbook_path: string
  html_path: string
  source_package_path: string
  kpis: Array<{ label: string; value: string }>
  overview: Array<{ title: string; text: string }>
  risks: Array<{ title: string; severity: string; text: string }>
  action_plan: Array<{ period: string; title: string; details: string[]; proof: string }>
}

type StrategySnapshot = {
  generatedAt?: string
  project?: {
    name?: string
    description?: string
    stage?: string
    format?: string
  }
  kpis?: ActiveStrategySummary["kpis"]
  overview?: ActiveStrategySummary["overview"]
  risks?: ActiveStrategySummary["risks"]
  actionPlan?: {
    items?: ActiveStrategySummary["action_plan"]
  }
  answers?: Array<{ key: string; value: string }>
}

type StrategyManifest = {
  token?: string
  miniapp_url?: string
  workbook_path?: string
  html_path?: string
}

const packageRoot = join(process.cwd(), "..", "outputs", STRATEGY_PACKAGE_SLUG)
const snapshotPath = join(packageRoot, `${DEFAULT_STRATEGY_TOKEN}.json`)
const manifestPath = join(packageRoot, "lunch_up_spb_lo_manifest_20260604.json")

const fallbackName = "Lunch-UP: выход ассортимента готовой еды в Санкт-Петербург и Ленинградскую область"
const spbDeliveryTerms = "Санкт-Петербург: бесплатная доставка с понедельника по четверг при заказе от 7 000 руб. на точку."
const loDeliveryTerms =
  "Ленинградская область: подключение второй волной через якорных клиентов, согласованные маршруты и индивидуальные условия доставки."

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf-8")) as T
}

function answer(snapshot: StrategySnapshot | null, key: string, fallback: string) {
  return snapshot?.answers?.find((item) => item.key === key)?.value ?? fallback
}

function readStrategySettings() {
  try {
    const rows = getDb()
      .prepare("SELECT key, value FROM settings WHERE key LIKE 'active_strategy_%' OR key LIKE 'demo_%' OR key = 'min_order_amount'")
      .all() as Array<{ key: string; value: string }>
    return Object.fromEntries(rows.map((item) => [item.key, item.value]))
  } catch {
    return {} as Record<string, string>
  }
}

export function getActiveStrategy(): ActiveStrategySummary {
  const snapshot = readJsonFile<StrategySnapshot>(snapshotPath)
  const manifest = readJsonFile<StrategyManifest>(manifestPath)
  const settings = readStrategySettings()
  const token = settings.active_strategy_token || DEFAULT_STRATEGY_TOKEN
  const packageSlug = settings.active_strategy_package_slug || STRATEGY_PACKAGE_SLUG

  return {
    token,
    package_slug: packageSlug,
    name: settings.active_strategy_name || snapshot?.project?.name || fallbackName,
    description:
      settings.active_strategy_description ||
      (snapshot?.project?.description ??
        "SPB+LO B2B-стратегия Lunch-UP для пилотных поставок готовой еды, вендинга, микромаркетов, офисов и локального ритейла."),
    generated_at: settings.active_strategy_generated_at || snapshot?.generatedAt || "2026-06-04T09:13:07.349928+00:00",
    geography:
      settings.active_strategy_geography ||
      answer(snapshot, "geography", "Первый фокус - Санкт-Петербург; Ленинградская область подключается через якорных клиентов и согласованные маршруты."),
    stage: settings.active_strategy_stage || snapshot?.project?.stage || answer(snapshot, "stage", "Запуск нового регионального рынка SPB+ЛО."),
    default_segment:
      settings.active_strategy_default_segment ||
      answer(snapshot, "target_segment", "Операторы вендинга, микромаркетов и офисных точек питания в Санкт-Петербурге."),
    first_offer:
      settings.active_strategy_first_offer ||
      answer(snapshot, "first_offer", "Двухнедельный пилот для 1-3 точек: дегустация, матрица 20-25 SKU, минимум 7 000 руб. на точку."),
    monthly_goal:
      settings.active_strategy_monthly_goal ||
      answer(snapshot, "monthly_goal", "50 квалифицированных контактов, 10-15 встреч, 5 дегустаций, 2-3 пилотные точки и минимум 2 повторных заказа."),
    minimum_success:
      settings.active_strategy_minimum_success ||
      answer(snapshot, "minimum_success", "2 юридических лица запустили пилотные поставки, каждая точка сделала повторный заказ."),
    spb_delivery_terms: settings.active_strategy_spb_delivery_terms || spbDeliveryTerms,
    lo_delivery_terms: settings.active_strategy_lo_delivery_terms || loDeliveryTerms,
    min_order_amount: Number(settings.min_order_amount || 7000),
    miniapp_url: manifest?.miniapp_url ?? "",
    local_miniapp_path: `/miniapp?strategy=${token}`,
    workbook_path: manifest?.workbook_path ?? `runtime/outputs/${packageSlug}/lunch_up_spb_lo_strategy_20260604.xlsx`,
    html_path: manifest?.html_path ?? `runtime/outputs/${packageSlug}/lunch_up_spb_lo_strategy_20260604.html`,
    source_package_path: settings.active_strategy_source_package_path || packageRoot,
    kpis: snapshot?.kpis ?? [],
    overview: snapshot?.overview ?? [],
    risks: snapshot?.risks ?? [],
    action_plan: snapshot?.actionPlan?.items ?? []
  }
}

export function isDefaultStrategyToken(token: string | null | undefined) {
  return !token || token === DEFAULT_STRATEGY_TOKEN
}
