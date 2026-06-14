"use client"

import * as React from "react"
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Database,
  ExternalLink,
  Filter,
  Mail,
  PackageCheck,
  Phone,
  Plug,
  Printer,
  RefreshCw,
  Refrigerator,
  Ruler,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  Sparkles,
  Store,
  Target,
  Truck,
  Utensils,
  Users
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildClientLineScript, segmentRoleProfiles, stageScriptBlocks } from "@/lib/sales-script-matrix"
import type { LaunchSkuItem } from "@/lib/sales-script-matrix"
import type { IntegrationStatus } from "@/lib/external-integrations"
import type { CatalogAnalysisItem, CrmSegment, DashboardData, LaunchMatrixRow, Lead, ObjectionMapItem, ProjectSheetSegment, SalesScript, SegmentLaunch, Stage } from "@/lib/types"

const stageTone: Record<string, "default" | "secondary" | "outline" | "muted" | "warning" | "success"> = {
  lead: "muted",
  qualified: "outline",
  contacted: "secondary",
  tasting: "warning",
  trial: "warning",
  repeat: "success",
  contract: "success",
  won: "success",
  lost: "muted"
}

const orderTone: Record<string, "default" | "secondary" | "outline" | "muted" | "warning" | "success"> = {
  manager_review: "warning",
  blocked_minimum: "muted",
  confirmed: "success",
  in_delivery: "secondary",
  completed: "success",
  cancelled: "muted",
  draft: "outline"
}

const orderStatusOptions = [
  { value: "draft", label: "Черновик" },
  { value: "manager_review", label: "На проверке" },
  { value: "confirmed", label: "Подтвержден" },
  { value: "in_delivery", label: "В доставке" },
  { value: "completed", label: "Выполнен" },
  { value: "blocked_minimum", label: "Ниже минимума" },
  { value: "cancelled", label: "Отменен" }
]
const orderStatusLabels = Object.fromEntries(orderStatusOptions.map((option) => [option.value, option.label]))

const tabLabels: Record<string, string> = {
  pipeline: "Воронка",
  accounts: "Единая база",
  local: "Локальные лиды",
  launch: "Матрица запуска",
  about: "О компании",
  script: "Скрипт",
  objections: "Карта возражений",
  leads: "Компании",
  people: "Контакты",
  orders: "Заказы",
  catalog: "Каталог",
  equipment: "Оборудование",
  agents: "ИИ-агенты",
  bot: "Telegram API"
}

const tabGroups = [
  {
    label: "Продажи",
    items: ["pipeline", "accounts", "local", "launch", "script", "objections"]
  },
  {
    label: "Клиенты",
    items: ["leads", "people", "catalog", "equipment", "about"]
  },
  {
    label: "Операции",
    items: ["orders", "agents", "bot"]
  }
]

const scriptInitialRowLimit = 48
const scriptRowLimitStep = 48
const scriptInitialCardLimit = 8
const scriptCardLimitStep = 8
const scriptTableSkuLimit = 2
const scriptCardSkuLimit = 4
const bulkEnrichmentLimit = 10
const allCrmSegmentsLabel = "Все сегменты"
const crmSelectClass = "crm-select h-9 rounded-md border bg-background px-3 text-sm"
const crmSelectIconClass = "crm-select h-9 rounded-md border bg-background pl-8 pr-3 text-sm"
const leadIntakeInitialForm = {
  company_name: "",
  inn: "",
  address: "",
  dgis_url: "",
  drive_minutes_from_production: "",
  drive_minutes_source: "",
  website: "",
  telegram_url: "",
  telegram_username: "",
  telegram_contact_status: "not_found",
  telegram_source_note: "",
  segment: "office_cluster",
  contact_name: "",
  contact_role: "",
  contact_email: "",
  contact_phone: "",
  notes: ""
}
const dgisLeadSearchInitialForm = {
  query: "",
  district: "",
  city: "Санкт-Петербург",
  segment: "office_cluster",
  limit: "8"
}

type IntegrationStatusResponse = {
  ok: boolean
  status: IntegrationStatus
  recent_events: Array<{
    id: number
    provider: string
    direction: string
    status: string
    endpoint: string | null
    response_status: number | null
    error: string | null
    created_at: string
  }>
}

type IntegrationPreflightResponse = {
  ok: boolean
  checked_at: string
  public_base_url: string | null
  checks: Array<{
    key: string
    label: string
    status: "ok" | "warning" | "blocked"
    message: string
    evidence?: string | null
  }>
}

type IntegrationLaunchGuideResponse = {
  ok: boolean
  generated_at: string
  links: {
    public_base_url: string | null
    miniapp_url: string | null
    webhook_url: string | null
    local_miniapp_url: string
  }
  commands: {
    env_bootstrap: string
    launch_telegram_bot: string
    setup_telegram_bot: string
    run_preflight: string
    preview_telegram_setup: string
  }
  env: Array<{
    key: string
    label: string
    configured: boolean
    required: boolean
    secret: boolean
  }>
  steps: Array<{
    id: string
    title: string
    status: "done" | "needed" | "optional"
    action: string
  }>
  operator_handoff: {
    botfather: {
      open_url: string
      bot_name: string
      suggested_username: string
      bot_url_hint: string
      short_description: string
      description: string
      commands: string[]
      token_instruction: string
      miniapp_setup: {
        required: boolean
        configured: boolean
        short_name_env_key: "TELEGRAM_MINIAPP_SHORT_NAME"
        short_name: string | null
        suggested_short_name: string
        miniapp_url: string | null
        local_miniapp_url: string
        fallback_startapp_url: string | null
        named_startapp_url: string | null
        botfather_commands: string[]
        instructions: string[]
        note: string
      }
    }
    env_template: Array<{
      key: string
      required: boolean
      secret: boolean
      value_hint: string
      where_to_get: string
    }>
    connection_checklist: Array<{
      id: string
      title: string
      provider: string
      required: boolean
      configured: boolean
      status: "ready" | "missing_required" | "optional_missing"
      env_keys: string[]
      official_url: string | null
      why_it_matters: string
      next_action: string
      crm_surface: string
      safe_handling: string
    }>
    share_links: Array<{
      id: string
      title: string
      audience: "client" | "manager" | "telegram" | "operator"
      url: string | null
      available: boolean
      note: string
    }>
    share_assets: Array<{
      id: string
      title: string
      audience: "client" | "manager" | "operator"
      channel: "telegram" | "web" | "crm"
      url: string | null
      available: boolean
      message: string
      telegram_share_url: string | null
      telegram_startapp_url: string | null
      qr_payload_url: string | null
      qr_image_url: string | null
      note: string
    }>
    telegram_entrypoints: Array<{
      id: string
      title: string
      command: string
      url: string | null
      available: boolean
      note: string
    }>
    success_criteria: string[]
  }
  handoff_note: string
}

type TelegramSetupPreviewResponse = {
  ok: boolean
  mode: string
  generated_at: string
  links: {
    public_base_url: string | null
    miniapp_url: string
    webhook_url: string | null
  }
  required: {
    missing: string[]
    telegram_bot_token_configured: boolean
    telegram_webhook_secret_configured: boolean
    public_base_url_configured: boolean
  }
  telegram_api: Array<{
    method: string
    optional: boolean
    payload: Record<string, unknown>
  }>
  telegram_entrypoints: Array<{
    command: string
    title: string
    url: string | null
    note: string
  }>
  note: string
}

type CompanyEnrichmentPayload = {
  ok: boolean
  enrichment?: {
    profile: {
      legal_name: string | null
      inn: string | null
      address: string | null
      phone: string | null
      email: string | null
      website: string | null
      dgis_url: string | null
      drive_minutes_from_production: number | null
      drive_minutes_source: string | null
      employee_count_fns: number | null
      employee_count_2gis: number | null
      employee_count_website: number | null
    }
    office_people: {
      min: number
      max: number
      confidence: "high" | "medium" | "low"
      method: string
      recommended_portions: number
      recommended_sku: number
      estimated_launch_budget: number
    }
    headcount_evidence?: Array<{
      source: "fns_dadata" | "2gis" | "website" | "crm_segment" | "heuristic"
      label: string
      value: number | null
      confidence: "high" | "medium" | "low"
      used_for_estimate: boolean
      note: string
      url?: string | null
    }>
    proposal?: {
      headcount_source: string
      office_size_label: string
      confidence_label: string
      launch_scenario: string
      proposal_summary: string
      manager_next_step: string
      what_to_offer: string[]
      assumptions: string[]
    }
    cache?: {
      hit: boolean
      updated_at: string | null
      age_hours: number | null
      ttl_hours: number
    }
  }
  cache?: {
    hit: boolean
    updated_at: string | null
    age_hours: number | null
    ttl_hours: number
  } | null
}

type LeadIntakeForm = typeof leadIntakeInitialForm
type DgisLeadSearchForm = typeof dgisLeadSearchInitialForm

type CompanyLeadIntakePayload = {
  ok: boolean
  dry_run: boolean
  company_id: number | null
  deal_id: number | null
  contact_id: number | null
  ai_task_id: number | null
  created_company: boolean
  created_deal: boolean
  next_action: string
  enrichment: NonNullable<CompanyEnrichmentPayload["enrichment"]>
  error?: string
}

type DgisLeadCandidate = {
  dgis_id: string | null
  name: string
  legal_name: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  telegram_url: string | null
  telegram_username: string | null
  telegram_contact_status: string
  agent_contact_readiness: string
  inn: string | null
  employees_org_count: number | null
  rubrics: string[]
  source_url: string
  drive_minutes_from_production: number
  suggested_payload: {
    company_name?: string
    inn?: string | null
    segment?: string | null
    region?: string | null
    city?: string | null
    address?: string | null
    dgis_url?: string | null
    drive_minutes_from_production?: number | null
    drive_minutes_source?: string | null
    website?: string | null
    telegram_url?: string | null
    telegram_username?: string | null
    telegram_channel_type?: string | null
    telegram_contact_status?: string | null
    telegram_source_url?: string | null
    telegram_source_note?: string | null
    agent_contact_policy?: string | null
    agent_contact_readiness?: string | null
    agent_contact_next_step?: string | null
    source?: string | null
    lead_score?: number | null
    fit_reason?: string | null
    notes?: string | null
    next_action?: string | null
    create_ai_task?: boolean
    contact?: {
      name?: string | null
      role?: string | null
      email?: string | null
      phone?: string | null
      telegram_handle?: string | null
      preferred_channel?: string | null
    } | null
  }
}

type DgisLeadSearchPayload = {
  ok: boolean
  dry_run: boolean
  imported: boolean
  query: string
  city: string
  segment: string
  limit: number
  total: number | null
  candidates: DgisLeadCandidate[]
  error?: string
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value)
}

function photoMatchLabel(match?: string | null) {
  if (!match) return "фото Lunch-UP"
  return "фото Lunch-UP"
}

function shortDate(value: string | null) {
  if (!value) return "нет даты"
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(value))
}

function StatIcon({ label }: { label: string }) {
  if (label.includes("лиды")) return <Users className="size-4" />
  if (label.includes("Потенциал")) return <CircleDollarSign className="size-4" />
  if (label.includes("Каталог")) return <PackageCheck className="size-4" />
  if (label.includes("Заказы")) return <Truck className="size-4" />
  if (label.includes("Telegram")) return <Send className="size-4" />
  return <Sparkles className="size-4" />
}

const telegramStatusLabels: Record<string, string> = {
  public_found: "публичный найден",
  needs_verification: "проверить",
  approved_to_contact: "можно писать",
  opted_out: "не писать",
  not_found: "не найден"
}

const agentReadinessLabels: Record<string, string> = {
  none: "нет AI-канала",
  public_channel: "публичный канал",
  human_operator: "оператор",
  bot_likely: "похоже на бот",
  company_agent_ready: "agent-ready"
}

function telegramStatusLabel(value?: string | null) {
  return telegramStatusLabels[value ?? ""] ?? value ?? "не найден"
}

function agentReadinessLabel(value?: string | null) {
  return agentReadinessLabels[value ?? ""] ?? value ?? "нет AI-канала"
}

function IntegrationStateBadge({ ready }: { ready: boolean }) {
  return <Badge variant={ready ? "success" : "outline"}>{ready ? "готово" : "ожидает"}</Badge>
}

function IntegrationStatusRow({
  label,
  description,
  ready
}: {
  label: string
  description: string
  ready: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-background p-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      </div>
      <IntegrationStateBadge ready={ready} />
    </div>
  )
}

function phoneHref(value: string) {
  return value.replace(/[^+0-9]/g, "")
}

function externalHref(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (/^\/(?!\/)/.test(trimmed) || trimmed.startsWith("#")) return trimmed
  if (/^www\./i.test(trimmed) || /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

function internalHref(path: string, key?: string | null) {
  if (!key || !path.startsWith("/") || path.startsWith("//")) return path
  const [base, hash = ""] = path.split("#")
  const [pathname, query = ""] = base.split("?")
  const params = new URLSearchParams(query)
  if (!params.has("key")) params.set("key", key)
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`
}

function leadHeadcountEvidenceRows(lead: Lead) {
  const rows = [
    {
      label: "ФНС/DaData",
      value: lead.employee_count_fns,
      confidence: "high",
      used: Boolean(lead.employee_count_fns),
      note: "среднесписочная численность"
    },
    {
      label: "2ГИС",
      value: lead.employee_count_2gis,
      confidence: "medium",
      used: !lead.employee_count_fns && Boolean(lead.employee_count_2gis),
      note: "карточка организации"
    },
    {
      label: "сайт",
      value: lead.employee_count_website,
      confidence: lead.employee_count_fns || lead.employee_count_2gis ? "medium" : "low",
      used: !lead.employee_count_fns && !lead.employee_count_2gis && Boolean(lead.employee_count_website),
      note: "публичное описание команды"
    }
  ].filter((row) => row.value)

  if (!rows.length && lead.office_people_method) {
    rows.push({
      label: "оценка",
      value: null,
      confidence: lead.office_people_confidence ?? "low",
      used: true,
      note: lead.office_people_method
    })
  }

  return rows
}

const launchCategoryFields = [
  { key: "breakfasts", label: "Завтраки" },
  { key: "salads", label: "Салаты" },
  { key: "sandwiches", label: "Горячее" },
  { key: "desserts", label: "Десерты" }
] as const

const productTradeDescriptionByLaunchRole: Record<string, string> = {
  "утренний трафик и офисный перекус":
    "Утренняя позиция с ясной ценностью: готовый завтрак уже на полке. Берут быстро, едят удобно, возвращаются к дню без очереди и кухни.",
  "допродажа к кофе и чайной зоне":
    "Компактная позиция к напитку: она делает паузу завершенной и естественно добавляется к чеку.",
  "обеденный чек и более здоровая альтернатива":
    "Свежая обеденная позиция с понятной порцией и чистым составом. Легкая альтернатива тяжелому фастфуду, которая выглядит уверенно в витрине.",
  "ядро быстрой готовой еды":
    "Базовая grab&go-позиция для сильной полки: сытно, аккуратно, удобно взять с собой."
}

const productTradeDescriptionByCategory: Record<string, string> = {
  Завтраки:
    "Утренняя позиция с ясной ценностью: готовый завтрак уже на полке. Берут быстро, едят удобно, возвращаются к дню без очереди и кухни.",
  Салаты:
    "Свежая обеденная позиция с понятной порцией и чистым составом. Легкая альтернатива тяжелому фастфуду, которая выглядит уверенно в витрине.",
  "Горячие блюда":
    "Сытная готовая позиция для дневного спроса: полноценный обед без кухни на точке и понятный якорь для первой витрины.",
  Сэндвичи:
    "Базовая grab&go-позиция для сильной полки: сытно, аккуратно, удобно взять с собой.",
  Десерты:
    "Компактная позиция к напитку: она делает паузу завершенной и естественно добавляется к чеку."
}

function productTradeDescription(product: { category: string; launch_role?: string | null }) {
  const role = product.launch_role?.trim()
  return (role ? productTradeDescriptionByLaunchRole[role] : null) ?? productTradeDescriptionByCategory[product.category] ?? "Готовая порционная позиция для аккуратной B2B-витрины: понятная, быстрая, готовая к продаже без кухни."
}

function normalizeSkuName(value: string) {
  return value
    .toLowerCase()
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function catalogSkuDomId(value: string) {
  return `catalog-sku-${encodeURIComponent(normalizeSkuName(value))}`
}

function clientCatalogCrmSegmentHref(segmentCode: string) {
  return segmentCode === "all" ? "/catalog" : `/catalog?segment=${encodeURIComponent(segmentCode)}`
}

function parseLaunchSkuList(segment: SegmentLaunch) {
  const items: LaunchSkuItem[] = []
  for (const field of launchCategoryFields) {
    const raw = segment[field.key]
    if (!raw) continue
    for (const part of raw.split(";")) {
      const value = part.trim()
      if (!value) continue
      const match = value.match(/^(.*?)\s+x(\d+)$/i)
      items.push({
        segment: segment.format,
        category: field.label,
        name: (match?.[1] ?? value).trim(),
        quantity: match?.[2] ? Number(match[2]) : null
      })
    }
  }
  return items
}

type PilotEquipmentRecommendation = {
  badge: string
  equipment: string
  spec: string
  operatingModel: string
  example: string
  modelIds: string[]
}

type PilotEquipmentPlan = {
  launch: SegmentLaunch
  skuItems: LaunchSkuItem[]
  unitCount: number
  categorySummary: string
  categoryTags: string[]
  jtbdSegments: ProjectSheetSegment[]
  sales: PilotEquipmentRecommendation
  internal: PilotEquipmentRecommendation
  checks: string[]
}

type EquipmentModel = {
  id: string
  title: string
  brand: string
  scenario: string
  priceLabel: string
  priceNote: string
  imageUrl: string
  manufacturerHref: string
  priceHref: string
  bestFor: string
  specs: string[]
}

const equipmentModelOptions: EquipmentModel[] = [
  {
    id: "biryusa-521rdn",
    title: "Бирюса 521RDN",
    brand: "Бирюса",
    scenario: "полноразмерная витрина",
    priceLabel: "52 400 ₽",
    priceNote: "цена интернет-магазина Бирюса",
    imageUrl: "/equipment/biryusa-521rdn.jpg",
    manufacturerHref: "https://biryusa.ru/catalog/xolodilnaya-tehnika/xolodilnye-shkafy/biryusa-521rdn",
    priceHref: "https://biryusa.shop/biryusa-521rdn",
    bestFor: "ритейл fresh-полка, офисная витрина, точки с заметным трафиком",
    specs: ["545 л", "+1...+10 °C", "5 полок", "стеклянная дверь"]
  },
  {
    id: "biryusa-l102",
    title: "Бирюса L102",
    brand: "Бирюса",
    scenario: "компактная витрина",
    priceLabel: "28 500 ₽",
    priceNote: "цена официального представителя",
    imageUrl: "/equipment/biryusa-l102.jpg",
    manufacturerHref: "https://biryusa.ru/catalog/xolodilnaya-tehnika/xolodilnye-shkafy/biryusa-l102",
    priceHref: "https://bt-biryusa.ru/product/biryusa-l102/",
    bestFor: "кофейни, ресепшен, небольшая кухня персонала, короткий тест спроса",
    specs: ["115 л", "+1...+10 °C", "3 полки", "48x60,5x86,5 см"]
  },
  {
    id: "carboma-a87",
    title: "Carboma A87 ВХС-1,0 Арго",
    brand: "Carboma / Полюс",
    scenario: "настольная витрина",
    priceLabel: "50 900 ₽",
    priceNote: "прайс производителя Carboma",
    imageUrl: "/equipment/carboma-a87.jpeg",
    manufacturerHref: "https://carboma.com/catalog/nastolnye_vitriny/vitriny_a87_argo/",
    priceHref: "https://carboma.com/catalog/nastolnye_vitriny/vitriny_a87_argo/",
    bestFor: "стойка кофе, бар, буфет, ресепшен, банная зона",
    specs: ["1000x870x630 мм", "0...+7 °C", "0,46 м2 выкладки", "220 В"]
  },
  {
    id: "polair-cm105s",
    title: "POLAIR CM105-S",
    brand: "POLAIR",
    scenario: "внутреннее хранение",
    priceLabel: "85 390 ₽",
    priceNote: "РРЦ производителя с НДС",
    imageUrl: "/equipment/polair-cm105s.png",
    manufacturerHref: "https://www.polair.com/en/products/refrigerated-cabinets/cm105-s/",
    priceHref: "https://www.polair.com/products/pdf.php?id=2536",
    bestFor: "внутренняя выдача сотрудникам, сменные наборы, склад приемки",
    specs: ["500 л", "0...+6 °C", "4 полки", "глухая дверь с замком"]
  },
  {
    id: "spmarket-start",
    title: "СП Маркет Старт",
    brand: "СП Маркет",
    scenario: "микромаркет",
    priceLabel: "от 173 500 ₽",
    priceNote: "модель 0...+7 °C на сайте СП Маркет",
    imageUrl: "/equipment/spmarket-start.png",
    manufacturerHref: "https://spmarket.tech/",
    priceHref: "https://spmarket.tech/",
    bestFor: "офисы и коворкинги без продавца, оплата через СБП/карту",
    specs: ["0...+7 °C", "самообслуживание", "учет продаж", "удаленный контроль"]
  },
  {
    id: "uvenco-foodbox-long",
    title: "Uvenco FoodBox Long",
    brand: "Uvenco",
    scenario: "снэковый автомат",
    priceLabel: "без покупки",
    priceNote: "Uvenco размещает и обслуживает автомат по договору; площадка не покупает оборудование.",
    imageUrl: "/equipment/uvenco-foodbox-long.png",
    manufacturerHref: "https://uvenco.ru/vending/foodbox-long",
    priceHref: "https://uvenco.ru/vending/foodbox-long",
    bestFor: "офисы, коворкинги и лобби с самообслуживанием, где нужен готовый вендинговый контур",
    specs: ["до 72 SKU", "+3/+7 °C", "130x80x183 см", "24U/карты"]
  },
  {
    id: "neuroshop-ai",
    title: "Neuroshop AI-вендинг",
    brand: "Neuroshop",
    scenario: "умный холодильник",
    priceLabel: "по запросу",
    priceNote: "стоимость зависит от комплектации",
    imageUrl: "/equipment/neuroshop-ai.png",
    manufacturerHref: "https://neuroshop.tech/ru/fridge-vending-machines",
    priceHref: "https://neuroshop.tech/ru/fridge-vending-machines",
    bestFor: "точки 24/7 без кассира, офисные кухни, отели, медицинские учреждения",
    specs: ["AI/RFID/весы", "оплата без персонала", "учет остатков", "температурный мониторинг"]
  }
]

const equipmentModelsById = new Map(equipmentModelOptions.map((model) => [model.id, model]))

function equipmentModelsFor(ids: string[]) {
  return ids
    .map((id) => equipmentModelsById.get(id))
    .filter((model): model is EquipmentModel => Boolean(model))
}

function launchUnitCount(items: LaunchSkuItem[]) {
  return items.reduce((sum, item) => sum + (item.quantity ?? 1), 0)
}

function launchCategorySummary(items: LaunchSkuItem[]) {
  const counts = new Map<string, { sku: number; qty: number }>()
  for (const item of items) {
    const current = counts.get(item.category) ?? { sku: 0, qty: 0 }
    counts.set(item.category, {
      sku: current.sku + 1,
      qty: current.qty + (item.quantity ?? 1)
    })
  }
  return Array.from(counts.entries())
    .map(([category, value]) => `${category.toLowerCase()}: ${value.sku} SKU / ${value.qty} шт.`)
    .join("; ")
}

function saleEquipmentForPilot(launch: SegmentLaunch, unitCount: number): PilotEquipmentRecommendation {
  const format = launch.format.toLowerCase()

  if (format.includes("вендинг") || format.includes("коворкинг") || format.includes("офис")) {
    return {
      badge: "Самообслуживание",
      equipment: "Умный холодильник или шкаф-витрина 350-600 л",
      spec: "Стеклянная дверь, 4-6 полок, питание 220 В, контроль остатков; для оплаты - QR/касса или микромаркет.",
      operatingModel:
        "Для точек без продавца: Lunch Up загружает пилот, клиент видит выкладку, покупки фиксируются через платежный сценарий.",
      example: "Uvenco FoodBox Long или микромаркет SELF для готового операционного контура; SP Market / Neuroshop как альтернатива.",
      modelIds: ["uvenco-foodbox-long", "spmarket-start", "neuroshop-ai", "biryusa-521rdn"]
    }
  }

  if (format.includes("кофе") || format.includes("отель") || format.includes("банн")) {
    return {
      badge: "Прилавок",
      equipment: "Настольная витрина 0...+7 °C или компактный шкаф 115-225 л",
      spec: "Глубина до 900 мм, прозрачная выкладка, ценники, подсветка, отдельная полка под десерты и сэндвичи.",
      operatingModel:
        "Для продаж у барной стойки, ресепшена или буфета: клиенту не нужна кухня, только холодная видимая полка.",
      example: "Carboma / Полюс ВХС-1,0 Арго для стойки; Бирюса L102 для компактной вертикальной выкладки.",
      modelIds: ["carboma-a87", "biryusa-l102"]
    }
  }

  if (format.includes("ритейл")) {
    return {
      badge: "Fresh-полка",
      equipment: "Шкаф-витрина 350-545 л или выделенная fresh-секция",
      spec: "Стеклянная дверь, динамическое охлаждение, 5+ полок, место рядом с кофе/кассой и видимый остаток по SKU.",
      operatingModel:
        "Для магазина без готовой fresh-зоны: поставить отдельную локальную полку и мерить sell-through по дням.",
      example: "POLAIR Visual 355-615 л или Бирюса 521RDN 545 л.",
      modelIds: ["biryusa-521rdn", "carboma-a87"]
    }
  }

  if (unitCount >= 95) {
    return {
      badge: "Полноразмерный холод",
      equipment: "Шкаф-витрина 350-600 л",
      spec: "Запас по объему под 90+ порций, 4-6 полок, прозрачная дверь, термометр, журнал списаний.",
      operatingModel:
        "Для продажи покупателям при заметном трафике: выкладка работает как отдельная точка продаж без кухни.",
      example: "POLAIR Visual / Бирюса 521RDN.",
      modelIds: ["biryusa-521rdn"]
    }
  }

  return {
    badge: "Компактный пилот",
    equipment: "Компактный шкаф-витрина 115-225 л",
    spec: "Стеклянная дверь, 3-4 полки, питание 220 В, отдельная зона для утренних SKU и десертов.",
    operatingModel:
      "Для проверки спроса без большой закупки оборудования: поставить холодную полку на неделю и замерить повтор.",
    example: "Бирюса L102 или аналогичный барный шкаф-витрина.",
    modelIds: ["biryusa-l102"]
  }
}

function internalEquipmentForPilot(launch: SegmentLaunch, unitCount: number): PilotEquipmentRecommendation {
  const format = launch.format.toLowerCase()

  if (format.includes("смен") || unitCount >= 100) {
    return {
      badge: "Склад смены",
      equipment: "Профессиональный шкаф хранения 500 л",
      spec: "Глухая или стеклянная дверь, 0...+6 °C, 4-5 полок, маркировка смен/отделов, FIFO и отдельная приемка.",
      operatingModel:
        "Компания покупает набор для сотрудников: продажи нет, нужен управляемый холод, выдача по отделам и контроль остатков.",
      example: "POLAIR Profi CM105-S / аналогичный шкаф 500 л.",
      modelIds: ["polair-cm105s"]
    }
  }

  if (format.includes("медицин") || unitCount <= 80) {
    return {
      badge: "Кухня персонала",
      equipment: "Компактный холодильный шкаф 115-200 л",
      spec: "3-4 полки, термометр, контейнеры по датам поставки, отдельная полка под готовую еду Lunch Up.",
      operatingModel:
        "Для небольшой команды: заказ не продается посетителям, а хранится в служебной зоне до перерывов сотрудников.",
      example: "Бирюса L102 как компактная база или закрытый шкаф хранения сопоставимого объема.",
      modelIds: ["biryusa-l102"]
    }
  }

  if (format.includes("офис") || format.includes("коворкинг")) {
    return {
      badge: "Офисный запас",
      equipment: "Шкаф хранения 200-350 л в кухне или переговорной зоне",
      spec: "Разделить полки по дате поставки и типу SKU, закрыть доступ к списаниям ответственным, вести остатки после дня.",
      operatingModel:
        "Работодатель закупает питание для команды: задача не в витрине, а в понятной выдаче без очереди и лишних потерь.",
      example: "POLAIR Visual/V-серия малых объемов или закрытый среднетемпературный шкаф.",
      modelIds: ["polair-cm105s", "biryusa-l102"]
    }
  }

  return {
    badge: "Внутренний пилот",
    equipment: "Холодильный шкаф 200-350 л",
  spec: "Выделенные полки, приемка по накладной, температурный контроль, стикеры даты и ответственный за остатки.",
  operatingModel:
    "Для компании, которая ест сама: не нужна покупательская витрина, нужен надежный холод и простая выдача сотрудникам.",
  example: "POLAIR 190-355 л / аналогичный среднетемпературный шкаф.",
  modelIds: ["polair-cm105s", "biryusa-l102"]
  }
}

function buildPilotEquipmentPlans(launches: SegmentLaunch[], projectSegments: ProjectSheetSegment[]): PilotEquipmentPlan[] {
  return launches.map((launch) => {
    const skuItems = parseLaunchSkuList(launch)
    const unitCount = launchUnitCount(skuItems)
    const categoryTags = uniqueValues(skuItems.map((item) => item.category))
    const jtbdSegments = projectSegments.filter((segment) => segment.launch_format === launch.format)
    return {
      launch,
      skuItems,
      unitCount,
      categorySummary: launchCategorySummary(skuItems),
      categoryTags,
      jtbdSegments,
      sales: saleEquipmentForPilot(launch, unitCount),
      internal: internalEquipmentForPilot(launch, unitCount),
      checks: [
        "220 В и место под дверцу/вентиляцию",
        "режим охлаждения под готовую еду и термометр на точке",
        "маркировка даты поставки, FIFO и ответственный за списания",
        "решение по оплате: касса/QR/микромаркет для продаж или ведомость выдачи для внутреннего питания"
      ]
    }
  })
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

type CrmSegmentGroup = {
  code: string
  label: string
  description: string
  rows: CrmSegment[]
}

function buildCrmSegmentGroups(crmSegments: CrmSegment[]): CrmSegmentGroup[] {
  const groupMap = new Map<string, CrmSegmentGroup & { position: number }>()

  for (const segment of crmSegments) {
    let group = groupMap.get(segment.direction_code)
    if (!group) {
      group = {
        code: segment.direction_code,
        label: segment.direction_label,
        description: segment.direction_description,
        position: segment.direction_position,
        rows: []
      }
      groupMap.set(segment.direction_code, group)
    }
    group.rows.push(segment)
  }

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      rows: group.rows.sort(
        (a, b) => a.segment_position - b.segment_position || a.label.localeCompare(b.label, "ru")
      )
    }))
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "ru"))
    .map(({ position: _position, ...group }) => group)
}

function findCrmSegmentDirection(groups: CrmSegmentGroup[], segmentCode: string) {
  return groups.find((group) => group.rows.some((segment) => segment.code === segmentCode))?.code ?? "all"
}

function normalizeCrmSegmentText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim()
}

function addCrmSegmentAlias(index: Map<string, Set<string>>, label: string, codes: string[]) {
  const key = normalizeCrmSegmentText(label)
  if (!key) return
  const current = index.get(key) ?? new Set<string>()
  for (const code of codes) current.add(code)
  index.set(key, current)
}

function buildCrmSegmentMatchIndex(crmSegments: CrmSegment[]) {
  const index = new Map<string, Set<string>>()
  for (const segment of crmSegments) {
    addCrmSegmentAlias(index, segment.code, [segment.code])
    addCrmSegmentAlias(index, segment.label, [segment.code])
    addCrmSegmentAlias(index, segment.launch_format, [segment.code])
  }

  const legacyAliases: Array<[string, string[]]> = [
    ["Бизнес-центры", ["office_cluster"]],
    ["Бизнес центры", ["office_cluster"]],
    ["Офисы", ["office_cluster"]],
    ["Офис", ["office_cluster"]],
    ["Коворкинги", ["office_cluster"]],
    ["Кофейни", ["coffee_bakery"]],
    ["Пекарни", ["coffee_bakery"]],
    ["Кофейни/пекарни", ["coffee_bakery"]],
    ["АЗС", ["gas_station"]],
    ["Магазины", ["retail_store"]],
    ["Ритейл", ["retail_store", "retail_cluster"]],
    ["Образование", ["education_campus"]],
    ["Кампусы", ["education_campus"]],
    ["Учебные заведения", ["education_campus"]],
    ["Компьютерные клубы", ["computer_club"]],
    ["Киберклубы", ["computer_club"]],
    ["Киберспорт", ["computer_club"]],
    ["Игровые клубы", ["computer_club"]],
    ["Клиники", ["healthcare_clinic"]],
    ["Медцентры", ["healthcare_clinic"]],
    ["Вендинг", ["vending_micromarket"]],
    ["Вендинг/оборудование", ["vending_micromarket"]],
    ["Микромаркеты", ["vending_micromarket"]],
    ["Умные холодильники", ["vending_micromarket"]],
    ["Столовые", ["foodservice_operator"]],
    ["Операторы питания", ["foodservice_operator"]],
    ["Uvenco", ["rail_partner"]],
    ["Rail", ["rail_partner"]],
    ["Якорные клиенты ЛО", ["lo_anchor"]],
    ["HoReCa", ["horeca_cluster", "horeca_ready_food"]],
    ["Готовая еда", ["horeca_ready_food"]],
    ["ЖК", ["residential_apart"]],
    ["Апарт-комплексы", ["residential_apart"]],
    ["Транспорт", ["transport_cluster"]]
  ]

  for (const [label, codes] of legacyAliases) addCrmSegmentAlias(index, label, codes)
  return index
}

function resolveCrmSegmentCodes(values: Array<string | null | undefined>, index: Map<string, Set<string>>) {
  const codes = new Set<string>()
  const entries = Array.from(index.entries()).filter(([key]) => key.length >= 3)
  for (const value of values) {
    const normalized = normalizeCrmSegmentText(value)
    if (!normalized) continue
    const exact = index.get(normalized)
    if (exact) {
      for (const code of exact) codes.add(code)
    }
    for (const [key, aliasCodes] of entries) {
      if (normalized.includes(key) || key.includes(normalized)) {
        for (const code of aliasCodes) codes.add(code)
      }
    }
  }
  return codes
}

function matchesCrmSegmentFilter({
  values,
  directionValue,
  segmentValue,
  crmSegmentByCode,
  crmSegmentMatchIndex
}: {
  values: Array<string | null | undefined>
  directionValue: string
  segmentValue: string
  crmSegmentByCode: Map<string, CrmSegment>
  crmSegmentMatchIndex: Map<string, Set<string>>
}) {
  if (directionValue === "all" && segmentValue === "all") return true
  const codes = resolveCrmSegmentCodes(values, crmSegmentMatchIndex)
  if (segmentValue !== "all") return codes.has(segmentValue)
  if (directionValue !== "all") {
    return Array.from(codes).some((code) => crmSegmentByCode.get(code)?.direction_code === directionValue)
  }
  return true
}

function CrmSegmentFilterControls({
  id,
  groups,
  directionValue,
  segmentValue,
  onChange,
  className = "",
  count,
  allDirectionLabel = "Все направления",
  allSegmentLabel = allCrmSegmentsLabel,
  getSegmentSuffix,
  layout = "wide"
}: {
  id: string
  groups: CrmSegmentGroup[]
  directionValue: string
  segmentValue: string
  onChange: (directionCode: string, segmentCode: string) => void
  className?: string
  count?: number
  allDirectionLabel?: string
  allSegmentLabel?: string
  getSegmentSuffix?: (segment: CrmSegment) => string
  layout?: "wide" | "stacked"
}) {
  const visibleGroups =
    directionValue === "all" ? groups : groups.filter((group) => group.code === directionValue)
  const layoutClass =
    layout === "stacked"
      ? "grid-cols-1"
      : typeof count === "number"
        ? "lg:grid-cols-[minmax(320px,360px)_minmax(520px,1fr)_minmax(96px,120px)]"
        : "lg:grid-cols-[minmax(320px,360px)_minmax(520px,1fr)]"

  return (
    <div
      data-crm-segment-filter={id}
      data-crm-segment-source="crm_segments"
      className={`grid grid-cols-1 gap-2 sm:items-end ${layoutClass} ${className}`}
    >
      <label className="space-y-1 text-xs font-medium">
        <span className="dense-label">Направление</span>
        <select
          id={`${id}-direction`}
          aria-label={`${id}: направление`}
          data-crm-segment-direction-select
          className={`${crmSelectClass} w-full`}
          value={directionValue}
          onChange={(event) => onChange(event.target.value, "all")}
        >
          <option value="all">{allDirectionLabel}</option>
          {groups.map((group) => (
            <option key={group.code} value={group.code}>
              {group.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium">
        <span className="dense-label">Сегмент</span>
        <select
          id={`${id}-segment`}
          aria-label={`${id}: сегмент`}
          data-crm-segment-select
          className={`${crmSelectClass} w-full`}
          value={segmentValue}
          onChange={(event) => {
            const nextSegment = event.target.value
            if (nextSegment === "all") {
              onChange(directionValue, "all")
              return
            }
            onChange(findCrmSegmentDirection(groups, nextSegment), nextSegment)
          }}
        >
          <option value="all">{directionValue === "all" ? allSegmentLabel : "Все сегменты направления"}</option>
          {visibleGroups.map((group) =>
            directionValue === "all" ? (
              <optgroup key={group.code} label={group.label}>
                {group.rows.map((segment) => {
                  const suffix = getSegmentSuffix?.(segment) ?? ""
                  return (
                    <option key={segment.code} value={segment.code}>
                      {segment.label}
                      {suffix}
                    </option>
                  )
                })}
              </optgroup>
            ) : (
              group.rows.map((segment) => {
                const suffix = getSegmentSuffix?.(segment) ?? ""
                return (
                  <option key={segment.code} value={segment.code}>
                    {segment.label}
                    {suffix}
                  </option>
                )
              })
            )
          )}
        </select>
      </label>

      {typeof count === "number" ? (
        <div className="rounded-md border bg-background px-3 py-2 text-sm">
          <div className="dense-label">Показано</div>
          <div className="mt-1 font-semibold">{count}</div>
        </div>
      ) : null}
    </div>
  )
}

function CrmSegmentOptionGroups({
  groups
}: {
  groups: CrmSegmentGroup[]
}) {
  return (
    <>
      {groups.map((group) => (
        <optgroup key={group.code} label={group.label}>
          {group.rows.map((segment) => (
            <option key={segment.code} value={segment.code}>
              {segment.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

function launchForSegment(segmentCode: string, launches: SegmentLaunch[], crmSegmentByCode: Map<string, CrmSegment>) {
  const format = crmSegmentByCode.get(segmentCode)?.launch_format
  return format ? launches.find((item) => item.format === format) ?? null : null
}

function buildLaunchMatrixSummary(launch: SegmentLaunch | null) {
  if (!launch) return "Матрица запуска подбирается из каталога после квалификации точки."
  const categoryLines = launchCategoryFields
    .map((field) => {
      const value = launch[field.key]?.trim()
      return value ? `${field.label}: ${value}` : ""
    })
    .filter(Boolean)
  return categoryLines.length
    ? categoryLines.join("; ")
    : `Каталог запуска "${launch.format}" без детализации по категориям.`
}

function buildLaunchMatrixCompact(launch: SegmentLaunch | null) {
  if (!launch) return "индивидуальная матрица после квалификации точки"
  const skuItems = parseLaunchSkuList(launch)
  const categories = launchCategoryFields
    .filter((field) => launch[field.key]?.trim())
    .map((field) => field.label.toLowerCase())
  const preview = skuItems.slice(0, 4).map((item) => item.name).join(", ")
  const categoryText = categories.length ? categories.join(" / ") : "SKU из каталога"
  return `${skuItems.length || "несколько"} SKU: ${categoryText}${preview ? `; примеры: ${preview}` : ""}`
}

function buildJtbdSpeechBasis(jtbdSegments: ProjectSheetSegment[], profile: CompanySegmentProfile) {
  const primary = jtbdSegments[0] ?? null
  const jtbdLine = primary?.jtbd ?? profile.categoryRole
  const painLine = primary?.pain ?? profile.competitorFrame
  const needLine = primary?.need ?? profile.qualificationQuestion
  const solutionLine = primary?.solution ?? profile.leadHook
  const routeLine = uniqueValues(jtbdSegments.map((item) => item.route_logic)).join(" / ")
  const targetSegments = jtbdSegments.map((item) => item.segment).join(" / ")
  return {
    primary,
    jtbdLine,
    painLine,
    needLine,
    solutionLine,
    routeLine,
    targetSegments
  }
}

function speechPhrase(value: string, fallback = "") {
  return (value || fallback).trim().replace(/\s+/g, " ").replace(/[.;:!?]+$/g, "")
}

function lowerFirst(value: string) {
  const clean = speechPhrase(value)
  return clean ? `${clean[0].toLowerCase()}${clean.slice(1)}` : clean
}

function buildManagerElevatorSpeech({
  segmentLabel,
  launchName,
  launchMatrixCompact,
  launchKpi,
  routeLine,
  revenueLogic,
  jtbdBasis
}: {
  segmentLabel: string
  launchName: string
  launchMatrixCompact: string
  launchKpi: string
  routeLine: string
  revenueLogic: string
  jtbdBasis: ReturnType<typeof buildJtbdSpeechBasis>
}) {
  const jtbd = lowerFirst(jtbdBasis.jtbdLine)
  const pain = lowerFirst(jtbdBasis.painLine)
  const need = lowerFirst(jtbdBasis.needLine)
  const solution = speechPhrase(jtbdBasis.solutionLine)
  const route = lowerFirst(routeLine)
  const kpi = speechPhrase(launchKpi)

  return [
    `Добрый день. Я представляю Lunch Up. Мы помогаем сегменту "${segmentLabel}" запустить готовую охлажденную еду в Санкт-Петербурге и Ленинградской области без кухни на объекте и без закупки всего каталога.`,
    `В вашем сценарии главная задача конечного клиента - ${jtbd}. Сейчас этому мешает ${pain}. Клиенту нужно ${need}, поэтому ценность Lunch Up не в красивой витрине, а в том, чтобы человек быстро получил понятный завтрак, перекус или ланч там, где он уже находится.`,
    `Для первого шага я предлагаю не большой проект, а пилот формата "${launchName}": ${launchMatrixCompact}. Оффер пилота: ${solution}. Это короткая матрица из каталога, которую можно проверить на продажах, списаниях и повторном заказе без перестройки ваших текущих процессов.`,
    `Для вашей компании выгода в том, что ${lowerFirst(revenueLogic)}. Проще говоря, вы получаете дополнительный чек, удерживаете спрос внутри своей локации и зарабатываете на категории, которую не нужно запускать с нуля.`,
    `Если видите потенциал, я задам три вопроса по точке, трафику и ответственному. После этого подготовлю матрицу "${launchName}" и KPI пилота: ${kpi}.${route ? ` Сразу проверю маршрутное условие: ${route}.` : ""}`
  ]
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

const segmentSpinProfiles: Record<
  string,
  {
    audience: string
    situation: string
    problem: string
    implication: string
    payoff: string
  }
> = {
  vending_micromarket: {
    audience: "директор по развитию/закупки вендинга",
    situation: "Какие точки сейчас имеют холодильник, микромаркет или офисный поток с запросом на готовую еду?",
    problem: "Где чаще всего возникают списания, пустые ячейки или нехватка сытного ready-to-eat рядом с кофе?",
    implication: "Если матрица остается только снековой, оператор теряет дневной чек и не проверяет спрос на обеденный сценарий.",
    payoff: "Если начать с 8-10 SKU в 1-2 точках и считать sell-through, какой результат даст основание расширить матрицу?"
  },
  office_cluster: {
    audience: "администратор БЦ/facility manager",
    situation: "Как сейчас арендаторы и сотрудники закрывают завтрак, обед и перекус в течение рабочего дня?",
    problem: "Где не хватает быстрых готовых позиций без очереди, кухни и отдельного оператора питания?",
    implication: "Если в офисе нет понятной витрины, сотрудники уходят за едой наружу, а БЦ теряет сервис для арендаторов.",
    payoff: "Если поставить витрину на 7-10 дней с 10-12 SKU, какие метрики убедят оставить регулярную поставку?"
  },
  production_logistics: {
    audience: "операционный руководитель склада/производства",
    situation: "Как сотрудники смены сейчас получают нормальную еду, если рядом нет столовой или доставка неудобна?",
    problem: "Где чаще всего возникает бытовая боль: ночная смена, длинная смена, отсутствие выбора или нестабильная поставка?",
    implication: "Если питание смены не закрыто, объект теряет время, лояльность сотрудников и контроль над бытовым сервисом.",
    payoff: "Если запустить сытную матрицу по графику смен, какой повтор и объем покажет, что маршрут стоит закреплять?"
  },
  healthcare_clinic: {
    audience: "администратор клиники/операционный руководитель",
    situation: "Как персонал и посетители сейчас покупают быстрый перекус без выхода из здания?",
    problem: "Где ограничение важнее всего: состав, чистая упаковка, срок годности, место выкладки или регулярность поставки?",
    implication: "Если еда для персонала не решена, клиника получает бытовую нагрузку и зависимость от внешних кафе.",
    payoff: "Если поставить небольшой набор с понятными сроками, какие продажи и отзывы подтвердят регулярную витрину?"
  },
  bath_spa: {
    audience: "управляющий банного комплекса/F&B",
    situation: "Как гости и персонал сейчас покупают быстрый перекус до или после парения, если кухня или буфет ограничены?",
    problem: "Где теряется чек: гости остаются надолго, буфет перегружен, нет легкой еды в упаковке или списания свежей еды слишком рискованные?",
    implication: "Если баня продает только напитки и тяжелое меню, часть гостевого спроса после процедур уходит без удобного перекуса и повторной покупки.",
    payoff: "Если поставить маленькую fresh-витрину у ресепшена или буфета, какой sell-through и средний чек покажут, что формат стоит оставить?"
  },
  foodservice_operator: {
    audience: "оператор корпоративной столовой/F&B",
    situation: "Какие позиции сейчас сложно производить малыми партиями: десерты, сэндвичи, роллы или готовые перекусы?",
    problem: "Где кухня перегружена или невыгодно держать отдельную категорию ради ограниченного спроса?",
    implication: "Если оператор делает все сам, часть ассортимента становится дорогой, нестабильной или слишком трудоемкой.",
    payoff: "Если Lunch-UP закроет дополнительную полку готовыми SKU, какие продажи подтвердят расширение ассортимента?"
  },
  education_campus: {
    audience: "администратор кампуса/оператор питания",
    situation: "Как студенты и сотрудники закрывают быстрый перекус между парами, сменами и пиковыми окнами?",
    problem: "Где сейчас барьер: очереди, цена, отсутствие точки рядом или слабый выбор готовой еды?",
    implication: "Если пиковый спрос не закрыт, аудитория уходит к внешнему ритейлу и не покупает внутри кампуса.",
    payoff: "Если поставить холодильник с value-матрицей, какой оборот в пиковые часы подтвердит продолжение?"
  },
  residential_apart: {
    audience: "управляющая компания ЖК/апарт-оператор",
    situation: "Какие сервисы еды уже есть у резидентов утром, вечером и поздно после работы?",
    problem: "Где возникает неудобство: ждать доставку, идти в магазин или не иметь быстрого завтрака рядом?",
    implication: "Если еда не доступна внутри комплекса, сервис резидентов уступает доставке и внешнему магазину.",
    payoff: "Если поставить микромаркет или холодильник, какие утренние/вечерние продажи покажут устойчивый спрос?"
  },
  lo_anchor: {
    audience: "закупки якорного клиента Ленинградской области",
    situation: "Сколько адресов можно объединить в один день поставки и какой регулярный объем уже понятен?",
    problem: "Где риск маршрута: один малый заказ, длинное плечо, непредсказуемый график или отсутствие якоря?",
    implication: "Если ЛО запускать одиночными точками, логистика съедает экономику и делает обещания небезопасными.",
    payoff: "Если собрать 4-5 точек или якорный адрес, какой объем за рейс подтвердит маршрутный запуск?"
  },
  rail_partner: {
    audience: "директор по развитию rail-оператора",
    situation: "Какие food-точки, микромаркеты, кофепоинты или vending-маршруты уже имеют трафик и телеметрию?",
    problem: "Где инфраструктура теряет чек: снековая матрица, слабый food-layer, низкий repeat или отсутствие свежей еды?",
    implication: "Если платформа не добавляет fresh food, она недозарабатывает на lunch/snack dayparts и loyalty-сценариях.",
    payoff: "Если Lunch-UP даст supplier-first пилот, какие KPI по food-conversion и repeat нужны для revenue-share?"
  },
  coffee_bakery: {
    audience: "управляющий кофейни/пекарни",
    situation: "Какие готовые сытные позиции сейчас продаются вместе с кофе и кто отвечает за их пополнение?",
    problem: "Где теряется средний чек: нет кухни, не хватает сэндвичей, или десерты не закрывают сытный перекус?",
    implication: "Если гость берет только кофе, точка недозарабатывает на готовой еде без расширения кухни.",
    payoff: "Если дать 6-8 SKU как допродажу к кофе, какие продажи по SKU покажут, что регулярная поставка нужна?"
  },
  coffee_chain: {
    audience: "категорийный менеджер кофейной сети",
    situation: "Как сейчас сеть тестирует готовую еду по точкам и какие SKU считаются обязательными к кофе?",
    problem: "Где сложнее удержать единый стандарт: поставщик, сроки годности, списания или ввод новой позиции?",
    implication: "Без локального теста сеть не видит, какие SKU реально дают прирост среднего чека в СПб.",
    payoff: "Если пилот покажет 2-3 лидера SKU, что нужно для масштабирования на несколько точек?"
  },
  gas_station: {
    audience: "управляющий АЗС/категорийный менеджер convenience",
    situation: "Какие готовые позиции сейчас продаются у кофе, кассы или в зоне быстрого перекуса?",
    problem: "Где провал в ассортименте: сытный перекус, понятный срок годности или быстрый оборот партии?",
    implication: "Если у кофе нет готовой еды, часть дорожного трафика покупает только напиток и уходит без второго товара.",
    payoff: "Если поставить fresh-полку 8-12 SKU и считать продажи до следующей поставки, какой sell-through будет рабочим?"
  },
  retail_store: {
    audience: "управляющий магазином/закупки fresh",
    situation: "Как сейчас устроена полка готовой еды: где стоит, как часто пополняется и что продается рядом с кофе?",
    problem: "Какие позиции чаще дают списания или не проходят по обороту на локальной точке?",
    implication: "Если полка не обновляется локальной матрицей, магазин не использует офисный и вечерний трафик вокруг точки.",
    payoff: "Если начать с 8-12 SKU и оставить лидеров после первой недели, какие данные нужны для решения?"
  },
  retail_cluster: {
    audience: "управляющий ритейл-кластером/категорийный менеджер",
    situation: "Какие точки кластера подходят для локального теста fresh-полки рядом с кофе или кассой?",
    problem: "Где сейчас сложнее доказать спрос: в выборе SKU, цене, списаниях или согласовании закупки?",
    implication: "Без точечного пилота сеть долго согласует категорию и не видит локальный оборот по SKU.",
    payoff: "Если выбрать одну точку и замерить продажи по дням, какие условия позволят расширить тест?"
  },
  horeca_cluster: {
    audience: "управляющий HoReCa/администратор площадки",
    situation: "Какие быстрые готовые позиции нужны персоналу, гостям или арендаторам в течение смены?",
    problem: "Где возникает нехватка еды: раннее утро, обеденный пик, вечерняя смена или отсутствие кухни?",
    implication: "Если нет готового перекуса рядом, персонал и гости уходят к внешним точкам, а площадка теряет сервис.",
    payoff: "Если дать сытный набор под смены и считать повтор, какой объем станет регулярным?"
  },
  horeca_ready_food: {
    audience: "закупки готовой еды/операционный руководитель",
    situation: "Какие готовые позиции уже продаются и где нужен внешний поставщик без нагрузки на производство?",
    problem: "Что ограничивает текущую матрицу: срок годности, стабильность упаковки, цена или поставки по графику?",
    implication: "Если не закрыть стабильность, готовая еда не масштабируется и остается разовым экспериментом.",
    payoff: "Если Lunch-UP даст проверенный набор под смену, какие KPI подтвердят регулярную закупку?"
  },
  transport_cluster: {
    audience: "управляющий транспортным узлом/оператор питания",
    situation: "Как пассажиры или сотрудники сейчас покупают быстрый сытный перекус в вашей зоне?",
    problem: "Где не хватает готовой еды с понятной упаковкой и быстрым выбором без ожидания?",
    implication: "Если в транспортной точке нет готовой еды, импульсный спрос уходит в соседние каналы.",
    payoff: "Если поставить сытный набор с быстрым оборотом, какие продажи за смену покажут потенциал?"
  }
}

const stageSpinGuides: Record<
  string,
  {
    goal: string
    action: string
    script: string
    close: string
  }
> = {
  lead: {
    goal: "Найти ЛПР и получить разрешение на короткую квалификацию.",
    action: "Открыть разговор через локальность, готовый запуск и одну понятную выгоду.",
    script: "Добрый день. Я отвечаю за развитие продуктов Lunch-UP в Санкт-Петербурге и Ленинградской области. У нас есть готовый формат запуска под ваш сегмент: проверяем спрос на небольшой матрице, без перестройки текущего поставщика.",
    close: "Кто у вас отвечает за такую категорию и можно ли задать 3 вопроса по текущей точке?"
  },
  qualified: {
    goal: "Понять текущий процесс, ограничения и критерий пилота.",
    action: "Не продавать весь каталог; выяснить контур, график, ограничения по SKU и экономику.",
    script: "Чтобы не отправлять лишнее, сначала уточню текущую схему: где стоит готовая еда, как часто пополняется, какие позиции уже продаются и что считается нормальным оборотом.",
    close: "Какой один показатель должен сойтись, чтобы вы дали добро на тест?"
  },
  contacted: {
    goal: "Передать релевантную матрицу и получить требования к запуску.",
    action: "Согласовать карточки SKU, условия заказа, контакт закупки и формат следующего шага.",
    script: "Я соберу короткую матрицу именно под ваш сценарий: SKU, вес, срок годности, стартовую сумму, условия заказа и KPI пилота. Не предлагаю большой контракт до проверки продаж.",
    close: "Кому отправить матрицу и какие обязательные поля нужны для первичного согласования?"
  },
  tasting: {
    goal: "Назначить дегустацию или демонстрацию стартового набора.",
    action: "Показать продукт, упаковку, роли SKU и связать дегустацию с решением по пилоту.",
    script: "Предлагаю не обсуждать вкус по презентации. Давайте покажем дегустационный набор по ролям: сытный SKU, завтрак, десерт к кофе и позиция с длинным сроком.",
    close: "Когда удобно принять дегустацию и кто должен быть на решении по тесту?"
  },
  trial: {
    goal: "Запустить ограниченный пилот с измеримыми условиями.",
    action: "Зафиксировать точку, ассортимент, объем, дату поставки и критерий успеха.",
    script: "Фиксируем пилот без лишнего риска: одна точка или один маршрут, старт от 7 000 ₽, заказ за 2 дня до 15:00, после первой недели оставляем только рабочие SKU.",
    close: "Какую точку берем для пилота и на какую дату планировать первую поставку?"
  },
  repeat: {
    goal: "Превратить результат теста в повторный заказ.",
    action: "Разобрать продажи, списания, лидеров SKU и предложить регулярную матрицу.",
    script: "По пилоту смотрим не мнение, а факты: что продалось, что списалось, какие SKU стали лидерами и где надо поменять объем. На повтор оставляем только рабочее ядро.",
    close: "Какие SKU оставляем в регулярной матрице и какой график поставки удобен?"
  },
  contract: {
    goal: "Согласовать документы, оплату и регулярные условия.",
    action: "Закрыть договор, счет, отсрочку после пилота, ЭДО и ответственных.",
    script: "Теперь переводим пилот в регулярный контур: счет/договор, документы по SKU, условия поставки по СПб/ЛО, ответственный за заказ и согласованный график маршрута.",
    close: "Кому отправить реквизиты, договор и список документов для проверки?"
  },
  won: {
    goal: "Удержать клиента и расширить матрицу по данным продаж.",
    action: "Планировать повтор, тест новых SKU и расширение на соседние точки.",
    script: "Раз клиент активен, работаем от продаж: сохраняем лидеров, тестируем 1-2 новых SKU за цикл и смотрим, где можно расширить формат без роста списаний.",
    close: "Какие две позиции тестируем следующими и есть ли вторая точка для расширения?"
  }
}

const lunchUpSiteFacts = [
  {
    label: "Позиция",
    value: "Фабрика готовой еды",
    detail: "Lunch Up - фабрика готовой охлажденной еды для B2B-точек: завтраки, салаты, сэндвичи, десерты и блюда."
  },
  {
    label: "Сроки",
    value: "3-10 суток",
    detail: "Ассортимент подходит для охлаждаемой food-полки, вендинга, микромаркета, банного комплекса, HoReCa и retail без ежедневного производства на точке."
  },
  {
    label: "Старт",
    value: "Не весь каталог",
    detail: "Стартуем с короткой матрицы 20-25 SKU, проверяем продажи, списания и повтор, затем расширяем только рабочее ядро."
  },
  {
    label: "B2B-контур",
    value: "От 7 000 ₽ на точку",
    detail: "Коммерческий контур строится вокруг юрлица, заказа заранее, документов, холодовой логистики и регулярного повтора."
  }
]

const lunchUpSourceLinks = [
  { label: "Главная", url: "https://lunch-up.ru/" },
  { label: "Вендинг", url: "https://lunch-up.ru/vending" },
  { label: "HoReCa", url: "https://lunch-up.ru/horeca" },
  { label: "Retail", url: "https://lunch-up.ru/retail" },
  { label: "Контакты", url: "https://lunch-up.ru/contacts" }
]

const companyStrategyBrief = [
  {
    label: "Что реализуем",
    value: "Фабрику готовой еды",
    detail: "Lunch Up производит готовую охлажденную еду и собирает ее в управляемую B2B-категорию: SKU, упаковка, документы, поставка, контроль продаж и повторный заказ."
  },
  {
    label: "Кому",
    value: "B2B-локациям",
    detail: "Вендинг/микромаркеты, офисные кластеры, бани/SPA, кофейни, АЗС, ритейл, HoReCa, транспорт и операторы питания в СПб/ЛО."
  },
  {
    label: "Как",
    value: "Через пилот",
    detail: "Сначала 1-3 точки, короткая матрица, KPI по продажам/списаниям/повтору; затем масштабирование по фактам."
  },
  {
    label: "Почему покупают",
    value: "Еда в моменте",
    detail: "Клиент получает быстрый полноценный перекус или ланч прямо в здании, без очереди, кухни, CapEx и долгого запуска."
  }
]

const companyDoctrineCards = [
  {
    title: "Позиционирование одним абзацем",
    text:
      "Lunch Up в Санкт-Петербурге и Ленинградской области - это фабрика готовой охлажденной еды для B2B-каналов: вендинга, микромаркетов, офисов, банных и SPA-комплексов, кофеен, АЗС, ритейла, HoReCa и операторов питания. Мы не продаем клиенту весь прайс-лист и не спорим ценой со столовой или доставкой; мы как фабрика собираем короткую матрицу под конкретный сценарий, проверяем sell-through, списания и повторный заказ, после чего расширяем только доказанную линейку."
  },
  {
    title: "Главная отстройка",
    text:
      "Lunch Up конкурирует не с абстрактным рынком еды, а с альтернативами клиента: столовой, соседней кофейней, доставкой, заморозкой, собственной кухней и текущим поставщиком. Победа - в скорости внутри локации, готовом продукте, документах, сроках, упаковке, cold-chain и управлении матрицей по данным."
  },
  {
    title: "Модель роста",
    text:
      "Правильный старт - supplier-first: Lunch Up отвечает за food-контур, ассортимент, качество, FEFO, demand planning и документы; партнер или клиентская локация дает точку продаж, трафик, платежный/операционный контур и данные. Свой операторский CAPEX - только после доказанных повторов."
  }
]

const commercialGuardrails = [
  "Не обещать бесплатную Ленинградскую область без плотности маршрута: ЛО продается коридорами, якорными клиентами или группой адресов.",
  "Не расширять ассортимент до первой недельной ревизии: широкий пилот размывает глубину SKU и повышает риск списаний.",
  "Не продавать скидку как главный аргумент: скидка допустима только за маршрутную плотность, сеть адресов или снижение списаний.",
  "Не считать мнение после дегустации победой: доказательство - пробная поставка, продажи, списания, top SKU и повторный заказ.",
  "Не заходить в operator/CAPEX-модель до проверки supplier-first: сначала доказать повторы, матрицу и route economics."
]

const companyStrategySources = [
  "Go-to-market и партнерская стратегия Lunch Up для Санкт-Петербурга вместе с Uvenco.docx",
  "Стратегический план продажи, продвижения и финансовой модели Lunch Up для Санкт-Петербурга.docx",
  "Внешний Ассортимент Lunch-UP 2026.docx",
  "Условия сотрудничества.docx"
]

type CompanySegmentProfile = {
  categoryRole: string
  competitorFrame: string
  difference: string
  revenueLogic: string
  leadHook: string
  qualificationQuestion: string
  followUpAsset: string
}

const companySegmentProfiles: Record<string, CompanySegmentProfile> = {
  vending_micromarket: {
    categoryRole: "готовая еда для умных холодильников, микромаркетов и вендинговых маршрутов",
    competitorFrame: "Оператор сравнивает Lunch Up со снековой полкой в автомате, замороженными ланчами, локальным холодильником без данных и доставкой обедов в офис.",
    difference: "Отстройка: охлажденные SKU под ячейки, ОСГ до 10 дней, маркировка, карточки для автомата, FEFO и пилот без замены текущей снековой матрицы.",
    revenueLogic: "Оператор добавляет второй чек и более сытную категорию в уже обслуживаемые точки, затем оставляет только SKU с нормальным sell-through.",
    leadHook: "Вижу, что у вас есть точки с холодильниками/микромаркетами. Мы можем дать маленькую матрицу готовой еды без перестройки маршрута.",
    qualificationQuestion: "Какие точки сейчас дают лучший поток утром и в обед, и какой срок годности для вас критичен?",
    followUpAsset: "вендинговая матрица, SKU с ОСГ, упаковка, прайс и KPI пилота"
  },
  office_cluster: {
    categoryRole: "офисная витрина готовой еды для сотрудников и арендаторов",
    competitorFrame: "Сотрудник БЦ выбирает между столовой в пиковую очередь, доставкой с ожиданием, кафе на улице и перекусом из дома.",
    difference: "Отстройка: готовая витрина внутри объекта возвращает завтрак и обед в БЦ, не требует кухни и проверяется на одной зоне по продажам и списаниям.",
    revenueLogic: "БЦ или оператор питания удерживает ежедневный спрос внутри объекта и повышает ценность сервиса для арендаторов.",
    leadHook: "Предлагаем офисную витрину на короткий тест: завтрак, сытный перекус и десерт к кофе для сотрудников без очереди.",
    qualificationQuestion: "Где в объекте самый сильный поток и кто сейчас отвечает за питание арендаторов?",
    followUpAsset: "офисная матрица, стартовый объем, требования к холодильнику и KPI по продажам/списаниям"
  },
  production_logistics: {
    categoryRole: "сытная готовая еда для сменных объектов, складов и производств",
    competitorFrame: "Смена сравнивает Lunch Up со столовой в короткое окно обеда, доставкой на КПП, магазином у проходной и сухим снеком из автомата.",
    difference: "Отстройка: сытная матрица приезжает по графику смены, продается прямо на объекте и не требует открывать кухню или держать повара.",
    revenueLogic: "Объект получает стабильный бытовой сервис для персонала, а Lunch Up закрепляет повторяемый маршрутный объем.",
    leadHook: "Для сменных объектов можем закрыть питание сытной матрицей по графику поставки, без кухни на площадке.",
    qualificationQuestion: "Сколько людей в смене, какие часы пика и есть ли несколько адресов в одном маршруте?",
    followUpAsset: "матрица 'Сытная смена', график поставок, требования к приемке и KPI повтора"
  },
  healthcare_clinic: {
    categoryRole: "быстрая готовая еда для персонала и посетителей клиник",
    competitorFrame: "Персонал и посетитель клиники сравнивают Lunch Up с буфетом, автоматом со снеками, выходом в ближайшее кафе и доставкой на ресепшен.",
    difference: "Отстройка: чистая упаковка, понятный состав, документы и короткий тестовый набор закрывают перекус внутри клиники без food-процесса на стороне клиента.",
    revenueLogic: "Клиника повышает комфорт персонала и посетителей, не создавая отдельный food-процесс.",
    leadHook: "Для клиники можно поставить небольшой набор готовой еды с чистой упаковкой и понятными сроками.",
    qualificationQuestion: "Кому нужна еда в первую очередь: персоналу, посетителям или ночной/длинной смене?",
    followUpAsset: "матрица 'Медицинский персонал', документы, состав, сроки и KPI по отзывам/повтору"
  },
  bath_spa: {
    categoryRole: "fresh-витрина готовой еды для банных и SPA-комплексов",
    competitorFrame: "Гость банного комплекса сравнивает Lunch Up с буфетом, рестораном при бане, доставкой к ресепшену, чипсами/снеками и выходом в ближайшее кафе после сеанса.",
    difference: "Отстройка: легкие охлажденные SKU в упаковке можно поставить у ресепшена или буфета без новой кухни, тяжелого меню и широкой первой закупки.",
    revenueLogic: "Банный комплекс добавляет понятный второй чек к напиткам, удерживает гостя после парения и снижает нагрузку на буфет в пиковые дни.",
    leadHook: "Для бань предлагаем маленькую fresh-витрину: сэндвичи, завтраки, нейтральные салаты и десерты для гостей после парения и персонала смены.",
    qualificationQuestion: "Где физически может стоять витрина: ресепшен, буфет, зона отдыха или отдельный холодильник, и какие дни дают максимальный поток?",
    followUpAsset: "матрица 'Банная fresh-витрина', требования к холодильнику, стартовая сумма и KPI sell-through/списаний"
  },
  foodservice_operator: {
    categoryRole: "дополнительная готовая полка для столовых и операторов питания",
    competitorFrame: "Оператор питания сравнивает Lunch Up с собственной кухней, фабрикой-кухней, заморозкой, ручной выпечкой и закупкой ингредиентов под малые партии.",
    difference: "Отстройка: Lunch Up закрывает малые партии сэндвичей, роллов, десертов и перекусов готовыми SKU, документами и упаковкой без новой кухонной смены.",
    revenueLogic: "Оператор получает дополнительную маржу и разгружает производство на роллах, сэндвичах, десертах и перекусах.",
    leadHook: "Можем расширить ассортимент столовой готовыми SKU без отдельного производства и лишней кухонной смены.",
    qualificationQuestion: "Какие категории сейчас сложнее держать стабильно: десерты, сэндвичи, роллы или готовые перекусы?",
    followUpAsset: "операторская матрица готовых SKU, документы, прайс и критерии пилота"
  },
  education_campus: {
    categoryRole: "доступный быстрый перекус для кампусов и учебных пространств",
    competitorFrame: "Студент и сотрудник кампуса выбирают между очередью в буфет, магазином у метро, снеками из автомата и доставкой к проходной.",
    difference: "Отстройка: value-матрица в холодильнике попадает в короткие пики между парами и сменами, без полноценной кухни и долгого тендерного запуска.",
    revenueLogic: "Кампус удерживает импульсный спрос внутри площадки и дает студентам/сотрудникам быстрый выбор.",
    leadHook: "Для кампуса можно запустить холодильник с быстрыми SKU на пиках между парами и сменами.",
    qualificationQuestion: "Какие часы пиковые и какой ценовой коридор аудитория готова принимать?",
    followUpAsset: "кампусная value-матрица, требования к холодильнику и KPI оборота в пиковые часы"
  },
  residential_apart: {
    categoryRole: "микромаркет или холодильник готовой еды для ЖК и апарт-комплексов",
    competitorFrame: "Резидент сравнивает Lunch Up с доставкой вечером, магазином у дома, кофейней в лобби и домашним перекусом без готового выбора.",
    difference: "Отстройка: готовая food-полка в лобби или общей зоне закрывает утро и вечер внутри комплекса без кухни, курьеров и отдельной операционной команды.",
    revenueLogic: "Управляющая компания повышает сервис для резидентов, а продажи строятся на регулярном импульсном спросе.",
    leadHook: "Для апарт-комплекса или ЖК можно добавить готовую еду как сервис рядом с домом.",
    qualificationQuestion: "Где физически возможна точка: лобби, кофепоинт, ресепшен, магазин или общая зона?",
    followUpAsset: "матрица микромаркета для резидентов, требования к месту и KPI утро/вечер"
  },
  lo_anchor: {
    categoryRole: "маршрутный запуск готовой еды для якорных клиентов Ленинградской области",
    competitorFrame: "Адрес в ЛО сравнивает Lunch Up с местной столовой, корпоративным кейтерингом, ближайшим магазином и доставкой, а для нас главный конкурент - пустой маршрут.",
    difference: "Отстройка: сначала собираем коридор адресов или якорный объем, затем обещаем регулярную поставку; так клиент получает график, а Lunch Up защищает экономику рейса.",
    revenueLogic: "Клиент получает график и условия, а Lunch Up защищает GM2 маршрута и не распыляет логистику.",
    leadHook: "Ленинградскую область запускаем коридорами: несколько адресов или якорный клиент с регулярным объемом.",
    qualificationQuestion: "Какие адреса можно объединить в один маршрут и какой объем заказа ожидается за рейс?",
    followUpAsset: "маршрутная карта ЛО, матрица 'Сытная смена', условия запуска и порог плотности"
  },
  rail_partner: {
    categoryRole: "fresh-food слой для инфраструктурных операторов, vending/coffee-point и rail-партнеров",
    competitorFrame: "Партнер сравнивает Lunch Up с текущей снековой матрицей, кофе-точкой без еды, федеральным fresh-поставщиком и собственной закупкой по точкам.",
    difference: "Отстройка: Lunch Up берет food-контур и аналитику food-conversion, а партнер сохраняет точки, платежи, сервис, телеметрию и отношения с локацией.",
    revenueLogic: "Партнер повышает средний чек и repeat на существующей инфраструктуре, затем обсуждается revenue-share.",
    leadHook: "Можем усилить вашу vending/coffee-point инфраструктуру свежей едой без собственного производства.",
    qualificationQuestion: "Какие точки уже имеют трафик, холодильник/кофепоинт и данные по продажам?",
    followUpAsset: "supplier-first пилот, KPI food-conversion/repeat, карта ролей Lunch Up и партнера"
  },
  coffee_bakery: {
    categoryRole: "еда к кофе для одиночной кофейни или пекарни",
    competitorFrame: "Гость кофейни выбирает между выпечкой, десертом, сэндвичем у соседей и доставкой, а владелец сравнивает Lunch Up с собственной кухней и локальной кулинарией.",
    difference: "Отстройка: Lunch Up добавляет сытные позиции к кофе без расширения кухни, с готовыми SKU, сроками, упаковкой и малым стартом на 6-8 позиций.",
    revenueLogic: "Кофейня повышает средний чек: гость берет не только напиток, а завтрак, сэндвич, салат или десерт с понятной маржинальной ролью.",
    leadHook: "Мы помогаем кофейням в СПб добавить еду к кофе без расширения кухни: начать можно с 6-8 SKU.",
    qualificationQuestion: "Какие позиции сейчас чаще всего спрашивают к кофе: завтрак, сэндвич, салат или десерт?",
    followUpAsset: "матрица 'Еда к кофе', карточки SKU, дегустационный набор и расчет стартовой поставки"
  },
  coffee_chain: {
    categoryRole: "единая ready-to-eat матрица для нескольких кофеен",
    competitorFrame: "Сеть кофеен сравнивает Lunch Up с централизованным поставщиком, локальными кухнями по точкам, собственной dark kitchen и федеральной food-матрицей.",
    difference: "Отстройка: локальный тест в СПб/ЛО дает повторяемые SKU, документы и данные по лидерам, которые можно масштабировать только после фактических продаж.",
    revenueLogic: "Сеть находит позиции, которые стабильно добавляют чек к кофе, и масштабирует их без капитальных вложений в производство.",
    leadHook: "Можно проверить новую food-матрицу на нескольких точках сети и оставить только SKU, которые реально двигают средний чек.",
    qualificationQuestion: "Как сеть сейчас решает ввод новой готовой еды: через пилотные точки, категорийный комитет или закупку?",
    followUpAsset: "сетевая матрица 'Еда к кофе', KPI пилота, документы по SKU и карта масштабирования"
  },
  gas_station: {
    categoryRole: "fresh-полка готовой еды в зоне кофе, кассы или convenience",
    competitorFrame: "Покупатель на АЗС выбирает между хот-догом, выпечкой, сухим снеком, заморозкой и кофе без сытной еды.",
    difference: "Отстройка: охлажденная fresh-полка рядом с кофе или кассой дает завтрак, сэндвич, салат и десерт с документами и тестом на одной станции.",
    revenueLogic: "АЗС получает второй товар к кофе и импульсную покупку без изменения основного топливного сценария.",
    leadHook: "Для АЗС предлагаем fresh-полку рядом с кофе: быстрые завтраки, сэндвичи, салаты и десерты в тестовом объеме.",
    qualificationQuestion: "Какая зона сейчас продает лучше: кофе, касса или холодильник, и как часто проходит пополнение?",
    followUpAsset: "fresh-полка, стартовый SKU-набор, срок годности, требования к выкладке и KPI sell-through"
  },
  retail_store: {
    categoryRole: "локальная полка готовой еды для магазина у дома",
    competitorFrame: "Магазин у дома сравнивает Lunch Up с федеральной СТМ, сетевой кулинарией, местным цехом и салатами с коротким сроком.",
    difference: "Отстройка: локальный малый старт закрывает документы, упаковку, SKU-карточки и поставку без большой закупки и долгого запуска категории.",
    revenueLogic: "Магазин монетизирует офисный, вечерний и кофейный трафик через готовую еду с контролем списаний.",
    leadHook: "Мы можем поставить маленькую fresh-матрицу, чтобы проверить продажи готовой еды без расширения склада.",
    qualificationQuestion: "Какая полка сейчас рядом с кофе/кассой свободна и какой объем списаний для вас допустим на тесте?",
    followUpAsset: "ритейл fresh-полка, SKU-карточки, документы, стартовая сумма и KPI по списаниям"
  },
  retail_cluster: {
    categoryRole: "fresh-категория для группы локальных торговых точек",
    competitorFrame: "Ритейл-кластер сравнивает Lunch Up с проектом СТМ, федеральным комбинатом, поставщиком кулинарии и самостоятельной закупкой по точкам.",
    difference: "Отстройка: одна-две контрольные точки, единый пакет документов, данные по SKU и масштабирование только после повторного заказа.",
    revenueLogic: "Кластер получает новую категорию выручки без долгого запуска производства и убирает слабые позиции до масштабирования.",
    leadHook: "Для кластера можно начать с одной контрольной точки и за неделю увидеть, какие SKU стоит расширять.",
    qualificationQuestion: "Какая точка в кластере лучше всего покажет спрос на готовую еду: офисный поток, касса или кофе-зона?",
    followUpAsset: "матрица fresh-полки, план пилота по точкам, документы и отчетность по продажам SKU"
  },
  horeca_cluster: {
    categoryRole: "готовая еда для HoReCa-площадок, отелей, кейтеринга и сменных сценариев",
    competitorFrame: "HoReCa-площадка сравнивает Lunch Up с собственной кухней, кейтерингом, заготовками и поставщиком ингредиентов под непиковые окна.",
    difference: "Отстройка: готовая HoReCa-линейка закрывает стабильные упакованные позиции, упаковку под формат точки, свою этикетку и работу по техкарте клиента.",
    revenueLogic: "Площадка продает еду в дополнительные окна спроса и не держит лишнюю кухонную смену ради ограниченной категории.",
    leadHook: "Мы можем закрыть готовую линейку для смены/гостей без нагрузки на вашу кухню и с упаковкой под формат точки.",
    qualificationQuestion: "Где у вас возникает нехватка готовой еды: утро, обед, поздняя смена, кейтеринг или grab-and-go?",
    followUpAsset: "HoReCa-линейка, варианты упаковки, прайс, документы и условия СТМ/техкарты"
  },
  horeca_ready_food: {
    categoryRole: "аутсорс готовой еды для регулярной продажи или внутреннего F&B-процесса",
    competitorFrame: "Клиент с готовой едой сравнивает Lunch Up с собственной доготовкой, фабрикой-кухней, полуфабрикатами и закупкой ингредиентов.",
    difference: "Отстройка: производственный партнер дает готовую линейку, маркировку, упаковку, документы и повторяемость вместо набора задач для кухни.",
    revenueLogic: "Компания стабилизирует ассортимент, снижает операционную нагрузку и продает готовую еду чаще, а не только в пиковые дни.",
    leadHook: "Если готовая еда уже продается, мы можем взять часть матрицы на себя и оставить вашей команде только контроль продаж.",
    qualificationQuestion: "Какие позиции сейчас ограничены производством: сэндвичи, салаты, завтраки, десерты или блюда под смену?",
    followUpAsset: "готовая HoReCa-матрица, документы, упаковка, условия СТМ и пилотный перечень SKU"
  },
  transport_cluster: {
    categoryRole: "grab-and-go готовая еда для транспортного потока",
    competitorFrame: "Пассажир сравнивает Lunch Up с очередью в кафе, киоском с выпечкой, снеком с напитком и покупкой еды уже после поездки.",
    difference: "Отстройка: grab-and-go матрица дает сытную упакованную покупку в потоке, с понятным сроком и быстрым стартом без кухни на транспортной точке.",
    revenueLogic: "Оператор ловит импульсный спрос в высоком потоке и увеличивает чек за счет сытной позиции рядом с напитком.",
    leadHook: "Для транспортной точки предлагаем короткую grab-and-go матрицу: быстро выбрать, оплатить и унести.",
    qualificationQuestion: "В какие часы максимальный поток и где физически можно поставить охлажденную готовую еду?",
    followUpAsset: "матрица 'Сытная смена', требования к выкладке, SKU-карточки и KPI оборота по сменам"
  }
}

function buildCompanyPositioning(
  segmentCode: string,
  segmentLabel: string,
  launch: SegmentLaunch | null,
  jtbdSegments: ProjectSheetSegment[],
  launchFormat: string | null
) {
  const profile = companySegmentProfiles[segmentCode] ?? {
    categoryRole: "готовая B2B-еда под локальный сценарий точки",
    competitorFrame: "Сравниваемся не с любым поставщиком еды, а с альтернативами клиента: текущая кухня, доставка, заморозка или слабая полка.",
    difference: "Lunch Up дает готовую матрицу, упаковку, документы, сроки и пилот под СПб/ЛО.",
    revenueLogic: "Партнер получает дополнительную категорию выручки и проверяет ее на малом старте до регулярной закупки.",
    leadHook: "Предлагаем короткий запуск готовой еды под ваш сегмент без замены текущих процессов.",
    qualificationQuestion: "Какой сценарий готовой еды сейчас недозакрыт и кто принимает решение по тесту?",
    followUpAsset: "стартовая матрица, каталог SKU, условия сотрудничества и KPI пилота"
  }
  const launchName = launch?.format ?? launchFormat ?? "индивидуальный запуск"
  const launchPitch = launch?.pitch ?? "подобрать стартовый SKU-набор под трафик точки"
  const launchKpi = launch?.kpi ?? "зафиксировать продажи, списания и решение о следующем заказе"
  const skuCount = launch ? parseLaunchSkuList(launch).length : 0
  const launchMatrixSummary = buildLaunchMatrixSummary(launch)
  const launchMatrixCompact = buildLaunchMatrixCompact(launch)
  const jtbdBasis = buildJtbdSpeechBasis(jtbdSegments, profile)
  const elevatorParagraphs = buildManagerElevatorSpeech({
    segmentLabel,
    launchName,
    launchMatrixCompact,
    launchKpi,
    routeLine: jtbdBasis.routeLine,
    revenueLogic: profile.revenueLogic,
    jtbdBasis
  })
  return {
    segmentCode,
    segmentLabel,
    launchName,
    launchPitch,
    launchKpi,
    launchMatrixSummary,
    launchMatrixCompact,
    jtbdSpeechBasis: jtbdBasis,
    skuCount,
    ...profile,
    elevator: elevatorParagraphs.join("\n\n"),
    elevatorParagraphs,
    firstSteps: [
      {
        stageCode: "lead",
        label: "Новый лид",
        text: `${profile.leadHook} Нужен контакт человека, который отвечает за ассортимент, закупку или развитие точки.`
      },
      {
        stageCode: "qualified",
        label: "Квалификация",
        text: `${profile.qualificationQuestion} Сразу фиксируем ограничения: срок, холодильник, график поставки, документы и критерий пилота.`
      },
      {
        stageCode: "contacted",
        label: "Контакт установлен",
        text: `После разговора отправляем ${profile.followUpAsset}. В письме связываем "${launchName}" с KPI: ${launchKpi}.`
      }
    ]
  }
}

function offerSkuItems(launch: SegmentLaunch | null) {
  return launch ? parseLaunchSkuList(launch) : []
}

function compactLaunchLabel(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").replace(/[.;:!?]+$/g, "")
}

function launchCatalogShortName(item: Pick<LaunchMatrixRow, "segment" | "package_name">) {
  const segment = compactLaunchLabel(item.segment)
  const launch = compactLaunchLabel(item.package_name)
  if (segment && launch && segment.toLowerCase() !== launch.toLowerCase()) return `${segment} · ${launch}`
  return segment || launch || "Сегмент x запуск"
}

function launchCatalogCategoryLabels(item: Pick<LaunchMatrixRow, "breakfasts" | "salads" | "sandwiches" | "desserts">) {
  return [
    item.breakfasts ? "завтраки" : "",
    item.salads ? "обеденная полка" : "",
    item.sandwiches ? "горячее" : "",
    item.desserts ? "десерты к кофе" : ""
  ].filter(Boolean)
}

function launchCatalogGeneralScope(item: Pick<LaunchMatrixRow, "breakfasts" | "salads" | "sandwiches" | "desserts" | "sku_count">) {
  const categories = launchCatalogCategoryLabels(item)
  const skuCount = item.sku_count || categories.length || "несколько"
  return `${skuCount} SKU в целом: ${categories.length ? categories.join(", ") : "подбор из каталога под трафик точки"}`
}

function segmentLaunchCategoryLabels(launch: SegmentLaunch) {
  return launchCategoryFields
    .filter((field) => launch[field.key]?.trim())
    .map((field) => field.label.toLowerCase())
}

function segmentLaunchGeneralScope(launch: SegmentLaunch) {
  const categories = segmentLaunchCategoryLabels(launch)
  const skuCount = parseLaunchSkuList(launch).length || "несколько"
  return `${skuCount} SKU в целом: ${categories.length ? categories.join(", ") : "подбор из каталога под трафик точки"}`
}

function scriptBlockLabel(block: string) {
  return block === "JTBD / сегмент" ? "Задача сегмента" : block
}

function scriptDisplayText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/JTBD\/Reels/g, "Reels по задаче клиента")
    .replace(/\bJTBD\b/g, "задача клиента")
}

function launchMatchesForSalesScript(script: SalesScript, launches: SegmentLaunch[]) {
  const haystack = [script.block, script.audience, script.script, script.offer, script.closing_question]
    .join(" ")
    .toLowerCase()
  const inferredFormats = [
    haystack.includes("вендинг") || haystack.includes("микромаркет") ? "Вендинг-партнер" : "",
    haystack.includes("кофе") || haystack.includes("кофейн") ? "Еда к кофе" : "",
    haystack.includes("ритейл") || haystack.includes("магазин") || haystack.includes("fresh") ? "Ритейл fresh-полка" : "",
    haystack.includes("бц") || haystack.includes("коворкинг") || haystack.includes("арендатор") ? "Офисная витрина" : "",
    haystack.includes("отель") || haystack.includes("grab") ? "Отель grab&go" : "",
    haystack.includes("клиник") || haystack.includes("медцентр") ? "Медицинский персонал" : "",
    haystack.includes("бан") || haystack.includes("spa") || haystack.includes("спа") || haystack.includes("саун") || haystack.includes("терм") ? "Банная fresh-витрина" : "",
    haystack.includes("смен") || haystack.includes("производ") ? "Сытная смена" : ""
  ].filter(Boolean)
  const directFormats = launches.filter((launch) => haystack.includes(launch.format.toLowerCase())).map((launch) => launch.format)
  const formats = uniqueValues([...directFormats, ...inferredFormats])
  return formats
    .map((format) => launches.find((launch) => launch.format === format))
    .filter((launch): launch is SegmentLaunch => Boolean(launch))
}

function objectionStageFor(segmentCode: string, stageCode: string) {
  if (segmentCode === "vending_micromarket" && ["lead", "qualified"].includes(stageCode)) return "Квалификация вендинга"
  if (segmentCode === "bath_spa" && ["lead", "qualified"].includes(stageCode)) return "Квалификация бань"
  if (segmentCode === "bath_spa" && ["tasting", "trial", "repeat"].includes(stageCode)) return "Операции бань"
  const byStage: Record<string, string> = {
    lead: "Локальные лиды",
    qualified: "Локальные лиды",
    contacted: "Закупки",
    tasting: "Продажи",
    trial: "Операции",
    repeat: "Экономика",
    contract: "Документы",
    won: "Закрытие"
  }
  return byStage[stageCode] ?? "Локальные лиды"
}

function objectionForSegmentStage(segmentCode: string, stageCode: string, objections: ObjectionMapItem[]) {
  const preferredStage = objectionStageFor(segmentCode, stageCode)
  const exact = objections.find((item) => item.stage === preferredStage)
  if (exact) return exact
  if (segmentCode === "vending_micromarket") {
    const vending = objections.find((item) => item.stage.toLowerCase().includes("вендинг"))
    if (vending) return vending
  }
  if (segmentCode === "bath_spa") {
    const bath = objections.find((item) => item.stage.toLowerCase().includes("бан"))
    if (bath) return bath
  }
  return objections.find((item) => item.stage === "Локальные лиды") ?? objections[0] ?? null
}

type PipelineStagePlaybookTemplate = {
  goal: string
  managerActions: string[]
  exitCriteria: string[]
  evidence: string[]
  stopCondition: string
}

type PipelineStagePlaybook = {
  key: string
  stageCode: string
  stageName: string
  nextStageName: string
  goal: string
  managerActions: string[]
  exitCriteria: string[]
  evidence: string[]
  handoff: string
  stopCondition: string
}

const pipelineStagePlaybookTemplates: Record<string, PipelineStagePlaybookTemplate> = {
  lead: {
    goal: "Понять, есть ли коммерческий смысл вести компанию дальше и кто может принять решение.",
    managerActions: [
      "Проверить, что компания находится в Санкт-Петербурге или Ленинградской области.",
      "Определить сегмент, формат точки и реальный сценарий готовой еды.",
      "Найти ЛПР или роль: закупка, управляющий, категорийный менеджер, операционный руководитель."
    ],
    exitCriteria: [
      "Регион и сегмент подтверждены.",
      "Есть рабочий телефон, email, сайт, 2GIS или понятный канал первого касания.",
      "Зафиксирован повод для контакта и следующая задача менеджера."
    ],
    evidence: ["Карточка компании", "Источник лида", "Контакт или публичный канал связи"],
    stopCondition: "Компания вне СПб/ЛО, нет B2B-сценария готовой еды или невозможно найти канал связи."
  },
  qualified: {
    goal: "Подтвердить, что у клиента есть потребность, экономика и условия для маленького запуска.",
    managerActions: [
      "Задать 3-5 вопросов по текущей схеме питания, полке, трафику и закупке.",
      "Понять ограничение: срок годности, холодильник, документы, цена, график или списания.",
      "Зафиксировать ЛПР, критерий успеха пилота и минимальный старт от 7 000 ₽."
    ],
    exitCriteria: [
      "Понятна боль или недозакрытый сценарий клиента.",
      "Есть ЛПР, влияющий на тест или закупку.",
      "Клиент не возражает против пилота с измеримым KPI."
    ],
    evidence: ["Заполненные поля квалификации", "Критерий пилота", "Оценка стартового объема"],
    stopCondition: "Клиент не видит сценария, не может принять тест или стартовая экономика явно ниже минимума."
  },
  contacted: {
    goal: "Перевести первый контакт в согласованный следующий шаг: матрица, дегустация или пилот.",
    managerActions: [
      "Отправить короткое письмо или сообщение с релевантным форматом запуска.",
      "Связать предложение с KPI клиента, а не с общим каталогом.",
      "Получить дату следующего касания и список обязательных требований к SKU."
    ],
    exitCriteria: [
      "Клиент ответил или подтвердил интерес к формату.",
      "Назначен следующий шаг: дегустация, запрос документов, расчет или пилот.",
      "В CRM записаны контакт, канал связи и дата follow-up."
    ],
    evidence: ["Ответ клиента", "Отправленная матрица/письмо", "Дата следующего шага"],
    stopCondition: "После серии касаний нет ответа, канал неверный или клиент просит вернуться без срока."
  },
  tasting: {
    goal: "Доказать продукт через вкус, упаковку, роли SKU и пригодность под точку.",
    managerActions: [
      "Собрать дегустационный набор под сегмент: сытная позиция, завтрак, десерт и SKU с хорошим сроком.",
      "Показать упаковку, срок годности, документы и логику выкладки.",
      "После дегустации сразу закрыть решение по пилоту или список доработок."
    ],
    exitCriteria: [
      "Дегустация проведена или клиент принял образцы.",
      "Зафиксированы понравившиеся SKU, ограничения и возражения.",
      "Согласованы точка, дата или условия пробной поставки."
    ],
    evidence: ["Список образцов", "Обратная связь", "Предварительная матрица пилота"],
    stopCondition: "Клиент не принимает продукт, не допускает образцы или не дает критерий решения после дегустации."
  },
  trial: {
    goal: "Запустить ограниченный пилот, который можно измерить продажами, списаниями и повтором.",
    managerActions: [
      "Согласовать точку, адрес, дату поставки, количество SKU и ответственного на стороне клиента.",
      "Проверить минимум заказа 7 000 ₽, заказ за 2 дня до 15:00 и маршрутную реализуемость.",
      "Заранее договориться, какие данные клиент вернет после первой недели."
    ],
    exitCriteria: [
      "Первая поставка согласована или отгружена.",
      "Есть понятный набор SKU, сумма, дата, адрес и ответственный.",
      "Клиент согласен считать продажи, списания и лидеров SKU."
    ],
    evidence: ["Пробный заказ", "Адрес и дата поставки", "Матрица SKU и KPI пилота"],
    stopCondition: "Не согласованы адрес, сумма, график, документы или нет ответственного за приемку."
  },
  repeat: {
    goal: "Перевести пилот в повторный заказ на основе фактов, а не общего впечатления.",
    managerActions: [
      "Разобрать продажи, списания, остатки и отзывы по каждому SKU.",
      "Оставить рабочее ядро и заменить слабые позиции из каталога.",
      "Согласовать регулярный график и следующий объем без раздувания матрицы."
    ],
    exitCriteria: [
      "Повторный заказ оформлен или согласован.",
      "Есть список SKU-лидеров и SKU на замену.",
      "Понятен регулярный объем, график и владелец заказа."
    ],
    evidence: ["Повторный заказ", "Отчет по продажам/списаниям", "Обновленная матрица"],
    stopCondition: "Нет данных пилота, клиент не готов повторять или экономика не сходится по списаниям."
  },
  contract: {
    goal: "Закрепить регулярные условия, документы и ответственность сторон.",
    managerActions: [
      "Передать договор, реквизиты, документы по SKU, ЭДО и условия оплаты.",
      "Закрыть график поставок, ответственных, правила заказа и приемки.",
      "Согласовать контрольную дату обзора результатов после запуска регулярного контура."
    ],
    exitCriteria: [
      "Договор, счет или регулярные условия согласованы.",
      "Есть ответственные с обеих сторон и понятный порядок заказов.",
      "Первый регулярный период поставок поставлен в календарь."
    ],
    evidence: ["Договор/счет", "Согласованные условия", "Регулярный график поставок"],
    stopCondition: "Зависли документы, оплата, отсрочка, ЭДО или нет владельца регулярного заказа."
  },
  won: {
    goal: "Удержать постоянное партнерство и расширять матрицу только по данным продаж.",
    managerActions: [
      "Проводить регулярный обзор продаж, списаний и обратной связи.",
      "Тестировать 1-2 новых SKU за цикл, не ломая рабочее ядро.",
      "Искать вторую точку, соседний сегмент или новый сценарий заказа."
    ],
    exitCriteria: [
      "Партнер делает повторные регулярные заказы.",
      "Есть месячный ритм анализа и обновления матрицы.",
      "Понятен следующий шаг роста: SKU, точка, маршрут или канал."
    ],
    evidence: ["Регулярные заказы", "Отчет по SKU", "План развития аккаунта"],
    stopCondition: "Снижается повтор, растут списания или партнер не дает данные для управления матрицей."
  }
}

function companyProfileForSegment(segmentCode: string): CompanySegmentProfile {
  return (
    companySegmentProfiles[segmentCode] ?? {
      categoryRole: "готовая B2B-еда под локальный сценарий точки",
      competitorFrame: "Сравниваемся не с любым поставщиком еды, а с альтернативами клиента: текущая кухня, доставка, заморозка или слабая полка.",
      difference: "Lunch Up дает готовую матрицу, упаковку, документы, сроки и пилот под СПб/ЛО.",
      revenueLogic: "Партнер получает дополнительную категорию выручки и проверяет ее на малом старте до регулярной закупки.",
      leadHook: "Предлагаем короткий запуск готовой еды под ваш сегмент без замены текущих процессов.",
      qualificationQuestion: "Какой сценарий готовой еды сейчас недозакрыт и кто принимает решение по тесту?",
      followUpAsset: "стартовая матрица, каталог SKU, условия сотрудничества и KPI пилота"
    }
  )
}

function buildPipelineStagePlaybook({
  segmentCode,
  segmentLabel,
  stage,
  nextStage,
  launch,
  objection,
  launchFormat
}: {
  segmentCode: string
  segmentLabel: string
  stage: Stage
  nextStage: Stage | null
  launch: SegmentLaunch | null
  objection: ObjectionMapItem | null
  launchFormat: string | null
}): PipelineStagePlaybook {
  const profile = companyProfileForSegment(segmentCode)
  const template = pipelineStagePlaybookTemplates[stage.code] ?? pipelineStagePlaybookTemplates.lead
  const launchName = launch?.format ?? launchFormat ?? "индивидуальный запуск"
  const launchPitch = launch?.pitch ?? "подобрать стартовый SKU-набор под трафик точки"
  const launchKpi = launch?.kpi ?? "принять решение о повторном заказе по продажам, списаниям и обратной связи"
  const nextStageName = nextStage?.name ?? (stage.code === "won" ? "Развитие аккаунта" : "Постоянное партнерство")
  const stageSpecificActions: Record<string, string> = {
    lead: `Использовать входной крючок сегмента: ${profile.leadHook}`,
    qualified: `Ключевой вопрос квалификации: ${profile.qualificationQuestion}`,
    contacted: `Отправить материал: ${profile.followUpAsset}.`,
    tasting: `Подобрать образцы под формат "${launchName}" и проверить, что клиент видит роль каждого SKU.`,
    trial: `Запустить "${launchName}" без расширения за пределы одной точки или маршрута до первых фактов продаж.`,
    repeat: `Сравнить результат пилота с KPI: ${launchKpi}`,
    contract: `Зафиксировать, что регулярные условия покрывают роль категории: ${profile.categoryRole}.`,
    won: `Расширять партнера через логику выручки: ${profile.revenueLogic}`
  }
  const segmentExitCriteria: Record<string, string> = {
    lead: `Понятно, почему именно ${segmentLabel} подходит под "${launchName}".`,
    qualified: `Клиент подтвердил сценарий и готов обсуждать "${launchPitch}".`,
    contacted: `Клиент получил материал и согласовал следующий шаг по "${launchName}".`,
    tasting: "После дегустации есть решение: пилот, доработка матрицы или отказ с причиной.",
    trial: `Пилот измеряется KPI: ${launchKpi}`,
    repeat: "Повтор строится на SKU-лидерах, а не на полном каталоге.",
    contract: "Регулярный заказ не зависит от одного разового менеджерского касания.",
    won: "Постоянное партнерство подтверждено повторными заказами и планом развития."
  }
  const evidence = uniqueValues([
    ...template.evidence,
    profile.followUpAsset,
    objection?.proof_or_asset ?? "",
    launch ? `Матрица запуска "${launchName}"` : ""
  ])

  return {
    key: `${segmentCode}-${stage.code}-playbook`,
    stageCode: stage.code,
    stageName: stage.name,
    nextStageName,
    goal: template.goal,
    managerActions: uniqueValues([...template.managerActions, stageSpecificActions[stage.code] ?? "Открыть карточки сделок и назначить следующий конкретный шаг."]),
    exitCriteria: uniqueValues([...template.exitCriteria, segmentExitCriteria[stage.code] ?? "Есть понятный следующий шаг и критерий перехода."]),
    evidence,
    handoff: objection?.next_question ?? stageSpinGuides[stage.code]?.close ?? "Назначить следующий шаг с датой и ответственным.",
    stopCondition: template.stopCondition
  }
}

function buildSegmentStageScript({
  segmentCode,
  segmentLabel,
  stage,
  launch,
  launchFormat,
  objections
}: {
  segmentCode: string
  segmentLabel: string
  stage: Stage
  launch: SegmentLaunch | null
  launchFormat: string | null
  objections: ObjectionMapItem[]
}) {
  const profile = segmentSpinProfiles[segmentCode] ?? {
    audience: `ЛПР сегмента ${segmentLabel}`,
    situation: "Как сейчас устроена закупка готовой еды и кто принимает решение по тесту?",
    problem: "Где сейчас не хватает готовых SKU, стабильной поставки или понятной экономики?",
    implication: "Если не проверить маленький пилот, решение останется без фактических продаж по SKU.",
    payoff: "Если Lunch-UP даст короткий тест с понятным KPI, что должно произойти для регулярной поставки?"
  }
  const guide = stageSpinGuides[stage.code] ?? stageSpinGuides.lead
  const objection = objectionForSegmentStage(segmentCode, stage.code, objections)
  const launchName = launch?.format ?? launchFormat ?? "индивидуальный запуск"
  const launchPitch = launch?.pitch ?? "Подобрать стартовый набор из каталога под трафик точки."
  const launchKpi = launch?.kpi ?? "Зафиксировать продажи, списания и решение о следующем заказе."
  const usesHorecaFramework = horecaFrameworkSegments.has(segmentCode)
  const framework = usesHorecaFramework ? "HoReCa FAB" : "SPIN"
  const frameworkSteps = usesHorecaFramework
    ? [
        {
          label: "F / feature",
          text: `${launchName}: готовая упакованная еда Lunch-UP под конкретный F&B-сценарий точки.`
        },
        {
          label: "A / advantage",
          text: "Точка получает допродажу без расширения кухни, с понятным сроком годности, прайсом и стартовой матрицей."
        },
        {
          label: "B / benefit",
          text: `${profile.payoff} KPI: ${launchKpi}`
        },
        {
          label: "Close / следующий шаг",
          text: guide.close
        }
      ]
    : [
        { label: "S / ситуация", text: profile.situation },
        { label: "P / проблема", text: profile.problem },
        { label: "I / последствия", text: profile.implication },
        { label: "N / ценность", text: profile.payoff }
      ]
  return {
    key: `${segmentCode}-${stage.code}`,
    segmentCode,
    segmentLabel,
    stageCode: stage.code,
    stageName: stage.name,
    audience: profile.audience,
    launchName,
    goal: guide.goal,
    action: guide.action,
    script: `${guide.script} Для ${segmentLabel} предлагаю формат "${launchName}": ${launchPitch}`,
    offer: `${launchPitch} KPI: ${launchKpi}`,
    skuItems: offerSkuItems(launch),
    framework,
    frameworkSteps,
    close: guide.close,
    spin: {
      situation: profile.situation,
      problem: profile.problem,
      implication: profile.implication,
      needPayoff: profile.payoff
    },
    objection,
    proof: objection?.proof_or_asset ?? "Матрица запуска, каталог SKU и условия сотрудничества.",
    nextQuestion: objection?.next_question ?? guide.close
  }
}

export function CrmDashboard({
  data,
  initialTab = "pipeline",
  publicDemo = false
}: {
  data: DashboardData
  initialTab?: string
  publicDemo?: boolean
}) {
  const safeInitialTab = tabLabels[initialTab] ? initialTab : "pipeline"
  const [activeTab, setActiveTab] = React.useState(safeInitialTab)
  const [leads, setLeads] = React.useState(data.leads)
  const [orders, setOrders] = React.useState(data.orders)
  const [accountQuery, setAccountQuery] = React.useState("")
  const [accountSource, setAccountSource] = React.useState("all")
  const [accountPriority, setAccountPriority] = React.useState("all")
  const [accountSegmentGroup, setAccountSegmentGroup] = React.useState("all")
  const [accountSegment, setAccountSegment] = React.useState("all")
  const [peopleQuery, setPeopleQuery] = React.useState("")
  const [peopleSource, setPeopleSource] = React.useState("all")
  const [peopleSegmentGroup, setPeopleSegmentGroup] = React.useState("all")
  const [peopleSegment, setPeopleSegment] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [segmentGroup, setSegmentGroup] = React.useState("all")
  const [segment, setSegment] = React.useState("all")
  const [leadStage, setLeadStage] = React.useState("all")
  const [localQuery, setLocalQuery] = React.useState("")
  const [localPriority, setLocalPriority] = React.useState("all")
  const [localSegmentGroup, setLocalSegmentGroup] = React.useState("all")
  const [localSegment, setLocalSegment] = React.useState("all")
  const [vendingQuery, setVendingQuery] = React.useState("")
  const [vendingPriority, setVendingPriority] = React.useState("all")
  const [launchQuery, setLaunchQuery] = React.useState("")
  const [launchPackage, setLaunchPackage] = React.useState("all")
  const [pipelineSegmentGroup, setPipelineSegmentGroup] = React.useState("all")
  const [pipelineSegment, setPipelineSegment] = React.useState("all")
  const [companySegment, setCompanySegment] = React.useState("all")
  const [companySegmentGroup, setCompanySegmentGroup] = React.useState("all")
  const [catalogSegmentGroup, setCatalogSegmentGroup] = React.useState("all")
  const [catalogSegment, setCatalogSegment] = React.useState("all")
  const [catalogHighlightSku, setCatalogHighlightSku] = React.useState<string | null>(null)
  const [scriptQuery, setScriptQuery] = React.useState("")
  const [scriptBlock, setScriptBlock] = React.useState("all")
  const [scriptAudience, setScriptAudience] = React.useState("all")
  const [scriptFocus, setScriptFocus] = React.useState("all")
  const [scriptSegmentGroup, setScriptSegmentGroup] = React.useState("all")
  const [scriptSegment, setScriptSegment] = React.useState("all")
  const [scriptStage, setScriptStage] = React.useState("all")
  const [scriptVisibleLimit, setScriptVisibleLimit] = React.useState(scriptInitialRowLimit)
  const [scriptCardVisibleLimit, setScriptCardVisibleLimit] = React.useState(scriptInitialCardLimit)
  const [objectionQuery, setObjectionQuery] = React.useState("")
  const [objectionStage, setObjectionStage] = React.useState("all")
  const [ordersSegmentGroup, setOrdersSegmentGroup] = React.useState("all")
  const [ordersSegment, setOrdersSegment] = React.useState("all")
  const [status, setStatus] = React.useState<string | null>(null)
  const [accessKey, setAccessKey] = React.useState<string | null>(null)
  const [savingDeal, setSavingDeal] = React.useState<number | null>(null)
  const [enrichingCompany, setEnrichingCompany] = React.useState<number | null>(null)
  const [bulkEnriching, setBulkEnriching] = React.useState(false)
  const [savingOrder, setSavingOrder] = React.useState<number | null>(null)
  const [integrationStatus, setIntegrationStatus] = React.useState<IntegrationStatusResponse | null>(null)
  const [integrationPreflight, setIntegrationPreflight] = React.useState<IntegrationPreflightResponse | null>(null)
  const [integrationLaunchGuide, setIntegrationLaunchGuide] = React.useState<IntegrationLaunchGuideResponse | null>(null)
  const [telegramSetupPreview, setTelegramSetupPreview] = React.useState<TelegramSetupPreviewResponse | null>(null)
  const [checkingPreflight, setCheckingPreflight] = React.useState(false)
  const [checkingSetupPreview, setCheckingSetupPreview] = React.useState(false)
  const [leadIntakeForm, setLeadIntakeForm] = React.useState<LeadIntakeForm>(leadIntakeInitialForm)
  const [leadIntakePreview, setLeadIntakePreview] = React.useState<CompanyLeadIntakePayload | null>(null)
  const [leadIntakeSaving, setLeadIntakeSaving] = React.useState<"preview" | "create" | null>(null)
  const [dgisLeadSearchForm, setDgisLeadSearchForm] = React.useState<DgisLeadSearchForm>(dgisLeadSearchInitialForm)
  const [dgisLeadSearchPayload, setDgisLeadSearchPayload] = React.useState<DgisLeadSearchPayload | null>(null)
  const [dgisLeadSearchSaving, setDgisLeadSearchSaving] = React.useState(false)
  const [importingDgisLead, setImportingDgisLead] = React.useState<string | null>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab") ?? ""
    if (tabLabels[tab]) setActiveTab(tab)
    setAccessKey(params.get("key"))
  }, [])

  const crmSegmentGroups = React.useMemo(() => buildCrmSegmentGroups(data.crmSegments), [data.crmSegments])
  const crmSegmentByCode = React.useMemo(
    () => new Map(data.crmSegments.map((item) => [item.code, item])),
    [data.crmSegments]
  )
  const crmSegmentMatchIndex = React.useMemo(() => buildCrmSegmentMatchIndex(data.crmSegments), [data.crmSegments])
  const accountCompanyById = React.useMemo(
    () => new Map(data.accountCompanies.map((account) => [account.id, account])),
    [data.accountCompanies]
  )
  const segmentLabelByCode = React.useMemo(
    () => new Map(data.crmSegments.map((item) => [item.code, item.label])),
    [data.crmSegments]
  )
  const crmLaunchFormatBySegment = React.useMemo(
    () => new Map(data.crmSegments.map((item) => [item.code, item.launch_format])),
    [data.crmSegments]
  )
  const segments = React.useMemo(() => Array.from(new Set(data.leads.map((lead) => lead.segment))).sort(), [data.leads])
  const pipelineStages = React.useMemo(() => data.stages.filter((stage) => stage.code !== "lost"), [data.stages])
  const projectSheetSegmentsByCrmSegment = React.useMemo(() => {
    const grouped = new Map<string, typeof data.projectSheetSegments>()
    for (const item of data.projectSheetSegments) {
      const current = grouped.get(item.crm_segment_code) ?? []
      current.push(item)
      grouped.set(item.crm_segment_code, current)
    }
    return grouped
  }, [data.projectSheetSegments])
  const segmentOptionCodes = React.useMemo(() => data.crmSegments.map((item) => item.code), [data.crmSegments])
  const activeTabGroup = React.useMemo(
    () => tabGroups.find((group) => group.items.includes(activeTab))?.label ?? "CRM",
    [activeTab]
  )
  const priorityStats = React.useMemo(() => {
    const preferred = ["B2B-лиды", "Потенциал воронки", "Заказы", "ИИ-задачи"]
    const picked = preferred
      .map((label) => data.stats.find((stat) => stat.label === label))
      .filter((stat): stat is (typeof data.stats)[number] => Boolean(stat))
    return picked.length ? picked : data.stats.slice(0, 4)
  }, [data.stats])
  const accountSources = React.useMemo(
    () => Array.from(new Set(data.accountCompanies.flatMap((account) => account.sources))).sort(),
    [data.accountCompanies]
  )
  const peopleSources = React.useMemo(
    () => Array.from(new Set(data.companyPeople.map((contact) => contact.source))).sort(),
    [data.companyPeople]
  )
  React.useEffect(() => {
    setScriptVisibleLimit(scriptInitialRowLimit)
    setScriptCardVisibleLimit(scriptInitialCardLimit)
  }, [scriptAudience, scriptBlock, scriptFocus, scriptQuery, scriptSegment, scriptSegmentGroup, scriptStage])
  React.useEffect(() => {
    if (publicDemo) return
    const key = new URLSearchParams(window.location.search).get("key")
    const url = key ? `/api/integrations/status?key=${encodeURIComponent(key)}` : "/api/integrations/status"
    const launchGuideUrl = key ? `/api/integrations/launch-guide?key=${encodeURIComponent(key)}` : "/api/integrations/launch-guide"
    const setupPreviewUrl = key ? `/api/integrations/telegram/setup-preview?key=${encodeURIComponent(key)}` : "/api/integrations/telegram/setup-preview"
    fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: IntegrationStatusResponse | null) => {
        if (payload?.ok) setIntegrationStatus(payload)
      })
      .catch(() => {
        setIntegrationStatus(null)
      })
    fetch(launchGuideUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: IntegrationLaunchGuideResponse | null) => {
        if (payload) setIntegrationLaunchGuide(payload)
      })
      .catch(() => {
        setIntegrationLaunchGuide(null)
      })
    fetch(setupPreviewUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: TelegramSetupPreviewResponse | null) => {
        if (payload) setTelegramSetupPreview(payload)
      })
      .catch(() => {
        setTelegramSetupPreview(null)
      })
  }, [publicDemo])
  const filteredAccountCompanies = React.useMemo(() => {
    const needle = accountQuery.trim().toLowerCase()
    return data.accountCompanies.filter((account) => {
      const haystack = [
        account.display_name,
        account.original_names.join(" "),
        account.sources.join(" "),
        account.primary_segment,
        account.address,
        account.dgis_url,
        account.drive_minutes_from_production,
        account.phone,
        account.email,
        account.website,
        account.telegram_url,
        account.telegram_username,
        account.telegram_contact_status,
        account.telegram_source_note,
        account.agent_contact_readiness,
        account.agent_contact_next_step,
        account.fit_reason,
        account.offer,
        account.next_action
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return (
        (!needle || haystack.includes(needle)) &&
        (accountSource === "all" || account.sources.includes(accountSource)) &&
        (accountPriority === "all" || account.priority === accountPriority) &&
        matchesCrmSegmentFilter({
          values: [account.primary_segment, ...account.sources],
          directionValue: accountSegmentGroup,
          segmentValue: accountSegment,
          crmSegmentByCode,
          crmSegmentMatchIndex
        })
      )
    })
  }, [accountPriority, accountQuery, accountSegment, accountSegmentGroup, accountSource, crmSegmentByCode, crmSegmentMatchIndex, data.accountCompanies])
  const filteredCompanyPeople = React.useMemo(() => {
    const needle = peopleQuery.trim().toLowerCase()
    return data.companyPeople.filter((contact) => {
      const account = accountCompanyById.get(contact.account_id)
      const haystack = [
        contact.company_display_name,
        contact.person_name,
        contact.role,
        contact.address,
        contact.dgis_url,
        contact.drive_minutes_from_production,
        contact.email,
        contact.phone,
        contact.telegram_handle,
        contact.preferred_channel,
        contact.notes,
        contact.source
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return (
        (!needle || haystack.includes(needle)) &&
        (peopleSource === "all" || contact.source === peopleSource) &&
        matchesCrmSegmentFilter({
          values: [account?.primary_segment, contact.source],
          directionValue: peopleSegmentGroup,
          segmentValue: peopleSegment,
          crmSegmentByCode,
          crmSegmentMatchIndex
        })
      )
    })
  }, [accountCompanyById, crmSegmentByCode, crmSegmentMatchIndex, data.companyPeople, peopleQuery, peopleSegment, peopleSegmentGroup, peopleSource])
  const filteredLeads = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return leads.filter((lead) => {
      const matchesQuery =
        !needle ||
        lead.company_name.toLowerCase().includes(needle) ||
        lead.city.toLowerCase().includes(needle) ||
        (lead.legal_name ?? "").toLowerCase().includes(needle) ||
        (lead.enrichment_inn ?? "").toLowerCase().includes(needle) ||
        (lead.enrichment_address ?? "").toLowerCase().includes(needle) ||
        (lead.address ?? "").toLowerCase().includes(needle) ||
        (lead.dgis_url ?? "").toLowerCase().includes(needle) ||
        (lead.fit_reason ?? "").toLowerCase().includes(needle) ||
        (lead.contact_email ?? "").toLowerCase().includes(needle) ||
        (lead.contact_phone ?? "").toLowerCase().includes(needle) ||
        (lead.telegram_url ?? "").toLowerCase().includes(needle) ||
        (lead.telegram_username ?? "").toLowerCase().includes(needle) ||
        (lead.telegram_contact_status ?? "").toLowerCase().includes(needle) ||
        (lead.telegram_source_note ?? "").toLowerCase().includes(needle) ||
        (lead.agent_contact_readiness ?? "").toLowerCase().includes(needle) ||
        (lead.agent_contact_next_step ?? "").toLowerCase().includes(needle) ||
        (lead.enrichment_email ?? "").toLowerCase().includes(needle) ||
        (lead.enrichment_phone ?? "").toLowerCase().includes(needle) ||
        (lead.enrichment_website ?? "").toLowerCase().includes(needle)
      const matchesSegment = segment === "all" || lead.segment === segment
      const matchesSegmentGroup =
        segmentGroup === "all" || crmSegmentByCode.get(lead.segment)?.direction_code === segmentGroup
      const matchesStage = leadStage === "all" || lead.stage_code === leadStage
      return matchesQuery && matchesSegmentGroup && matchesSegment && matchesStage
    })
  }, [crmSegmentByCode, leadStage, leads, query, segment, segmentGroup])
  const visibleEnrichmentTargets = React.useMemo(
    () => filteredLeads.filter((lead) => !lead.enrichment_updated_at || !lead.office_people_min),
    [filteredLeads]
  )
  const segmentPipelines = React.useMemo(
    () =>
      segments
        .map((segmentCode) => {
          const crmSegment = crmSegmentByCode.get(segmentCode)
          const label = crmSegment?.label ?? segmentCode
          const segmentLeads = leads.filter((lead) => lead.segment === segmentCode)
          const launch = launchForSegment(segmentCode, data.segmentLaunches, crmSegmentByCode)
          const launchFormat = crmSegment?.launch_format ?? null
          const stageCells = pipelineStages.map((stage) => {
            const stageLeads = segmentLeads.filter((lead) => lead.stage_code === stage.code)
            return {
              stage,
              count: stageLeads.length,
              revenue: stageLeads.reduce((sum, lead) => sum + Number(lead.estimated_monthly_revenue || 0), 0)
            }
          })
          const revenue = segmentLeads.reduce((sum, lead) => sum + Number(lead.estimated_monthly_revenue || 0), 0)
          const avgScore = segmentLeads.length
              ? Math.round(segmentLeads.reduce((sum, lead) => sum + Number(lead.lead_score || 0), 0) / segmentLeads.length)
              : 0
          const lastActiveIndex = Math.max(...stageCells.map((cell, index) => (cell.count > 0 ? index : -1)))
          const nextStage = pipelineStages[Math.min(Math.max(lastActiveIndex + 1, 0), Math.max(pipelineStages.length - 1, 0))]
          const playbook = pipelineStages.map((stage, index) =>
            buildPipelineStagePlaybook({
              segmentCode,
              segmentLabel: label,
              stage,
              nextStage: pipelineStages[index + 1] ?? null,
              launch,
              launchFormat,
              objection: objectionForSegmentStage(segmentCode, stage.code, data.objectionMap)
            })
          )
          const jtbdSegments = projectSheetSegmentsByCrmSegment.get(segmentCode) ?? []
          const bestLead = segmentLeads.reduce<Lead | null>(
            (best, lead) => (!best || lead.lead_score > best.lead_score ? lead : best),
            null
          )
          return {
            segmentCode,
            directionCode: crmSegment?.direction_code ?? "all",
            label,
            count: segmentLeads.length,
            revenue,
            avgScore,
            launch,
            launchFormat,
            stageCells,
            playbook,
            jtbdSegments,
            nextStage,
            nextAction: bestLead?.next_action ?? launch?.pitch ?? "Квалифицировать сегмент и назначить следующий контакт"
          }
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count || b.revenue - a.revenue),
    [crmSegmentByCode, data.objectionMap, data.segmentLaunches, leads, pipelineStages, projectSheetSegmentsByCrmSegment, segments]
  )
  const visibleSegmentPipelines = React.useMemo(
    () =>
      segmentPipelines.filter(
        (item) =>
          (pipelineSegmentGroup === "all" || item.directionCode === pipelineSegmentGroup) &&
          (pipelineSegment === "all" || item.segmentCode === pipelineSegment)
      ),
    [pipelineSegment, pipelineSegmentGroup, segmentPipelines]
  )
  const focusSegmentPipeline = visibleSegmentPipelines[0] ?? segmentPipelines[0] ?? null
  const companyPositioningRows = React.useMemo(
    () =>
      segmentOptionCodes.map((segmentCode) => {
        const jtbdSegments = projectSheetSegmentsByCrmSegment.get(segmentCode) ?? []
        const crmSegment = crmSegmentByCode.get(segmentCode)
        const label = crmSegment?.label ?? jtbdSegments[0]?.crm_segment_label ?? segmentCode
        const launch = launchForSegment(segmentCode, data.segmentLaunches, crmSegmentByCode)
        return {
          ...buildCompanyPositioning(segmentCode, label, launch, jtbdSegments, crmSegment?.launch_format ?? null),
          jtbdSegments
        }
      }),
    [crmSegmentByCode, data.segmentLaunches, projectSheetSegmentsByCrmSegment, segmentOptionCodes]
  )
  const companySegmentGroupRows = React.useMemo(() => {
    const rowsByCode = new Map(companyPositioningRows.map((row) => [row.segmentCode, row]))
    const groupedCodes = new Set(crmSegmentGroups.flatMap((group) => group.rows.map((segment) => segment.code)))
    const groupedRows = crmSegmentGroups
      .map((group) => ({
        code: group.code,
        label: group.label,
        description: group.description,
        segments: group.rows.map((segment) => segment.code),
        rows: group.rows.flatMap((segment) => {
          const row = rowsByCode.get(segment.code)
          return row ? [row] : []
        })
      }))
      .filter((group) => group.rows.length > 0)
    const ungroupedRows = companyPositioningRows.filter((row) => !groupedCodes.has(row.segmentCode))
    return ungroupedRows.length
      ? [
          ...groupedRows,
          {
            code: "other",
            label: "Прочие сегменты",
            description: "Сегменты без отдельного направления",
            segments: ungroupedRows.map((row) => row.segmentCode),
            rows: ungroupedRows
          }
        ]
      : groupedRows
  }, [companyPositioningRows, crmSegmentGroups])
  const selectedCompanySegmentGroup = React.useMemo(
    () => companySegmentGroupRows.find((group) => group.code === companySegmentGroup) ?? null,
    [companySegmentGroup, companySegmentGroupRows]
  )
  const selectedCompanySegmentRow = React.useMemo(
    () => companyPositioningRows.find((row) => row.segmentCode === companySegment) ?? null,
    [companyPositioningRows, companySegment]
  )
  const visibleCompanyPositioningRows = React.useMemo(
    () => {
      if (companySegment !== "all") {
        return companyPositioningRows.filter((item) => item.segmentCode === companySegment)
      }
      if (companySegmentGroup !== "all" && selectedCompanySegmentGroup) {
        const groupCodes = new Set(selectedCompanySegmentGroup.rows.map((item) => item.segmentCode))
        return companyPositioningRows.filter((item) => groupCodes.has(item.segmentCode))
      }
      return companyPositioningRows
    },
    [companyPositioningRows, companySegment, companySegmentGroup, selectedCompanySegmentGroup]
  )
  const companyCompetitiveContextLabel = React.useMemo(
    () =>
      selectedCompanySegmentRow?.segmentLabel ??
      selectedCompanySegmentGroup?.label ??
      allCrmSegmentsLabel,
    [selectedCompanySegmentGroup, selectedCompanySegmentRow]
  )
  const filteredLocalProspects = React.useMemo(() => {
    const needle = localQuery.trim().toLowerCase()
    return data.localProspects.filter((prospect) => {
      const haystack = [
        prospect.name,
        prospect.segment,
        prospect.address,
        prospect.fit_reason,
        prospect.offer,
        prospect.next_action,
        prospect.phone,
        prospect.email,
        prospect.inn,
        prospect.ogrn
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return (
        (!needle || haystack.includes(needle)) &&
        (localPriority === "all" || prospect.priority === localPriority) &&
        matchesCrmSegmentFilter({
          values: [prospect.segment],
          directionValue: localSegmentGroup,
          segmentValue: localSegment,
          crmSegmentByCode,
          crmSegmentMatchIndex
        })
      )
    })
  }, [crmSegmentByCode, crmSegmentMatchIndex, data.localProspects, localPriority, localQuery, localSegment, localSegmentGroup])
  const filteredVendingCompanies = React.useMemo(() => {
    const needle = vendingQuery.trim().toLowerCase()
    return data.vendingCompanies.filter((company) => {
      const haystack = [
        company.name,
        company.segment,
        company.address,
        company.coverage,
        company.fit_reason,
        company.recommended_offer,
        company.next_action,
        company.phone,
        company.email
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return (!needle || haystack.includes(needle)) && (vendingPriority === "all" || company.priority === vendingPriority)
    })
  }, [data.vendingCompanies, vendingPriority, vendingQuery])
  const launchPackages = React.useMemo(
    () => Array.from(new Set(data.launchMatrix.map((item) => item.package_name))).sort(),
    [data.launchMatrix]
  )
  const filteredLaunchMatrix = React.useMemo(() => {
    const needle = launchQuery.trim().toLowerCase()
    return data.launchMatrix.filter((item) => {
      const haystack = [
        item.name,
        item.segment,
        item.package_name,
        item.launch_format,
        launchCatalogShortName(item),
        launchCatalogGeneralScope(item),
        item.offer,
        item.next_action,
        item.contact
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return (!needle || haystack.includes(needle)) && (launchPackage === "all" || item.package_name === launchPackage)
    })
  }, [data.launchMatrix, launchPackage, launchQuery])
  const isCustomDemoStrategy = data.activeStrategy.token !== "209498707_lunch_up_spb_lo_20260604"
  const catalogBaseRows = React.useMemo<CatalogAnalysisItem[]>(
    () => {
      const sqliteCatalogRows = data.products.map((product) => ({
        category: product.category,
        name: product.name,
        net_weight: product.net_weight,
        shelf_life_days: product.shelf_life_days ? String(product.shelf_life_days) : null,
        price: product.wholesale_price,
        launch_role: "",
        best_segments: "",
        image_url: product.image_url ?? null,
        product_url: product.product_url ?? null,
        image_source: product.image_source ?? null,
        image_match: product.image_match ?? null,
        image_note: product.image_note ?? null,
        site_title: product.site_title ?? null
      }))

      return !isCustomDemoStrategy && data.catalogAnalysis.length
        ? data.catalogAnalysis
        : sqliteCatalogRows
    },
    [data.catalogAnalysis, data.products, isCustomDemoStrategy]
  )
  const launchSkuByName = React.useMemo(() => {
    const map = new Map<string, LaunchSkuItem[]>()
    for (const segmentLaunch of data.segmentLaunches) {
      for (const item of parseLaunchSkuList(segmentLaunch)) {
        const key = normalizeSkuName(item.name)
        map.set(key, [...(map.get(key) ?? []), item])
      }
    }
    return map
  }, [data.segmentLaunches])
  const selectedCatalogCrmSegment = React.useMemo(
    () => (catalogSegment === "all" ? null : crmSegmentByCode.get(catalogSegment) ?? null),
    [catalogSegment, crmSegmentByCode]
  )
  const selectedCatalogLaunchFormat = selectedCatalogCrmSegment?.launch_format ?? "all"
  const selectedCatalogSegment = React.useMemo(
    () =>
      selectedCatalogLaunchFormat === "all"
        ? null
        : data.segmentLaunches.find((item) => item.format === selectedCatalogLaunchFormat) ?? null,
    [data.segmentLaunches, selectedCatalogLaunchFormat]
  )
  const selectedCatalogJtbdSegments = React.useMemo(
    () => data.projectSheetSegments.filter((item) => catalogSegment === "all" || item.crm_segment_code === catalogSegment),
    [catalogSegment, data.projectSheetSegments]
  )
  const catalogRows = React.useMemo(
    () =>
      catalogBaseRows
        .map((product) => {
          const launchItems = launchSkuByName.get(normalizeSkuName(product.name)) ?? []
          const selectedItem =
            selectedCatalogLaunchFormat === "all"
              ? null
              : launchItems.find((item) => item.segment === selectedCatalogLaunchFormat) ?? null
          return {
            ...product,
            launchItems,
            selectedItem,
            launchSegments: uniqueValues(launchItems.map((item) => item.segment))
          }
        })
        .filter((product) => selectedCatalogLaunchFormat === "all" || Boolean(product.selectedItem)),
    [catalogBaseRows, launchSkuByName, selectedCatalogLaunchFormat]
  )
  const catalogPhotoCount = React.useMemo(
    () => catalogRows.filter((product) => Boolean(product.image_url)).length,
    [catalogRows]
  )
  const selectedCatalogItems = React.useMemo(
    () => (selectedCatalogSegment ? parseLaunchSkuList(selectedCatalogSegment) : []),
    [selectedCatalogSegment]
  )
  const pilotEquipmentPlans = React.useMemo(
    () => buildPilotEquipmentPlans(data.segmentLaunches, data.projectSheetSegments),
    [data.projectSheetSegments, data.segmentLaunches]
  )
  const pilotEquipmentSkuCount = React.useMemo(
    () => pilotEquipmentPlans.reduce((sum, plan) => sum + plan.skuItems.length, 0),
    [pilotEquipmentPlans]
  )
  const pilotEquipmentUnitCount = React.useMemo(
    () => pilotEquipmentPlans.reduce((sum, plan) => sum + plan.unitCount, 0),
    [pilotEquipmentPlans]
  )
  const objectionStages = React.useMemo(
    () => Array.from(new Set(data.objectionMap.map((item) => item.stage))).sort(),
    [data.objectionMap]
  )
  const filteredObjections = React.useMemo(() => {
    const needle = objectionQuery.trim().toLowerCase()
    return data.objectionMap.filter((item) => {
      const haystack = [
        item.stage,
        item.objection,
        item.why_it_matters,
        item.response,
        item.proof_or_asset,
        item.next_question
      ]
        .join(" ")
        .toLowerCase()
      const matchesQuery = !needle || haystack.includes(needle)
      const matchesStage = objectionStage === "all" || item.stage === objectionStage
      return matchesQuery && matchesStage
    })
  }, [data.objectionMap, objectionQuery, objectionStage])
  const filteredOrders = React.useMemo(
    () =>
      orders.filter((order) =>
        matchesCrmSegmentFilter({
          values: [order.company_segment, order.channel, "telegram_order"],
          directionValue: ordersSegmentGroup,
          segmentValue: ordersSegment,
          crmSegmentByCode,
          crmSegmentMatchIndex
        })
      ),
    [crmSegmentByCode, crmSegmentMatchIndex, orders, ordersSegment, ordersSegmentGroup]
  )
  const segmentStageScripts = React.useMemo(
    () =>
      segmentOptionCodes.flatMap((segmentCode) => {
        const jtbdSegments = projectSheetSegmentsByCrmSegment.get(segmentCode) ?? []
        const crmSegment = crmSegmentByCode.get(segmentCode)
        const segmentLabel = crmSegment?.label ?? jtbdSegments[0]?.crm_segment_label ?? segmentCode
        const launch = launchForSegment(segmentCode, data.segmentLaunches, crmSegmentByCode)
        return (
        pipelineStages.map((stage) =>
          buildSegmentStageScript({
            segmentCode,
            segmentLabel,
            stage,
            launch,
            launchFormat: crmSegment?.launch_format ?? null,
            objections: data.objectionMap
          })
        )
        )
      }),
    [crmSegmentByCode, data.objectionMap, data.segmentLaunches, pipelineStages, projectSheetSegmentsByCrmSegment, segmentOptionCodes]
  )
  const clientLineScripts = React.useMemo(
    () =>
      segmentStageScripts.flatMap((item) => {
        const roles = segmentRoleProfiles[item.segmentCode] ?? [item.audience]
        const blocks = stageScriptBlocks[item.stageCode] ?? ["opening", "qualification", "offer", "objection", "closing"]
        return roles.flatMap((role) => blocks.map((block) => buildClientLineScript(item, block, role)))
      }),
    [segmentStageScripts]
  )
  const scriptBlocks = React.useMemo(
    () => Array.from(new Set([...clientLineScripts.map((item) => item.block), ...data.salesScripts.map((item) => item.block)])).sort(),
    [clientLineScripts, data.salesScripts]
  )
  const scriptAudiences = React.useMemo(
    () =>
      Array.from(new Set([...clientLineScripts.map((item) => item.role), ...data.salesScripts.map((item) => item.audience)])).sort(),
    [clientLineScripts, data.salesScripts]
  )
  const selectedScriptGroupSegments = React.useMemo(
    () => (scriptSegmentGroup === "all" ? [] : crmSegmentGroups.find((group) => group.code === scriptSegmentGroup)?.rows ?? []),
    [crmSegmentGroups, scriptSegmentGroup]
  )
  const filteredClientLineScripts = React.useMemo(() => {
    const needle = scriptQuery.trim().toLowerCase()
    return clientLineScripts.filter((item) => {
      const haystack = [
        item.focusLabel,
        item.segmentLabel,
        item.stageName,
        item.block,
        item.role,
        item.framework,
        item.launchName,
        item.script,
        item.offer,
        item.closingQuestion,
        item.logic,
        item.skuItems.map((sku) => sku.name).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      const matchesQuery = !needle || haystack.includes(needle)
      const matchesSegmentGroup =
        scriptSegmentGroup === "all" || crmSegmentByCode.get(item.segmentCode)?.direction_code === scriptSegmentGroup
      const matchesSegment = scriptSegment === "all" || item.segmentCode === scriptSegment
      const matchesStage = scriptStage === "all" || item.stageCode === scriptStage
      const matchesBlock = scriptBlock === "all" || item.block === scriptBlock
      const matchesAudience = scriptAudience === "all" || item.role === scriptAudience
      const matchesFocus = scriptFocus === "all" || item.focus === scriptFocus
      return matchesQuery && matchesSegmentGroup && matchesSegment && matchesStage && matchesBlock && matchesAudience && matchesFocus
    })
  }, [clientLineScripts, crmSegmentByCode, scriptAudience, scriptBlock, scriptFocus, scriptQuery, scriptSegment, scriptSegmentGroup, scriptStage])
  const filteredSegmentStageScripts = React.useMemo(() => {
    const visibleKeys = new Set(filteredClientLineScripts.map((item) => item.segmentStageKey))
    return segmentStageScripts.filter((item) => visibleKeys.has(item.key))
  }, [filteredClientLineScripts, segmentStageScripts])
  const visibleClientLineScripts = React.useMemo(
    () => filteredClientLineScripts.slice(0, scriptVisibleLimit),
    [filteredClientLineScripts, scriptVisibleLimit]
  )
  const visibleSegmentStageScripts = React.useMemo(
    () => filteredSegmentStageScripts.slice(0, scriptCardVisibleLimit),
    [filteredSegmentStageScripts, scriptCardVisibleLimit]
  )
  const filteredSalesScripts = React.useMemo(() => {
    const needle = scriptQuery.trim().toLowerCase()
    return data.salesScripts.filter((item) => {
      const haystack = [item.block, item.audience, item.script, item.offer, item.closing_question].join(" ").toLowerCase()
      const matchingLaunches = launchMatchesForSalesScript(item, data.segmentLaunches)
      const selectedLaunchFormat = scriptSegment === "all" ? "" : crmLaunchFormatBySegment.get(scriptSegment) ?? ""
      const selectedJtbdSegments = scriptSegment === "all" ? [] : projectSheetSegmentsByCrmSegment.get(scriptSegment) ?? []
      const matchesQuery = !needle || haystack.includes(needle)
      const matchesBlock = scriptBlock === "all" || item.block === scriptBlock
      const matchesAudience = scriptAudience === "all" || item.audience === scriptAudience
      const matchesSegment =
        scriptSegment !== "all"
          ? item.crm_segment_code === scriptSegment ||
            item.launch_format === selectedLaunchFormat ||
            matchingLaunches.some((launch) => launch.format === selectedLaunchFormat) ||
            haystack.includes((segmentLabelByCode.get(scriptSegment) ?? "").toLowerCase()) ||
            selectedJtbdSegments.some((segment) => haystack.includes(segment.segment.toLowerCase()))
          : scriptSegmentGroup === "all" ||
            selectedScriptGroupSegments.some(
              (segment) =>
                item.crm_segment_code === segment.code ||
                item.launch_format === segment.launch_format ||
                matchingLaunches.some((launch) => launch.format === segment.launch_format) ||
                haystack.includes(segment.label.toLowerCase())
            )
      const matchesStage = scriptStage === "all"
      const matchesFocus =
        scriptFocus === "all" ||
        (scriptFocus === "spin" && ["Открытие", "Квалификация", "Предложение"].includes(item.block)) ||
        (scriptFocus === "horeca" && haystack.includes("horeca")) ||
        (scriptFocus === "vending" && haystack.includes("вендинг")) ||
        (scriptFocus === "objections" && item.block === "Возражение") ||
        (scriptFocus === "closing" && item.block === "Закрытие") ||
        (scriptFocus === "email" && item.block === "Письмо после звонка")
      return matchesQuery && matchesBlock && matchesAudience && matchesSegment && matchesStage && matchesFocus
    })
  }, [crmLaunchFormatBySegment, data.salesScripts, data.segmentLaunches, projectSheetSegmentsByCrmSegment, scriptAudience, scriptBlock, scriptFocus, scriptQuery, scriptSegment, scriptSegmentGroup, scriptStage, segmentLabelByCode, selectedScriptGroupSegments])

  async function updateStage(lead: Lead, stageId: number) {
    setSavingDeal(lead.deal_id)
    setStatus("Сохраняю стадию сделки")
    const response = await fetch(`/api/companies/${lead.deal_id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: stageId })
    })
    if (response.ok) {
      const stage = data.stages.find((item) => item.id === stageId)
      setLeads((current) =>
        current.map((item) =>
          item.deal_id === lead.deal_id && stage
            ? { ...item, stage_id: stage.id, stage_code: stage.code, stage_name: stage.name }
            : item
        )
      )
      setStatus("Стадия обновлена")
    } else {
      setStatus("Не удалось обновить стадию")
    }
    setSavingDeal(null)
  }

  function applyCompanyEnrichment(companyId: number, enrichment: NonNullable<CompanyEnrichmentPayload["enrichment"]>) {
    const { profile, office_people: officePeople } = enrichment
    setLeads((current) =>
      current.map((item) =>
        item.company_id === companyId
          ? {
              ...item,
              legal_name: profile.legal_name,
              enrichment_inn: profile.inn,
              enrichment_address: profile.address,
              address: profile.address ?? item.address,
              dgis_url: profile.dgis_url ?? item.dgis_url,
              drive_minutes_from_production: profile.drive_minutes_from_production ?? item.drive_minutes_from_production,
              drive_minutes_source: profile.drive_minutes_source ?? item.drive_minutes_source,
              enrichment_phone: profile.phone,
              enrichment_email: profile.email,
              enrichment_website: profile.website,
              employee_count_fns: profile.employee_count_fns,
              employee_count_2gis: profile.employee_count_2gis,
              employee_count_website: profile.employee_count_website,
              office_people_min: officePeople.min,
              office_people_max: officePeople.max,
              office_people_confidence: officePeople.confidence,
              office_people_method: officePeople.method,
              recommended_portions: officePeople.recommended_portions,
              recommended_sku: officePeople.recommended_sku,
              estimated_launch_budget: officePeople.estimated_launch_budget,
              enrichment_updated_at: new Date().toISOString()
            }
          : item
      )
    )
  }

  async function enrichCompany(lead: Lead) {
    setEnrichingCompany(lead.company_id)
    setStatus(`Обновляю данные по компании: ${lead.company_name}`)
    const response = await fetch(`/api/companies/${lead.company_id}/enrichment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force_refresh: true })
    })
    if (!response.ok) {
      setStatus("Не удалось обновить данные компании")
      setEnrichingCompany(null)
      return
    }

    const payload = (await response.json()) as CompanyEnrichmentPayload

    if (payload.enrichment) {
      const { office_people: officePeople } = payload.enrichment
      applyCompanyEnrichment(lead.company_id, payload.enrichment)
      const cacheNote = payload.enrichment.cache?.hit ? " · из cache" : ""
      setStatus(`Данные обновлены: офис ${officePeople.min}-${officePeople.max} человек${cacheNote}`)
    } else {
      setStatus("Источник не вернул данные компании")
    }
    setEnrichingCompany(null)
  }

  async function enrichVisibleCompanies() {
    const targets = visibleEnrichmentTargets.slice(0, bulkEnrichmentLimit)
    if (!targets.length) {
      setStatus("В текущем виде все компании уже имеют оценку офиса")
      return
    }

    setBulkEnriching(true)
    let updated = 0
    let failed = 0
    let cacheHits = 0
    for (const lead of targets) {
      setEnrichingCompany(lead.company_id)
      setStatus(`Заполняю ${updated + failed + 1}/${targets.length}: ${lead.company_name}`)
      try {
        const response = await fetch(`/api/companies/${lead.company_id}/enrichment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force_refresh: false, cache_ttl_hours: 72 })
        })
        if (!response.ok) {
          failed += 1
          continue
        }
        const payload = (await response.json()) as CompanyEnrichmentPayload
        if (payload.enrichment) {
          if (payload.enrichment.cache?.hit) cacheHits += 1
          applyCompanyEnrichment(lead.company_id, payload.enrichment)
          updated += 1
        } else {
          failed += 1
        }
      } catch {
        failed += 1
      }
    }
    setEnrichingCompany(null)
    setBulkEnriching(false)
    setStatus(`Заполнение завершено: обновлено ${updated}, из cache ${cacheHits}, ошибок ${failed}`)
  }

  function protectedApiPath(path: string) {
    const key = new URLSearchParams(window.location.search).get("key")
    if (!key) return path
    return `${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`
  }

  function updateLeadIntakeForm<K extends keyof LeadIntakeForm>(key: K, value: LeadIntakeForm[K]) {
    setLeadIntakeForm((current) => ({ ...current, [key]: value }))
  }

  function updateDgisLeadSearchForm<K extends keyof DgisLeadSearchForm>(key: K, value: DgisLeadSearchForm[K]) {
    setDgisLeadSearchForm((current) => ({ ...current, [key]: value }))
  }

  function leadIntakeRequestBody(dryRun: boolean) {
    return {
      company_name: leadIntakeForm.company_name,
      inn: leadIntakeForm.inn,
      address: leadIntakeForm.address,
      dgis_url: leadIntakeForm.dgis_url,
      drive_minutes_from_production: Number(leadIntakeForm.drive_minutes_from_production) || null,
      drive_minutes_source: leadIntakeForm.drive_minutes_source,
      website: leadIntakeForm.website,
      telegram_url: leadIntakeForm.telegram_url,
      telegram_username: leadIntakeForm.telegram_username,
      telegram_contact_status:
        leadIntakeForm.telegram_url || leadIntakeForm.telegram_username ? "public_found" : leadIntakeForm.telegram_contact_status,
      telegram_source_note: leadIntakeForm.telegram_source_note,
      agent_contact_policy: "manual_review_required",
      agent_contact_readiness: leadIntakeForm.telegram_url || leadIntakeForm.telegram_username ? "public_channel" : "none",
      segment: leadIntakeForm.segment,
      source: "crm_operator_form",
      notes: leadIntakeForm.notes,
      dry_run: dryRun,
      contact: {
        name: leadIntakeForm.contact_name,
        role: leadIntakeForm.contact_role,
        email: leadIntakeForm.contact_email,
        phone: leadIntakeForm.contact_phone,
        telegram_handle: leadIntakeForm.telegram_username ? `@${leadIntakeForm.telegram_username.replace(/^@/, "")}` : null,
        preferred_channel: leadIntakeForm.telegram_url || leadIntakeForm.telegram_username ? "telegram" : leadIntakeForm.contact_email ? "email" : leadIntakeForm.contact_phone ? "phone" : "site"
      }
    }
  }

  async function refreshDashboardLeads() {
    const response = await fetch(protectedApiPath("/api/dashboard"), { cache: "no-store" })
    if (!response.ok) return false
    const payload = (await response.json()) as DashboardData
    setLeads(payload.leads)
    setOrders(payload.orders)
    return true
  }

  async function submitLeadIntake(dryRun: boolean) {
    if (!leadIntakeForm.company_name.trim()) {
      setStatus("Введите название компании для расчета КП")
      return
    }

    setLeadIntakeSaving(dryRun ? "preview" : "create")
    setStatus(dryRun ? "Считаю КП по компании" : "Создаю компанию, сделку и enrichment")
    try {
      const response = await fetch(protectedApiPath("/api/companies"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadIntakeRequestBody(dryRun))
      })
      const payload = (await response.json()) as CompanyLeadIntakePayload
      if (!response.ok || !payload.ok) {
        setStatus(payload.error ?? "Не удалось обработать компанию")
        return
      }

      setLeadIntakePreview(payload)
      const office = payload.enrichment.office_people
      if (dryRun) {
        setStatus(`Расчет КП: офис ${office.min}-${office.max} человек, старт ${office.recommended_portions} порций`)
      } else {
        await refreshDashboardLeads()
        setQuery(leadIntakeForm.company_name)
        setLeadStage("all")
        setStatus(`Лид в CRM: офис ${office.min}-${office.max} человек, сделка #${payload.deal_id ?? "обновлена"}`)
      }
    } catch {
      setStatus("Не удалось обработать компанию")
    } finally {
      setLeadIntakeSaving(null)
    }
  }

  async function searchDgisLeadCandidates() {
    setDgisLeadSearchSaving(true)
    setStatus("Ищу B2B-кандидатов в 2ГИС")
    try {
      const response = await fetch(protectedApiPath("/api/integrations/2gis/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: dgisLeadSearchForm.query,
          district: dgisLeadSearchForm.district,
          city: dgisLeadSearchForm.city,
          segment: dgisLeadSearchForm.segment,
          limit: Number(dgisLeadSearchForm.limit) || 8,
          dry_run: true
        })
      })
      const payload = (await response.json()) as DgisLeadSearchPayload
      if (!response.ok || !payload.ok) {
        setDgisLeadSearchPayload(null)
        setStatus(payload.error?.includes("DGIS_API_KEY") ? "Нужен DGIS_API_KEY на сервере для поиска 2ГИС" : payload.error ?? "2ГИС не вернул кандидатов")
        return
      }
      setDgisLeadSearchPayload(payload)
      setStatus(`2ГИС: найдено ${payload.candidates.length}${payload.total ? ` из ${payload.total}` : ""}; выберите карточку для формы или импорта`)
    } catch {
      setDgisLeadSearchPayload(null)
      setStatus("Не удалось выполнить поиск 2ГИС")
    } finally {
      setDgisLeadSearchSaving(false)
    }
  }

  function useDgisCandidate(candidate: DgisLeadCandidate) {
    const payload = candidate.suggested_payload
    setLeadIntakeForm((current) => ({
      ...current,
      company_name: payload.company_name ?? candidate.name,
      inn: payload.inn ?? candidate.inn ?? "",
      address: payload.address ?? candidate.address ?? "",
      dgis_url: payload.dgis_url ?? candidate.source_url ?? "",
      drive_minutes_from_production: String(payload.drive_minutes_from_production ?? candidate.drive_minutes_from_production ?? ""),
      drive_minutes_source: payload.drive_minutes_source ?? "estimated_from_2gis_address",
      website: payload.website ?? candidate.website ?? "",
      telegram_url: payload.telegram_url ?? candidate.telegram_url ?? "",
      telegram_username: payload.telegram_username ?? candidate.telegram_username ?? "",
      telegram_contact_status: payload.telegram_contact_status ?? candidate.telegram_contact_status ?? "not_found",
      telegram_source_note: payload.telegram_source_note ?? "",
      segment: payload.segment ?? dgisLeadSearchForm.segment,
      contact_name: payload.contact?.name ?? "Публичный B2B-канал",
      contact_role: payload.contact?.role ?? "Общий контакт / офис / закупки",
      contact_email: payload.contact?.email ?? candidate.email ?? "",
      contact_phone: payload.contact?.phone ?? candidate.phone ?? "",
      notes: payload.notes ?? current.notes
    }))
    setLeadIntakePreview(null)
    setStatus(`Карточка 2ГИС перенесена в форму: ${candidate.name}`)
  }

  async function importDgisCandidate(candidate: DgisLeadCandidate) {
    const importKey = candidate.dgis_id ?? candidate.name
    setImportingDgisLead(importKey)
    setStatus(`Импортирую 2ГИС-кандидата: ${candidate.name}`)
    try {
      const response = await fetch(protectedApiPath("/api/companies"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...candidate.suggested_payload,
          dry_run: false,
          create_ai_task: true,
          source: "2gis_lead_search_ui"
        })
      })
      const payload = (await response.json()) as CompanyLeadIntakePayload
      if (!response.ok || !payload.ok) {
        setStatus(payload.error ?? "Не удалось импортировать кандидата 2ГИС")
        return
      }
      setLeadIntakePreview(payload)
      await refreshDashboardLeads()
      setQuery(candidate.name)
      setLeadStage("all")
      setSegmentGroup("all")
      setSegment("all")
      const office = payload.enrichment.office_people
      setStatus(`Импортировано из 2ГИС: офис ${office.min}-${office.max} человек, сделка #${payload.deal_id ?? "обновлена"}`)
    } catch {
      setStatus("Не удалось импортировать кандидата 2ГИС")
    } finally {
      setImportingDgisLead(null)
    }
  }

  async function queueAiTask(lead: Lead) {
    setSavingDeal(lead.deal_id)
    setStatus("Ставлю задачу ИИ-агенту")
    const response = await fetch("/api/agent/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_code: "outreach_writer",
        company_id: lead.company_id,
        deal_id: lead.deal_id,
        task_type: "outreach",
        priority: lead.lead_score,
        prompt: `Подготовить B2B-письмо, скрипт звонка и аргументы для ${lead.company_name}. Сегмент: ${segmentLabelByCode.get(lead.segment) ?? lead.segment}.`
      })
    })
    setStatus(response.ok ? "Задача добавлена в очередь" : "Не удалось добавить задачу")
    setSavingDeal(null)
  }

  async function updateOrderStatus(orderId: number, nextStatus: string, managerComment?: string | null) {
    setSavingOrder(orderId)
    setStatus(`Обновляю заказ #${orderId}`)
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        manager_comment: managerComment,
        notify_customer: true
      })
    })
    const payload = await response.json().catch(() => null)
    if (response.ok && payload?.ok) {
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: payload.order.status,
                manager_comment: payload.order.manager_comment,
                updated_at: new Date().toISOString()
              }
            : order
        )
      )
      setStatus(
        payload.customer_notification?.ok
          ? `Заказ #${orderId} обновлен, клиент уведомлен`
          : `Заказ #${orderId} обновлен, уведомление клиенту не отправлено`
      )
    } else {
      setStatus(payload?.error ?? "Не удалось обновить заказ")
    }
    setSavingOrder(null)
  }

  async function runIntegrationPreflight() {
    setCheckingPreflight(true)
    setStatus("Проверяю запуск Telegram Mini App и интеграций")
    const key = new URLSearchParams(window.location.search).get("key")
    const url = key ? `/api/integrations/preflight?key=${encodeURIComponent(key)}` : "/api/integrations/preflight"
    try {
      const response = await fetch(url)
      const payload = (await response.json()) as IntegrationPreflightResponse
      if (response.ok) {
        setIntegrationPreflight(payload)
        const blocked = payload.checks.filter((item) => item.status === "blocked").length
        const warnings = payload.checks.filter((item) => item.status === "warning").length
        setStatus(blocked ? `Preflight: блокеров ${blocked}, предупреждений ${warnings}` : `Preflight: блокеров нет, предупреждений ${warnings}`)
      } else {
        setStatus("Не удалось выполнить preflight")
      }
    } catch {
      setStatus("Не удалось выполнить preflight")
    } finally {
      setCheckingPreflight(false)
    }
  }

  async function refreshTelegramSetupPreview() {
    setCheckingSetupPreview(true)
    setStatus("Собираю server-side preview настройки Telegram")
    const key = new URLSearchParams(window.location.search).get("key")
    const url = key ? `/api/integrations/telegram/setup-preview?key=${encodeURIComponent(key)}` : "/api/integrations/telegram/setup-preview"
    try {
      const response = await fetch(url)
      const payload = (await response.json()) as TelegramSetupPreviewResponse
      if (response.ok) {
        setTelegramSetupPreview(payload)
        setStatus(payload.ok ? "Telegram setup preview: все обязательные значения заданы" : `Telegram setup preview: не хватает ${payload.required.missing.length}`)
      } else {
        setStatus("Не удалось получить Telegram setup preview")
      }
    } catch {
      setStatus("Не удалось получить Telegram setup preview")
    } finally {
      setCheckingSetupPreview(false)
    }
  }

  function followCrossLink(tab: string, searchValue: string) {
    setActiveTab(tab)
    if (tab === "accounts") {
      setAccountQuery(searchValue)
      setAccountSegmentGroup("all")
      setAccountSegment("all")
    }
    if (tab === "people") {
      setPeopleQuery(searchValue)
      setPeopleSegmentGroup("all")
      setPeopleSegment("all")
    }
    if (tab === "leads") {
      setQuery(searchValue)
      setSegmentGroup("all")
      setSegment("all")
      setLeadStage("all")
    }
    if (tab === "local") {
      setLocalQuery(searchValue)
      setLocalSegmentGroup("all")
      setLocalSegment("all")
    }
  }

  function openCatalogSku(launchName: string, skuName: string) {
    const nextSegment = data.crmSegments.find((item) => item.launch_format === launchName) ?? null
    setCatalogSegmentGroup(nextSegment?.direction_code ?? "all")
    setCatalogSegment(nextSegment?.code ?? "all")
    setCatalogHighlightSku(normalizeSkuName(skuName))
    setActiveTab("catalog")
    setStatus(`Каталог: ${launchName} / ${skuName}`)
    window.setTimeout(() => {
      document.getElementById(catalogSkuDomId(skuName))?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, 60)
  }

  function openCatalogLaunch(launchName: string) {
    const nextSegment = data.crmSegments.find((item) => item.launch_format === launchName) ?? null
    setCatalogSegmentGroup(nextSegment?.direction_code ?? "all")
    setCatalogSegment(nextSegment?.code ?? "all")
    setCatalogHighlightSku(null)
    setActiveTab("catalog")
    setStatus(`Каталог: ${launchName}`)
  }

  function openPipelineStage(stageCode: string, stageName: string, segmentCode?: string) {
    setQuery("")
    setSegmentGroup(segmentCode ? findCrmSegmentDirection(crmSegmentGroups, segmentCode) : "all")
    setSegment(segmentCode ?? "all")
    setLeadStage(stageCode)
    setActiveTab("leads")
    setStatus(
      segmentCode
        ? `Показаны сделки: ${segmentLabelByCode.get(segmentCode) ?? segmentCode} / ${stageName}`
        : `Показаны сделки стадии: ${stageName}`
    )
  }

  function openCompanyScriptStage(segmentCode: string, stageCode: string) {
    const stage = pipelineStages.find((item) => item.code === stageCode)
    setScriptQuery("")
    setScriptBlock("all")
    setScriptAudience("all")
    setScriptFocus("all")
    setScriptSegmentGroup(findCrmSegmentDirection(crmSegmentGroups, segmentCode))
    setScriptSegment(segmentCode)
    setScriptStage(stageCode)
    setObjectionStage("all")
    setActiveTab("script")
    setStatus(`Скрипт: ${segmentLabelByCode.get(segmentCode) ?? segmentCode} / ${stage?.name ?? stageCode}`)
  }

  function resetLeadFilters() {
    setQuery("")
    setSegmentGroup("all")
    setSegment("all")
    setLeadStage("all")
    setStatus(null)
  }

  React.useEffect(() => {
    if (!isCustomDemoStrategy) return

    const demoMinOrder = data.activeStrategy.min_order_amount || 3000
    const demoMinOrderCurrency = money(demoMinOrder)
    const demoMinOrderRubles = `${new Intl.NumberFormat("ru-RU").format(demoMinOrder)} руб.`
    const replaceDemoText = (value: string) =>
      value
        .replace(/Lunch[-\s]?UP/gi, "Caloristika")
        .replace(/7\s*000\s*₽/g, demoMinOrderCurrency)
        .replace(/7\s*000\s*руб\.?/g, demoMinOrderRubles)
        .replace(/7\s*000\s*рублей/g, demoMinOrderRubles)
        .replace(/7000\s*руб\.?/g, demoMinOrderRubles)
    const applyToNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const current = node.textContent ?? ""
        const next = replaceDemoText(current)
        if (next !== current) node.textContent = next
        return
      }

      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let current = walker.nextNode()
      while (current) {
        const text = current.textContent ?? ""
        const next = replaceDemoText(text)
        if (next !== text) current.textContent = next
        current = walker.nextNode()
      }
    }

    applyToNode(document.body)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          applyToNode(mutation.target)
          continue
        }
        mutation.addedNodes.forEach(applyToNode)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [data.activeStrategy.min_order_amount, isCustomDemoStrategy])

  return (
    <main className="crm-shell">
      <div className="crm-workspace">
        <section className="crm-command-bar no-print">
          <div className="min-w-0">
            <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:gap-3">
              <h1 className="text-2xl font-semibold tracking-normal lg:text-[28px]">
                {tabLabels[activeTab] ?? "CRM"}
              </h1>
              <span className="pb-1 text-sm text-muted-foreground">{activeTabGroup}</span>
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <Badge variant={isCustomDemoStrategy ? "success" : "outline"}>
                {isCustomDemoStrategy ? "Demo strategy" : "Активная стратегия"}
              </Badge>
              <span className="min-w-0 font-medium text-foreground">{data.activeStrategy.name}</span>
            </div>
            <p className="mt-1 max-w-4xl text-sm leading-5 text-muted-foreground">{data.activeStrategy.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <Button asChild variant="outline" className="no-print gap-2">
              <a href={internalHref(data.activeStrategy.local_miniapp_path, accessKey)} target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" />
                Mini App
              </a>
            </Button>
            {isCustomDemoStrategy ? (
              <>
                <Button asChild variant="outline" className="no-print gap-2">
                  <a href={internalHref("/catalog", accessKey)} target="_blank" rel="noreferrer">
                    <ExternalLink data-icon="inline-start" />
                    Клиентский каталог
                  </a>
                </Button>
                <Button type="button" variant="outline" className="no-print gap-2" onClick={() => setActiveTab("catalog")}>
                  <PackageCheck data-icon="inline-start" />
                  Каталог CRM
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" className="no-print gap-2">
                  <a href={internalHref("/catalog", accessKey)} target="_blank" rel="noreferrer">
                    <ExternalLink data-icon="inline-start" />
                    Клиентский каталог
                  </a>
                </Button>
                <Button asChild variant="outline" className="no-print gap-2">
                  <a href={internalHref("/admin-catalog.html", accessKey)} target="_blank" rel="noreferrer">
                    <ShieldCheck data-icon="inline-start" />
                    Админ-каталог
                  </a>
                </Button>
              </>
            )}
            <Button type="button" variant="outline" className="no-print gap-2" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              Печать
            </Button>
          </div>
        </section>

        <section className="print-only rounded-lg border-b pb-3">
          <div className="dense-label">CRM demo / печать</div>
          <h1 className="mt-1 text-xl font-semibold tracking-normal">{tabLabels[activeTab] ?? "CRM"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.activeStrategy.name} · {new Date().toLocaleDateString("ru-RU")}
          </p>
        </section>

        <section className="crm-kpi-strip no-print">
          {priorityStats.map((stat) => (
            <div key={stat.label} className="crm-kpi-card">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs font-medium text-muted-foreground">{stat.label}</div>
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <StatIcon label={stat.label} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-normal">{stat.value}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{stat.hint}</p>
            </div>
          ))}
          <div className="crm-kpi-card crm-kpi-status">
            <div className="text-xs font-medium text-muted-foreground">Статус</div>
            <div className="mt-2 text-sm font-semibold">{status ?? "Готово к работе"}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Последнее действие CRM показывается здесь.</p>
          </div>
        </section>

        <Tabs defaultValue="pipeline" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="crm-tab-rail no-print">
            {tabGroups.map((group) => {
              const groupActive = group.items.includes(activeTab)
              const groupDefaultTab = group.items[0]
              return (
                <div key={group.label} className="crm-tab-group">
                  <button
                    type="button"
                    className={`crm-tab-group-label${groupActive ? " is-active" : ""}`}
                    aria-pressed={groupActive}
                    onClick={() => setActiveTab(groupDefaultTab)}
                  >
                    {group.label}
                  </button>
                  <div className="crm-tab-group-items">
                    {group.items.map((item) => (
                      <TabsTrigger key={item} value={item} className="crm-tab-trigger">
                        {tabLabels[item]}
                      </TabsTrigger>
                    ))}
                  </div>
                </div>
              )
            })}
          </TabsList>

          <TabsContent value="pipeline">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="size-4" />
                    Воронка продаж
                  </CardTitle>
                  <CardDescription>Стадии спроектированы под путь от лида до повторного заказа.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
                    {pipelineStages.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        className="group rounded-lg border bg-background p-3 text-left transition hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openPipelineStage(stage.code, stage.name)}
                        aria-label={`Открыть сделки стадии ${stage.name}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={stageTone[stage.code] ?? "outline"}>{stage.name}</Badge>
                          <span className="text-xs text-muted-foreground">{stage.probability}%</span>
                        </div>
                        <div className="mt-3 text-2xl font-semibold">{stage.deal_count}</div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{money(stage.revenue)}</span>
                          <span className="inline-flex items-center gap-1 text-primary opacity-80 group-hover:opacity-100">
                            Открыть <ArrowRight className="size-3" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Фокус недели</CardTitle>
                  <CardDescription>Следующие действия для директора по продажам.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {focusSegmentPipeline ? (
                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <b>{focusSegmentPipeline.label}</b>
                        <Badge variant="secondary">{focusSegmentPipeline.count} сделок</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {focusSegmentPipeline.launch?.format ?? "Формат запуска уточняется"} · {money(focusSegmentPipeline.revenue)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        <b>Следующий этап:</b> {focusSegmentPipeline.nextStage?.name ?? "Квалификация"}
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-md border p-3">
                    <b>1. Квалифицировать топ-18</b>
                    <p className="mt-1 text-muted-foreground">Сначала вендинг/микромаркеты и кофейни, где score выше 80.</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <b>2. Назначить дегустации</b>
                    <p className="mt-1 text-muted-foreground">Цель: 30-50 дегустаций за 90 дней, затем пробные поставки.</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <b>3. Закрыть Telegram-процесс</b>
                    <p className="mt-1 text-muted-foreground">Бот принимает заказ, CRM проверяет минимум 7 000 руб. и передает менеджеру.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="size-4" />
                      Воронка по сегментам
                    </CardTitle>
                    <CardDescription>Сегмент x этап продаж с рекомендуемым запуском из матрицы.</CardDescription>
                  </div>
                  <CrmSegmentFilterControls
                    id="pipeline"
                    groups={crmSegmentGroups}
                    directionValue={pipelineSegmentGroup}
                    segmentValue={pipelineSegment}
                    count={visibleSegmentPipelines.length}
                    onChange={(directionCode, segmentCode) => {
                      setPipelineSegmentGroup(directionCode)
                      setPipelineSegment(segmentCode)
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Сегментов в виде</div>
                    <div className="text-xl font-semibold">{visibleSegmentPipelines.length}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Сделок</div>
                    <div className="text-xl font-semibold">
                      {visibleSegmentPipelines.reduce((sum, item) => sum + item.count, 0)}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Потенциал</div>
                    <div className="text-xl font-semibold">
                      {money(visibleSegmentPipelines.reduce((sum, item) => sum + item.revenue, 0))}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Средний score</div>
                    <div className="text-xl font-semibold">
                      {visibleSegmentPipelines.length
                        ? Math.round(
                            visibleSegmentPipelines.reduce((sum, item) => sum + item.avgScore * item.count, 0) /
                              Math.max(visibleSegmentPipelines.reduce((sum, item) => sum + item.count, 0), 1)
                          )
                        : 0}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {visibleSegmentPipelines.map((row) => (
                    <div
                      key={row.segmentCode}
                      data-segment-funnel-row={row.segmentCode}
                      className="rounded-lg border bg-background p-3"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <b>{row.label}</b>
                            <Badge variant="secondary">{row.count} сделок</Badge>
                            <Badge variant="outline">score {row.avgScore}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.launch?.format ?? "Формат запуска не назначен"} · {row.launch?.pitch ?? "подобрать стартовый SKU-набор"}
                          </p>
                        </div>
                        <div className="text-sm font-medium">{money(row.revenue)}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                        {row.stageCells.map((cell) => (
                          <button
                            key={`${row.segmentCode}-${cell.stage.code}`}
                            type="button"
                            data-segment-code={row.segmentCode}
                            data-stage-code={cell.stage.code}
                            className={`rounded-md border p-2 text-left transition hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              cell.count ? "border-primary/40 bg-primary/5" : "bg-card"
                            }`}
                            onClick={() => openPipelineStage(cell.stage.code, cell.stage.name, row.segmentCode)}
                            aria-label={`Открыть ${row.label}: ${cell.stage.name}`}
                          >
                            <div className="truncate text-xs text-muted-foreground">{cell.stage.name}</div>
                            <div className="mt-1 text-lg font-semibold">{cell.count}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{money(cell.revenue)}</div>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        <b>Что предлагать:</b> {row.launch?.kpi ?? row.nextAction}
                      </div>
                      {row.jtbdSegments.length ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                          {row.jtbdSegments.map((segment) => (
                            <div key={segment.segment} className="rounded-md border bg-primary/5 p-3 text-xs leading-5">
                              <div className="font-semibold text-foreground">{segment.segment}</div>
                              <p className="mt-1 text-muted-foreground">
                                <b className="text-foreground">Задача:</b> {segment.jtbd}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                <b className="text-foreground">Боль:</b> {segment.pain}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                <b className="text-foreground">Решение:</b> {segment.solution}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <details className="mt-4 rounded-lg border bg-muted/20 p-3" open={pipelineSegment !== "all"}>
                        <summary className="cursor-pointer list-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold">Playbook менеджера по стадиям</div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Что делать на каждом этапе, какие доказательства собрать и когда переводить сделку дальше.
                              </p>
                            </div>
                            <Badge variant="outline">Цель: постоянное партнерство</Badge>
                          </div>
                        </summary>
                        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                          {row.playbook.map((step) => {
                            const cell = row.stageCells.find((item) => item.stage.code === step.stageCode)
                            return (
                              <div key={step.key} className="flex min-h-[360px] flex-col rounded-md border bg-background p-3 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="break-words text-sm font-semibold">{step.stageName}</div>
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                      Дальше: {step.nextStageName}
                                    </div>
                                  </div>
                                  <Badge variant={cell?.count ? "secondary" : "outline"}>{cell?.count ?? 0}</Badge>
                                </div>
                                <p className="mt-3 leading-5 text-muted-foreground">
                                  <b className="text-foreground">Цель:</b> {step.goal}
                                </p>
                                <div className="mt-3">
                                  <div className="font-semibold">Что сделать</div>
                                  <ul className="mt-1 list-disc space-y-1 pl-4 leading-5 text-muted-foreground">
                                    {step.managerActions.slice(0, 4).map((action) => (
                                      <li key={action}>{action}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="mt-3">
                                  <div className="font-semibold">Критерии перехода</div>
                                  <ul className="mt-1 list-disc space-y-1 pl-4 leading-5 text-muted-foreground">
                                    {step.exitCriteria.slice(0, 4).map((criterion) => (
                                      <li key={criterion}>{criterion}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="mt-3">
                                  <div className="font-semibold">Доказательства</div>
                                  <p className="mt-1 leading-5 text-muted-foreground">{step.evidence.slice(0, 4).join("; ")}</p>
                                </div>
                                <div className="mt-3 leading-5 text-muted-foreground">
                                  <b className="text-foreground">Следующий вопрос:</b> {step.handoff}
                                </div>
                                <div className="mt-2 leading-5 text-muted-foreground">
                                  <b className="text-foreground">Стоп:</b> {step.stopCondition}
                                </div>
                                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1 px-2 text-xs"
                                    onClick={() => openPipelineStage(step.stageCode, step.stageName, row.segmentCode)}
                                  >
                                    <ArrowRight className="size-3" />
                                    Сделки
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1 px-2 text-xs"
                                    onClick={() => openCompanyScriptStage(row.segmentCode, step.stageCode)}
                                  >
                                    <ClipboardList className="size-3" />
                                    Скрипт
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="size-4" />
                      Единая база учета компаний
                    </CardTitle>
                    <CardDescription>
                      Объединяет вкладки `Компании`, `Локальные лиды` и специализированные источники; названия нормализованы, оригиналы сохранены.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-[260px]">
                      <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        value={accountQuery}
                        onChange={(event) => setAccountQuery(event.target.value)}
                        placeholder="Поиск по единой базе"
                      />
                    </div>
                    <select
                      className={`${crmSelectClass} min-w-[220px]`}
                      value={accountSource}
                      onChange={(event) => setAccountSource(event.target.value)}
                    >
                      <option value="all">Все источники</option>
                      {accountSources.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <select
                      className={`${crmSelectClass} min-w-[220px]`}
                      value={accountPriority}
                      onChange={(event) => setAccountPriority(event.target.value)}
                    >
                      <option value="all">Все приоритеты</option>
                      <option value="A">Приоритет A</option>
                      <option value="B">Приоритет B</option>
                      <option value="C">Приоритет C</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/20 p-3" data-account-segment-menu>
                  <CrmSegmentFilterControls
                    id="accounts"
                    groups={crmSegmentGroups}
                    directionValue={accountSegmentGroup}
                    segmentValue={accountSegment}
                    count={filteredAccountCompanies.length}
                    onChange={(directionCode, segmentCode) => {
                      setAccountSegmentGroup(directionCode)
                      setAccountSegment(segmentCode)
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Компаний в учете</div>
                    <div className="text-xl font-semibold">{data.accountCompanies.length}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">В текущем виде</div>
                    <div className="text-xl font-semibold">{filteredAccountCompanies.length}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">С кросс-источниками</div>
                    <div className="text-xl font-semibold">
                      {data.accountCompanies.filter((account) => account.source_count > 1).length}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Контактов людей</div>
                    <div className="text-xl font-semibold">{data.companyPeople.length}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Telegram/AI-канал</div>
                    <div className="text-xl font-semibold">
                      {data.accountCompanies.filter((account) => account.telegram_contact_status !== "not_found").length}
                    </div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Компания</TableHead>
                      <TableHead>Источники</TableHead>
                      <TableHead>Контакты</TableHead>
                      <TableHead>Сегмент/статус</TableHead>
                      <TableHead>Оффер/следующий шаг</TableHead>
                      <TableHead>Ссылки</TableHead>
                      <TableHead>Кросс-переход</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccountCompanies.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="min-w-[260px]">
                          <div className="font-medium">{account.display_name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Оригиналы: {account.original_names.join(" / ")}
                          </div>
                          {account.address ? <div className="mt-1 text-xs text-muted-foreground">{account.address}</div> : null}
                          <div className="mt-1 flex flex-wrap gap-2 text-xs">
                            {account.drive_minutes_from_production ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Truck className="size-3" />
                                {account.drive_minutes_from_production} мин на авто
                              </span>
                            ) : null}
                            {account.dgis_url ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(account.dgis_url)} target="_blank" rel="noreferrer">
                                2ГИС <ExternalLink className="size-3" />
                              </a>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[170px]">
                          <div className="flex flex-wrap gap-1">
                            {account.sources.map((source) => (
                              <Badge key={source} variant="outline">
                                {source}
                              </Badge>
                            ))}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{account.source_count} источник(а)</div>
                        </TableCell>
                        <TableCell className="min-w-[230px] text-sm">
                          <div className="space-y-1">
                            {account.phone ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${phoneHref(account.phone)}`}>
                                <Phone className="size-3" />
                                {account.phone}
                              </a>
                            ) : null}
                            {account.email ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${account.email.split(";")[0].trim()}`}>
                                <Mail className="size-3" />
                                {account.email}
                              </a>
                            ) : null}
                            {account.telegram_url ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(account.telegram_url)} target="_blank" rel="noreferrer">
                                <Send className="size-3" />
                                {account.telegram_username ? `@${account.telegram_username}` : "Telegram"}
                              </a>
                            ) : null}
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={account.telegram_contact_status === "public_found" || account.telegram_contact_status === "approved_to_contact" ? "success" : account.telegram_contact_status === "needs_verification" ? "warning" : "outline"}>
                                {telegramStatusLabel(account.telegram_contact_status)}
                              </Badge>
                              <Badge variant="outline">{agentReadinessLabel(account.agent_contact_readiness)}</Badge>
                            </div>
                            {account.agent_contact_next_step ? (
                              <div className="text-xs text-muted-foreground">{account.agent_contact_next_step}</div>
                            ) : null}
                            <div className="text-xs text-muted-foreground">людей/каналов: {account.people_count}</div>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[190px] text-sm">
                          <Badge variant={account.priority === "A" ? "success" : account.priority === "B" ? "warning" : "outline"}>
                            {account.priority}
                          </Badge>
                          <div className="mt-1">{account.primary_segment}</div>
                          <div className="text-xs text-muted-foreground">score {account.score} · {account.status}</div>
                        </TableCell>
                        <TableCell className="min-w-[360px] text-sm">
                          <div>{account.offer ?? account.fit_reason}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{account.next_action}</div>
                        </TableCell>
                        <TableCell className="min-w-[150px] text-sm">
                          <div className="flex flex-col gap-1">
                            {account.source_links.slice(0, 5).map((link) => (
                              <a
                                key={`${link.label}-${link.url}`}
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                href={externalHref(link.url)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {link.label} <ExternalLink className="size-3" />
                              </a>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="flex flex-wrap gap-1">
                            {account.cross_links.map((link) => (
                              <Button
                                key={`${account.id}-${link.label}`}
                                size="sm"
                                variant="outline"
                                onClick={() => followCrossLink(link.tab, link.query)}
                              >
                                {link.label}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="local">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="size-4" />
                      Локальная база SPB+ЛО
                    </CardTitle>
                    <CardDescription>Потенциальные клиенты для первого SPB+ЛО outreach и маршрутных пилотов.</CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-[260px]">
                      <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        value={localQuery}
                        onChange={(event) => setLocalQuery(event.target.value)}
                        placeholder="Поиск по локальной базе"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                      <select
                        className={`${crmSelectIconClass} min-w-[220px]`}
                        value={localPriority}
                        onChange={(event) => setLocalPriority(event.target.value)}
                      >
                        <option value="all">Все приоритеты</option>
                        <option value="A">Приоритет A</option>
                        <option value="B">Приоритет B</option>
                        <option value="C">Приоритет C</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/20 p-3" data-local-segment-menu>
                  <CrmSegmentFilterControls
                    id="local"
                    groups={crmSegmentGroups}
                    directionValue={localSegmentGroup}
                    segmentValue={localSegment}
                    count={filteredLocalProspects.length}
                    onChange={(directionCode, segmentCode) => {
                      setLocalSegmentGroup(directionCode)
                      setLocalSegment(segmentCode)
                    }}
                  />
                </div>
                <div className="hidden">
                  <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="size-4" />
                        Новый лид и КП
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">2ГИС/ФНС enrichment, контакт, сделка и расчет запуска.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        disabled={leadIntakeSaving !== null}
                        onClick={() => submitLeadIntake(true)}
                      >
                        <Database className="size-3.5" />
                        Рассчитать КП
                      </Button>
                      <Button
                        type="button"
                        className="gap-2"
                        disabled={leadIntakeSaving !== null}
                        onClick={() => submitLeadIntake(false)}
                      >
                        <Send className="size-3.5" />
                        Создать лид
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.2fr)_170px_minmax(220px,1fr)_minmax(180px,0.9fr)]">
                    <label className="space-y-1 text-xs font-medium">
                      <span>Компания</span>
                      <Input
                        value={leadIntakeForm.company_name}
                        onChange={(event) => updateLeadIntakeForm("company_name", event.target.value)}
                        placeholder="Название компании"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>ИНН</span>
                      <Input value={leadIntakeForm.inn} onChange={(event) => updateLeadIntakeForm("inn", event.target.value)} placeholder="Опционально" />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Адрес</span>
                      <Input
                        value={leadIntakeForm.address}
                        onChange={(event) => updateLeadIntakeForm("address", event.target.value)}
                        placeholder="СПб или ЛО"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Сегмент</span>
                      <select
                        className={`${crmSelectClass} w-full`}
                        value={leadIntakeForm.segment}
                        onChange={(event) => updateLeadIntakeForm("segment", event.target.value)}
                      >
                        <CrmSegmentOptionGroups groups={crmSegmentGroups} />
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Сайт</span>
                      <Input value={leadIntakeForm.website} onChange={(event) => updateLeadIntakeForm("website", event.target.value)} placeholder="https://" />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Контакт</span>
                      <Input
                        value={leadIntakeForm.contact_name}
                        onChange={(event) => updateLeadIntakeForm("contact_name", event.target.value)}
                        placeholder="Имя или канал"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Роль</span>
                      <Input
                        value={leadIntakeForm.contact_role}
                        onChange={(event) => updateLeadIntakeForm("contact_role", event.target.value)}
                        placeholder="Закупки / офис"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Email</span>
                      <Input
                        value={leadIntakeForm.contact_email}
                        onChange={(event) => updateLeadIntakeForm("contact_email", event.target.value)}
                        placeholder="email"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Телефон</span>
                      <Input
                        value={leadIntakeForm.contact_phone}
                        onChange={(event) => updateLeadIntakeForm("contact_phone", event.target.value)}
                        placeholder="+7"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Telegram URL</span>
                      <Input
                        value={leadIntakeForm.telegram_url}
                        onChange={(event) => updateLeadIntakeForm("telegram_url", event.target.value)}
                        placeholder="https://t.me/..."
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Telegram username</span>
                      <Input
                        value={leadIntakeForm.telegram_username}
                        onChange={(event) => updateLeadIntakeForm("telegram_username", event.target.value.replace(/^@/, ""))}
                        placeholder="company_bot"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span>Статус Telegram</span>
                      <select
                        className={`${crmSelectClass} w-full`}
                        value={leadIntakeForm.telegram_contact_status}
                        onChange={(event) => updateLeadIntakeForm("telegram_contact_status", event.target.value)}
                      >
                        <option value="not_found">не найден</option>
                        <option value="needs_verification">проверить</option>
                        <option value="public_found">публичный найден</option>
                        <option value="approved_to_contact">можно писать</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium lg:col-span-4">
                      <span>Заметка</span>
                      <textarea
                        className="min-h-[72px] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={leadIntakeForm.notes}
                        onChange={(event) => updateLeadIntakeForm("notes", event.target.value)}
                        placeholder="Что известно о точке, офисе или формате питания"
                      />
                    </label>
                  </div>
                  {leadIntakePreview ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-4">
                      <div className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">Офис</div>
                        <div className="font-semibold">
                          {leadIntakePreview.enrichment.office_people.min}-{leadIntakePreview.enrichment.office_people.max} чел.
                        </div>
                        <div className="text-xs text-muted-foreground">{leadIntakePreview.enrichment.office_people.confidence}</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">Старт</div>
                        <div className="font-semibold">{leadIntakePreview.enrichment.office_people.recommended_portions} порций</div>
                        <div className="text-xs text-muted-foreground">{leadIntakePreview.enrichment.office_people.recommended_sku} SKU</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">Бюджет</div>
                        <div className="font-semibold">{money(leadIntakePreview.enrichment.office_people.estimated_launch_budget)}</div>
                        <div className="text-xs text-muted-foreground">{leadIntakePreview.dry_run ? "предпросмотр" : "записано в CRM"}</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">Следующее действие</div>
                        <div className="text-xs leading-5">{leadIntakePreview.next_action}</div>
                      </div>
                      <div className="md:col-span-4 text-xs leading-5 text-muted-foreground">
                        {leadIntakePreview.enrichment.profile.inn ? `ИНН: ${leadIntakePreview.enrichment.profile.inn}. ` : ""}
                        {leadIntakePreview.enrichment.profile.address ? `${leadIntakePreview.enrichment.profile.address}. ` : ""}
                        {leadIntakePreview.enrichment.office_people.method}
                      </div>
                      {leadIntakePreview.enrichment.headcount_evidence?.length ? (
                        <div className="md:col-span-4 rounded-md border bg-background p-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">Источники численности для КП</div>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            {leadIntakePreview.enrichment.headcount_evidence.map((item) => (
                              <div key={`${item.source}-${item.label}`} className="rounded-md border p-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{item.label}</span>
                                  <Badge variant={item.used_for_estimate ? "success" : "outline"}>
                                    {item.used_for_estimate ? "в расчете" : item.confidence}
                                  </Badge>
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  {item.value ? `${item.value} чел. · ` : ""}
                                  {item.note}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {leadIntakePreview.enrichment.proposal?.proposal_summary ? (
                        <div className="md:col-span-4 text-xs leading-5 text-muted-foreground">
                          {leadIntakePreview.enrichment.proposal.proposal_summary}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Компания</TableHead>
                      <TableHead>Сегмент</TableHead>
                      <TableHead>Пешком</TableHead>
                      <TableHead>Приоритет</TableHead>
                      <TableHead>Почему подходит</TableHead>
                      <TableHead>Оффер</TableHead>
                      <TableHead>Контакт</TableHead>
                      <TableHead>Источники</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLocalProspects.map((prospect) => (
                      <TableRow key={prospect.id}>
                        <TableCell className="min-w-[260px]">
                          <div className="font-medium">{prospect.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{prospect.address}</div>
                          {prospect.fns_status ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              ФНС: {prospect.fns_status} {prospect.inn ? `· ${prospect.inn}` : ""}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{prospect.segment}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{prospect.walk_min} мин</div>
                          <div className="text-xs text-muted-foreground">{prospect.distance_band}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              prospect.priority === "A" ? "success" : prospect.priority === "B" ? "warning" : "outline"
                            }
                          >
                            {prospect.priority}
                          </Badge>
                          <div className="mt-1 text-xs text-muted-foreground">score {prospect.score}</div>
                        </TableCell>
                        <TableCell className="min-w-[320px] text-sm">{prospect.fit_reason}</TableCell>
                        <TableCell className="min-w-[340px] text-sm">
                          <div>{prospect.offer}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{prospect.next_action}</div>
                        </TableCell>
                        <TableCell className="min-w-[220px] text-sm">
                          <div className="space-y-1">
                            {prospect.phone ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${phoneHref(prospect.phone)}`}>
                                <Phone className="size-3" />
                                {prospect.phone}
                              </a>
                            ) : null}
                            {prospect.email ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${prospect.email}`}>
                                <Mail className="size-3" />
                                {prospect.email}
                              </a>
                            ) : null}
                            {prospect.notes ? <div className="text-xs text-muted-foreground">{prospect.notes}</div> : null}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px] text-sm">
                          <div className="flex flex-col gap-1">
                            {prospect.source_2gis ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(prospect.source_2gis)} target="_blank" rel="noreferrer">
                                2ГИС <ExternalLink className="size-3" />
                              </a>
                            ) : null}
                            {prospect.source_yandex ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(prospect.source_yandex)} target="_blank" rel="noreferrer">
                                Яндекс <ExternalLink className="size-3" />
                              </a>
                            ) : null}
                            {prospect.pb_nalog_url ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(prospect.pb_nalog_url)} target="_blank" rel="noreferrer">
                                ФНС <ExternalLink className="size-3" />
                              </a>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vending">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <PackageCheck className="size-4" />
                        Вендинг
                      </CardTitle>
                      <CardDescription>
                        Операторы СПб/ЛО из открытых источников, 2ГИС и Яндекс Карт для предложения Lunch-UP.
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative min-w-[260px]">
                        <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          value={vendingQuery}
                          onChange={(event) => setVendingQuery(event.target.value)}
                          placeholder="Поиск по вендингу"
                        />
                      </div>
                      <div className="relative">
                        <Filter className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                        <select
                          className={`${crmSelectIconClass} min-w-[220px]`}
                          value={vendingPriority}
                          onChange={(event) => setVendingPriority(event.target.value)}
                        >
                          <option value="all">Все приоритеты</option>
                          <option value="A">Приоритет A</option>
                          <option value="B">Приоритет B</option>
                          <option value="C">Приоритет C</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Компаний</div>
                      <div className="text-xl font-semibold">{filteredVendingCompanies.length}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Приоритет A</div>
                      <div className="text-xl font-semibold">
                        {filteredVendingCompanies.filter((company) => company.priority === "A").length}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Прямой fit</div>
                      <div className="text-xl font-semibold">
                        {filteredVendingCompanies.filter((company) => company.segment !== "Вендинг/оборудование").length}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Формат</div>
                      <div className="text-xl font-semibold">Вендинг</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Мин. старт</div>
                      <div className="text-xl font-semibold">{money(data.launchSummary?.min_order_rub ?? 7000)}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Канал</div>
                      <div className="text-xl font-semibold">2ГИС/Я</div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Компания</TableHead>
                        <TableHead>Сегмент</TableHead>
                        <TableHead>Приоритет</TableHead>
                        <TableHead>Контакт</TableHead>
                        <TableHead>Почему подходит</TableHead>
                        <TableHead>Что предложить</TableHead>
                        <TableHead>Риск</TableHead>
                        <TableHead>Источники</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendingCompanies.map((company) => {
                        const canEmail = company.email && !company.email.toLowerCase().includes("уточнить")
                        return (
                          <TableRow key={company.name}>
                            <TableCell className="min-w-[260px]">
                              <div className="font-medium">{company.name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{company.address}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{company.coverage}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{company.segment}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={company.priority === "A" ? "success" : company.priority === "B" ? "warning" : "outline"}>
                                {company.priority}
                              </Badge>
                              <div className="mt-1 text-xs text-muted-foreground">score {company.score}</div>
                            </TableCell>
                            <TableCell className="min-w-[230px] text-sm">
                              <div className="space-y-1">
                                {company.phone ? (
                                  <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${phoneHref(company.phone)}`}>
                                    <Phone className="size-3" />
                                    {company.phone}
                                  </a>
                                ) : null}
                                {canEmail ? (
                                  <a
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                    href={`mailto:${company.email.split(";")[0].trim()}`}
                                  >
                                    <Mail className="size-3" />
                                    {company.email}
                                  </a>
                                ) : (
                                  <div className="text-xs text-muted-foreground">{company.email}</div>
                                )}
                                {company.website ? (
                                  <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(company.website)} target="_blank" rel="noreferrer">
                                    сайт <ExternalLink className="size-3" />
                                  </a>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[320px] text-sm">{company.fit_reason}</TableCell>
                            <TableCell className="min-w-[360px] text-sm">
                              <div>{company.recommended_offer}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{company.next_action}</div>
                            </TableCell>
                            <TableCell className="min-w-[280px] text-sm">
                              <div>{company.risk}</div>
                              <div className="mt-1 text-xs text-muted-foreground">уверенность: {company.confidence}</div>
                            </TableCell>
                            <TableCell className="min-w-[160px] text-sm">
                              <div className="flex flex-col gap-1">
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(company.source_2gis)} target="_blank" rel="noreferrer">
                                  2ГИС <ExternalLink className="size-3" />
                                </a>
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(company.source_yandex)} target="_blank" rel="noreferrer">
                                  Яндекс <ExternalLink className="size-3" />
                                </a>
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(company.source_public)} target="_blank" rel="noreferrer">
                                  источник <ExternalLink className="size-3" />
                                </a>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Что продавать вендингу</CardTitle>
                  <CardDescription>Короткий оффер для первых переговоров.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md border p-3">
                    <b>Формат</b>
                    <p className="mt-1 text-muted-foreground">Вендинг-партнер: готовая еда для микромаркетов и умных холодильников.</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <b>Ядро запуска</b>
                    <p className="mt-1 text-muted-foreground">
                      Сэндвичи с ОСГ 10 суток, сырники, запеканка, медовик, морковный кекс, сочень.
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <b>KPI пилота</b>
                    <p className="mt-1 text-muted-foreground">
                      Sell-through 65% до следующей загрузки, списания до 15%, 3 SKU-лидера.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="launch">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <PackageCheck className="size-4" />
                        Матрица запуска
                      </CardTitle>
                      <CardDescription>Формат, SKU из каталога, стартовая сумма, KPI и следующий шаг по каждому лиду.</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative min-w-[260px]">
                        <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          value={launchQuery}
                          onChange={(event) => setLaunchQuery(event.target.value)}
                          placeholder="Поиск по лиду/сегменту"
                        />
                      </div>
                      <div className="relative">
                        <Filter className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                        <select
                          className={`${crmSelectIconClass} min-w-[260px]`}
                          value={launchPackage}
                          onChange={(event) => setLaunchPackage(event.target.value)}
                        >
                          <option value="all">Все форматы</option>
                          {launchPackages.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Лидов</div>
                      <div className="text-xl font-semibold">{data.launchSummary?.lead_count ?? data.launchMatrix.length}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Телефоны</div>
                      <div className="text-xl font-semibold">{data.launchSummary?.phone_count ?? 0}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Email</div>
                      <div className="text-xl font-semibold">{data.launchSummary?.email_count ?? 0}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Мин. заказ</div>
                      <div className="text-xl font-semibold">{money(data.launchSummary?.min_order_rub ?? 7000)}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">SKU</div>
                      <div className="text-xl font-semibold">{data.launchSummary?.catalog_sku_count ?? data.products.length}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Форматов</div>
                      <div className="text-xl font-semibold">{data.segmentLaunches.length}</div>
                    </div>
                  </div>
                  <div className="grid gap-3" data-launch-matrix-cards>
                    {filteredLaunchMatrix.map((item) => {
                      const categoryLabels = launchCatalogCategoryLabels(item)
                      return (
                        <article key={`${item.name}-${item.package_name}`} className="min-w-0 rounded-lg border bg-background p-3">
                          <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.2fr)]">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={item.priority === "A" ? "success" : item.priority === "B" ? "warning" : "outline"}>
                                  {item.priority}
                                </Badge>
                                <Badge variant="outline">score {item.score}</Badge>
                              </div>
                              <div className="mt-2 break-words font-semibold">{item.name}</div>
                              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                {item.walk_min == null ? "СПб/ЛО" : `${item.walk_min} мин`} · {item.contact}
                              </div>
                            </div>

                            <div className="min-w-0 rounded-md border bg-muted/20 p-3" data-launch-catalog-short-name>
                              <div className="dense-label">Перечень из каталога</div>
                              <div className="mt-1 break-words text-sm font-semibold">{launchCatalogShortName(item)}</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{launchCatalogGeneralScope(item)}</p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {categoryLabels.map((label) => (
                                  <Badge key={label} variant="secondary">
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="dense-label">Старт</div>
                              <div className="mt-1 text-lg font-semibold">{money(item.start_amount)}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{item.sku_count} SKU · {item.package_name}</div>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.launch_format}</p>
                            </div>

                            <div className="min-w-0">
                              <div className="dense-label">Что предлагать</div>
                              <p className="mt-1 break-words text-sm leading-6">{item.offer}</p>
                              {item.next_action ? (
                                <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{item.next_action}</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 grid min-w-0 gap-2 border-t pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="min-w-0">
                              <div className="dense-label">KPI</div>
                              <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{item.kpi}</p>
                            </div>
                            <div className="min-w-0">
                              <div className="dense-label">Риск</div>
                              <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{item.risk}</p>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                    {filteredLaunchMatrix.length === 0 ? (
                      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                        Нет лидов под текущий фильтр.
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Сегмент x запуск</CardTitle>
                  <CardDescription>Сводка форматов по локальной базе.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.segmentLaunches.map((item) => {
                    const jtbdSegments = data.projectSheetSegments.filter((segment) => segment.launch_format === item.format)
                    return (
                      <div key={item.format} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <b>{item.format}</b>
                          <Badge variant="secondary">{item.lead_count} лидов</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Средний старт: {money(item.avg_start_amount)}</p>
                        <p className="mt-2 text-sm">{item.pitch}</p>
                        <p className="mt-2 text-xs text-muted-foreground" data-launch-segment-general-scope>
                          <b>Перечень из каталога:</b> {item.format} · {segmentLaunchGeneralScope(item)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground"><b>KPI:</b> {item.kpi}</p>
                        {jtbdSegments.length ? (
                          <div className="mt-3 space-y-2">
                            <div className="dense-label">Задачи из таблицы</div>
                            {jtbdSegments.map((segment) => (
                              <div key={segment.segment} className="rounded-md border bg-muted/30 p-2 text-xs leading-5">
                                <div className="font-semibold">{segment.segment}</div>
                                <p className="text-muted-foreground">{segment.jtbd}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="about">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="size-4" />
                        О компании Lunch Up
                      </CardTitle>
                      <CardDescription>
                        Lunch Up как фабрика готовой охлажденной еды и отстройка от конкурентных альтернатив по каждому сегменту CRM.
                      </CardDescription>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <div className="dense-label">Выбранный контекст</div>
                      <div className="mt-1 font-semibold">{companyCompetitiveContextLabel}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Показано сегментов: {visibleCompanyPositioningRows.length}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/20 p-3" data-company-segment-menu>
                    <CrmSegmentFilterControls
                      id="company"
                      groups={crmSegmentGroups}
                      directionValue={companySegmentGroup}
                      segmentValue={companySegment}
                      count={visibleCompanyPositioningRows.length}
                      onChange={(directionCode, segmentCode) => {
                        setCompanySegmentGroup(directionCode)
                        setCompanySegment(segmentCode)
                      }}
                    />
                  </div>

                  <div className="rounded-lg border bg-primary/5 p-4">
                    <div className="dense-label">Единая формулировка для сотрудников</div>
                    <h3 className="mt-2 text-lg font-semibold">Что Lunch Up реализует и почему это покупают</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Lunch Up - это фабрика готовой охлажденной еды для B2B-каналов в Санкт-Петербурге и Ленинградской
                      области. Мы производим готовые завтраки, сэндвичи, салаты, десерты и блюда, а затем собираем из них
                      короткую матрицу под конкретную локацию: вендинг, офис, банный комплекс, кофейню, АЗС, ритейл,
                      HoReCa или оператора питания. Клиент покупает не весь каталог, а проверяемый запуск: продажи, списания, повторный заказ и
                      расширение только тех SKU, которые доказали спрос.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {companyStrategyBrief.map((item) => (
                      <div key={item.label} className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-lg font-semibold">{item.value}</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    {companyDoctrineCards.map((item) => (
                      <div key={item.title} className="rounded-lg border bg-background p-4">
                        <div className="font-semibold">{item.title}</div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {lunchUpSiteFacts.map((fact) => (
                      <div key={fact.label} className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">{fact.label}</div>
                        <div className="mt-1 text-lg font-semibold">{fact.value}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{fact.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <div className="font-semibold">Коммерческие guardrails</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {commercialGuardrails.map((item) => (
                        <div key={item} className="rounded-md border bg-background p-3 text-xs leading-5 text-muted-foreground">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3" data-company-positioning-list>
                    {visibleCompanyPositioningRows.map((row) => (
                      <div
                        key={row.segmentCode}
                        data-company-positioning-card={row.segmentCode}
                        className="rounded-lg border bg-background p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{row.segmentLabel}</Badge>
                              <Badge variant="secondary">{row.launchName}</Badge>
                              <Badge variant="success">{row.skuCount || "SKU"} в запуске</Badge>
                            </div>
                            <h3 className="mt-3 text-base font-semibold">Elevator Speech</h3>
                          </div>
                          <div className="text-sm font-semibold">{money(segmentPipelines.find((item) => item.segmentCode === row.segmentCode)?.revenue ?? 0)}</div>
                        </div>

                        <div className="mt-3 space-y-3 rounded-md border bg-card p-3 text-sm leading-6" data-elevator-speech={row.segmentCode}>
                          {row.elevatorParagraphs.map((paragraph, index) => (
                            <p key={`${row.segmentCode}-elevator-${index}`}>{paragraph}</p>
                          ))}
                        </div>

                        <div className="mt-3 rounded-md border bg-muted/20 p-3">
                          <div className="dense-label">Матрица запуска из каталога</div>
                          <p className="mt-1 text-sm font-medium">{row.launchName}</p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{row.launchMatrixSummary}</p>
                        </div>

                        {row.jtbdSegments.length ? (
                          <div className="mt-4 rounded-md border bg-primary/5 p-3">
                            <div className="dense-label">Задачи из таблицы проекта</div>
                            <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
                              {row.jtbdSegments.map((segment) => (
                                <div key={segment.segment} className="rounded-md border bg-background p-3 text-xs leading-5">
                                  <div className="font-semibold text-foreground">{segment.segment}</div>
                                  <p className="mt-1 text-muted-foreground">
                                    <b className="text-foreground">Задача:</b> {segment.jtbd}
                                  </p>
                                  <p className="mt-1 text-muted-foreground">
                                    <b className="text-foreground">Потребность:</b> {segment.need}
                                  </p>
                                  <p className="mt-1 text-muted-foreground">
                                    <b className="text-foreground">Оффер:</b> {segment.solution}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge variant="outline">{segment.launch_format}</Badge>
                                    <Badge variant={segment.priority === "core" ? "success" : segment.priority === "partner" ? "secondary" : "outline"}>
                                      {segment.priority === "core" ? "ядро" : segment.priority === "partner" ? "партнер" : "расширение"}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-muted-foreground">
                                    <b className="text-foreground">Маршрут:</b> {segment.route_logic}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                          <div className="rounded-md border p-3">
                            <div className="dense-label">Конкурентное поле сегмента</div>
                            <p className="mt-1 text-sm">{row.competitorFrame}</p>
                            <div className="dense-label mt-3">Отстройка Lunch Up</div>
                            <p className="mt-2 text-xs text-muted-foreground">{row.difference}</p>
                          </div>
                          <div className="rounded-md border p-3">
                            <div className="dense-label">Как растет доход партнера</div>
                            <p className="mt-1 text-sm">{row.revenueLogic}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              KPI запуска: {row.launchKpi}
                            </p>
                          </div>
                          <div className="rounded-md border p-3">
                            <div className="dense-label">Что предлагать</div>
                            <p className="mt-1 text-sm">{row.launchPitch}</p>
                            <button
                              type="button"
                              className="mt-2 rounded-md border bg-card px-2 py-1 text-left text-xs text-primary transition hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => openCatalogLaunch(row.launchName)}
                            >
                              Открыть каталог запуска
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 rounded-md border p-3">
                          <div className="dense-label">Связка с первыми этапами обработки лида</div>
                          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
                            {row.firstSteps.map((step) => (
                              <button
                                key={`${row.segmentCode}-${step.stageCode}`}
                                type="button"
                                className="rounded-md border bg-card p-3 text-left text-sm transition hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => openCompanyScriptStage(row.segmentCode, step.stageCode)}
                              >
                                <div className="font-semibold text-primary">{step.label}</div>
                                <p className="mt-1 text-xs text-muted-foreground">{step.text}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    {visibleCompanyPositioningRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет сегментов под текущий фильтр.</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Конкурентное поле: {companyCompetitiveContextLabel}</CardTitle>
                  <CardDescription>
                    Синхронизировано с двухуровневым меню: на экране видно только поле выбранного направления или сегмента.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm" data-competitive-field-panel>
                  <div className="rounded-md border bg-primary/5 p-3" data-competitive-context>
                    <div className="dense-label">Сейчас выбрано</div>
                    <div className="mt-1 font-semibold">{companyCompetitiveContextLabel}</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Ниже показаны конкурентные альтернативы и отстройка только для сегментов, которые выбраны в меню слева.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {visibleCompanyPositioningRows.map((row) => (
                      <div key={`competitive-${row.segmentCode}`} className="rounded-md border p-3" data-competitive-field-segment={row.segmentCode}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{row.segmentLabel}</Badge>
                          <Badge variant="secondary">{row.launchName}</Badge>
                        </div>
                        <div className="mt-3 space-y-3">
                          <div>
                            <div className="dense-label">Конкурентное поле сегмента</div>
                            <p className="mt-1 leading-6">{row.competitorFrame}</p>
                          </div>
                          <div>
                            <div className="dense-label">Отстройка Lunch Up</div>
                            <p className="mt-1 leading-6 text-muted-foreground">{row.difference}</p>
                          </div>
                          <div className="rounded-md bg-muted/30 p-2">
                            <div className="dense-label">Фокус переговоров</div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Вести разговор от формата "{row.launchName}" и KPI пилота: {row.launchKpi}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {visibleCompanyPositioningRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет конкурентного поля под текущий выбор.</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="font-semibold">Источники по Lunch Up</div>
                    <div className="mt-2 flex flex-col gap-1">
                      {lunchUpSourceLinks.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {link.label}
                          <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="font-semibold">Использованные внутренние материалы</div>
                    <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                      {companyStrategySources.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="script">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-4" />
                  Скрипт продажи
                </CardTitle>
                <CardDescription>
                  Матрица: {filteredClientLineScripts.length} из {clientLineScripts.length} связок, SPIN/FAB:{" "}
                  {filteredSegmentStageScripts.length} из {segmentStageScripts.length}, базовые скрипты: {filteredSalesScripts.length} из{" "}
                  {data.salesScripts.length}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div className="relative md:col-span-2">
                    <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={scriptQuery}
                      onChange={(event) => setScriptQuery(event.target.value)}
                      placeholder="Поиск по скриптам и возражениям"
                    />
                  </div>
                  <select
                    aria-label="Фильтр скриптов по фокусу"
                    className={crmSelectClass}
                    value={scriptFocus}
                    onChange={(event) => setScriptFocus(event.target.value)}
                  >
                    <option value="all">Весь скрипт</option>
                    <option value="spin">Фокус: SPIN</option>
                    <option value="horeca">Фокус: HoReCa FAB</option>
                    <option value="vending">Фокус: вендинг</option>
                    <option value="objections">Фокус: возражения</option>
                    <option value="closing">Фокус: закрытие</option>
                    <option value="email">Фокус: письмо</option>
                  </select>
                  <CrmSegmentFilterControls
                    id="script"
                    groups={crmSegmentGroups}
                    directionValue={scriptSegmentGroup}
                    segmentValue={scriptSegment}
                    layout="stacked"
                    className="md:col-span-2"
                    onChange={(directionCode, segmentCode) => {
                      setScriptSegmentGroup(directionCode)
                      setScriptSegment(segmentCode)
                    }}
                  />
                  <select
                    aria-label="Фильтр SPIN по этапу"
                    className={crmSelectClass}
                    value={scriptStage}
                    onChange={(event) => setScriptStage(event.target.value)}
                  >
                    <option value="all">Все этапы</option>
                    {pipelineStages.map((stage) => (
                      <option key={stage.code} value={stage.code}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Фильтр общего скрипта по блоку"
                    className={crmSelectClass}
                    value={scriptBlock}
                    onChange={(event) => setScriptBlock(event.target.value)}
                  >
                    <option value="all">Все блоки</option>
                    {scriptBlocks.map((item) => (
                      <option key={item} value={item}>
                        {scriptBlockLabel(item)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Фильтр общего скрипта по роли"
                    className={`${crmSelectClass} md:col-span-2`}
                    value={scriptAudience}
                    onChange={(event) => setScriptAudience(event.target.value)}
                  >
                    <option value="all">Все роли</option>
                    {scriptAudiences.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setScriptQuery("")
                      setScriptBlock("all")
                      setScriptAudience("all")
                      setScriptFocus("all")
                      setScriptSegmentGroup("all")
                      setScriptSegment("all")
                      setScriptStage("all")
                    }}
                  >
                    Сбросить
                  </Button>
                </div>

                <div className="rounded-lg border bg-background">
                  <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold">Матрица сценариев: фокус x сегмент x этап x блок x роль</div>
                      <p className="text-xs text-muted-foreground">
                        Строка связывает роль клиента, этап воронки, запуск из каталога, продуктовую логику и следующий вопрос.
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {visibleClientLineScripts.length} из {filteredClientLineScripts.length} строк
                    </Badge>
                  </div>
                  <div className="max-h-[720px] overflow-auto border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Фокус</TableHead>
                          <TableHead>Сегмент / этап</TableHead>
                          <TableHead>Блок / роль</TableHead>
                          <TableHead>Что озвучивать</TableHead>
                          <TableHead>Что предлагать</TableHead>
                          <TableHead>Логика</TableHead>
                          <TableHead>Следующий шаг</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleClientLineScripts.map((item, itemIndex) => (
                          <TableRow key={`${item.key}-${item.segmentCode}-${item.stageCode}-${item.block}-${item.role}-${itemIndex}`}>
                            <TableCell className="min-w-[130px]">
                              <Badge
                                variant={
                                  item.focus === "objections"
                                    ? "warning"
                                    : item.focus === "closing"
                                      ? "success"
                                      : item.focus === "horeca"
                                        ? "secondary"
                                        : "outline"
                                }
                              >
                                {item.focusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              <div className="font-medium">{item.segmentLabel}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <Badge variant={stageTone[item.stageCode] ?? "secondary"}>{item.stageName}</Badge>
                                <Badge variant="secondary">{item.launchName}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[250px]">
                              <Badge variant={item.block === "Возражение" ? "warning" : item.block === "Закрытие" ? "success" : "outline"}>
                                {scriptBlockLabel(item.block)}
                              </Badge>
                              <div className="mt-2 text-sm font-medium">{item.role}</div>
                            </TableCell>
                            <TableCell className="min-w-[560px] text-sm leading-6">{scriptDisplayText(item.script)}</TableCell>
                            <TableCell className="min-w-[360px] text-sm">
                              <div>{scriptDisplayText(item.offer)}</div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {item.skuItems.slice(0, scriptTableSkuLimit).map((sku, skuIndex) => (
                                  <button
                                    key={`${item.key}-${itemIndex}-${sku.category}-${sku.name}-${skuIndex}`}
                                    type="button"
                                    className="rounded-md border bg-card px-2 py-1 text-left text-xs text-primary transition hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => openCatalogSku(item.launchName, sku.name)}
                                  >
                                    {sku.name}
                                    {sku.quantity ? ` x${sku.quantity}` : ""}
                                  </button>
                                ))}
                                {item.skuItems.length > scriptTableSkuLimit ? (
                                  <button
                                    key={`${item.key}-${itemIndex}-more-sku`}
                                    type="button"
                                    className="rounded-md border bg-card px-2 py-1 text-left text-xs text-primary transition hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => openCatalogLaunch(item.launchName)}
                                  >
                                    еще {item.skuItems.length - scriptTableSkuLimit} SKU
                                  </button>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[360px] text-xs leading-5 text-muted-foreground">{scriptDisplayText(item.logic)}</TableCell>
                            <TableCell className="min-w-[320px] text-sm">{scriptDisplayText(item.closingQuestion)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {filteredClientLineScripts.length > visibleClientLineScripts.length ? (
                    <div className="flex items-center justify-between border-t p-3">
                      <span className="text-xs text-muted-foreground">
                        Показано {visibleClientLineScripts.length} из {filteredClientLineScripts.length}.
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setScriptVisibleLimit((current) => current + scriptRowLimitStep)}
                      >
                        Показать еще
                      </Button>
                    </div>
                  ) : null}
                  {filteredClientLineScripts.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Нет сценариев под текущие фильтры.</p>
                  ) : null}
                </div>

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold">Сценарии по сегментам и этапам</div>
                      <p className="text-xs text-muted-foreground">
                        Каждая карточка соединяет этап воронки, фреймворк продажи, рекомендуемый запуск, SKU-ссылки и отработку возражения.
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {visibleSegmentStageScripts.length} из {filteredSegmentStageScripts.length} связок
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {visibleSegmentStageScripts.map((item) => (
                      <div
                        key={item.key}
                        data-spin-script-card={item.key}
                        data-spin-segment={item.segmentCode}
                        data-spin-stage={item.stageCode}
                        className="rounded-lg border bg-background p-3 text-sm"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{item.segmentLabel}</Badge>
                              <Badge variant={stageTone[item.stageCode] ?? "secondary"}>{item.stageName}</Badge>
                              <Badge variant="secondary">{item.launchName}</Badge>
                              <Badge variant={item.framework === "HoReCa FAB" ? "success" : "outline"}>{item.framework}</Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{item.audience}</p>
                          </div>
                          <div className="text-xs text-muted-foreground">{scriptDisplayText(item.goal)}</div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          {item.frameworkSteps.map((step) => (
                            <div key={step.label} className="rounded-md border p-2">
                              <div className="dense-label">{step.label}</div>
                              <p className="mt-1 text-xs">{scriptDisplayText(step.text)}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 rounded-md border p-2">
                          <div className="dense-label">Формулировка этапа</div>
                          <p className="mt-1">{scriptDisplayText(item.script)}</p>
                        </div>
                        <div className="mt-2 rounded-md border p-2">
                          <div className="dense-label">Что предлагать</div>
                          <p className="mt-1 text-xs text-muted-foreground">{scriptDisplayText(item.offer)}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.skuItems.slice(0, scriptCardSkuLimit).map((sku) => (
                              <button
                                key={`${item.key}-${sku.category}-${sku.name}`}
                                type="button"
                                className="rounded-md border bg-card px-2 py-1 text-left text-xs text-primary transition hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => openCatalogSku(item.launchName, sku.name)}
                              >
                                {sku.name}
                                {sku.quantity ? ` x${sku.quantity}` : ""}
                              </button>
                            ))}
                            {item.skuItems.length > scriptCardSkuLimit ? (
                              <button
                                type="button"
                                className="rounded-md border bg-card px-2 py-1 text-left text-xs text-primary transition hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => openCatalogLaunch(item.launchName)}
                              >
                                еще {item.skuItems.length - scriptCardSkuLimit} SKU
                              </button>
                            ) : null}
                            {item.skuItems.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Открыть запуск "{item.launchName}" и собрать короткую матрицу под трафик точки.
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 rounded-md border p-2">
                          <div className="dense-label">Возражение этапа</div>
                          <p className="mt-1 font-medium">{scriptDisplayText(item.objection?.objection ?? "Нет отдельного возражения")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{scriptDisplayText(item.objection?.response ?? item.proof)}</p>
                          <p className="mt-1 text-xs text-muted-foreground"><b>Материал:</b> {scriptDisplayText(item.proof)}</p>
                        </div>
                        <div className="mt-2 rounded-md border p-2">
                          <div className="dense-label">Закрыть на следующий шаг</div>
                          <p className="mt-1 text-xs">{scriptDisplayText(item.nextQuestion || item.close)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredSegmentStageScripts.length > visibleSegmentStageScripts.length ? (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setScriptCardVisibleLimit((current) => current + scriptCardLimitStep)}
                      >
                        Показать еще связки
                      </Button>
                    </div>
                  ) : null}
                  {filteredSegmentStageScripts.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Нет связок под текущие фильтры.</p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Базовые ручные скрипты</div>
                    <p className="text-xs text-muted-foreground">Короткие универсальные формулировки, оставленные как быстрый справочник.</p>
                  </div>
                  <Badge variant="outline">{filteredSalesScripts.length} строк</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Блок</TableHead>
                      <TableHead>Кому</TableHead>
                      <TableHead>Формулировка</TableHead>
                      <TableHead>Что предлагать</TableHead>
                      <TableHead>Закрывающий вопрос</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesScripts.map((item, itemIndex) => {
                      const launchMatches = launchMatchesForSalesScript(item, data.segmentLaunches)
                      return (
                        <TableRow
                          key={`${item.block}-${item.audience}-${item.crm_segment_code ?? "base"}-${item.launch_format ?? "any"}-${item.jtbd ?? "common"}-${itemIndex}`}
                        >
                          <TableCell>
                            <Badge
                              variant={
                                item.block === "Возражение" ? "warning" : item.block === "Закрытие" ? "success" : "outline"
                              }
                            >
                              {scriptBlockLabel(item.block)}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[220px] font-medium">{item.audience}</TableCell>
                          <TableCell className="min-w-[520px] text-sm">{scriptDisplayText(item.script)}</TableCell>
                          <TableCell className="min-w-[320px] text-sm">
                            {launchMatches.length ? (
                              <div className="flex flex-wrap gap-1">
                                {launchMatches.map((launch, launchIndex) => (
                                  <button
                                    key={`${item.block}-${item.audience}-${launch.format}-${itemIndex}-${launchIndex}`}
                                    type="button"
                                    className="rounded-md border bg-card px-2 py-1 text-left text-xs text-primary transition hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => openCatalogLaunch(launch.format)}
                                  >
                                    {launch.format} · {parseLaunchSkuList(launch).length} SKU
                                  </button>
                                ))}
                              </div>
                            ) : (
                              scriptDisplayText(item.offer)
                            )}
                          </TableCell>
                          <TableCell className="min-w-[320px] text-sm">{scriptDisplayText(item.closing_question)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="objections">
            <Card>
              <CardHeader>
                <CardTitle>Карта возражений</CardTitle>
                <CardDescription>
                  Показано {filteredObjections.length} из {data.objectionMap.length}: отработка по вендингу и локальным лидам с
                  закрывающим вопросом.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,1fr)_minmax(260px,300px)_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={objectionQuery}
                      onChange={(event) => setObjectionQuery(event.target.value)}
                      placeholder="Поиск по возражениям"
                    />
                  </div>
                  <select
                    className={crmSelectClass}
                    value={objectionStage}
                    onChange={(event) => setObjectionStage(event.target.value)}
                  >
                    <option value="all">Все этапы возражений</option>
                    {objectionStages.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setObjectionQuery("")
                      setObjectionStage("all")
                    }}
                  >
                    Сбросить
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Этап</TableHead>
                      <TableHead>Возражение</TableHead>
                      <TableHead>Отработка</TableHead>
                      <TableHead>Материал</TableHead>
                      <TableHead>Следующий вопрос</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredObjections.map((item) => (
                      <TableRow key={`${item.stage}-${item.objection}`}>
                        <TableCell className="min-w-[190px]">
                          <Badge variant={item.stage.toLowerCase().includes("вендинг") ? "secondary" : "outline"}>{item.stage}</Badge>
                        </TableCell>
                        <TableCell className="min-w-[340px] text-sm">
                          <div className="font-medium">{item.objection}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{item.why_it_matters}</div>
                        </TableCell>
                        <TableCell className="min-w-[520px] text-sm">{item.response}</TableCell>
                        <TableCell className="min-w-[260px] text-sm">{item.proof_or_asset}</TableCell>
                        <TableCell className="min-w-[300px] text-sm">{item.next_question}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="size-4" />
                      Компании и сделки
                    </CardTitle>
                    <CardDescription>Стартовая база компаний, стадий и сделок для outreach.</CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-end xl:justify-end">
                    <div className="relative min-w-[260px]">
                      <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                      <Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по компании, городу, причине fit" />
                    </div>
                    <CrmSegmentFilterControls
                      id="leads"
                      groups={crmSegmentGroups}
                      directionValue={segmentGroup}
                      segmentValue={segment}
                      count={filteredLeads.length}
                      onChange={(directionCode, segmentCode) => {
                        setSegmentGroup(directionCode)
                        setSegment(segmentCode)
                      }}
                    />
                    <div className="relative">
                      <Target className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                      <select
                        className={`${crmSelectIconClass} min-w-[260px]`}
                        value={leadStage}
                        onChange={(event) => setLeadStage(event.target.value)}
                      >
                        <option value="all">Все стадии</option>
                        {pipelineStages.map((stage) => (
                          <option key={stage.id} value={stage.code}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(query || segmentGroup !== "all" || segment !== "all" || leadStage !== "all") ? (
                      <Button type="button" variant="outline" className="gap-2" onClick={resetLeadFilters}>
                        <RefreshCw className="size-3.5" />
                        Сбросить
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={bulkEnriching || !visibleEnrichmentTargets.length}
                      onClick={enrichVisibleCompanies}
                    >
                      <Database className="size-3.5" />
                      Заполнить видимые
                    </Button>
                  </div>
                </div>
                {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
                <p className="text-xs text-muted-foreground">
                  Показано {filteredLeads.length} из {leads.length} сделок
                  {leadStage !== "all" ? ` · стадия: ${pipelineStages.find((stage) => stage.code === leadStage)?.name ?? leadStage}` : ""}
                  {visibleEnrichmentTargets.length ? ` · без оценки офиса: ${visibleEnrichmentTargets.length}` : ""}
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-md border bg-background p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Search className="size-4" />
                        Поиск 2ГИС
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Найти B2B-кандидатов по сегменту и району, затем перенести в КП или импортировать в CRM.</p>
                    </div>
                    <Button type="button" variant="outline" className="gap-2" disabled={dgisLeadSearchSaving} onClick={searchDgisLeadCandidates}>
                      <Database className="size-3.5" />
                      {dgisLeadSearchSaving ? "Ищу" : "Найти"}
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_180px_minmax(260px,320px)_110px]">
                    <Input
                      value={dgisLeadSearchForm.query}
                      onChange={(event) => updateDgisLeadSearchForm("query", event.target.value)}
                      placeholder="Запрос: бизнес центр, офис, завод"
                    />
                    <Input
                      value={dgisLeadSearchForm.district}
                      onChange={(event) => updateDgisLeadSearchForm("district", event.target.value)}
                      placeholder="Район / локация"
                    />
                    <Input value={dgisLeadSearchForm.city} onChange={(event) => updateDgisLeadSearchForm("city", event.target.value)} placeholder="Город" />
                    <select
                      className={crmSelectClass}
                      value={dgisLeadSearchForm.segment}
                      onChange={(event) => updateDgisLeadSearchForm("segment", event.target.value)}
                    >
                      <CrmSegmentOptionGroups groups={crmSegmentGroups} />
                    </select>
                    <select
                      className={crmSelectClass}
                      value={dgisLeadSearchForm.limit}
                      onChange={(event) => updateDgisLeadSearchForm("limit", event.target.value)}
                    >
                      <option value="5">5</option>
                      <option value="8">8</option>
                      <option value="12">12</option>
                      <option value="20">20</option>
                    </select>
                  </div>
                  {dgisLeadSearchPayload?.candidates.length ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
                      {dgisLeadSearchPayload.candidates.map((candidate) => {
                        const importKey = candidate.dgis_id ?? candidate.name
                        return (
                          <div key={`${importKey}-${candidate.address ?? ""}`} className="rounded-md border p-3 text-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="font-semibold">{candidate.name}</div>
                                {candidate.legal_name ? <div className="mt-1 text-xs text-muted-foreground">{candidate.legal_name}</div> : null}
                                {candidate.address ? <div className="mt-1 text-xs text-muted-foreground">{candidate.address}</div> : null}
                              </div>
                              <Badge variant={candidate.employees_org_count ? "success" : "outline"}>
                                {candidate.employees_org_count ? `${candidate.employees_org_count} чел.` : "численность уточнить"}
                              </Badge>
                            </div>
                            <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Truck className="size-3" />
                              {candidate.drive_minutes_from_production} мин на авто от производства
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {candidate.phone ? (
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${phoneHref(candidate.phone)}`}>
                                  <Phone className="size-3" />
                                  {candidate.phone}
                                </a>
                              ) : null}
                              {candidate.email ? (
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${candidate.email}`}>
                                  <Mail className="size-3" />
                                  {candidate.email}
                                </a>
                              ) : null}
                              {candidate.website ? (
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(candidate.website)} target="_blank" rel="noreferrer">
                                  сайт <ExternalLink className="size-3" />
                                </a>
                              ) : null}
                              {candidate.telegram_url ? (
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(candidate.telegram_url)} target="_blank" rel="noreferrer">
                                  <Send className="size-3" />
                                  {candidate.telegram_username ? `@${candidate.telegram_username}` : "Telegram"}
                                </a>
                              ) : null}
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(candidate.source_url)} target="_blank" rel="noreferrer">
                                2ГИС <ExternalLink className="size-3" />
                              </a>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Badge variant={candidate.telegram_contact_status === "public_found" ? "success" : "outline"}>
                                {telegramStatusLabel(candidate.telegram_contact_status)}
                              </Badge>
                              <Badge variant="outline">{agentReadinessLabel(candidate.agent_contact_readiness)}</Badge>
                            </div>
                            {candidate.rubrics.length ? <div className="mt-2 text-xs text-muted-foreground">{candidate.rubrics.slice(0, 3).join(" · ")}</div> : null}
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => useDgisCandidate(candidate)}>
                                <ArrowRight className="size-3.5" />
                                Взять в КП
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="gap-2"
                                disabled={importingDgisLead === importKey}
                                onClick={() => importDgisCandidate(candidate)}
                              >
                                <Send className="size-3.5" />
                                {importingDgisLead === importKey ? "Импорт" : "Импортировать"}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : dgisLeadSearchPayload ? (
                    <div className="mt-3 rounded-md border p-3 text-sm text-muted-foreground">2ГИС не вернул кандидатов под текущий запрос.</div>
                  ) : null}
                </div>
                <div className="mb-4 rounded-md border bg-background p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="size-4" />
                        Новый лид и КП
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Расчет людей в офисе, стартовой матрицы и сделки через 2ГИС/ФНС enrichment.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" className="gap-2" disabled={leadIntakeSaving !== null} onClick={() => submitLeadIntake(true)}>
                        <Database className="size-3.5" />
                        Рассчитать КП
                      </Button>
                      <Button type="button" className="gap-2" disabled={leadIntakeSaving !== null} onClick={() => submitLeadIntake(false)}>
                        <Send className="size-3.5" />
                        Создать лид
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
                    <Input
                      className="xl:col-span-2"
                      value={leadIntakeForm.company_name}
                      onChange={(event) => updateLeadIntakeForm("company_name", event.target.value)}
                      placeholder="Компания"
                    />
                    <Input value={leadIntakeForm.inn} onChange={(event) => updateLeadIntakeForm("inn", event.target.value)} placeholder="ИНН" />
                    <Input
                      className="xl:col-span-2"
                      value={leadIntakeForm.address}
                      onChange={(event) => updateLeadIntakeForm("address", event.target.value)}
                      placeholder="Адрес"
                    />
                    <select
                      className={`${crmSelectClass} xl:col-span-2`}
                      value={leadIntakeForm.segment}
                      onChange={(event) => updateLeadIntakeForm("segment", event.target.value)}
                    >
                      <CrmSegmentOptionGroups groups={crmSegmentGroups} />
                    </select>
                    <Input value={leadIntakeForm.contact_name} onChange={(event) => updateLeadIntakeForm("contact_name", event.target.value)} placeholder="Контакт" />
                    <Input value={leadIntakeForm.contact_role} onChange={(event) => updateLeadIntakeForm("contact_role", event.target.value)} placeholder="Роль" />
                    <Input
                      value={leadIntakeForm.contact_email}
                      onChange={(event) => updateLeadIntakeForm("contact_email", event.target.value)}
                      placeholder="Email"
                    />
                    <Input
                      value={leadIntakeForm.contact_phone}
                      onChange={(event) => updateLeadIntakeForm("contact_phone", event.target.value)}
                      placeholder="Телефон"
                    />
                    <Input
                      className="xl:col-span-2"
                      value={leadIntakeForm.website}
                      onChange={(event) => updateLeadIntakeForm("website", event.target.value)}
                      placeholder="Сайт"
                    />
                    <Input
                      className="xl:col-span-2"
                      value={leadIntakeForm.telegram_url}
                      onChange={(event) => updateLeadIntakeForm("telegram_url", event.target.value)}
                      placeholder="Telegram URL"
                    />
                    <Input
                      value={leadIntakeForm.telegram_username}
                      onChange={(event) => updateLeadIntakeForm("telegram_username", event.target.value.replace(/^@/, ""))}
                      placeholder="Telegram username"
                    />
                    <select
                      className={crmSelectClass}
                      value={leadIntakeForm.telegram_contact_status}
                      onChange={(event) => updateLeadIntakeForm("telegram_contact_status", event.target.value)}
                    >
                      <option value="not_found">Telegram не найден</option>
                      <option value="needs_verification">проверить</option>
                      <option value="public_found">публичный найден</option>
                      <option value="approved_to_contact">можно писать</option>
                    </select>
                  </div>
                  <textarea
                    className="mt-2 min-h-[64px] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={leadIntakeForm.notes}
                    onChange={(event) => updateLeadIntakeForm("notes", event.target.value)}
                    placeholder="Заметка для КП и следующего шага"
                  />
                  {leadIntakePreview ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-4">
                      <div className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">Офис</div>
                        <div className="font-semibold">
                          {leadIntakePreview.enrichment.office_people.min}-{leadIntakePreview.enrichment.office_people.max} чел.
                        </div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">Старт</div>
                        <div className="font-semibold">{leadIntakePreview.enrichment.office_people.recommended_portions} порций</div>
                        <div className="text-xs text-muted-foreground">{leadIntakePreview.enrichment.office_people.recommended_sku} SKU</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">Бюджет</div>
                        <div className="font-semibold">{money(leadIntakePreview.enrichment.office_people.estimated_launch_budget)}</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">Статус</div>
                        <div className="text-xs leading-5">{leadIntakePreview.dry_run ? "Предпросмотр без записи" : "Записано в CRM"}</div>
                      </div>
                      {leadIntakePreview.enrichment.headcount_evidence?.length ? (
                        <div className="md:col-span-4 rounded-md border bg-background p-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">Источники численности для КП</div>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            {leadIntakePreview.enrichment.headcount_evidence.map((item) => (
                              <div key={`${item.source}-${item.label}`} className="rounded-md border p-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{item.label}</span>
                                  <Badge variant={item.used_for_estimate ? "success" : "outline"}>
                                    {item.used_for_estimate ? "в расчете" : item.confidence}
                                  </Badge>
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  {item.value ? `${item.value} чел. · ` : ""}
                                  {item.note}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {leadIntakePreview.enrichment.proposal?.proposal_summary ? (
                        <div className="md:col-span-4 text-xs leading-5 text-muted-foreground">
                          {leadIntakePreview.enrichment.proposal.proposal_summary}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Компания</TableHead>
                      <TableHead>Контакт</TableHead>
                      <TableHead>Сегмент</TableHead>
                      <TableHead>География</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Стадия</TableHead>
                      <TableHead>Потенциал</TableHead>
                      <TableHead>Следующее действие</TableHead>
                      <TableHead>Управление</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.deal_id}>
                        <TableCell className="min-w-[260px]">
                          <div className="font-medium">{lead.company_name}</div>
                          {lead.legal_name ? <div className="mt-1 text-xs text-muted-foreground">{lead.legal_name}</div> : null}
                          <div className="mt-1 text-xs text-muted-foreground">{lead.fit_reason}</div>
                          {lead.enrichment_inn || lead.enrichment_address ? (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {lead.enrichment_inn ? <div>ИНН: {lead.enrichment_inn}</div> : null}
                              {lead.enrichment_address ? <div>{lead.enrichment_address}</div> : null}
                            </div>
                          ) : null}
                          {lead.address && lead.address !== lead.enrichment_address ? (
                            <div className="mt-2 text-xs text-muted-foreground">Адрес: {lead.address}</div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {lead.drive_minutes_from_production ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Truck className="size-3" />
                                {lead.drive_minutes_from_production} мин на авто
                              </span>
                            ) : null}
                            {lead.dgis_url ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(lead.dgis_url)} target="_blank" rel="noreferrer">
                                2ГИС <ExternalLink className="size-3" />
                              </a>
                            ) : null}
                          </div>
                          {lead.website || lead.enrichment_website ? (
                            <a
                              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              href={externalHref(lead.website ?? lead.enrichment_website)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              сайт <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-[220px] text-sm">
                          <div className="space-y-1">
                            {lead.contact_phone || lead.enrichment_phone ? (
                              <a
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                href={`tel:${(lead.contact_phone ?? lead.enrichment_phone ?? "").replace(/[^+0-9]/g, "")}`}
                              >
                                <Phone className="size-3" />
                                {lead.contact_phone ?? lead.enrichment_phone}
                              </a>
                            ) : null}
                            {lead.contact_email || lead.enrichment_email ? (
                              <a
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                href={`mailto:${lead.contact_email ?? lead.enrichment_email}`}
                              >
                                <Mail className="size-3" />
                                {lead.contact_email ?? lead.enrichment_email}
                              </a>
                            ) : null}
                            {lead.telegram_url ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(lead.telegram_url)} target="_blank" rel="noreferrer">
                                <Send className="size-3" />
                                {lead.telegram_username ? `@${lead.telegram_username}` : "Telegram"}
                              </a>
                            ) : null}
                            {(!lead.contact_phone && lead.enrichment_phone) || (!lead.contact_email && lead.enrichment_email) ? (
                              <div className="text-xs text-muted-foreground">из карточки компании</div>
                            ) : null}
                            {!lead.contact_phone && !lead.enrichment_phone && !lead.contact_email && !lead.enrichment_email && lead.public_contact_url ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(lead.public_contact_url)} target="_blank" rel="noreferrer">
                                форма связи <ExternalLink className="size-3" />
                              </a>
                            ) : null}
                            {lead.preferred_channel ? (
                              <div className="text-xs text-muted-foreground">канал: {lead.preferred_channel}</div>
                            ) : null}
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={lead.telegram_contact_status === "public_found" || lead.telegram_contact_status === "approved_to_contact" ? "success" : lead.telegram_contact_status === "needs_verification" ? "warning" : "outline"}>
                                {telegramStatusLabel(lead.telegram_contact_status)}
                              </Badge>
                              <Badge variant="outline">{agentReadinessLabel(lead.agent_contact_readiness)}</Badge>
                            </div>
                            {lead.agent_contact_next_step ? (
                              <div className="text-xs text-muted-foreground">{lead.agent_contact_next_step}</div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{segmentLabelByCode.get(lead.segment) ?? lead.segment}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{lead.city}</div>
                          <div className="text-xs text-muted-foreground">{lead.district ?? lead.region}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{lead.lead_score}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stageTone[lead.stage_code] ?? "outline"}>{lead.stage_name}</Badge>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium">{money(lead.estimated_monthly_revenue)}</div>
                          {lead.office_people_min && lead.office_people_max ? (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <div>
                                офис: {lead.office_people_min}-{lead.office_people_max} чел.
                                {lead.office_people_confidence ? ` · ${lead.office_people_confidence}` : ""}
                              </div>
                              <div>
                                старт: {lead.recommended_portions ?? 0} порций · {lead.recommended_sku ?? 0} SKU
                              </div>
                              {lead.estimated_launch_budget ? <div>КП от {money(lead.estimated_launch_budget)}</div> : null}
                              {leadHeadcountEvidenceRows(lead).length ? (
                                <div className="space-y-0.5">
                                  <div className="font-medium text-foreground">источники численности</div>
                                  {leadHeadcountEvidenceRows(lead).map((item) => (
                                    <div key={`${lead.company_id}-${item.label}`}>
                                      {item.used ? "в расчете: " : ""}
                                      {item.label}
                                      {item.value ? ` ${item.value} чел.` : ""}
                                      {" · "}
                                      {item.note}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-muted-foreground">нет оценки офиса</div>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div>{lead.next_action}</div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="size-3" />
                            {shortDate(lead.next_action_at)}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[260px]">
                          <div className="flex flex-col gap-2">
                            <select
                              className="h-8 rounded-md border bg-background px-2 text-xs"
                              value={lead.stage_id}
                              disabled={savingDeal === lead.deal_id}
                              onChange={(event) => updateStage(lead, Number(event.target.value))}
                            >
                              {data.stages.map((stage) => (
                                <option key={stage.id} value={stage.id}>
                                  {stage.name}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" variant="outline" disabled={savingDeal === lead.deal_id} onClick={() => queueAiTask(lead)}>
                              <Sparkles className="size-3.5" />
                              Задача ИИ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={enrichingCompany === lead.company_id}
                              onClick={() => enrichCompany(lead)}
                            >
                              <Database className="size-3.5" />
                              2ГИС/ФНС
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="people">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="size-4" />
                      Контакты людей и B2B-каналов
                    </CardTitle>
                    <CardDescription>
                      Дополняет компании: кто/какой канал отвечает за закупки, развитие, администрирование или общий вход.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-[260px]">
                      <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        value={peopleQuery}
                        onChange={(event) => setPeopleQuery(event.target.value)}
                        placeholder="Поиск по контактам"
                      />
                    </div>
                    <select
                      className={`${crmSelectClass} min-w-[220px]`}
                      value={peopleSource}
                      onChange={(event) => setPeopleSource(event.target.value)}
                    >
                      <option value="all">Все источники</option>
                      {peopleSources.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/20 p-3" data-people-segment-menu>
                  <CrmSegmentFilterControls
                    id="people"
                    groups={crmSegmentGroups}
                    directionValue={peopleSegmentGroup}
                    segmentValue={peopleSegment}
                    count={filteredCompanyPeople.length}
                    onChange={(directionCode, segmentCode) => {
                      setPeopleSegmentGroup(directionCode)
                      setPeopleSegment(segmentCode)
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Контактов в учете</div>
                    <div className="text-xl font-semibold">{data.companyPeople.length}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">В текущем виде</div>
                    <div className="text-xl font-semibold">{filteredCompanyPeople.length}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">С email</div>
                    <div className="text-xl font-semibold">{data.companyPeople.filter((contact) => contact.email).length}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">С телефоном</div>
                    <div className="text-xl font-semibold">{data.companyPeople.filter((contact) => contact.phone).length}</div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Компания</TableHead>
                      <TableHead>Контакт</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Email/телефон</TableHead>
                      <TableHead>Источник</TableHead>
                      <TableHead>Заметка</TableHead>
                      <TableHead>Кросс-переход</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanyPeople.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="min-w-[240px]">
                          <div className="font-medium">{contact.company_display_name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">account: {contact.account_id}</div>
                          {contact.address ? <div className="mt-1 text-xs text-muted-foreground">{contact.address}</div> : null}
                          <div className="mt-1 flex flex-wrap gap-2 text-xs">
                            {contact.drive_minutes_from_production ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Truck className="size-3" />
                                {contact.drive_minutes_from_production} мин на авто
                              </span>
                            ) : null}
                            {contact.dgis_url ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={externalHref(contact.dgis_url)} target="_blank" rel="noreferrer">
                                2ГИС <ExternalLink className="size-3" />
                              </a>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium">{contact.person_name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">канал: {contact.preferred_channel}</div>
                        </TableCell>
                        <TableCell className="min-w-[260px] text-sm">{contact.role}</TableCell>
                        <TableCell className="min-w-[240px] text-sm">
                          <div className="space-y-1">
                            {contact.email ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${contact.email.split(";")[0].trim()}`}>
                                <Mail className="size-3" />
                                {contact.email}
                              </a>
                            ) : null}
                            {contact.phone ? (
                              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${phoneHref(contact.phone)}`}>
                                <Phone className="size-3" />
                                {contact.phone}
                              </a>
                            ) : null}
                            {contact.telegram_handle ? (
                              <a
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                href={externalHref(`https://t.me/${contact.telegram_handle.replace(/^@/, "")}`)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Send className="size-3" />
                                {contact.telegram_handle}
                              </a>
                            ) : null}
                            {!contact.email && !contact.phone && !contact.telegram_handle ? <span className="text-xs text-muted-foreground">контакт надо уточнить</span> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.source}</Badge>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {contact.is_public ? "публичный канал" : "внутренний контакт"}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[300px] text-sm">
                          <div>{contact.notes}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{contact.consent_basis}</div>
                        </TableCell>
                        <TableCell className="min-w-[170px]">
                          <div className="flex flex-wrap gap-1">
                            {contact.cross_links.map((link) => (
                              <Button
                                key={`${contact.id}-${link.label}`}
                                size="sm"
                                variant="outline"
                                onClick={() => followCrossLink(link.tab, link.query)}
                              >
                                {link.label}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="size-4" />
                    Заказы
                  </CardTitle>
                  <CardDescription>Единая очередь заказов из Telegram, web и ручного канала.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/20 p-3" data-orders-segment-menu>
                    <CrmSegmentFilterControls
                      id="orders"
                      groups={crmSegmentGroups}
                      directionValue={ordersSegmentGroup}
                      segmentValue={ordersSegment}
                      count={filteredOrders.length}
                      onChange={(directionCode, segmentCode) => {
                        setOrdersSegmentGroup(directionCode)
                        setOrdersSegment(segmentCode)
                      }}
                    />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Компания</TableHead>
                        <TableHead>Канал</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Даты</TableHead>
                        <TableHead>Сумма</TableHead>
                        <TableHead>Состав</TableHead>
                        <TableHead>Комментарий</TableHead>
                        <TableHead>Управление</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>#{order.id}</TableCell>
                          <TableCell>{order.company_name ?? "Не привязана"}</TableCell>
                          <TableCell>{order.channel}</TableCell>
                          <TableCell>
                            <Badge variant={orderTone[order.status] ?? "outline"}>{orderStatusLabels[order.status] ?? order.status}</Badge>
                          </TableCell>
                          <TableCell className="min-w-[170px]">
                            <div className="text-xs text-muted-foreground">Заказ</div>
                            <div>{order.created_at ? new Date(order.created_at).toLocaleDateString("ru-RU") : "не указана"}</div>
                            <div className="mt-1 text-xs text-muted-foreground">Доставка</div>
                            <div>{order.delivery_date ?? "не указана"}</div>
                            <div className="mt-1 text-xs text-muted-foreground">Оплата</div>
                            <div>{order.payment_date ?? "не указана"}</div>
                            {order.delivery_address ? <div className="mt-1 text-xs text-muted-foreground">{order.delivery_address}</div> : null}
                          </TableCell>
                          <TableCell>{money(order.total_amount)}</TableCell>
                          <TableCell className="min-w-[280px]">
                            {order.items.length ? (
                              <div className="space-y-1 text-xs">
                                <div className="text-muted-foreground">{order.item_count} шт. / {order.items.length} SKU</div>
                                {order.items.slice(0, 4).map((item) => (
                                  <div key={`${order.id}-${item.product_id}`} className="flex items-start justify-between gap-2">
                                    <span className="min-w-0">{item.name}</span>
                                    <span className="shrink-0 text-muted-foreground">{item.quantity} x {money(item.unit_price)}</span>
                                  </div>
                                ))}
                                {order.items.length > 4 ? <div className="text-muted-foreground">Еще {order.items.length - 4} SKU</div> : null}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">нет SKU</div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[360px] text-xs text-muted-foreground">{order.manager_comment}</TableCell>
                          <TableCell className="min-w-[280px]">
                            <div className="flex flex-col gap-2">
                              <select
                                className="h-8 rounded-md border bg-background px-2 text-xs"
                                value={order.status}
                                disabled={savingOrder === order.id}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: value } : item)))
                                }}
                              >
                                {orderStatusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <Input
                                className="h-8 text-xs"
                                value={order.manager_comment ?? ""}
                                disabled={savingOrder === order.id}
                                placeholder="Комментарий клиенту"
                                onChange={(event) => {
                                  const value = event.target.value
                                  setOrders((current) =>
                                    current.map((item) => (item.id === order.id ? { ...item, manager_comment: value } : item))
                                  )
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingOrder === order.id}
                                onClick={() => updateOrderStatus(order.id, order.status, order.manager_comment)}
                              >
                                <Send className="size-3.5" />
                                Сохранить и уведомить
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Правила заказа</CardTitle>
                  <CardDescription>Условия из документа сотрудничества.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md border p-3"><b>Минимум:</b> 7 000 руб. на одну торговую точку.</div>
                  <div className="rounded-md border p-3"><b>Срок:</b> заказ за 2 дня, до 15:00 на послезавтра.</div>
                  <div className="rounded-md border p-3"><b>Доставка СПб:</b> {data.activeStrategy.spb_delivery_terms}</div>
                  <div className="rounded-md border p-3"><b>Ленинградская область:</b> {data.activeStrategy.lo_delivery_terms}</div>
                  <div className="rounded-md border p-3"><b>Оплата:</b> по счету, возможна отсрочка 5 дней.</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="catalog">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <PackageCheck className="size-4" />
                        Каталог Lunch Up
                      </CardTitle>
                      <CardDescription>SKU связаны с форматами запуска из матрицы.</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 xl:flex-row xl:items-end">
                      <Button asChild variant="outline" className="no-print gap-2">
                        <a
                          href={internalHref(clientCatalogCrmSegmentHref(catalogSegment), accessKey)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Printer className="size-3.5" />
                          A4 для клиента
                        </a>
                      </Button>
                      <CrmSegmentFilterControls
                        id="catalog"
                        groups={crmSegmentGroups}
                        directionValue={catalogSegmentGroup}
                        segmentValue={catalogSegment}
                        count={catalogRows.length}
                        onChange={(directionCode, segmentCode) => {
                          setCatalogSegmentGroup(directionCode)
                          setCatalogSegment(segmentCode)
                          setCatalogHighlightSku(null)
                        }}
                        getSegmentSuffix={(segment) => ` · ${segment.launch_format}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">SKU в текущем виде</div>
                      <div className="text-xl font-semibold">{catalogRows.length}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Фото SKU</div>
                      <div className="text-xl font-semibold">{catalogPhotoCount}/{catalogRows.length}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Средний старт</div>
                      <div className="text-xl font-semibold">
                        {selectedCatalogSegment ? money(selectedCatalogSegment.avg_start_amount) : money(data.launchMatrix[0]?.start_amount ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Лидов сегмента</div>
                      <div className="text-xl font-semibold">{selectedCatalogSegment?.lead_count ?? data.launchSummary?.lead_count ?? 0}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-semibold">Сегменты для текущего запуска</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Связка из таблицы: какой клиентский сценарий закрывает выбранный каталог и формат запуска.
                        </p>
                      </div>
                      <Badge variant="outline">{selectedCatalogJtbdSegments.length} сегментов</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
                      {selectedCatalogJtbdSegments.slice(0, 6).map((segment) => (
                        <div key={segment.segment} className="rounded-md border bg-background p-3 text-xs leading-5">
                          <div className="font-semibold text-foreground">{segment.segment}</div>
                          <p className="mt-1 text-muted-foreground">{segment.jtbd}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">{segment.crm_segment_label}</Badge>
                            <Badge variant="secondary">{segment.launch_format}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Фото</TableHead>
                        <TableHead>Категория</TableHead>
                        <TableHead>Позиция</TableHead>
                        <TableHead>Вес</TableHead>
                        <TableHead>Срок</TableHead>
                        <TableHead>Цена</TableHead>
                        <TableHead>Описание позиции</TableHead>
                        <TableHead>Сегмент x запуск</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalogRows.map((product) => (
                        <TableRow
                          key={`${product.category}-${product.name}`}
                          id={catalogSkuDomId(product.name)}
                          className={
                            catalogHighlightSku === normalizeSkuName(product.name)
                              ? "bg-primary/5 transition-colors"
                              : "transition-colors"
                          }
                        >
                          <TableCell className="w-[96px]">
                            {product.image_url ? (
                              <div className="w-20">
                                <a
                                  href={externalHref(product.product_url ?? product.image_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-16 w-20 overflow-hidden rounded-md border bg-muted/20"
                                  title={product.site_title ? `Источник: ${product.site_title}` : "Фото Lunch-UP"}
                                >
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </a>
                                <div className="mt-1 text-[10px] leading-tight text-muted-foreground">
                                  {photoMatchLabel(product.image_match)}
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-16 w-20 items-center justify-center rounded-md border bg-muted/10 text-[10px] leading-tight text-muted-foreground">
                                Нет фото
                              </div>
                            )}
                          </TableCell>
                          <TableCell><Badge variant="outline">{product.category}</Badge></TableCell>
                          <TableCell className="min-w-[220px] font-medium">
                            <div>{product.name}</div>
                          </TableCell>
                          <TableCell>{product.net_weight}</TableCell>
                          <TableCell>{product.shelf_life_days} сут.</TableCell>
                          <TableCell>{money(product.price)}</TableCell>
                          <TableCell className="min-w-[280px] text-sm">
                            <div>{productTradeDescription(product)}</div>
                            {product.launch_recommendation ? (
                              <div className="mt-1 text-xs text-muted-foreground">{product.launch_recommendation}</div>
                            ) : null}
                            {product.best_segments ? (
                              <div className="mt-1 text-xs text-muted-foreground">Где это едят: {product.best_segments}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="min-w-[320px] text-sm">
                            {product.selectedItem ? (
                              <div className="space-y-1">
                                <Badge variant="secondary">{product.selectedItem.category}</Badge>
                                <div>
                                  {product.selectedItem.quantity ? `${product.selectedItem.quantity} шт. в стартовой матрице` : "в стартовой матрице"}
                                </div>
                              </div>
                            ) : product.launchSegments.length ? (
                              <div className="flex flex-wrap gap-1">
                                {product.launchSegments.map((segmentName) => (
                                  <Badge key={segmentName} variant="outline">
                                    {segmentName}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">вне стартовых сегментов</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Сегмент x запуск</CardTitle>
                  <CardDescription>
                    {selectedCatalogCrmSegment && selectedCatalogSegment
                      ? `${selectedCatalogCrmSegment.label} / ${selectedCatalogSegment.format}`
                      : "Сводка форматов из матрицы запуска."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedCatalogSegment ? (
                    <>
                      <div className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <b>{selectedCatalogSegment.format}</b>
                          <Badge variant="secondary">{selectedCatalogItems.length} SKU</Badge>
                        </div>
                        <p className="mt-2 text-muted-foreground">{selectedCatalogSegment.pitch}</p>
                        <p className="mt-2 text-xs text-muted-foreground"><b>KPI:</b> {selectedCatalogSegment.kpi}</p>
                      </div>
                      {launchCategoryFields.map((field) => {
                        const value = selectedCatalogSegment[field.key]
                        return value ? (
                          <div key={field.key} className="rounded-md border p-3 text-sm">
                            <div className="font-medium">{field.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{value}</div>
                          </div>
                        ) : null
                      })}
                    </>
                  ) : (
                    data.segmentLaunches.map((segmentLaunch) => (
                      <button
                        key={segmentLaunch.format}
                        type="button"
                        className="w-full rounded-md border p-3 text-left text-sm transition hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          const nextSegment = data.crmSegments.find((item) => item.launch_format === segmentLaunch.format) ?? null
                          setCatalogSegmentGroup(nextSegment?.direction_code ?? "all")
                          setCatalogSegment(nextSegment?.code ?? "all")
                          setCatalogHighlightSku(null)
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <b>{segmentLaunch.format}</b>
                          <Badge variant="secondary">{segmentLaunch.lead_count} лидов</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{segmentLaunch.pitch}</p>
                        <p className="mt-2 text-xs text-muted-foreground"><b>KPI:</b> {segmentLaunch.kpi}</p>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="equipment">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Refrigerator className="size-4" />
                        Оборудование для пилотных наборов
                      </CardTitle>
                      <CardDescription>
                        Только стартовые матрицы из каталога: что ставить клиенту без своей витрины/холодильника для продаж или внутреннего питания.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{pilotEquipmentPlans.length} пилотных наборов</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Форматов запуска</div>
                      <div className="text-xl font-semibold">{pilotEquipmentPlans.length}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">SKU в пилотах</div>
                      <div className="text-xl font-semibold">{pilotEquipmentSkuCount}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Порций в стартовых матрицах</div>
                      <div className="text-xl font-semibold">{pilotEquipmentUnitCount}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Сценариев оборудования</div>
                      <div className="text-xl font-semibold">2</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-primary/10 p-2 text-primary">
                          <ShoppingCart className="size-4" />
                        </div>
                        <div>
                          <div className="font-semibold">Продавать покупателям</div>
                          <p className="text-xs text-muted-foreground">Витрина, шкаф-витрина или умный холодильник.</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Главный критерий - покупатель должен видеть ассортимент, цену и остаток; для точек без персонала нужна оплата через QR/кассу или микромаркет.
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-primary/10 p-2 text-primary">
                          <Utensils className="size-4" />
                        </div>
                        <div>
                          <div className="font-semibold">Есть внутри компании</div>
                          <p className="text-xs text-muted-foreground">Хранение, выдача и контроль остатков без витрины продаж.</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Главный критерий - надежный холод, отдельные полки Lunch Up, маркировка по датам поставки и ответственный за приемку/списания.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold">Модели и бюджет</div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Цены даны как ориентир по открытым страницам. Перед закупкой нужно подтвердить наличие, доставку в СПб/ЛО и гарантию.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {equipmentModelOptions.map((model) => (
                        <article key={model.id} className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
                          <a href={externalHref(model.manufacturerHref)} target="_blank" rel="noreferrer" className="block bg-muted/20">
                            <img
                              src={model.imageUrl}
                              alt={model.title}
                              className="h-44 w-full object-contain p-3"
                              loading="lazy"
                            />
                          </a>
                          <div className="flex flex-1 flex-col gap-3 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold leading-5">{model.title}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{model.brand} · {model.scenario}</div>
                              </div>
                              <Badge variant="secondary" className="whitespace-nowrap">{model.priceLabel}</Badge>
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">{model.bestFor}</p>
                            <div className="flex flex-wrap gap-1">
                              {model.specs.map((spec) => (
                                <Badge key={spec} variant="outline">
                                  {spec}
                                </Badge>
                              ))}
                            </div>
                            <div className="mt-auto flex flex-col gap-2">
                              <p className="text-[11px] leading-4 text-muted-foreground">{model.priceNote}</p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Button asChild variant="outline" className="h-8 gap-2 text-xs">
                                  <a href={externalHref(model.manufacturerHref)} target="_blank" rel="noreferrer">
                                    <ExternalLink className="size-3.5" />
                                    Производитель
                                  </a>
                                </Button>
                                <Button asChild variant="outline" className="h-8 gap-2 text-xs">
                                  <a href={externalHref(model.priceHref)} target="_blank" rel="noreferrer">
                                    <CircleDollarSign className="size-3.5" />
                                    Цена
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold">Пилотные наборы</div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        По каждому набору показаны две траектории: продажа покупателям и внутреннее питание без перепродажи.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                      {pilotEquipmentPlans.map((plan) => (
                        <article key={plan.launch.format} className="min-w-0 rounded-lg border bg-background p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold tracking-normal">{plan.launch.format}</h3>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{plan.launch.pitch}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Badge variant="secondary">{plan.launch.lead_count} лидов</Badge>
                              <Badge variant="outline">{plan.unitCount} шт.</Badge>
                              <Badge variant="outline">{money(plan.launch.avg_start_amount)}</Badge>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
                            <div className="rounded-md border bg-muted/20 p-3">
                              <div className="dense-label">Состав пилота</div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {plan.categoryTags.map((tag) => (
                                  <Badge key={tag} variant="outline">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">{plan.categorySummary}</p>
                              {plan.jtbdSegments.length ? (
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                  <b>Сегменты:</b> {plan.jtbdSegments.slice(0, 2).map((item) => item.segment).join(" / ")}
                                </p>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                className="mt-3 h-8 gap-2 text-xs"
                                onClick={() => openCatalogLaunch(plan.launch.format)}
                              >
                                <PackageCheck className="size-3.5" />
                                Открыть набор
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              {[
                                { title: "Продавать покупателям", icon: ShoppingCart, recommendation: plan.sales },
                                { title: "Есть внутри компании", icon: Utensils, recommendation: plan.internal }
                              ].map((scenario) => {
                                const Icon = scenario.icon
                                const models = equipmentModelsFor(scenario.recommendation.modelIds)
                                return (
                                  <div key={scenario.title} className="rounded-md border p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 font-semibold">
                                        <Icon className="size-4" />
                                        {scenario.title}
                                      </div>
                                      <Badge variant={scenario.title === "Продавать покупателям" ? "success" : "warning"}>
                                        {scenario.recommendation.badge}
                                      </Badge>
                                    </div>
                                    <div className="mt-2 text-sm font-medium">{scenario.recommendation.equipment}</div>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{scenario.recommendation.spec}</p>
                                    <p className="mt-2 text-xs leading-5">{scenario.recommendation.operatingModel}</p>
                                    <div className="mt-3 grid grid-cols-1 gap-2">
                                      {models.slice(0, 2).map((model) => (
                                        <a
                                          key={`${scenario.title}-${model.id}`}
                                          href={externalHref(model.manufacturerHref)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-md border bg-muted/20 p-2 transition hover:border-primary hover:bg-muted/40"
                                        >
                                          <img
                                            src={model.imageUrl}
                                            alt={model.title}
                                            className="size-16 rounded-md bg-background object-contain p-1"
                                            loading="lazy"
                                          />
                                          <span className="flex min-w-0 flex-col gap-1 text-xs leading-4">
                                            <span className="font-semibold leading-4">{model.title}</span>
                                            <Badge variant="secondary" className="w-fit whitespace-nowrap">
                                              {model.priceLabel}
                                            </Badge>
                                          </span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {plan.checks.map((check) => (
                              <div key={check} className="flex gap-2 rounded-md border bg-muted/20 p-2 text-xs leading-5">
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                <span>{check}</span>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Пилотный набор</TableHead>
                          <TableHead>Состав</TableHead>
                          <TableHead>Если продают покупателям</TableHead>
                          <TableHead>Если едят сами</TableHead>
                          <TableHead>Проверить перед стартом</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pilotEquipmentPlans.map((plan) => (
                          <TableRow key={plan.launch.format}>
                            <TableCell className="min-w-[280px] align-top">
                              <div className="font-medium">{plan.launch.format}</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{plan.launch.pitch}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant="secondary">{plan.launch.lead_count} лидов</Badge>
                                <Badge variant="outline">{plan.unitCount} шт.</Badge>
                                <Badge variant="outline">{money(plan.launch.avg_start_amount)}</Badge>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="mt-3 h-8 gap-2 text-xs"
                                onClick={() => openCatalogLaunch(plan.launch.format)}
                              >
                                <PackageCheck className="size-3.5" />
                                Открыть набор в каталоге
                              </Button>
                            </TableCell>
                            <TableCell className="min-w-[260px] align-top text-sm">
                              <div className="flex flex-wrap gap-1">
                                {plan.categoryTags.map((tag) => (
                                  <Badge key={tag} variant="outline">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">{plan.categorySummary}</p>
                              {plan.jtbdSegments.length ? (
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                  <b>Сегменты:</b> {plan.jtbdSegments.slice(0, 2).map((item) => item.segment).join(" / ")}
                                </p>
                              ) : null}
                            </TableCell>
                            <TableCell className="min-w-[360px] align-top text-sm">
                              <Badge variant="success">{plan.sales.badge}</Badge>
                              <div className="mt-2 font-medium">{plan.sales.equipment}</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{plan.sales.spec}</p>
                              <p className="mt-2 text-xs leading-5">{plan.sales.operatingModel}</p>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                <b>Пример:</b> {plan.sales.example}
                              </p>
                            </TableCell>
                            <TableCell className="min-w-[340px] align-top text-sm">
                              <Badge variant="warning">{plan.internal.badge}</Badge>
                              <div className="mt-2 font-medium">{plan.internal.equipment}</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{plan.internal.spec}</p>
                              <p className="mt-2 text-xs leading-5">{plan.internal.operatingModel}</p>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                <b>Пример:</b> {plan.internal.example}
                              </p>
                            </TableCell>
                            <TableCell className="min-w-[300px] align-top text-sm">
                              <div className="space-y-2">
                                {plan.checks.map((check) => (
                                  <div key={check} className="flex gap-2 text-xs leading-5">
                                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                    <span>{check}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="size-4" />
                    Классы оборудования
                  </CardTitle>
                  <CardDescription>Рыночные ориентиры для подбора, не финальная спецификация закупки.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="rounded-md border p-3 text-sm">
                      <div className="flex items-center gap-2 font-semibold">
                        <Store className="size-4" />
                        Витрина продаж
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Для кофеен, ресепшенов, бань и ритейла: видимая выкладка, ценники, быстрый доступ покупателя.
                      </p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="flex items-center gap-2 font-semibold">
                        <Refrigerator className="size-4" />
                        Умный холодильник
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Для офисов, коворкингов, отелей и точек без продавца: оплата, учет остатков и удаленный контроль.
                      </p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="flex items-center gap-2 font-semibold">
                        <Building2 className="size-4" />
                        Внутреннее хранение
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Для компаний, которые закупают еду для сотрудников: отдельный холод, выдача по графику, без мерчандайзинга.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="font-semibold">Быстрая квалификация площадки</div>
                    <div className="mt-3 space-y-2">
                      {[
                        { icon: Ruler, text: "площадь и открывание двери: стойка, кухня, ресепшен или зона отдыха" },
                        { icon: Plug, text: "питание 220 В и запрет на перегрев компрессора в нише" },
                        { icon: ShieldCheck, text: "кто отвечает за приемку, остатки, списания и оплату" }
                      ].map((item) => {
                        const Icon = item.icon
                        return (
                          <div key={item.text} className="flex gap-2 text-xs leading-5">
                            <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                            <span>{item.text}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="dense-label">Что смотреть перед покупкой</div>
                    {[
                      "цена оборудования без доставки и пусконаладки не равна бюджету запуска",
                      "для продаж нужна понятная кассовая/QR-схема, для внутреннего питания - ведомость выдачи",
                      "фото в CRM открывают сайт модели; итоговую комплектацию подтверждает поставщик"
                    ].map((item) => (
                      <div key={item} className="rounded-md border p-3 text-xs leading-5 text-muted-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agents">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4" />
                    Очередь ИИ-агентов продаж
                  </CardTitle>
                  <CardDescription>Задачи подготовлены для исследования, outreach, матриц SKU и проверки заказов.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Агент</TableHead>
                        <TableHead>Компания</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Приоритет</TableHead>
                        <TableHead>Задача</TableHead>
                        <TableHead>Срок</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>#{task.id}</TableCell>
                          <TableCell>{task.agent_name}</TableCell>
                          <TableCell>{task.company_name ?? "общая"}</TableCell>
                          <TableCell>{task.task_type}</TableCell>
                          <TableCell>{task.priority}</TableCell>
                          <TableCell className="max-w-[620px] text-xs">{task.prompt}</TableCell>
                          <TableCell>{shortDate(task.due_at)}</TableCell>
                          <TableCell><Badge variant="outline">{task.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="size-4" />
                    Внешние инструменты агентов
                  </CardTitle>
                  <CardDescription>Зафиксированные источники для будущих AI-workflows.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-background p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">Движок ИИ-агентов</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          CRM передает задачу во внешний агентный runtime и принимает обратно структурированный JSON для проверки менеджером.
                        </div>
                      </div>
                      <Badge variant={integrationStatus?.status.agent_runtime.configured ? "success" : "warning"}>
                        {integrationStatus?.status.agent_runtime.provider ?? "offline"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <IntegrationStatusRow
                        label="Текущий режим"
                        description={
                          integrationStatus?.status.agent_runtime.configured
                            ? `${integrationStatus.status.agent_runtime.mode}: provider готов к запуску worker.`
                            : integrationStatus?.status.agent_runtime.requirement ?? "По умолчанию включен offline-режим без внешних моделей."
                        }
                        ready={Boolean(integrationStatus?.status.agent_runtime.configured)}
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <IntegrationStatusRow
                          label="Paperclip"
                          description="PAPERCLIP_AGENT_ENDPOINT или PAPERCLIP_AGENT_COMMAND"
                          ready={Boolean(integrationStatus?.status.agent_runtime.paperclip_configured)}
                        />
                        <IntegrationStatusRow
                          label="Hermes"
                          description="HERMES_AGENT_ENDPOINT или HERMES_AGENT_COMMAND"
                          ready={Boolean(integrationStatus?.status.agent_runtime.hermes_configured)}
                        />
                        <IntegrationStatusRow
                          label="OpenClaw"
                          description="OPENCLAW_AGENT_ENDPOINT, OPENCLAW_GATEWAY_URL или OPENCLAW_AGENT_COMMAND"
                          ready={Boolean(integrationStatus?.status.agent_runtime.openclaw_configured)}
                        />
                        <IntegrationStatusRow
                          label="OmniRoute"
                          description="OMNIROUTER_BASE_URL и OMNIROUTER_MODEL на VPS worker"
                          ready={Boolean(integrationStatus?.status.agent_runtime.omniroute_configured)}
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      Чтобы отказаться от OpenAI, задайте <span className="font-mono">AGENT_LLM_PROVIDER=paperclip</span>,{" "}
                      <span className="font-mono">hermes</span>, <span className="font-mono">openclaw</span> или{" "}
                      <span className="font-mono">omniroute</span>, затем заполните endpoint, command или VPS OmniRouter base URL выбранного движка.
                    </p>
                  </div>

                  <div className="rounded-md border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">Apify Store</div>
                        <div className="mt-1 text-xs text-muted-foreground">Подключение через GitHub OAuth в Apify Console.</div>
                      </div>
                      <Badge variant="success">подключено</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Можно подбирать Apify Actors для поиска локальных B2B-лидов, проверки сайтов, сбора публичных
                      контактов, мониторинга каталогов и enrichment перед задачами менеджера.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Роль в очереди агентов: <span className="font-medium text-foreground">AI Apify Actor Researcher</span>.
                      Агент готовит черновик задачи и источники, а запись в сделки выполняется только после подтверждения.
                    </p>
                    <a
                      className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      href="https://console.apify.com/store"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть Apify Store <ExternalLink className="size-3" />
                    </a>
                  </div>

                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="font-semibold">Следующий технический шаг</div>
                    <p className="mt-1 text-muted-foreground">
                      Для автозапуска actors добавить <span className="font-mono text-xs">APIFY_TOKEN</span> только на
                      сервере и отдельный worker/API. CRM не хранит токены в интерфейсе, SQLite или публичной ссылке.
                    </p>
                  </div>

                  <div className="rounded-md border bg-background p-3 text-sm">
                    <div className="font-semibold">Ограничения для агентов</div>
                    <p className="mt-1 text-muted-foreground">
                      Использовать только публичные B2B-источники по Санкт-Петербургу и Ленинградской области. Массовые
                      запуски, лимиты и запись результатов в сделки подтверждает менеджер.
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      One source of truth: если сущность уже есть в CRM, агент использует ее и не создает дубль. Каталог
                      Lunch Up является единой точкой истины для цен, фото, описаний, добавления и удаления SKU; все
                      экраны CRM, Mini App, КП и экономика читают эти данные из каталога.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="bot">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_430px]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="size-4" />
                    Telegram-бот: точки интеграции
                  </CardTitle>
                  <CardDescription>Бот должен читать каталог из CRM и создавать заказы в той же базе.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/20 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold">Мастер запуска заказов</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Mini App и CRM API готовы. Физический бот включается после токена BotFather и публичного URL.
                        </p>
                      </div>
                      <Badge variant={integrationStatus?.status.telegram_bot.configured ? "success" : "warning"}>
                        {integrationStatus?.status.telegram_bot.configured ? "бот подключен" : "нужен токен бота"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" className="gap-2" disabled={checkingPreflight} onClick={runIntegrationPreflight}>
                        <RefreshCw className={`size-3.5 ${checkingPreflight ? "animate-spin" : ""}`} />
                        Проверить запуск
                      </Button>
                      {integrationPreflight ? (
                        <div className="text-xs text-muted-foreground">
                          Проверено: {new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(integrationPreflight.checked_at))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <IntegrationStatusRow
                        label="Telegram BotFather"
                        description={
                          integrationStatus?.status.telegram_bot.configured
                            ? "TELEGRAM_BOT_TOKEN задан на сервере."
                            : "Создать бота в BotFather и добавить TELEGRAM_BOT_TOKEN."
                        }
                        ready={Boolean(integrationStatus?.status.telegram_bot.configured)}
                      />
                      <IntegrationStatusRow
                        label="Публичная ссылка"
                        description={
                          integrationStatus?.status.telegram_bot.public_base_url
                            ? integrationStatus.status.telegram_bot.public_base_url
                            : "PUBLIC_BASE_URL нужен для webhook и Mini App."
                        }
                        ready={Boolean(integrationStatus?.status.telegram_bot.public_base_url)}
                      />
                      <IntegrationStatusRow
                        label="Telegram webhook secret"
                        description={
                          integrationStatus?.status.telegram_bot.webhook_secret_configured
                            ? "Webhook принимает только запросы с секретным заголовком."
                            : "TELEGRAM_WEBHOOK_SECRET усилит защиту webhook."
                        }
                        ready={Boolean(integrationStatus?.status.telegram_bot.webhook_secret_configured)}
                      />
                      <IntegrationStatusRow
                        label="Уведомления менеджеру"
                        description={
                          integrationStatus?.status.telegram_bot.manager_chat_configured
                            ? "Новые Mini App заказы будут отправляться менеджеру в Telegram."
                            : "TELEGRAM_MANAGER_CHAT_ID включит уведомления о новых заказах."
                        }
                        ready={Boolean(integrationStatus?.status.telegram_bot.manager_chat_configured)}
                      />
                      <IntegrationStatusRow
                        label="Mini App auth"
                        description={
                          integrationStatus?.status.miniapp.demo_mode
                            ? "Включен локальный демо-режим; для публичного бота лучше выключить."
                            : "Заказы требуют Telegram initData."
                        }
                        ready={Boolean(integrationStatus?.status.miniapp.auth_required)}
                      />
                      <IntegrationStatusRow
                        label="2ГИС"
                        description={
                          integrationStatus?.status.dgis.configured
                            ? `${integrationStatus.status.dgis.env_key} подключен.`
                            : "DGIS_API_KEY нужен для карточек компаний и контактных полей 2ГИС."
                        }
                        ready={Boolean(integrationStatus?.status.dgis.configured)}
                      />
                      <IntegrationStatusRow
                        label="DaData / ФНС"
                        description={
                          integrationStatus?.status.dadata.configured
                            ? `${integrationStatus.status.dadata.env_key} подключен.`
                            : "DADATA_API_KEY нужен для ИНН и среднесписочной численности."
                        }
                        ready={Boolean(integrationStatus?.status.dadata.configured)}
                      />
                      <IntegrationStatusRow
                        label="Внешний export"
                        description={
                          integrationStatus?.status.external_order_webhook.configured
                            ? "Заказы будут уходить во внешний webhook."
                            : "EXTERNAL_ORDER_WEBHOOK_URL подключит 1C, МойСклад или middleware."
                        }
                        ready={Boolean(integrationStatus?.status.external_order_webhook.configured)}
                      />
                      <IntegrationStatusRow
                        label="Apify actors"
                        description={
                          integrationStatus?.status.apify.configured
                            ? "APIFY_TOKEN задан для будущих server-side actor-запусков."
                            : "APIFY_TOKEN нужен только для автоматического research/enrichment worker."
                        }
                        ready={Boolean(integrationStatus?.status.apify.configured)}
                      />
                    </div>
                    {integrationLaunchGuide ? (
                      <div className="mt-4 rounded-md border bg-background p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <ClipboardList className="size-4" />
                              Пакет запуска бота
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{integrationLaunchGuide.handoff_note}</p>
                          </div>
                          <Badge variant={integrationLaunchGuide.ok ? "success" : "warning"}>
                            {integrationLaunchGuide.ok ? "ключи готовы" : "нужны ключи"}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="dense-label">Mini App</div>
                            <div className="mt-1 break-all text-xs text-muted-foreground">
                              {integrationLaunchGuide.links.miniapp_url ?? integrationLaunchGuide.links.local_miniapp_url}
                            </div>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="dense-label">Webhook</div>
                            <div className="mt-1 break-all text-xs text-muted-foreground">
                              {integrationLaunchGuide.links.webhook_url ?? "PUBLIC_BASE_URL еще не задан"}
                            </div>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="dense-label">Env bootstrap</div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">{integrationLaunchGuide.commands.env_bootstrap}</div>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="dense-label">Запуск</div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">{integrationLaunchGuide.commands.launch_telegram_bot}</div>
                          </div>
                        </div>
                        <div className="mt-3 rounded-md border bg-muted/20 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-medium">Панель подключений</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Что должно быть подключено для реального приема заказов, enrichment и будущих AI-агентов.
                              </p>
                            </div>
                            <Badge variant={integrationLaunchGuide.operator_handoff.connection_checklist.every((item) => !item.required || item.configured) ? "success" : "warning"}>
                              {integrationLaunchGuide.operator_handoff.connection_checklist.filter((item) => item.required && !item.configured).length
                                ? `нужно ${integrationLaunchGuide.operator_handoff.connection_checklist.filter((item) => item.required && !item.configured).length}`
                                : "обязательные готовы"}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
                            {integrationLaunchGuide.operator_handoff.connection_checklist.map((item) => (
                              <div key={item.id} className="rounded-md border bg-background p-3 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium">{item.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{item.provider}</div>
                                  </div>
                                  <Badge variant={item.configured ? "success" : item.required ? "warning" : "outline"}>
                                    {item.configured ? "готово" : item.required ? "нужно" : "опц."}
                                  </Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {item.env_keys.map((envKey) => (
                                    <span key={`${item.id}-${envKey}`} className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                      {envKey}
                                    </span>
                                  ))}
                                </div>
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.why_it_matters}</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.next_action}</p>
                                <div className="mt-2 text-xs leading-5 text-muted-foreground">
                                  <b className="text-foreground">В CRM:</b> {item.crm_surface}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                  <b className="text-foreground">Безопасность:</b> {item.safe_handling}
                                </div>
                                {item.official_url ? (
                                  <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={item.official_url} target="_blank" rel="noreferrer">
                                    Открыть официальный источник <ExternalLink className="size-3" />
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 rounded-md border bg-muted/20 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-medium">Готовые ссылки для отправки</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Клиентские входы в Mini App, каталог и бота с готовым текстом сообщения. CRM key и секреты сюда не попадают.
                              </p>
                            </div>
                            <Badge variant={integrationLaunchGuide.operator_handoff.share_assets.some((item) => item.available) ? "success" : "warning"}>
                              {integrationLaunchGuide.operator_handoff.share_assets.filter((item) => item.available).length} доступно
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
                            {integrationLaunchGuide.operator_handoff.share_assets.map((asset) => (
                              <div key={asset.id} className="rounded-md border bg-background p-3 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium">{asset.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{asset.message}</div>
                                  </div>
                                  <Badge variant={asset.available ? "success" : "warning"}>
                                    {asset.channel}
                                  </Badge>
                                </div>
                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                                  {asset.qr_image_url ? (
                                    <a href={asset.qr_image_url} target="_blank" rel="noreferrer" className="no-print shrink-0 rounded-md border bg-white p-2">
                                      <img className="size-24" src={asset.qr_image_url} alt={`QR: ${asset.title}`} loading="lazy" />
                                    </a>
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    {asset.url ? <div className="break-all font-mono text-[11px] text-muted-foreground">{asset.url}</div> : null}
                                    {asset.telegram_startapp_url ? (
                                      <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                                        startapp: {asset.telegram_startapp_url}
                                      </div>
                                    ) : null}
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                      {asset.telegram_share_url ? (
                                        <a className="inline-flex items-center gap-1 text-primary hover:underline" href={asset.telegram_share_url} target="_blank" rel="noreferrer">
                                          Отправить в Telegram <ExternalLink className="size-3" />
                                        </a>
                                      ) : null}
                                      {asset.qr_image_url ? (
                                        <a className="no-print inline-flex items-center gap-1 text-primary hover:underline" href={asset.qr_image_url} target="_blank" rel="noreferrer">
                                          Открыть QR <ExternalLink className="size-3" />
                                        </a>
                                      ) : null}
                                    </div>
                                    {asset.qr_payload_url ? (
                                      <div className="no-print mt-2 break-all text-xs text-muted-foreground">QR payload: {asset.qr_payload_url}</div>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">{asset.note}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-4">
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Bot className="size-4" />
                              BotFather
                            </div>
                            <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                              <div><b className="text-foreground">Имя:</b> {integrationLaunchGuide.operator_handoff.botfather.bot_name}</div>
                              <div><b className="text-foreground">Username:</b> {integrationLaunchGuide.operator_handoff.botfather.suggested_username}</div>
                              <div>
                                <b className="text-foreground">BotFather:</b>{" "}
                                <a
                                  className="text-primary hover:underline"
                                  href={externalHref(integrationLaunchGuide.operator_handoff.botfather.open_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  открыть
                                </a>
                              </div>
                              <div><b className="text-foreground">Ссылка бота:</b> {integrationLaunchGuide.operator_handoff.botfather.bot_url_hint}</div>
                              <div><b className="text-foreground">Описание:</b> {integrationLaunchGuide.operator_handoff.botfather.short_description}</div>
                            </div>
                            <div className="mt-2 rounded-md border bg-background p-2 text-xs leading-5 text-muted-foreground">
                              {integrationLaunchGuide.operator_handoff.botfather.token_instruction}
                            </div>
                            <pre className="mt-2 max-h-36 overflow-auto rounded-md bg-foreground p-2 text-[11px] leading-5 text-background">
                              {integrationLaunchGuide.operator_handoff.botfather.commands.join("\n")}
                            </pre>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-medium">Mini App в BotFather</div>
                              <Badge variant={integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.configured ? "success" : "outline"}>
                                {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.configured ? "short name задан" : "опц."}
                              </Badge>
                            </div>
                            <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                              <div>
                                <b className="text-foreground">Env:</b> {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.short_name_env_key}
                              </div>
                              <div>
                                <b className="text-foreground">Short name:</b>{" "}
                                {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.short_name ??
                                  integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.suggested_short_name}
                              </div>
                              {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.miniapp_url ? (
                                <div className="break-all">
                                  <b className="text-foreground">Mini App URL:</b>{" "}
                                  {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.miniapp_url}
                                </div>
                              ) : (
                                <div className="break-all">
                                  <b className="text-foreground">Mini App URL:</b>{" "}
                                  {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.local_miniapp_url}
                                </div>
                              )}
                              {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.named_startapp_url ? (
                                <div className="break-all font-mono text-[11px]">
                                  named: {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.named_startapp_url}
                                </div>
                              ) : null}
                              {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.fallback_startapp_url ? (
                                <div className="break-all font-mono text-[11px]">
                                  fallback: {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.fallback_startapp_url}
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-2 rounded-md border bg-background p-2 text-xs leading-5 text-muted-foreground">
                              {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.note}
                            </div>
                            <pre className="mt-2 max-h-36 overflow-auto rounded-md bg-foreground p-2 text-[11px] leading-5 text-background">
                              {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.botfather_commands.join("\n")}
                            </pre>
                            <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                              {integrationLaunchGuide.operator_handoff.botfather.miniapp_setup.instructions.map((item) => (
                                <div key={item} className="flex gap-2">
                                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="text-sm font-medium">Кому какую ссылку</div>
                            <div className="mt-2 space-y-2">
                              {integrationLaunchGuide.operator_handoff.share_links.map((link) => (
                                <div key={link.id} className="rounded-md border bg-background p-2 text-xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-medium">{link.title}</div>
                                    <Badge variant={link.available ? "success" : "warning"}>
                                      {link.audience}
                                    </Badge>
                                  </div>
                                  {link.url ? <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{link.url}</div> : null}
                                  <div className="mt-1 leading-5 text-muted-foreground">{link.note}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="text-sm font-medium">Готовность запуска</div>
                            <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                              {integrationLaunchGuide.operator_handoff.success_criteria.map((item) => (
                                <div key={item} className="flex gap-2">
                                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 rounded-md border bg-muted/20 p-3">
                          <div className="text-sm font-medium">Команды клиента в Telegram</div>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                            {integrationLaunchGuide.operator_handoff.telegram_entrypoints.map((entrypoint) => (
                              <div key={entrypoint.id} className="rounded-md border bg-background p-2 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-medium">{entrypoint.title}</div>
                                  <Badge variant={entrypoint.available ? "success" : "warning"}>{entrypoint.command}</Badge>
                                </div>
                                {entrypoint.url ? <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{entrypoint.url}</div> : null}
                                <div className="mt-1 leading-5 text-muted-foreground">{entrypoint.note}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="text-sm font-medium">Шаги</div>
                            <div className="mt-2 space-y-2">
                              {integrationLaunchGuide.steps.map((step) => (
                                <div key={step.id} className="rounded-md border bg-background p-2 text-sm">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-medium">{step.title}</div>
                                    <Badge variant={step.status === "done" ? "success" : step.status === "optional" ? "outline" : "warning"}>
                                      {step.status === "done" ? "готово" : step.status === "optional" ? "опц." : "нужно"}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.action}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="text-sm font-medium">Ключи и подключения</div>
                            <div className="mt-2 space-y-2">
                              {integrationLaunchGuide.operator_handoff.env_template.map((item) => {
                                const current = integrationLaunchGuide.env.find((envItem) => envItem.key === item.key)
                                return (
                                  <div key={`${item.key}-${item.where_to_get}`} className="flex items-start justify-between gap-3 rounded-md border bg-background p-2 text-sm">
                                    <div>
                                      <div className="font-mono text-xs">{item.key}</div>
                                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                        {item.value_hint}. Где взять: {item.where_to_get}.{item.secret ? " Секрет не показывается в CRM." : ""}
                                      </div>
                                    </div>
                                    <Badge variant={current?.configured ? "success" : item.required ? "warning" : "outline"}>
                                      {current?.configured ? "задано" : item.required ? "нужно" : "опц."}
                                    </Badge>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 rounded-md border bg-background p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Send className="size-4" />
                            Server-side preview настройки Telegram
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            CRM показывает planned payload для webhook, меню Mini App и команд клиента без вызова Telegram API и без вывода секретов.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {telegramSetupPreview ? (
                            <Badge variant={telegramSetupPreview.ok ? "success" : "warning"}>
                              {telegramSetupPreview.ok ? "готов к setup" : `не хватает ${telegramSetupPreview.required.missing.length}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline">не загружено</Badge>
                          )}
                          <Button type="button" variant="outline" size="sm" className="gap-2" disabled={checkingSetupPreview} onClick={refreshTelegramSetupPreview}>
                            <RefreshCw className={`size-3.5 ${checkingSetupPreview ? "animate-spin" : ""}`} />
                            Обновить
                          </Button>
                        </div>
                      </div>
                      {telegramSetupPreview ? (
                        <>
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                            <div className="rounded-md border bg-muted/20 p-3">
                              <div className="dense-label">Mini App URL</div>
                              <div className="mt-1 break-all text-xs text-muted-foreground">{telegramSetupPreview.links.miniapp_url}</div>
                            </div>
                            <div className="rounded-md border bg-muted/20 p-3">
                              <div className="dense-label">Webhook URL</div>
                              <div className="mt-1 break-all text-xs text-muted-foreground">
                                {telegramSetupPreview.links.webhook_url ?? "Нужен PUBLIC_BASE_URL или сохраненная публичная ссылка"}
                              </div>
                            </div>
                            <div className="rounded-md border bg-muted/20 p-3">
                              <div className="dense-label">Недостающие ключи</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {telegramSetupPreview.required.missing.length ? telegramSetupPreview.required.missing.join(", ") : "нет"}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                            {telegramSetupPreview.telegram_api.map((item) => (
                              <div key={item.method} className="rounded-md border bg-muted/20 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-mono text-xs font-semibold">{item.method}</div>
                                  <Badge variant={item.optional ? "outline" : "secondary"}>{item.optional ? "опц." : "обяз."}</Badge>
                                </div>
                                <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-foreground p-2 text-[11px] leading-5 text-background">
                                  {JSON.stringify(item.payload, null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                            {telegramSetupPreview.telegram_entrypoints.map((entrypoint) => (
                              <div key={entrypoint.command} className="rounded-md border bg-muted/20 p-3 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-medium">{entrypoint.title}</div>
                                  <Badge variant="outline">{entrypoint.command}</Badge>
                                </div>
                                {entrypoint.url ? <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{entrypoint.url}</div> : null}
                                <div className="mt-1 leading-5 text-muted-foreground">{entrypoint.note}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 text-xs leading-5 text-muted-foreground">{telegramSetupPreview.note}</div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                          Нажмите «Обновить» или откройте CRM с ключом доступа, чтобы получить protected setup preview.
                        </div>
                      )}
                    </div>
                    {integrationPreflight ? (
                      <div className="mt-4 rounded-md border bg-background p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">Preflight запуска</div>
                          <Badge variant={integrationPreflight.ok ? "success" : "warning"}>
                            {integrationPreflight.ok ? "готово" : "есть блокеры"}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          {integrationPreflight.checks.map((item) => (
                            <div key={item.key} className="rounded-md border bg-muted/20 p-3 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-medium">{item.label}</div>
                                <Badge variant={item.status === "ok" ? "success" : item.status === "warning" ? "warning" : "muted"}>
                                  {item.status === "ok" ? "ok" : item.status === "warning" ? "внимание" : "нужно"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.message}</p>
                              {item.evidence ? <div className="mt-2 break-all text-xs text-muted-foreground">{item.evidence}</div> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={internalHref("/miniapp", accessKey)} target="_blank" rel="noreferrer">
                        Mini App <ExternalLink className="size-3" />
                      </a>
                      <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={internalHref("/api/mcp/manifest", accessKey)} target="_blank" rel="noreferrer">
                        MCP manifest <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                  <div className="no-print rounded-md border bg-background p-3">
                    <div className="dense-label">GET /api/bot/catalog</div>
                    <p className="mt-1 text-sm text-muted-foreground">Возвращает категории, 46 SKU, цены, сроки годности и условия заказа.</p>
                  </div>
                  <div className="no-print rounded-md border bg-background p-3">
                    <div className="dense-label">POST /api/bot/orders</div>
                    <p className="mt-1 text-sm text-muted-foreground">Создает компанию, Telegram-клиента, заказ и позиции. Если сумма меньше 7 000 руб., ставит статус blocked_minimum.</p>
                  </div>
                  <div className="no-print rounded-md border bg-background p-3">
                    <div className="dense-label">GET /miniapp</div>
                    <p className="mt-1 text-sm text-muted-foreground">Открывает Telegram Mini App: кабинет клиента, каталог, корзина и заказ в CRM.</p>
                  </div>
                  <div className="no-print rounded-md border bg-background p-3">
                    <div className="dense-label">POST /api/miniapp/enrichment</div>
                    <p className="mt-1 text-sm text-muted-foreground">Подтягивает карточку компании из 2ГИС/CRM и считает диапазон людей в офисе для КП.</p>
                  </div>
                  <div className="no-print rounded-md border bg-background p-3">
                    <div className="dense-label">POST /api/integrations/orders/export</div>
                    <p className="mt-1 text-sm text-muted-foreground">Экспортирует заказ во внешний webhook: 1C, МойСклад, доставку или middleware.</p>
                  </div>
                  <div className="no-print rounded-md border bg-background p-3">
                    <div className="dense-label">POST /api/integrations/apify/research</div>
                    <p className="mt-1 text-sm text-muted-foreground">Готовит dry-run payload или запускает Apify Actor для публичного company research; результат идет в задачу ИИ на проверку.</p>
                  </div>
                  <div className="no-print rounded-md border bg-background p-3">
                    <div className="dense-label">POST /api/integrations/2gis/search</div>
                    <p className="mt-1 text-sm text-muted-foreground">Ищет новых B2B-кандидатов в 2ГИС по сегменту/району; dry-run показывает suggested payload, импорт требует confirm_import.</p>
                  </div>
                  <div className="no-print rounded-md border bg-background p-3">
                    <div className="dense-label">GET /api/mcp/manifest</div>
                    <p className="mt-1 text-sm text-muted-foreground">Машинный контракт для AI/MCP-агентов: каталог, enrichment, заказ, 2ГИС search, Apify research и экспорт заказа.</p>
                  </div>
                  <pre className="no-print overflow-auto rounded-md bg-foreground p-4 text-xs text-background">{`{
  "telegram_chat_id": "123456",
  "display_name": "Кофейня на Петроградке",
  "company_name": "ООО Кофейня Петроградка",
  "delivery_method": "delivery",
  "delivery_address": "Ленинградская область, Кудрово, Европейский проспект, 10",
  "delivery_date": "2026-06-05",
  "items": [
    { "product_id": 26, "quantity": 20 },
    { "product_id": 28, "quantity": 18 }
  ]
}`}</pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Схема данных</CardTitle>
                  <CardDescription>Связь CRM и заказов.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md border p-3"><b>companies</b> хранит B2B-лида или клиента.</div>
                  <div className="rounded-md border p-3"><b>deals</b> ведет воронку и прогноз выручки.</div>
                  <div className="rounded-md border p-3"><b>products</b> хранит каталог из файла Lunch Up.</div>
                  <div className="rounded-md border p-3"><b>bot_customers</b> связывает Telegram chat с компанией.</div>
                  <div className="rounded-md border p-3"><b>orders + order_items</b> управляют заказами и составом.</div>
                  <div className="rounded-md border p-3"><b>company_enrichment_profiles</b> хранит 2ГИС/открытые данные и оценку людей в офисе.</div>
                  <div className="rounded-md border p-3"><b>integration_events</b> хранит аудит отправки заказов и запусков Apify во внешние системы.</div>
                  <div className="rounded-md border p-3"><b>ai_tasks</b> очередь задач для агентов продаж.</div>
                  <div className="rounded-md border p-3 text-xs text-muted-foreground">
                    Внешний export включается через EXTERNAL_ORDER_WEBHOOK_URL. Секреты остаются только на сервере.
                  </div>
                  <div className="rounded-md border p-3 text-xs text-muted-foreground">
                    DB: {data.dbPath}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
