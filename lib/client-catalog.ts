import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { getActiveStrategy } from "@/lib/active-strategy"
import { getDb } from "@/lib/db"
import { attachProductPhotos, normalizeProductPhotoKey } from "@/lib/product-photos"
import { syncCrmSegments } from "@/lib/crm-segments"
import { enrichLaunchContentFromProjectSheet, projectSheetSegments } from "@/lib/project-sheet-enrichment"
import { adaptSegmentLaunchesToSqliteCatalog, type SqliteSegmentMatrixItem } from "@/lib/sqlite-launch-matrix"
import type { CatalogAnalysisItem, CrmSegment, ObjectionMapItem, SalesScript, SegmentLaunch } from "@/lib/types"

type ProductRow = {
  id: number
  category: string
  name: string
  net_weight: string | null
  shelf_life_days: number | null
  wholesale_price: number
  composition: string | null
  nutrition: string | null
  image_url?: string | null
  product_url?: string | null
  image_source?: string | null
  image_match?: string | null
  image_note?: string | null
  site_title?: string | null
}

type LaunchSku = {
  format: string
  category: string
  name: string
  quantity: number | null
}

type LaunchSkuPriced = LaunchSku & {
  price: number
  total_amount: number
  shelf_life_days: number | null
  retail_price: number
  retail_total: number
  revenue_after_tax: number
  tax_amount: number
  gross_profit: number
  net_profit: number
  food_cost_percent: number
  gross_margin_percent: number
  net_margin_percent: number
  markup_percent: number
  roi_percent: number
  retail_source: string
}

export type ClientCatalogProduct = {
  id: number
  category: string
  name: string
  net_weight: string | null
  shelf_life_days: number | null
  storage_temperature: string
  storage_condition: string
  storage_handling: string
  storage_source_note: string
  price: number
  composition: string | null
  nutrition: string | null
  image_url: string | null
  product_url: string | null
  description: string
  launch_role: string
  best_segments: string
  launch_segments: LaunchSku[]
  selected_quantity: number | null
  selected_line_total: number | null
  retail_price: number
  retail_source: string
  client_tax_per_unit: number
  client_profit_per_unit: number
  client_margin_percent: number
  selected_retail_total: number | null
  selected_client_profit_total: number | null
}

export type ClientCatalogCategory = {
  name: string
  products: ClientCatalogProduct[]
}

export type ClientCatalogBundle = {
  category: string
  total_units: number
  total_amount: number
  retail_revenue: number
  tax_amount: number
  revenue_after_tax: number
  gross_profit: number
  net_profit: number
  food_cost_percent: number
  gross_margin_percent: number
  net_margin_percent: number
  markup_percent: number
  roi_percent: number
  items: LaunchSkuPriced[]
}

export type ClientCatalogSellThroughScenario = {
  label: string
  daily_buyers: number
  sellout_days: number
  unique_people: number
  day_3_sell_through: number
  within_shelf_life: boolean
  shelf_life_safety_days: number
}

export type ClientCatalogCommercialOffer = {
  format: string
  package_total: number
  total_units: number
  sku_count: number
  average_unit_price: number
  target_days: number
  target_sell_through: number
  target_units: number
  target_daily_buyers: number
  full_sellout_days: number
  people_to_sell_out: number
  forecast_daily_people: number
  shelf_life_deadline_days: number
  sellout_safety_days: number
  shelf_life_plan_note: string
  repeat_purchase_rate: number
  assumptions: string[]
  bundles: ClientCatalogBundle[]
  scenarios: ClientCatalogSellThroughScenario[]
  financial_model: ClientCatalogFinancialModel
}

export type ClientCatalogFinancialItem = {
  category: string
  name: string
  quantity: number
  shelf_life_days: number | null
  wholesale_price: number
  wholesale_total: number
  retail_price: number
  retail_revenue: number
  revenue_after_tax: number
  tax_amount: number
  gross_profit: number
  net_profit: number
  food_cost_percent: number
  gross_margin_percent: number
  net_margin_percent: number
  markup_percent: number
  roi_percent: number
  retail_source: string
  sellout_deadline_days: number
  required_daily_sales: number
  shelf_life_safety_days: number
}

export type ClientCatalogFinancialModel = {
  tax_mode_label: string
  tax_rate_percent: number
  tax_basis: string
  tax_scenario_note: string
  retail_price_source: string
  sku_count: number
  total_units: number
  purchase_cost: number
  retail_revenue: number
  revenue_after_tax: number
  average_wholesale_price: number
  average_retail_price: number
  gross_profit: number
  tax_amount: number
  net_profit: number
  food_cost_percent: number
  gross_margin_percent: number
  net_margin_percent: number
  markup_percent: number
  roi_percent: number
  break_even_units: number
  break_even_days: number
  min_shelf_life_days: number
  sellout_deadline_days: number
  shelf_life_buffer_days: number
  sellout_safety_days: number
  required_daily_buyers: number
  forecast_daily_people: number
  forecast_total_people: number
  no_writeoff_days: number
  no_writeoff_note: string
  diversity_note: string
  items: ClientCatalogFinancialItem[]
}

export type ClientCatalogCrmSegment = CrmSegment & {
  slug: string
  package_total: number
  total_units: number
  sku_count: number
  min_shelf_life_days: number
  sellout_deadline_days: number
  target_days: number
  sellout_safety_days: number
  target_daily_buyers: number
  people_to_sell_out: number
  lead_count: number
  avg_score: number
  pipeline_value: number
}

export type ClientCatalogSegmentGroup = {
  code: string
  label: string
  description: string
  segments: ClientCatalogCrmSegment[]
}

export type ClientCatalogProposal = {
  title: string
  subtitle: string
  segment_label: string
  direction_label: string
  launch_format: string
  audience: string
  launch_idea: string
  opening_pitch: string
  client_pains: string[]
  client_needs: string[]
  recommended_solution: string
  pilot_scope: string[]
  kpi: string
  objection: {
    title: string
    response: string
    proof: string
    next_question: string
  }
  first_delivery: {
    order_amount: number
    total_units: number
    sku_count: number
    terms: string[]
  }
  closing_script: string
  crm_sources: string[]
  psychology: Array<{
    model: string
    plfs: number
    application: string
  }>
}

export type ClientCatalogData = {
  generated_at: string
  selected_crm_segment: ClientCatalogCrmSegment | null
  selected_segment: SegmentLaunch | null
  selected_segment_slug: string | null
  commercial_proposal: ClientCatalogProposal | null
  commercial_offer: ClientCatalogCommercialOffer | null
  products: ClientCatalogProduct[]
  categories: ClientCatalogCategory[]
  segment_groups: ClientCatalogSegmentGroup[]
  segment_launches: Array<
    SegmentLaunch & {
      slug: string
      sku_count: number
      package_total: number
      total_units: number
      min_shelf_life_days: number
      sellout_deadline_days: number
      target_days: number
      sellout_safety_days: number
      target_daily_buyers: number
      people_to_sell_out: number
    }
  >
  order_terms: {
    minimum_order_amount: number
    free_delivery_city: string
    free_delivery_days: string
    lo_delivery_terms: string
    order_lead_time_days: number
    order_cutoff_time: string
    payment_terms: string
  }
}

const launchCategoryFields = [
  { key: "breakfasts", label: "Завтраки" },
  { key: "salads", label: "Салаты" },
  { key: "sandwiches", label: "Горячее" },
  { key: "desserts", label: "Десерты" }
] as const

const categoryOrder = ["Горячие блюда", "Завтраки", "Салаты", "Десерты", "Сэндвичи"]

const categoryDescriptions: Record<string, string> = {
  Завтраки:
    "Охлажденная порционная позиция для утренней витрины: понятная порция, быстрый выбор у кофе-зоны и прогнозируемая выкладка.",
  Салаты:
    "Готовая охлажденная позиция для обеденной полки: свежий формат, аккуратная упаковка и понятный состав для grab&go-покупки.",
  "Горячие блюда":
    "Сытная готовая позиция для дневного спроса: полноценный обед без кухни на точке и понятный якорь для первой витрины.",
  Сэндвичи:
    "Сытная grab&go-позиция для дневного потока: удобно взять с собой, не требует кухни на точке и закрывает быстрый перекус.",
  Десерты:
    "Порционный десерт для допродажи к кофе и чаю: компактная выкладка, понятный чек и низкий порог импульсной покупки."
}

const clientRetailTaxRate = 0.06
const clientRetailTaxLabel = "УСН доходы 6%"
const clientRetailTaxBasis =
  "базовый сценарий считает налог с розничной выручки пилота; перед договором режим клиента нужно уточнить"
const clientRetailTaxScenarioNote =
  "Для клиентов на НДС в 2026 году нужна отдельная версия модели по фактическому режиму: основная ставка НДС 22%, либо специальные ставки для части клиентов на УСН."
const clientTargetMarkupByCategory: Record<string, number> = {
  "Горячие блюда": 1.8,
  Завтраки: 1.75,
  Салаты: 1.8,
  Сэндвичи: 1.85,
  Десерты: 1.8
}
const clientRetailSource = "РРЦ рассчитана от закупки Lunch Up и целевой клиентской наценки."

function clientTargetMarkup(category: string) {
  return clientTargetMarkupByCategory[category] ?? 1.8
}

function roundClientRetailPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.max(49, Math.ceil(value / 10) * 10 - 1)
}

function clientRetailPrice(product: { category: string; price: number }) {
  return {
    price: roundClientRetailPrice(product.price * clientTargetMarkup(product.category)),
    source: clientRetailSource
  }
}

function clientUnitEconomics(product: { name: string; category: string; price: number }) {
  const retail = clientRetailPrice(product)
  const tax = retail.price * clientRetailTaxRate
  const grossProfit = retail.price - product.price
  const netProfit = grossProfit - tax
  return {
    retail_price: retail.price,
    retail_source: retail.source,
    client_tax_per_unit: tax,
    client_profit_per_unit: netProfit,
    client_margin_percent: retail.price ? Math.round((netProfit / retail.price) * 100) : 0
  }
}

function financialPercent(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return Math.round((part / total) * 100)
}

function financialMarkup(revenue: number, purchaseCost: number) {
  if (!Number.isFinite(revenue) || !Number.isFinite(purchaseCost) || purchaseCost <= 0) return 0
  return Math.round(((revenue - purchaseCost) / purchaseCost) * 100)
}

function financialRoi(profit: number, purchaseCost: number) {
  if (!Number.isFinite(profit) || !Number.isFinite(purchaseCost) || purchaseCost <= 0) return 0
  return Math.round((profit / purchaseCost) * 100)
}

function normalizedShelfLifeDays(value: number | null | undefined) {
  if (!value || value < 1) return 5
  return Math.max(1, Math.round(value))
}

function selloutDeadlineDays(shelfLifeDays: number) {
  return Math.max(1, shelfLifeDays - (shelfLifeDays > 1 ? 1 : 0))
}

function shelfLifeSafetyDays(shelfLifeDays: number, selloutDays: number) {
  return Math.max(0, shelfLifeDays - selloutDays)
}

function requiredDailySales(units: number, deadlineDays: number) {
  return Math.max(1, Math.ceil(units / Math.max(1, deadlineDays)))
}

function productStorageProfile(product: { shelf_life_days: number | null | undefined }) {
  const shelfLifeDays = normalizedShelfLifeDays(product.shelf_life_days)
  const shelfLife = `${shelfLifeDays} сут.`

  return {
    storage_temperature: "+2...+6 °C",
    storage_condition: `Охлажденное хранение в холодильной витрине при +2...+6 °C; ОСГ ${shelfLife}.`,
    storage_handling:
      "Сохранять холодовую цепь при перевозке и выкладке; держать в целостной индивидуальной упаковке до продажи. После вскрытия упаковки реализовать или употребить в срок не более 12 часов при соблюдении температуры.",
    storage_source_note:
      "ОСГ взят из ассортимента Lunch Up 2026; температурный режим указан как типовой режим охлажденной готовой еды для клиентской витрины."
  }
}

function pilotQuantityCap(shelfLifeDays: number) {
  if (shelfLifeDays <= 3) return 6
  if (shelfLifeDays <= 5) return 8
  if (shelfLifeDays <= 10) return 10
  return 12
}

const tradePositionCopyByLaunchRole: Record<string, string> = {
  "утренний трафик и офисный перекус":
    "Роль в матрице: закрыть утренний спрос без собственной кухни и дать клиенту стабильный SKU для повторной покупки.",
  "допродажа к кофе и чайной зоне":
    "Роль в матрице: увеличить средний чек рядом с напитками за счет простой и понятной добавки к заказу.",
  "обеденный чек и более здоровая альтернатива":
    "Роль в матрице: дать покупателю готовый обеденный выбор с контролируемой порцией, составом и сроком годности.",
  "ядро быстрой готовой еды":
    "Роль в матрице: сформировать базовую полку готовой еды с понятной ценой, упаковкой и быстрым решением о покупке."
}

const tradePositionCopyByCategory: Record<string, string> = {
  Завтраки:
    "Коммерческая роль: закрыть утренний спрос без собственной кухни и дать клиенту стабильный SKU для повторной покупки.",
  Салаты:
    "Коммерческая роль: дать покупателю готовый обеденный выбор с контролируемой порцией, составом и сроком годности.",
  Сэндвичи:
    "Коммерческая роль: сформировать базовую полку готовой еды с понятной ценой, упаковкой и быстрым решением о покупке.",
  Десерты:
    "Коммерческая роль: увеличить средний чек рядом с напитками за счет простой и понятной добавки к заказу."
}

function tradeProductPositionCopy(product: { category: string; launch_role?: string | null }) {
  const role = product.launch_role?.trim()
  return (
    (role ? tradePositionCopyByLaunchRole[role] : null) ??
    tradePositionCopyByCategory[product.category] ??
    "Готовая порционная позиция для аккуратной B2B-витрины: понятная, быстрая, готовая к продаже без кухни."
  )
}

const sellThroughProfiles: Record<string, { target_days: number; target_sell_through: number; repeat_purchase_rate: number; audience: string }> = {
  "Офисная витрина": {
    target_days: 3,
    target_sell_through: 0.68,
    repeat_purchase_rate: 0.12,
    audience: "сотрудники и арендаторы офисного кластера"
  },
  "Ритейл fresh-полка": {
    target_days: 4,
    target_sell_through: 0.62,
    repeat_purchase_rate: 0.08,
    audience: "покупатели у кофе-зоны и кассы"
  },
  "Еда к кофе": {
    target_days: 4,
    target_sell_through: 0.6,
    repeat_purchase_rate: 0.16,
    audience: "гости кофейни с быстрым перекусом к напитку"
  },
  "Вендинг-партнер": {
    target_days: 4,
    target_sell_through: 0.65,
    repeat_purchase_rate: 0.1,
    audience: "пользователи микромаркета или вендингового маршрута"
  },
  "Коворкинг холодильник": {
    target_days: 5,
    target_sell_through: 0.62,
    repeat_purchase_rate: 0.18,
    audience: "резиденты коворкинга и гости переговорных"
  },
  "Компьютерный клуб snack-витрина": {
    target_days: 4,
    target_sell_through: 0.66,
    repeat_purchase_rate: 0.22,
    audience: "гости компьютерного клуба в вечернем и ночном игровом потоке"
  },
  "Медицинский персонал": {
    target_days: 5,
    target_sell_through: 0.58,
    repeat_purchase_rate: 0.2,
    audience: "персонал клиники и посетители в дневной поток"
  },
  "Банная fresh-витрина": {
    target_days: 4,
    target_sell_through: 0.6,
    repeat_purchase_rate: 0.16,
    audience: "гости банного комплекса после парения и персонал смены"
  },
  "Отель grab&go": {
    target_days: 4,
    target_sell_through: 0.6,
    repeat_purchase_rate: 0.1,
    audience: "гости отеля и сотрудники на утреннем трафике"
  },
  "Сытная смена": {
    target_days: 4,
    target_sell_through: 0.65,
    repeat_purchase_rate: 0.14,
    audience: "персонал смены и регулярный обеденный поток"
  }
}

const directionLaunchIdeas: Record<string, string> = {
  coffee_retail: "Идея направления: встроить готовую еду в уже существующий поток у кофе, кассы или локальной fresh-полки, чтобы увеличить чек без запуска кухни.",
  workplace: "Идея направления: дать людям еду там, где они уже проводят рабочий, учебный или сервисный день, и проверить спрос короткой холодильной матрицей.",
  operators: "Идея направления: использовать существующую инфраструктуру оператора или якорного клиента и добавить управляемый meal-layer без капитальных вложений.",
  horeca: "Идея направления: закрыть готовыми SKU категории, которые площадке невыгодно производить малыми партиями, сохранив скорость и стабильность сервиса.",
  residential_transport: "Идея направления: поставить готовую еду в точку повседневного маршрута, где покупатель принимает решение быстро и рядом с домом или дорогой."
}

const segmentLaunchIdeas: Record<string, string> = {
  coffee_bakery: "Для кофейни или пекарни запуск строится как food-to-coffee полка: 6-9 SKU рядом с напитками, акцент на сэндвичи и десерты, замер прироста среднего чека без кухни.",
  coffee_chain: "Для кофейной сети запуск нужен как управляемый тест по нескольким точкам: единые SKU, понятная упаковка, сравнение продаж по локациям и масштабирование только позиций-лидеров.",
  gas_station: "Для АЗС идея запуска - fresh-полка у кофе и кассы: быстрый сытный перекус для дорожного трафика, короткий выбор и контроль продаж до следующей поставки.",
  retail_store: "Для магазина запуск работает как локальная готовая полка: 8-12 SKU у зоны кофе или кассы, проверка импульсного спроса и оставление только ежедневных лидеров.",
  retail_cluster: "Для ритейл-кластера запуск лучше начинать с одной пилотной точки, где есть общий поток арендаторов и покупателей; результатом должен стать шаблон для соседних точек.",
  office_cluster: "Для офисного кластера идея запуска - холодильная витрина в общей зоне: завтрак, обед и десерт для арендаторов, чтобы удержать дневной спрос внутри здания.",
  production_logistics: "Для склада или производства запуск - сытная сменная матрица по графику объекта: плотные сэндвичи, роллы и позиции с длинным сроком для стабильного питания персонала.",
  education_campus: "Для кампуса запуск - доступный холодильник на пиках между парами: быстрые сэндвичи, завтраки и десерты, чтобы снять очередь и дать понятный выбор студентам.",
  healthcare_clinic: "Для клиники или медцентра запуск - аккуратная витрина для персонала и посетителей: чистая упаковка, понятный состав, умеренная глубина и контроль сроков.",
  bath_spa: "Для банного или SPA-комплекса запуск - fresh-витрина у ресепшена или буфета: легкая еда после парения, десерты к чаю и перекус для персонала без расширения кухни.",
  computer_club: "Для компьютерного клуба запуск - snack-витрина у администратора или в холодильнике клуба: сытные позиции, которые удобно есть одной рукой, плюс десерты для ночного игрового потока.",
  vending_micromarket: "Для вендинга и микромаркетов запуск - meal-layer в существующих холодильниках: SKU с понятным сроком, контроль sell-through и расширение маршрута только после продаж.",
  foodservice_operator: "Для оператора питания запуск - дополнительная готовая полка к текущей столовой: закрыть сэндвичи, роллы и десерты без отдельной кухонной смены.",
  rail_partner: "Для rail-оператора запуск - supplier-first пилот в существующей инфраструктуре: проверить food-conversion, средний чек и repeat до обсуждения revenue-share.",
  lo_anchor: "Для якорного клиента ЛО запуск - маршрутная поставка от одного крупного адреса или группы точек: сначала доказать плотность рейса, затем расширять ассортимент.",
  horeca_cluster: "Для HoReCa-кластера запуск - готовые SKU для персонала, гостей и арендаторов площадки: еда доступна быстро, без очереди и без отдельного производства.",
  horeca_ready_food: "Для сегмента готовой еды запуск - тест внешнего локального поставщика: стабильная упаковка, сроки, цена и повтор по фактической матрице продаж.",
  residential_apart: "Для ЖК или апарт-комплекса запуск - микромаркет/холодильник в лобби: быстрый завтрак и вечерний перекус рядом с домом без ожидания доставки.",
  transport_cluster: "Для транспортной точки запуск - компактный grab-and-go набор: сытные позиции и десерты, которые покупатель может выбрать за секунды на маршруте."
}

function segmentLaunchIdea(input: { crmSegment: CrmSegment; primaryProject?: { jtbd: string } | null }) {
  const direction = directionLaunchIdeas[input.crmSegment.direction_code] ?? "Идея направления: запустить короткую B2B-матрицу, измерить спрос и масштабировать только доказанные SKU."
  const segment = segmentLaunchIdeas[input.crmSegment.code] ?? `Для сегмента "${input.crmSegment.label}" запуск строится как короткий пилот формата "${input.crmSegment.launch_format}" с понятным местом выкладки, ответственным и KPI.`
  const jtbd = input.primaryProject?.jtbd ? `Задача клиента: ${input.primaryProject.jtbd}` : null
  return [direction, segment, jtbd].filter(Boolean).join(" ")
}

function readLaunchContent() {
  const path = join(process.cwd(), "data", "launch-crm-content.json")
  if (!existsSync(path)) {
    return {
      catalog_analysis: [] as CatalogAnalysisItem[],
      segment_launches: [] as SegmentLaunch[],
      sales_scripts: [] as SalesScript[],
      objection_map: [] as ObjectionMapItem[]
    }
  }
  const payload = JSON.parse(readFileSync(path, "utf-8")) as {
    catalog_analysis?: CatalogAnalysisItem[]
    segment_launches?: SegmentLaunch[]
    sales_scripts?: SalesScript[]
    objection_map?: ObjectionMapItem[]
  }
  return enrichLaunchContentFromProjectSheet({
    summary: null,
    catalog_analysis: payload.catalog_analysis ?? [],
    segment_launches: payload.segment_launches ?? [],
    sales_scripts: payload.sales_scripts ?? [],
    objection_map: payload.objection_map ?? []
  })
}

const transliterationMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya"
}

function baseCatalogSegmentSlug(value: string) {
  return normalizeProductPhotoKey(value)
    .replace(/[^a-zа-я0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function catalogSegmentSlug(value: string) {
  return baseCatalogSegmentSlug(value)
    .split("")
    .map((char) => transliterationMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function clientCatalogHref(segment?: string | null) {
  if (!segment) return "/catalog"
  return `/catalog?segment=${encodeURIComponent(segment)}`
}

function tableExists(db: ReturnType<typeof getDb>, name: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name))
}

function loadCrmSegments(db: ReturnType<typeof getDb>): CrmSegment[] {
  if (!tableExists(db, "crm_segments")) syncCrmSegments(db)
  const activeCount = db.prepare("SELECT COUNT(*) AS count FROM crm_segments WHERE is_active = 1").get() as { count: number }
  if (activeCount.count === 0) syncCrmSegments(db)
  return (db.prepare(`
    SELECT
      code,
      label,
      direction_code,
      direction_label,
      direction_description,
      direction_position,
      segment_position,
      launch_format,
      is_active
    FROM crm_segments
    WHERE is_active = 1
    ORDER BY direction_position, segment_position, label
  `).all() as Array<Omit<CrmSegment, "is_active"> & { is_active: number }>).map((row) => ({
    ...row,
    is_active: Boolean(row.is_active)
  }))
}

function resolveSelectedCrmSegment(
  segmentParam: string | null | undefined,
  crmSegments: CrmSegment[],
  launches: SegmentLaunch[]
) {
  const raw = segmentParam?.trim()
  if (!raw || raw === "all") return null
  const normalized = raw.toLowerCase()
  const bySegment =
    crmSegments.find((segment) =>
      [
        segment.code,
        catalogSegmentSlug(segment.code),
        baseCatalogSegmentSlug(segment.code),
        segment.label,
        catalogSegmentSlug(segment.label),
        baseCatalogSegmentSlug(segment.label)
      ]
        .map((item) => item.toLowerCase())
        .includes(normalized)
    ) ?? null
  if (bySegment) return bySegment

  const launch = launches.find((segmentLaunch) =>
    [
      segmentLaunch.format,
      catalogSegmentSlug(segmentLaunch.format),
      baseCatalogSegmentSlug(segmentLaunch.format)
    ]
      .map((item) => item.toLowerCase())
      .includes(normalized)
  )
  if (!launch) return null
  return crmSegments.find((segment) => segment.launch_format === launch.format) ?? null
}

function buildSegmentGroups(segments: ClientCatalogCrmSegment[]): ClientCatalogSegmentGroup[] {
  const groups = new Map<string, ClientCatalogSegmentGroup & { position: number }>()
  for (const segment of segments) {
    let group = groups.get(segment.direction_code)
    if (!group) {
      group = {
        code: segment.direction_code,
        label: segment.direction_label,
        description: segment.direction_description,
        position: segment.direction_position,
        segments: []
      }
      groups.set(segment.direction_code, group)
    }
    group.segments.push(segment)
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      segments: group.segments.sort((a, b) => a.segment_position - b.segment_position || a.label.localeCompare(b.label, "ru"))
    }))
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "ru"))
    .map(({ position: _position, ...group }) => group)
}

function parseLaunchSkuList(segment: SegmentLaunch): LaunchSku[] {
  const items: LaunchSku[] = []
  for (const field of launchCategoryFields) {
    const value = segment[field.key]
    if (!value) continue
    for (const raw of value.split(";")) {
      const entry = raw.trim()
      if (!entry) continue
      const match = entry.match(/^(.*?)\s+x(\d+)$/i)
      items.push({
        format: segment.format,
        category: field.label,
        name: (match?.[1] ?? entry).trim(),
        quantity: match?.[2] ? Number(match[2]) : null
      })
    }
  }
  return items
}

function productDescription(product: {
  category: string
  launch_role?: string | null
  best_segments?: string | null
}) {
  const intro = categoryDescriptions[product.category] ?? "Готовая порционная позиция для B2B-витрины."
  return `${intro} ${tradeProductPositionCopy(product)}`
}

function groupProducts(products: ClientCatalogProduct[]) {
  const byCategory = new Map<string, ClientCatalogProduct[]>()
  for (const product of products) {
    byCategory.set(product.category, [...(byCategory.get(product.category) ?? []), product])
  }

  return Array.from(byCategory.entries())
    .map(([name, products]) => ({ name, products }))
    .sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.name)
      const bIndex = categoryOrder.indexOf(b.name)
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.name.localeCompare(b.name, "ru")
    })
}

function groupBundleItems(items: LaunchSkuPriced[]): ClientCatalogBundle[] {
  const byCategory = new Map<string, LaunchSkuPriced[]>()
  for (const item of items) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item])
  }

  return Array.from(byCategory.entries())
    .map(([category, items]) => {
      const totalUnits = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
      const totalAmount = items.reduce((sum, item) => sum + item.total_amount, 0)
      const retailRevenue = items.reduce((sum, item) => sum + item.retail_total, 0)
      const taxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0)
      const revenueAfterTax = retailRevenue - taxAmount
      const grossProfit = items.reduce((sum, item) => sum + item.gross_profit, 0)
      const netProfit = items.reduce((sum, item) => sum + item.net_profit, 0)
      return {
        category,
        items,
        total_units: totalUnits,
        total_amount: totalAmount,
        retail_revenue: retailRevenue,
        tax_amount: taxAmount,
        revenue_after_tax: revenueAfterTax,
        gross_profit: grossProfit,
        net_profit: netProfit,
        food_cost_percent: financialPercent(totalAmount, retailRevenue),
        gross_margin_percent: financialPercent(grossProfit, retailRevenue),
        net_margin_percent: financialPercent(netProfit, retailRevenue),
        markup_percent: financialMarkup(retailRevenue, totalAmount),
        roi_percent: financialRoi(netProfit, totalAmount)
      }
    })
    .sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.category)
      const bIndex = categoryOrder.indexOf(b.category)
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.category.localeCompare(b.category, "ru")
    })
}

function makeScenario(input: {
  label: string
  dailyBuyers: number
  totalUnits: number
  targetDays: number
  repeatPurchaseRate: number
  shelfLifeDays: number
}): ClientCatalogSellThroughScenario {
  const dailyBuyers = Math.max(1, input.dailyBuyers)
  const selloutDays = Math.max(1, Math.ceil(input.totalUnits / dailyBuyers))
  const peopleRepeatFactor = Math.max(0.65, 1 - input.repeatPurchaseRate)
  return {
    label: input.label,
    daily_buyers: dailyBuyers,
    sellout_days: selloutDays,
    unique_people: Math.max(1, Math.ceil(input.totalUnits * peopleRepeatFactor)),
    day_3_sell_through: Math.min(100, Math.round(((dailyBuyers * input.targetDays) / input.totalUnits) * 100)),
    within_shelf_life: selloutDays <= input.shelfLifeDays,
    shelf_life_safety_days: shelfLifeSafetyDays(input.shelfLifeDays, selloutDays)
  }
}

function optimizePilotMatrixForDiversity(items: LaunchSkuPriced[], minimumOrderAmount: number) {
  const workingItems = items
    .filter((item) => item.price > 0)
    .map((item) => {
      const shelfLifeDays = normalizedShelfLifeDays(item.shelf_life_days)
      const quantity = Math.max(2, Math.min(item.quantity ?? 0, pilotQuantityCap(shelfLifeDays)))
      return { ...item, shelf_life_days: shelfLifeDays, quantity }
    })

  if (!workingItems.length) return workingItems

  let capBoost = 0
  let safety = 0
  const total = () => workingItems.reduce((sum, item) => sum + item.price * (item.quantity ?? 0), 0)

  while (total() < minimumOrderAmount && safety < 5000) {
    safety += 1
    const candidate = workingItems
      .filter((item) => (item.quantity ?? 0) < pilotQuantityCap(normalizedShelfLifeDays(item.shelf_life_days)) + capBoost)
      .sort((a, b) => {
        const quantityDelta = (a.quantity ?? 0) - (b.quantity ?? 0)
        if (quantityDelta !== 0) return quantityDelta
        const shelfDelta = normalizedShelfLifeDays(b.shelf_life_days) - normalizedShelfLifeDays(a.shelf_life_days)
        if (shelfDelta !== 0) return shelfDelta
        return a.price - b.price
      })[0]

    if (!candidate) {
      capBoost += 1
      if (capBoost > 6) break
      continue
    }
    candidate.quantity = (candidate.quantity ?? 0) + 1
  }

  return workingItems.map((item) => {
    const quantity = item.quantity ?? 0
    const retail = clientRetailPrice({ category: item.category, price: item.price })
    const retailTotal = retail.price * quantity
    const taxAmount = retailTotal * clientRetailTaxRate
    const revenueAfterTax = retailTotal - taxAmount
    const grossProfit = retailTotal - item.price * quantity
    const netProfit = revenueAfterTax - item.price * quantity
    return {
      ...item,
      quantity,
      total_amount: item.price * quantity,
      retail_price: retail.price,
      retail_total: retailTotal,
      revenue_after_tax: revenueAfterTax,
      tax_amount: taxAmount,
      gross_profit: grossProfit,
      net_profit: netProfit,
      food_cost_percent: financialPercent(item.price * quantity, retailTotal),
      gross_margin_percent: financialPercent(grossProfit, retailTotal),
      net_margin_percent: financialPercent(netProfit, retailTotal),
      markup_percent: financialMarkup(retailTotal, item.price * quantity),
      roi_percent: financialRoi(netProfit, item.price * quantity),
      retail_source: retail.source
    }
  })
}

function buildCommercialOffer(
  segment: SegmentLaunch | null,
  productPriceByName: Map<string, { name: string; price: number; shelf_life_days: number | null }>,
  minimumOrderAmount: number
): ClientCatalogCommercialOffer | null {
  if (!segment) return null

  const rawItems = parseLaunchSkuList(segment)
  const matrixItems = rawItems.map((item) => {
    const product = productPriceByName.get(normalizeProductPhotoKey(item.name))
    const price = product?.price ?? 0
    const quantity = item.quantity ?? 0
    const retail = clientRetailPrice({ category: item.category, price })
    const totalAmount = price * quantity
    const retailTotal = retail.price * quantity
    const taxAmount = retailTotal * clientRetailTaxRate
    const revenueAfterTax = retailTotal - taxAmount
    const grossProfit = retailTotal - totalAmount
    const netProfit = revenueAfterTax - totalAmount
    return {
      ...item,
      price,
      total_amount: totalAmount,
      shelf_life_days: product?.shelf_life_days ?? null,
      retail_price: retail.price,
      retail_total: retailTotal,
      revenue_after_tax: revenueAfterTax,
      tax_amount: taxAmount,
      gross_profit: grossProfit,
      net_profit: netProfit,
      food_cost_percent: financialPercent(totalAmount, retailTotal),
      gross_margin_percent: financialPercent(grossProfit, retailTotal),
      net_margin_percent: financialPercent(netProfit, retailTotal),
      markup_percent: financialMarkup(retailTotal, totalAmount),
      roi_percent: financialRoi(netProfit, totalAmount),
      retail_source: retail.source
    }
  })
  const items = optimizePilotMatrixForDiversity(matrixItems, minimumOrderAmount)
  if (!items.length) return null
  const packageTotal = items.reduce((sum, item) => sum + item.total_amount, 0)
  const totalUnits = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  const retailRevenue = items.reduce((sum, item) => sum + item.retail_total, 0)
  const taxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0)
  const revenueAfterTax = retailRevenue - taxAmount
  const grossProfit = items.reduce((sum, item) => sum + item.gross_profit, 0)
  const netProfit = items.reduce((sum, item) => sum + item.net_profit, 0)
  const minShelfLifeDays = Math.min(...items.map((item) => normalizedShelfLifeDays(item.shelf_life_days)))
  const shelfLifeDeadlineDays = selloutDeadlineDays(minShelfLifeDays)
  const profile =
    sellThroughProfiles[segment.format] ?? {
      target_days: 4,
      target_sell_through: 0.62,
      repeat_purchase_rate: 0.12,
      audience: "покупатели точки в регулярном дневном потоке"
    }
  const noWriteoffDays = Math.max(1, Math.min(profile.target_days, shelfLifeDeadlineDays))
  const selloutSafety = shelfLifeSafetyDays(minShelfLifeDays, noWriteoffDays)
  const shelfLifeBufferDays = Math.max(0, minShelfLifeDays - shelfLifeDeadlineDays)
  const targetUnits = totalUnits
  const targetDailyBuyers = requiredDailySales(targetUnits, noWriteoffDays)
  const fullSelloutDays = Math.max(1, Math.ceil(totalUnits / targetDailyBuyers))
  const peopleRepeatFactor = Math.max(0.65, 1 - profile.repeat_purchase_rate)
  const peopleToSellOut = Math.max(1, Math.ceil(totalUnits * peopleRepeatFactor))
  const forecastDailyPeople = Math.max(1, Math.ceil(targetDailyBuyers * peopleRepeatFactor))
  const slowDailyBuyers = Math.max(1, Math.floor(targetDailyBuyers * 0.72))
  const fastDailyBuyers = Math.max(targetDailyBuyers + 1, requiredDailySales(totalUnits, Math.max(1, noWriteoffDays - 1)))
  const averageRetailPrice = totalUnits ? retailRevenue / totalUnits : 0
  const averageWholesalePrice = totalUnits ? packageTotal / totalUnits : 0
  const breakEvenUnits = averageRetailPrice
    ? Math.min(totalUnits, Math.ceil(packageTotal / (averageRetailPrice * (1 - clientRetailTaxRate))))
    : totalUnits
  const breakEvenDays = Math.max(1, Math.ceil(breakEvenUnits / targetDailyBuyers))
  const financialItems: ClientCatalogFinancialItem[] = items.map((item) => {
    const itemShelfLifeDays = normalizedShelfLifeDays(item.shelf_life_days)
    const itemDeadlineDays = selloutDeadlineDays(itemShelfLifeDays)
    const itemQuantity = item.quantity ?? 0
    return {
      category: item.category,
      name: item.name,
      quantity: itemQuantity,
      shelf_life_days: item.shelf_life_days,
      wholesale_price: item.price,
      wholesale_total: item.total_amount,
      retail_price: item.retail_price,
      retail_revenue: item.retail_total,
      revenue_after_tax: item.revenue_after_tax,
      tax_amount: item.tax_amount,
      gross_profit: item.gross_profit,
      net_profit: item.net_profit,
      food_cost_percent: item.food_cost_percent,
      gross_margin_percent: item.gross_margin_percent,
      net_margin_percent: item.net_margin_percent,
      markup_percent: item.markup_percent,
      roi_percent: item.roi_percent,
      retail_source: item.retail_source,
      sellout_deadline_days: itemDeadlineDays,
      required_daily_sales: requiredDailySales(itemQuantity, Math.min(noWriteoffDays, itemDeadlineDays)),
      shelf_life_safety_days: shelfLifeSafetyDays(itemShelfLifeDays, noWriteoffDays)
    }
  })
  const shelfLifePlanNote = `План выкупа: ${targetDailyBuyers} покупок в день или около ${forecastDailyPeople} уникальных людей в день, чтобы ${totalUnits} порций ушли за ${noWriteoffDays} дн. при минимальном ОСГ ${minShelfLifeDays} сут.`

  return {
    format: segment.format,
    package_total: packageTotal,
    total_units: totalUnits,
    sku_count: items.length,
    average_unit_price: totalUnits ? packageTotal / totalUnits : 0,
    target_days: noWriteoffDays,
    target_sell_through: 100,
    target_units: targetUnits,
    target_daily_buyers: targetDailyBuyers,
    full_sellout_days: fullSelloutDays,
    people_to_sell_out: peopleToSellOut,
    forecast_daily_people: forecastDailyPeople,
    shelf_life_deadline_days: shelfLifeDeadlineDays,
    sellout_safety_days: selloutSafety,
    shelf_life_plan_note: shelfLifePlanNote,
    repeat_purchase_rate: Math.round(profile.repeat_purchase_rate * 100),
    assumptions: [
      `Аудитория: ${profile.audience}.`,
      `Один покупатель в модели берет одну порцию за покупку; повторные покупки учтены как ${Math.round(profile.repeat_purchase_rate * 100)}%, поэтому для прогноза нужны и покупки, и люди.`,
      `Матрица собрана по принципу разнообразия: ${items.length} SKU, умеренная глубина на позицию, сумма не ниже минимального заказа Lunch Up ${minimumOrderAmount} руб.`,
      `План без списаний: весь набор должен выкупиться за ${noWriteoffDays} дн.; это на ${selloutSafety} дн. раньше окончания минимального ОСГ ${minShelfLifeDays} сут.`,
      `Операционные условия Lunch Up: заказ размещается заранее, поэтому пилот планируется как поставка под заказ, а не как закупка с неизвестным спросом.`
    ],
    bundles: groupBundleItems(items),
    scenarios: [
      makeScenario({
        label: "Осторожный",
        dailyBuyers: slowDailyBuyers,
        totalUnits,
        targetDays: noWriteoffDays,
        repeatPurchaseRate: profile.repeat_purchase_rate,
        shelfLifeDays: minShelfLifeDays
      }),
      makeScenario({
        label: "Базовый",
        dailyBuyers: targetDailyBuyers,
        totalUnits,
        targetDays: noWriteoffDays,
        repeatPurchaseRate: profile.repeat_purchase_rate,
        shelfLifeDays: minShelfLifeDays
      }),
      makeScenario({
        label: "Быстрый",
        dailyBuyers: fastDailyBuyers,
        totalUnits,
        targetDays: noWriteoffDays,
        repeatPurchaseRate: profile.repeat_purchase_rate,
        shelfLifeDays: minShelfLifeDays
      })
    ],
    financial_model: {
      tax_mode_label: clientRetailTaxLabel,
      tax_rate_percent: Math.round(clientRetailTaxRate * 100),
      tax_basis: clientRetailTaxBasis,
      tax_scenario_note: clientRetailTaxScenarioNote,
      retail_price_source: clientRetailSource,
      sku_count: items.length,
      total_units: totalUnits,
      purchase_cost: packageTotal,
      retail_revenue: retailRevenue,
      revenue_after_tax: revenueAfterTax,
      average_wholesale_price: averageWholesalePrice,
      average_retail_price: averageRetailPrice,
      gross_profit: grossProfit,
      tax_amount: taxAmount,
      net_profit: netProfit,
      food_cost_percent: financialPercent(packageTotal, retailRevenue),
      gross_margin_percent: financialPercent(grossProfit, retailRevenue),
      net_margin_percent: financialPercent(netProfit, retailRevenue),
      markup_percent: financialMarkup(retailRevenue, packageTotal),
      roi_percent: financialRoi(netProfit, packageTotal),
      break_even_units: breakEvenUnits,
      break_even_days: breakEvenDays,
      min_shelf_life_days: minShelfLifeDays,
      sellout_deadline_days: shelfLifeDeadlineDays,
      shelf_life_buffer_days: shelfLifeBufferDays,
      sellout_safety_days: selloutSafety,
      required_daily_buyers: targetDailyBuyers,
      forecast_daily_people: forecastDailyPeople,
      forecast_total_people: peopleToSellOut,
      no_writeoff_days: noWriteoffDays,
      no_writeoff_note: `${shelfLifePlanNote} В модели Lunch Up поставляет под заказ, плановые списания Lunch Up = 0; клиентский пилот рассчитан на полный выкуп в пределах срока годности.`,
      diversity_note: "Рекомендация: набрать больше разных SKU с малой глубиной, потому что при минимальном заказе от 7000 руб. ассортимент снижает риск непроданных остатков лучше, чем одна позиция большим количеством.",
      items: financialItems
    }
  }
}

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)))
}

function sentence(value: string | null | undefined, fallback: string) {
  const clean = (value || fallback).trim().replace(/\s+/g, " ")
  return clean.replace(/[.;:!?]+$/g, "")
}

function segmentLeadMetrics(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    SELECT
      s.code,
      COUNT(DISTINCT c.id) AS lead_count,
      ROUND(AVG(c.lead_score)) AS avg_score,
      COALESCE(SUM(d.estimated_monthly_revenue), 0) AS pipeline_value
    FROM crm_segments s
    LEFT JOIN companies c ON c.segment = s.code
    LEFT JOIN deals d ON d.company_id = c.id
    WHERE s.is_active = 1
    GROUP BY s.code
  `).all() as Array<{ code: string; lead_count: number; avg_score: number | null; pipeline_value: number | null }>
  return new Map(
    rows.map((row) => [
      row.code,
      {
        lead_count: Number(row.lead_count ?? 0),
        avg_score: Number(row.avg_score ?? 0),
        pipeline_value: Number(row.pipeline_value ?? 0)
      }
    ])
  )
}

function pickSegmentObjection(input: {
  crmSegment: CrmSegment
  projectSegments: typeof projectSheetSegments
  objections: ObjectionMapItem[]
}) {
  if (input.crmSegment.code === "vending_micromarket") {
    const vending = input.objections.find((objection) => objection.stage.toLowerCase().includes("вендинг"))
    if (vending) return vending
  }
  if (input.crmSegment.code === "bath_spa") {
    const bath = input.objections.find((objection) => objection.stage.toLowerCase().includes("бан"))
    if (bath) return bath
  }

  const exactPain = input.objections.find((objection) =>
    input.projectSegments.some((segment) => segment.pain === objection.objection)
  )
  if (exactPain) return exactPain

  const jtbd = input.objections.find((objection) =>
    input.projectSegments.some((segment) => objection.why_it_matters?.includes(segment.segment))
  )
  if (jtbd) return jtbd

  return (
    input.objections.find((objection) => objection.stage === "Локальные лиды") ??
    input.objections[0] ?? {
      stage: "Пилот",
      objection: "Нужно понять спрос и не получить списания.",
      why_it_matters: "Клиенту нужен безопасный первый шаг.",
      response: "Запускаем короткую матрицу, считаем продажи и расширяем только SKU, которые доказали спрос.",
      proof_or_asset: "Стартовая матрица, каталог SKU и KPI пилота.",
      next_question: "Какую одну точку выберем для первого безопасного запуска?"
    }
  )
}

function buildCommercialProposal(input: {
  crmSegment: CrmSegment
  launch: SegmentLaunch | null
  offer: ClientCatalogCommercialOffer | null
  scripts: SalesScript[]
  objections: ObjectionMapItem[]
  orderTerms: ClientCatalogData["order_terms"]
}): ClientCatalogProposal {
  const segmentProjectRows = projectSheetSegments.filter((item) => item.crm_segment_code === input.crmSegment.code)
  const segmentScripts = input.scripts.filter(
    (script) =>
      script.crm_segment_code === input.crmSegment.code ||
      script.launch_format === input.crmSegment.launch_format ||
      [script.audience, script.script, script.offer].join(" ").toLowerCase().includes(input.crmSegment.label.toLowerCase())
  )
  const primaryProject = segmentProjectRows[0] ?? null
  const primaryScript = segmentScripts.find((script) => script.crm_segment_code === input.crmSegment.code) ?? segmentScripts[0] ?? null
  const objection = pickSegmentObjection({
    crmSegment: input.crmSegment,
    projectSegments: segmentProjectRows,
    objections: input.objections
  })
  const launchName = input.launch?.format ?? input.crmSegment.launch_format
  const packageTotal = input.offer?.package_total ?? input.orderTerms.minimum_order_amount
  const totalUnits = input.offer?.total_units ?? 0
  const skuCount = input.offer?.sku_count ?? 0
  const kpi = input.offer
    ? `100% выкуп пилотного набора за ${input.offer.target_days} дн. без плановых списаний и решение о повторном заказе`
    : input.launch?.kpi ?? "зафиксировать продажи, темп выкупа и решение о повторном заказе"
  const pains = compactUnique([
    ...segmentProjectRows.map((item) => item.pain),
    objection.objection
  ]).slice(0, 3)
  const needs = compactUnique([
    ...segmentProjectRows.map((item) => item.need),
    input.launch?.pitch
  ]).slice(0, 3)
  const solutions = compactUnique([
    ...segmentProjectRows.map((item) => item.solution),
    primaryScript?.offer,
    input.launch?.pitch
  ])
  const routeLogic = compactUnique(segmentProjectRows.map((item) => item.route_logic)).slice(0, 2)
  const managerFocus = compactUnique(segmentProjectRows.map((item) => item.manager_focus)).slice(0, 2)
  const launchIdea = segmentLaunchIdea({ crmSegment: input.crmSegment, primaryProject })

  return {
    title: `Коммерческое предложение Lunch Up для сегмента "${input.crmSegment.label}"`,
    subtitle: `${input.crmSegment.direction_label} / запуск "${launchName}"`,
    segment_label: input.crmSegment.label,
    direction_label: input.crmSegment.direction_label,
    launch_format: launchName,
    audience: primaryProject?.segment ?? input.crmSegment.label,
    launch_idea: launchIdea,
    opening_pitch: [
      launchIdea,
      `Формат первого шага: "${launchName}" без вывода всего каталога в переговоры.`,
      sentence(primaryScript?.script, primaryProject?.jtbd ?? input.launch?.pitch ?? "Цель - безопасно проверить спрос на готовую еду в точке")
    ].join(" "),
    client_pains: pains.length ? pains : ["Клиенту нужно проверить спрос без риска широкой закупки и лишних списаний."],
    client_needs: needs.length ? needs : ["Понятный пилот, регулярная поставка, контроль продаж и решение о повторе по фактам."],
    recommended_solution: solutions[0] ?? launchIdea,
    pilot_scope: compactUnique([
      `Стартовая матрица: ${skuCount || "8-12"} SKU, ${totalUnits || "первая партия"} порций, ориентир закупки ${packageTotal} руб.`,
      input.offer
        ? `Финансовая модель: выручка по РРЦ ${Math.round(input.offer.financial_model.retail_revenue)} руб., прибыль после налога ${Math.round(input.offer.financial_model.net_profit)} руб., ROI ${input.offer.financial_model.roi_percent}%.`
        : null,
      ...routeLogic,
      ...managerFocus,
      "После пилота оставляем SKU-лидеры и расширяем только доказанные позиции."
    ]),
    kpi,
    objection: {
      title: objection.objection,
      response: objection.response,
      proof: objection.proof_or_asset,
      next_question: objection.next_question
    },
    first_delivery: {
      order_amount: packageTotal,
      total_units: totalUnits,
      sku_count: skuCount,
      terms: [
        `Минимальный заказ: ${input.orderTerms.minimum_order_amount} руб. на торговую точку.`,
        `Заказ: за ${input.orderTerms.order_lead_time_days} дня до ${input.orderTerms.order_cutoff_time}.`,
        `Доставка СПб: ${input.orderTerms.free_delivery_city}, ${input.orderTerms.free_delivery_days}.`,
        `Оплата: ${input.orderTerms.payment_terms}.`
      ]
    },
    closing_script:
      primaryScript?.closing_question ??
      `Согласуем одну точку, дату первой поставки и критерий успеха пилота "${launchName}"?`,
    crm_sources: compactUnique([
      "CRM: вкладка О компании / позиционирование Lunch Up как фабрики готовой еды",
      "CRM: crm_segments / направление и сегмент",
      "CRM: матрица запуска и SKU из клиентского каталога",
      segmentProjectRows.length ? "CRM: JTBD-сегменты и контент из Google Sheet" : null,
      segmentScripts.length ? "CRM: скрипт продажи по сегменту" : null,
      input.objections.length ? "CRM: карта возражений" : null,
      "CRM: условия сотрудничества и правила заказа"
    ]),
    psychology: [
      {
        model: "Paradox of Choice",
        plfs: 15,
        application: "КП предлагает короткий запуск вместо всего каталога, чтобы клиенту было проще согласовать первый заказ."
      },
      {
        model: "Risk Reversal",
        plfs: 14,
        application: "Пилот ограничен одной точкой, KPI и повторным заказом только по фактическим продажам."
      },
      {
        model: "Jobs to Be Done",
        plfs: 14,
        application: "Текст КП строится от задачи сегмента: зачем клиенту готовая еда именно в его локации."
      },
      {
        model: "Anchoring",
        plfs: 12,
        application: "Первый якорь решения - сумма стартового набора, порции, SKU и ежедневный темп выкупа."
      }
    ]
  }
}

export function getClientCatalogData(segmentParam?: string | null): ClientCatalogData {
  const db = getDb()
  let launch = readLaunchContent()
  const activeStrategy = getActiveStrategy()
  const settings = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>
  const terms = Object.fromEntries(settings.map((row) => [row.key, row.value]))
  const orderTerms = {
    minimum_order_amount: Number(terms.min_order_amount ?? 7000),
    free_delivery_city: terms.free_delivery_city ?? "Санкт-Петербург",
    free_delivery_days: terms.free_delivery_days ?? "понедельник-четверг",
    lo_delivery_terms: terms.lo_delivery_terms ?? activeStrategy.lo_delivery_terms,
    order_lead_time_days: Number(terms.order_lead_time_days ?? 2),
    order_cutoff_time: terms.order_cutoff_time ?? "15:00",
    payment_terms: terms.payment_terms ?? "по счету"
  }

  const productRows = attachProductPhotos(db.prepare(`
    SELECT
      id,
      category,
      name,
      net_weight,
      shelf_life_days,
      wholesale_price,
      composition,
      nutrition,
      image_url,
      product_url,
      image_source,
      image_match,
      image_note,
      site_title
    FROM products
    WHERE is_active = 1
    ORDER BY category, name
  `).all() as ProductRow[])

  const analysisRows = attachProductPhotos(launch.catalog_analysis)
  const analysisByName = new Map(analysisRows.map((item) => [normalizeProductPhotoKey(item.name), item]))
  const productPriceByName = new Map(
    productRows.map((product) => {
      const analysis = analysisByName.get(normalizeProductPhotoKey(product.name))
      return [
        normalizeProductPhotoKey(product.name),
        {
          name: product.name,
          price: analysis?.price ?? product.wholesale_price,
          shelf_life_days: product.shelf_life_days
        }
      ]
    })
  )
  const crmSegments = loadCrmSegments(db).filter((segment) => segment.code !== "lo_anchor")
  const matrixProductRows = db.prepare(`
    SELECT
      m.segment,
      p.id,
      p.category,
      p.name,
      p.wholesale_price,
      p.shelf_life_days,
      mi.role,
      mi.priority
    FROM segment_matrices m
    JOIN matrix_items mi ON mi.matrix_id = m.id
    JOIN products p ON p.id = mi.product_id
    WHERE p.is_active = 1
    ORDER BY m.id, mi.priority DESC, p.name
  `).all() as SqliteSegmentMatrixItem[]
  launch = {
    ...launch,
    segment_launches: adaptSegmentLaunchesToSqliteCatalog({
      segmentLaunches: launch.segment_launches,
      crmSegments,
      products: productRows,
      matrixItems: matrixProductRows,
      minimumOrderAmount: orderTerms.minimum_order_amount
    })
  }
  const crmMetrics = segmentLeadMetrics(db)
  const selectedCrmSegment = resolveSelectedCrmSegment(segmentParam, crmSegments, launch.segment_launches)
  const selectedSegment =
    selectedCrmSegment
      ? launch.segment_launches.find((segment) => segment.format === selectedCrmSegment.launch_format) ?? null
      : launch.segment_launches.find((segment) => {
          if (!segmentParam || segmentParam === "all") return false
          return (
            catalogSegmentSlug(segment.format) === segmentParam ||
            baseCatalogSegmentSlug(segment.format) === segmentParam ||
            segment.format === segmentParam
          )
        }) ?? null

  const launchItemsByName = new Map<string, LaunchSku[]>()
  const segmentSkuCounts = new Map<string, number>()
  const segmentOfferByFormat = new Map<string, ClientCatalogCommercialOffer>()
  for (const segment of launch.segment_launches) {
    const segmentItems = parseLaunchSkuList(segment)
    segmentSkuCounts.set(segment.format, segmentItems.length)
    const offer = buildCommercialOffer(segment, productPriceByName, orderTerms.minimum_order_amount)
    if (offer) segmentOfferByFormat.set(segment.format, offer)
    for (const item of segmentItems) {
      const key = normalizeProductPhotoKey(item.name)
      launchItemsByName.set(key, [...(launchItemsByName.get(key) ?? []), item])
    }
  }
  const clientSegments: ClientCatalogCrmSegment[] = crmSegments.map((segment) => {
    const offer = segmentOfferByFormat.get(segment.launch_format)
    const metrics = crmMetrics.get(segment.code) ?? { lead_count: 0, avg_score: 0, pipeline_value: 0 }
    return {
      ...segment,
      slug: segment.code,
      package_total: offer?.package_total ?? 0,
      total_units: offer?.total_units ?? 0,
      sku_count: offer?.sku_count ?? 0,
      min_shelf_life_days: offer?.financial_model.min_shelf_life_days ?? 0,
      sellout_deadline_days: offer?.financial_model.sellout_deadline_days ?? 0,
      target_days: offer?.target_days ?? 0,
      sellout_safety_days: offer?.financial_model.sellout_safety_days ?? 0,
      target_daily_buyers: offer?.target_daily_buyers ?? 0,
      people_to_sell_out: offer?.people_to_sell_out ?? 0,
      lead_count: metrics.lead_count,
      avg_score: metrics.avg_score,
      pipeline_value: metrics.pipeline_value
    }
  })
  const selectedClientCrmSegment =
    selectedCrmSegment ? clientSegments.find((segment) => segment.code === selectedCrmSegment.code) ?? null : null
  const commercialOffer = selectedSegment ? segmentOfferByFormat.get(selectedSegment.format) ?? null : null
  const commercialProposal =
    selectedClientCrmSegment
      ? buildCommercialProposal({
          crmSegment: selectedClientCrmSegment,
          launch: selectedSegment,
          offer: commercialOffer,
          scripts: launch.sales_scripts ?? [],
          objections: launch.objection_map ?? [],
          orderTerms
        })
      : null

  const products = productRows
    .map((product) => {
      const analysis = analysisByName.get(normalizeProductPhotoKey(product.name))
      const launchSegments = launchItemsByName.get(normalizeProductPhotoKey(product.name)) ?? []
      const selectedLaunchItem = selectedSegment
        ? commercialOffer?.financial_model.items.find((item) => normalizeProductPhotoKey(item.name) === normalizeProductPhotoKey(product.name)) ?? null
        : null
      const selectedQuantity = selectedLaunchItem?.quantity ?? null
      const unitEconomics = clientUnitEconomics({
        name: product.name,
        category: product.category,
        price: analysis?.price ?? product.wholesale_price
      })
      const storageProfile = productStorageProfile({ shelf_life_days: product.shelf_life_days })

      return {
        id: product.id,
        category: product.category,
        name: product.name,
        net_weight: product.net_weight,
        shelf_life_days: product.shelf_life_days,
        storage_temperature: storageProfile.storage_temperature,
        storage_condition: storageProfile.storage_condition,
        storage_handling: storageProfile.storage_handling,
        storage_source_note: storageProfile.storage_source_note,
        price: analysis?.price ?? product.wholesale_price,
        retail_price: unitEconomics.retail_price,
        retail_source: unitEconomics.retail_source,
        client_tax_per_unit: unitEconomics.client_tax_per_unit,
        client_profit_per_unit: unitEconomics.client_profit_per_unit,
        client_margin_percent: unitEconomics.client_margin_percent,
        composition: product.composition,
        nutrition: product.nutrition,
        image_url: product.image_url,
        product_url: product.product_url,
        description: productDescription({
          category: product.category,
          launch_role: analysis?.launch_role,
          best_segments: analysis?.best_segments
        }),
        launch_role: analysis?.launch_role ?? "",
        best_segments: analysis?.best_segments ?? "",
        launch_segments: launchSegments,
        selected_quantity: selectedQuantity,
        selected_line_total: selectedQuantity ? (analysis?.price ?? product.wholesale_price) * selectedQuantity : null,
        selected_retail_total: selectedLaunchItem ? selectedLaunchItem.retail_revenue : null,
        selected_client_profit_total: selectedLaunchItem ? selectedLaunchItem.net_profit : null
      } satisfies ClientCatalogProduct
    })
    .filter((product) => !selectedSegment || product.launch_segments.some((item) => item.format === selectedSegment.format))
    .sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.category)
      const bIndex = categoryOrder.indexOf(b.category)
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.name.localeCompare(b.name, "ru")
    })

  return {
    generated_at: new Date().toISOString(),
    selected_crm_segment: selectedClientCrmSegment,
    selected_segment: selectedSegment,
    selected_segment_slug: selectedClientCrmSegment?.slug ?? (selectedSegment ? catalogSegmentSlug(selectedSegment.format) : null),
    commercial_proposal: commercialProposal,
    commercial_offer: commercialOffer,
    products,
    categories: groupProducts(products),
    segment_groups: buildSegmentGroups(clientSegments),
    segment_launches: launch.segment_launches.map((segment) => {
      const offer = segmentOfferByFormat.get(segment.format)
      return {
        ...segment,
        slug: catalogSegmentSlug(segment.format),
        sku_count: segmentSkuCounts.get(segment.format) ?? 0,
        package_total: offer?.package_total ?? 0,
        total_units: offer?.total_units ?? 0,
        min_shelf_life_days: offer?.financial_model.min_shelf_life_days ?? 0,
        sellout_deadline_days: offer?.financial_model.sellout_deadline_days ?? 0,
        target_days: offer?.target_days ?? 0,
        sellout_safety_days: offer?.financial_model.sellout_safety_days ?? 0,
        target_daily_buyers: offer?.target_daily_buyers ?? 0,
        people_to_sell_out: offer?.people_to_sell_out ?? 0
      }
    }),
    order_terms: orderTerms
  }
}
