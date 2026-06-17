import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { getActiveStrategy } from "@/lib/active-strategy"
import { assertWritableDb, getDb, getDbPath } from "@/lib/db"
import { attachProductPhotos } from "@/lib/product-photos"
import { syncCrmSegments } from "@/lib/crm-segments"
import { enrichLaunchContentFromProjectSheet, projectSheetSegments } from "@/lib/project-sheet-enrichment"
import { normalizeDgisUrl, normalizeDriveMinutes } from "@/lib/location-logistics"
import { listTelegramCopilotItems } from "@/lib/telegram-copilot"
import {
  adaptLaunchMatrixToSqliteCatalog,
  adaptLaunchSummaryToSqliteCatalog,
  adaptSegmentLaunchesToSqliteCatalog,
  type SqliteSegmentMatrixItem
} from "@/lib/sqlite-launch-matrix"
import type {
  AccountCompany,
  AiTask,
  CatalogAnalysisItem,
  CompanyPersonContact,
  CrmSegment,
  DashboardData,
  LaunchMatrixRow,
  LaunchSummary,
  Lead,
  LocalProspect,
  Matrix,
  ObjectionMapItem,
  Order,
  OrderItem,
  Product,
  SalesScript,
  SegmentLaunch,
  Stage,
  Stat,
  VendingCompany
} from "@/lib/types"

type DbContact = {
  id: number
  company_id: number
  company_name: string
  name: string | null
  role: string
  email: string | null
  phone: string | null
  address: string | null
  dgis_url: string | null
  drive_minutes_from_production: number | null
  drive_minutes_source: string | null
  telegram_handle: string | null
  preferred_channel: string
  is_public: number
  consent_basis: string
  notes: string | null
}

type AccountDraft = Omit<AccountCompany, "source_count" | "people_count" | "cross_links"> & {
  sourceSet: Set<string>
}

type DashboardOrderRow = Omit<Order, "item_count" | "items">

type DashboardOrderItemRow = OrderItem & {
  order_id: number
}

type DbCrmSegment = Omit<CrmSegment, "is_active"> & {
  is_active: number
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value)
}

function getLaunchContent(): {
  summary: LaunchSummary
  launch_matrix: LaunchMatrixRow[]
  segment_launches: SegmentLaunch[]
  sales_scripts: SalesScript[]
  catalog_analysis: CatalogAnalysisItem[]
  vending_companies: VendingCompany[]
  objection_map: ObjectionMapItem[]
} {
  const path = join(process.cwd(), "data", "launch-crm-content.json")
  if (!existsSync(path)) {
    return {
      summary: null,
      catalog_analysis: [],
      launch_matrix: [],
      segment_launches: [],
      sales_scripts: [],
      vending_companies: [],
      objection_map: []
    }
  }
  const launch = JSON.parse(readFileSync(path, "utf-8")) as {
    summary: LaunchSummary
    catalog_analysis: CatalogAnalysisItem[]
    launch_matrix: LaunchMatrixRow[]
    segment_launches: SegmentLaunch[]
    sales_scripts: SalesScript[]
    vending_companies: VendingCompany[]
    objection_map: ObjectionMapItem[]
  }
  return enrichLaunchContentFromProjectSheet(launch)
}

function tableExists(db: ReturnType<typeof getDb>, name: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name))
}

function tableColumnExists(db: ReturnType<typeof getDb>, table: string, column: string) {
  if (!tableExists(db, table)) return false
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return columns.some((item) => item.name === column)
}

function plainRows<T>(rows: unknown[]): T[] {
  return rows.map((row) => ({ ...(row as Record<string, unknown>) }) as T)
}

function firstValue<T>(current: T | null | undefined, next: T | null | undefined): T | null {
  return (current ?? next ?? null) as T | null
}

function firstMeaningfulValue<T>(current: T | null | undefined, next: T | null | undefined, emptyValues: T[]): T | null {
  if (current !== null && current !== undefined && !emptyValues.includes(current)) return current
  return (next ?? current ?? null) as T | null
}

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
}

function accountKey(name: string, website?: string | null) {
  const low = name.toLowerCase().replace(/ё/g, "е")
  if (/vendex|вендэкс/.test(low)) return "vendex-retail"
  if (/мегас/.test(low)) return "megas-vending"
  if (/uvenco|увенко/.test(low)) return "uvenco"
  if (/quickcafe|quick cafe/.test(low)) return "quickcafe"
  if (/spbvending|spb vending/.test(low)) return "spb-vending"
  if (/вендтрейд|vts-spb/.test(low)) return "vts-spb"
  if (/вендинг-с|vendings/.test(low)) return "vending-s"
  if (/кофейник|vending-kofe/.test(low)) return "kofeinik"
  if (/vendprogress/.test(low)) return "vendprogress"
  if (/vending partner|best-coffe/.test(low)) return "vending-partner"
  if (/вендингпро|vendingpro/.test(low)) return "vendingpro"
  if (/вавилон/.test(low)) return "vavilon-vending"
  const domain = website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0]
  if (domain) return `domain-${domain.toLowerCase()}`
  return low
    .replace(/\b(ооо|ао|пао|ип|зао|llc|inc)\b/g, "")
    .replace(/[^a-zа-я0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function accountDisplayName(name: string, key: string) {
  const displayByKey: Record<string, string> = {
    "vendex-retail": "Vendex Ритэйл",
    "megas-vending": "Мегас Вендинг",
    uvenco: "Uvenco / Увенко",
    quickcafe: "QuickCafe",
    "spb-vending": "SPB Vending",
    "vts-spb": "ВендТрейдСервис",
    "vending-s": "Вендинг-С",
    kofeinik: "Кофейник",
    vendprogress: "VendProgress",
    "vending-partner": "Vending Partner",
    vendingpro: "ВендингПро",
    "vavilon-vending": "Вавилон Вендинг"
  }
  return displayByKey[key] ?? name.replace(/\s+/g, " ").trim()
}

function leadPriority(score: number) {
  if (score >= 86) return "A"
  if (score >= 74) return "B"
  return "C"
}

function priorityRank(priority: string) {
  return { A: 3, B: 2, C: 1 }[priority as "A" | "B" | "C"] ?? 0
}

function mergeLinks(
  current: AccountCompany["source_links"],
  next: Array<{ label: string; url: string | null | undefined }>
) {
  const seen = new Set(current.map((link) => `${link.label}:${link.url}`))
  for (const link of next) {
    if (!link.url) continue
    const key = `${link.label}:${link.url}`
    if (!seen.has(key)) {
      current.push({ label: link.label, url: link.url })
      seen.add(key)
    }
  }
}

function makeCrossLinks(account: AccountDraft): AccountCompany["cross_links"] {
  const links: AccountCompany["cross_links"] = [{ label: "Единая база", tab: "accounts", query: account.display_name }]
  if (account.company_id) links.push({ label: "Компании", tab: "leads", query: account.display_name })
  if (account.local_prospect_id) links.push({ label: "Локальные лиды", tab: "local", query: account.display_name })
  links.push({ label: "Контакты", tab: "people", query: account.display_name })
  return links
}

function buildUnifiedRecords(input: {
  leads: Lead[]
  localProspects: LocalProspect[]
  vendingCompanies: VendingCompany[]
  dbContacts: DbContact[]
  segmentLabelByCode: Map<string, string>
}): { accountCompanies: AccountCompany[]; companyPeople: CompanyPersonContact[] } {
  const accounts = new Map<string, AccountDraft>()
  const accountByCompanyId = new Map<number, string>()

  function ensure(name: string, website?: string | null) {
    const id = accountKey(name, website)
    let account = accounts.get(id)
    if (!account) {
      account = {
        id,
        display_name: accountDisplayName(name, id),
        original_names: [],
        sources: [],
        sourceSet: new Set<string>(),
        primary_segment: "",
        region: "СПб/ЛО",
        city: "Санкт-Петербург",
        address: null,
        dgis_url: null,
        drive_minutes_from_production: null,
        drive_minutes_source: null,
        priority: "C",
        score: 0,
        status: "new",
        phone: null,
        email: null,
        website: null,
        telegram_url: null,
        telegram_username: null,
        telegram_channel_type: "unknown",
        telegram_contact_status: "not_found",
        telegram_source_url: null,
        telegram_source_note: null,
        telegram_discovered_at: null,
        agent_contact_policy: "manual_review_required",
        agent_contact_readiness: "none",
        agent_contact_next_step: null,
        fit_reason: null,
        offer: null,
        next_action: null,
        company_id: null,
        deal_id: null,
        local_prospect_id: null,
        vending_name: null,
        source_links: []
      }
      accounts.set(id, account)
    }
    account.original_names = compactUnique([...account.original_names, name])
    return account
  }

  function mergeBase(account: AccountDraft, source: string, values: Partial<AccountCompany>) {
    account.sourceSet.add(source)
    account.sources = Array.from(account.sourceSet)
    account.primary_segment = account.primary_segment || values.primary_segment || ""
    account.region = values.region || account.region
    account.city = values.city || account.city
    account.address = firstValue(account.address, values.address)
    account.dgis_url = firstValue(account.dgis_url, values.dgis_url)
    account.drive_minutes_from_production = firstValue(account.drive_minutes_from_production, values.drive_minutes_from_production)
    account.drive_minutes_source = firstValue(account.drive_minutes_source, values.drive_minutes_source)
    account.phone = firstValue(account.phone, values.phone)
    account.email = firstValue(account.email, values.email)
    account.website = firstValue(account.website, values.website)
    account.telegram_url = firstValue(account.telegram_url, values.telegram_url)
    account.telegram_username = firstValue(account.telegram_username, values.telegram_username)
    account.telegram_channel_type =
      firstMeaningfulValue(account.telegram_channel_type, values.telegram_channel_type, ["unknown"]) ?? "unknown"
    account.telegram_contact_status =
      firstMeaningfulValue(account.telegram_contact_status, values.telegram_contact_status, ["not_found"]) ?? "not_found"
    account.telegram_source_url = firstValue(account.telegram_source_url, values.telegram_source_url)
    account.telegram_source_note = firstValue(account.telegram_source_note, values.telegram_source_note)
    account.telegram_discovered_at = firstValue(account.telegram_discovered_at, values.telegram_discovered_at)
    account.agent_contact_policy =
      firstMeaningfulValue(account.agent_contact_policy, values.agent_contact_policy, ["manual_review_required"]) ?? "manual_review_required"
    account.agent_contact_readiness =
      firstMeaningfulValue(account.agent_contact_readiness, values.agent_contact_readiness, ["none"]) ?? "none"
    account.agent_contact_next_step = firstValue(account.agent_contact_next_step, values.agent_contact_next_step)
    account.fit_reason = firstValue(account.fit_reason, values.fit_reason)
    account.offer = firstValue(account.offer, values.offer)
    account.next_action = firstValue(account.next_action, values.next_action)
    account.status = values.status && account.status === "new" ? values.status : account.status
    account.score = Math.max(account.score, values.score ?? 0)
    if (priorityRank(values.priority ?? "") > priorityRank(account.priority)) account.priority = values.priority ?? account.priority
    account.company_id = account.company_id ?? values.company_id ?? null
    account.deal_id = account.deal_id ?? values.deal_id ?? null
    account.local_prospect_id = account.local_prospect_id ?? values.local_prospect_id ?? null
    account.vending_name = account.vending_name ?? values.vending_name ?? null
  }

  for (const lead of input.leads) {
    const account = ensure(lead.company_name, lead.website)
    accountByCompanyId.set(lead.company_id, account.id)
    mergeBase(account, "Компании", {
      primary_segment: input.segmentLabelByCode.get(lead.segment) ?? lead.segment,
      region: lead.region,
      city: lead.city,
      address: lead.address ?? lead.enrichment_address,
      dgis_url: normalizeDgisUrl({
        dgisUrl: lead.dgis_url,
        name: lead.company_name,
        city: lead.city,
        address: lead.address ?? lead.enrichment_address
      }),
      drive_minutes_from_production: normalizeDriveMinutes({
        value: lead.drive_minutes_from_production,
        address: lead.address ?? lead.enrichment_address,
        district: lead.district,
        city: lead.city,
        segment: lead.segment
      }),
      drive_minutes_source: lead.drive_minutes_source ?? "crm_company",
      priority: leadPriority(lead.lead_score),
      score: lead.lead_score,
      status: lead.stage_name,
      phone: lead.contact_phone,
      email: lead.contact_email,
      website: lead.website,
      telegram_url: lead.telegram_url,
      telegram_username: lead.telegram_username,
      telegram_channel_type: lead.telegram_channel_type,
      telegram_contact_status: lead.telegram_contact_status,
      telegram_source_url: lead.telegram_source_url,
      telegram_source_note: lead.telegram_source_note,
      telegram_discovered_at: lead.telegram_discovered_at,
      agent_contact_policy: lead.agent_contact_policy,
      agent_contact_readiness: lead.agent_contact_readiness,
      agent_contact_next_step: lead.agent_contact_next_step,
      fit_reason: lead.fit_reason,
      next_action: lead.next_action,
      company_id: lead.company_id,
      deal_id: lead.deal_id
    })
    mergeLinks(account.source_links, [
      { label: "сайт", url: lead.website },
      { label: "2ГИС", url: account.dgis_url },
      { label: "контакты", url: lead.public_contact_url },
      { label: "Telegram", url: lead.telegram_url },
      { label: "Telegram source", url: lead.telegram_source_url }
    ])
  }

  for (const prospect of input.localProspects) {
    const account = ensure(prospect.name, prospect.website)
    mergeBase(account, "Локальные лиды", {
      primary_segment: prospect.segment,
      address: prospect.address,
      dgis_url: normalizeDgisUrl({
        dgisUrl: prospect.dgis_url ?? prospect.source_2gis,
        name: prospect.name,
        city: "Санкт-Петербург",
        address: prospect.address
      }),
      drive_minutes_from_production: normalizeDriveMinutes({
        value: prospect.drive_minutes_from_production,
        walkMin: prospect.walk_min,
        address: prospect.address,
        city: "Санкт-Петербург",
        segment: prospect.segment
      }),
      drive_minutes_source: prospect.drive_minutes_from_production ? "local_prospect" : "estimated_from_walk_time",
      priority: prospect.priority,
      score: prospect.score,
      status: prospect.fns_status ?? "local",
      phone: prospect.phone,
      email: prospect.email,
      website: prospect.website,
      fit_reason: prospect.fit_reason,
      offer: prospect.offer,
      next_action: prospect.next_action,
      local_prospect_id: prospect.id
    })
    mergeLinks(account.source_links, [
      { label: "сайт", url: prospect.website },
      { label: "2ГИС", url: account.dgis_url ?? prospect.source_2gis },
      { label: "Яндекс", url: prospect.source_yandex },
      { label: "ФНС", url: prospect.pb_nalog_url }
    ])
  }

  for (const company of input.vendingCompanies) {
    const account = ensure(company.name, company.website)
    mergeBase(account, "Вендинг", {
      primary_segment: company.segment,
      address: company.address,
      dgis_url: normalizeDgisUrl({
        dgisUrl: company.source_2gis,
        name: company.name,
        city: "Санкт-Петербург",
        address: company.address
      }),
      drive_minutes_from_production: normalizeDriveMinutes({
        address: company.address,
        city: "Санкт-Петербург",
        segment: company.segment
      }),
      drive_minutes_source: "estimated_from_address",
      priority: company.priority,
      score: company.score,
      status: "vending",
      phone: company.phone,
      email: company.email,
      website: company.website,
      fit_reason: company.fit_reason,
      offer: company.recommended_offer,
      next_action: company.next_action,
      vending_name: company.name
    })
    mergeLinks(account.source_links, [
      { label: "сайт", url: company.website },
      { label: "2ГИС", url: account.dgis_url ?? company.source_2gis },
      { label: "Яндекс", url: company.source_yandex },
      { label: "источник", url: company.source_public }
    ])
  }

  const people: CompanyPersonContact[] = []

  function addPerson(inputContact: Omit<CompanyPersonContact, "cross_links">) {
    const account = accounts.get(inputContact.account_id)
    people.push({
      ...inputContact,
      cross_links: account ? makeCrossLinks(account) : [{ label: "Единая база", tab: "accounts", query: inputContact.company_display_name }]
    })
  }

  for (const contact of input.dbContacts) {
    const existingAccountId = accountByCompanyId.get(contact.company_id)
    const account = existingAccountId ? accounts.get(existingAccountId) ?? ensure(contact.company_name) : ensure(contact.company_name)
    addPerson({
      id: `company-contact-${contact.id}`,
      account_id: account.id,
      company_display_name: account.display_name,
      source: "Компании",
      source_record_id: String(contact.id),
      person_name: contact.name ?? "Публичный B2B-канал",
      role: contact.role,
      address: contact.address,
      dgis_url: contact.dgis_url,
      drive_minutes_from_production: contact.drive_minutes_from_production,
      drive_minutes_source: contact.drive_minutes_source,
      email: contact.email,
      phone: contact.phone,
      telegram_handle: contact.telegram_handle,
      preferred_channel: contact.preferred_channel,
      is_public: Boolean(contact.is_public),
      consent_basis: contact.consent_basis,
      notes: contact.notes,
      source_links: account.source_links
    })
  }

  for (const prospect of input.localProspects) {
    if (!prospect.phone && !prospect.email) continue
    const account = ensure(prospect.name, prospect.website)
    addPerson({
      id: `local-contact-${prospect.id}`,
      account_id: account.id,
      company_display_name: account.display_name,
      source: "Локальные лиды",
      source_record_id: String(prospect.id),
      person_name: "Публичный контакт точки",
      role: "Администратор / управляющий / закупки точки",
      address: prospect.address,
      dgis_url: normalizeDgisUrl({
        dgisUrl: prospect.dgis_url ?? prospect.source_2gis,
        name: prospect.name,
        city: "Санкт-Петербург",
        address: prospect.address
      }),
      drive_minutes_from_production: normalizeDriveMinutes({
        value: prospect.drive_minutes_from_production,
        walkMin: prospect.walk_min,
        address: prospect.address,
        city: "Санкт-Петербург",
        segment: prospect.segment
      }),
      drive_minutes_source: prospect.drive_minutes_from_production ? "local_prospect" : "estimated_from_walk_time",
      email: prospect.email,
      phone: prospect.phone,
      telegram_handle: null,
      preferred_channel: prospect.email ? "email" : "phone",
      is_public: true,
      consent_basis: "public_business_channel",
      notes: prospect.next_action,
      source_links: account.source_links
    })
  }

  for (const company of input.vendingCompanies) {
    const account = ensure(company.name, company.website)
    addPerson({
      id: `vending-contact-${account.id}`,
      account_id: account.id,
      company_display_name: account.display_name,
      source: "Вендинг",
      source_record_id: account.id,
      person_name: "Публичный B2B-канал",
      role: "Закупки / развитие / общий контакт",
      address: company.address,
      dgis_url: normalizeDgisUrl({
        dgisUrl: company.source_2gis,
        name: company.name,
        city: "Санкт-Петербург",
        address: company.address
      }),
      drive_minutes_from_production: normalizeDriveMinutes({
        address: company.address,
        city: "Санкт-Петербург",
        segment: company.segment
      }),
      drive_minutes_source: "estimated_from_address",
      email: company.email.includes("уточнить") ? null : company.email,
      phone: company.phone,
      telegram_handle: null,
      preferred_channel: company.email.includes("уточнить") ? "phone" : "email",
      is_public: true,
      consent_basis: "public_business_channel",
      notes: company.next_action,
      source_links: account.source_links
    })
  }

  const peopleCount = new Map<string, number>()
  for (const person of people) {
    peopleCount.set(person.account_id, (peopleCount.get(person.account_id) ?? 0) + 1)
  }

  const accountCompanies = Array.from(accounts.values())
    .map((account) => ({
      ...account,
      sources: Array.from(account.sourceSet),
      source_count: account.sourceSet.size,
      people_count: peopleCount.get(account.id) ?? 0,
      cross_links: makeCrossLinks(account)
    }))
    .map(({ sourceSet, ...account }) => account)
    .sort((a, b) => b.score - a.score || b.source_count - a.source_count || a.display_name.localeCompare(b.display_name, "ru"))

  people.sort((a, b) => a.company_display_name.localeCompare(b.company_display_name, "ru") || a.role.localeCompare(b.role, "ru"))

  return { accountCompanies, companyPeople: people }
}

export function getDashboardData(): DashboardData {
  const db = getDb()
  const activeStrategy = getActiveStrategy()
  if (!tableExists(db, "crm_segments")) {
    assertWritableDb()
    syncCrmSegments(db)
  }
  const crmSegmentCount = db.prepare("SELECT COUNT(*) AS count FROM crm_segments WHERE is_active = 1").get() as { count: number }
  if (crmSegmentCount.count === 0) {
    assertWritableDb()
    syncCrmSegments(db)
  }
  const crmSegments = plainRows<DbCrmSegment>(db.prepare(`
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
  `).all()).map((segmentRow) => ({
    ...segmentRow,
    is_active: Boolean(segmentRow.is_active)
  }))
  const segmentLabelByCode = new Map(crmSegments.map((segmentRow) => [segmentRow.code, segmentRow.label]))

  const companies = db.prepare("SELECT COUNT(*) AS count FROM companies").get() as { count: number }
  const products = db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active = 1").get() as { count: number }
  const orders = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total FROM orders").get() as {
    count: number
    total: number
  }
  const pipeline = db.prepare("SELECT COALESCE(SUM(estimated_monthly_revenue), 0) AS total FROM deals").get() as {
    total: number
  }
  const tasks = db.prepare("SELECT COUNT(*) AS count FROM ai_tasks WHERE status = 'queued'").get() as { count: number }
  const telegramCompanyChannels = db.prepare(`
    SELECT COUNT(*) AS count
    FROM companies
    WHERE telegram_contact_status IN ('public_found', 'approved_to_contact', 'needs_verification')
  `).get() as { count: number }
  const localProspects = tableExists(db, "local_prospects")
    ? plainRows<LocalProspect>(db.prepare(`
        SELECT
          id,
          name,
          segment,
          address,
          walk_min,
          distance_band,
          priority,
          score,
          fit_reason,
          offer,
          next_action,
          phone,
          email,
          website,
          source_2gis,
          source_yandex,
          pb_nalog_url,
          fns_status,
          legal_name,
          inn,
          ogrn,
          fns_notes,
          notes
        FROM local_prospects
        ORDER BY score DESC, walk_min ASC, name
      `).all())
    : []

  const stats: Stat[] = [
    { label: "B2B-лиды", value: String(companies.count), hint: "стартовая база СПб/ЛО" },
    { label: "Потенциал воронки", value: formatMoney(pipeline.total), hint: "оценка месячной выручки" },
    { label: "Каталог", value: String(products.count), hint: "SKU из ассортимента Lunch Up" },
    { label: "Заказы", value: `${orders.count} / ${formatMoney(orders.total)}`, hint: "web + Telegram pipeline" },
    { label: "ИИ-задачи", value: String(tasks.count), hint: "очередь для агентов продаж" },
    { label: "Telegram/AI-канал", value: String(telegramCompanyChannels.count), hint: "компании с публичным или проверяемым каналом" },
    { label: "Локальные лиды", value: String(localProspects.length), hint: "SPB+ЛО outreach база" }
  ]

  const stages = db.prepare(`
    SELECT
      ps.id,
      ps.code,
      ps.name,
      ps.position,
      ps.probability,
      COUNT(d.id) AS deal_count,
      COALESCE(SUM(d.estimated_monthly_revenue), 0) AS revenue
    FROM pipeline_stages ps
    LEFT JOIN deals d ON d.stage_id = ps.id
    GROUP BY ps.id
    ORDER BY ps.position
  `).all()

  const hasEnrichmentProfiles = tableExists(db, "company_enrichment_profiles")
  const hasWebsiteEmployeeCount = tableColumnExists(db, "company_enrichment_profiles", "employee_count_website")
  const enrichmentSelect = hasEnrichmentProfiles
    ? `
      ep.legal_name,
      ep.inn AS enrichment_inn,
      ep.address AS enrichment_address,
      ep.phone AS enrichment_phone,
      ep.email AS enrichment_email,
      ep.website AS enrichment_website,
      ep.employee_count_fns,
      ep.employee_count_2gis,
      ${hasWebsiteEmployeeCount ? "ep.employee_count_website" : "NULL"} AS employee_count_website,
      ep.office_people_min,
      ep.office_people_max,
      ep.office_people_confidence,
      ep.office_people_method,
      ep.recommended_portions,
      ep.recommended_sku,
      ep.estimated_launch_budget,
      ep.updated_at AS enrichment_updated_at,`
    : `
      NULL AS legal_name,
      NULL AS enrichment_inn,
      NULL AS enrichment_address,
      NULL AS enrichment_phone,
      NULL AS enrichment_email,
      NULL AS enrichment_website,
      NULL AS employee_count_fns,
      NULL AS employee_count_2gis,
      NULL AS employee_count_website,
      NULL AS office_people_min,
      NULL AS office_people_max,
      NULL AS office_people_confidence,
      NULL AS office_people_method,
      NULL AS recommended_portions,
      NULL AS recommended_sku,
      NULL AS estimated_launch_budget,
      NULL AS enrichment_updated_at,`
  const enrichmentJoin = hasEnrichmentProfiles ? "LEFT JOIN company_enrichment_profiles ep ON ep.company_id = c.id" : ""

  const leads = db.prepare(`
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      ${enrichmentSelect}
      c.segment,
      c.region,
      c.city,
      c.district,
      c.address,
      c.dgis_url,
      c.drive_minutes_from_production,
      c.drive_minutes_source,
      c.website,
      c.public_contact_url,
      c.telegram_url,
      c.telegram_username,
      c.telegram_channel_type,
      c.telegram_contact_status,
      c.telegram_source_url,
      c.telegram_source_note,
      c.telegram_discovered_at,
      c.agent_contact_policy,
      c.agent_contact_readiness,
      c.agent_contact_next_step,
      c.lead_status,
      c.lead_score,
      c.fit_reason,
      c.notes AS company_notes,
      ct.name AS contact_name,
      ct.role AS contact_role,
      ct.email AS contact_email,
      ct.phone AS contact_phone,
      ct.preferred_channel,
      ct.notes AS contact_notes,
      d.id AS deal_id,
      d.stage_id,
      ps.code AS stage_code,
      ps.name AS stage_name,
      d.estimated_monthly_revenue,
      d.next_action,
      d.next_action_at
    FROM companies c
    JOIN deals d ON d.company_id = c.id
    JOIN pipeline_stages ps ON ps.id = d.stage_id
    ${enrichmentJoin}
    LEFT JOIN (
      SELECT
        company_id,
        MAX(name) AS name,
        MAX(role) AS role,
        MAX(email) AS email,
        MAX(phone) AS phone,
        MAX(preferred_channel) AS preferred_channel,
        MAX(notes) AS notes
      FROM contacts
      GROUP BY company_id
    ) ct ON ct.company_id = c.id
    ORDER BY c.lead_score DESC, d.next_action_at ASC
  `).all()

  const dbContactRows = plainRows<DbContact>(db.prepare(`
    SELECT
      ct.id,
      ct.company_id,
      c.name AS company_name,
      ct.name,
      ct.role,
      ct.email,
      ct.phone,
      COALESCE(ct.address, c.address, ep.address) AS address,
      COALESCE(ct.dgis_url, c.dgis_url, CASE WHEN ep.dgis_id IS NOT NULL THEN 'https://2gis.ru/spb/firm/' || ep.dgis_id ELSE NULL END) AS dgis_url,
      COALESCE(ct.drive_minutes_from_production, c.drive_minutes_from_production) AS drive_minutes_from_production,
      COALESCE(ct.drive_minutes_source, c.drive_minutes_source) AS drive_minutes_source,
      ct.telegram_handle,
      ct.preferred_channel,
      ct.is_public,
      ct.consent_basis,
      ct.notes
    FROM contacts ct
    JOIN companies c ON c.id = ct.company_id
    LEFT JOIN company_enrichment_profiles ep ON ep.company_id = c.id
    ORDER BY c.name, ct.role, ct.id
  `).all())

  const productRows = plainRows<Product>(db.prepare(`
    SELECT
      id,
      category,
      name,
      barcode,
      net_weight,
      shelf_life_days,
      wholesale_price,
      image_url,
      product_url,
      image_source,
      image_match,
      image_note,
      site_title
    FROM products
    WHERE is_active = 1
    ORDER BY category, wholesale_price DESC, name
  `).all())

  const orderRows = plainRows<DashboardOrderRow>(db.prepare(`
    SELECT
      o.id,
      c.name AS company_name,
      c.segment AS company_segment,
      o.channel,
      o.status,
      o.delivery_method,
      o.delivery_address,
      o.delivery_date,
      o.payment_date,
      o.total_amount,
      o.payment_method,
      o.manager_comment,
      o.created_at,
      o.updated_at
    FROM orders o
    LEFT JOIN companies c ON c.id = o.company_id
    ORDER BY o.created_at DESC
  `).all())

  const orderItemsByOrderId = new Map<number, OrderItem[]>()
  if (orderRows.length) {
    const placeholders = orderRows.map(() => "?").join(", ")
    const itemRows = plainRows<DashboardOrderItemRow>(db.prepare(`
      SELECT
        oi.order_id,
        oi.product_id,
        p.name,
        p.category,
        oi.quantity,
        oi.unit_price,
        oi.line_total
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id IN (${placeholders})
      ORDER BY oi.order_id DESC, oi.id
    `).all(...orderRows.map((order) => order.id)))
    for (const item of itemRows) {
      const current = orderItemsByOrderId.get(item.order_id) ?? []
      current.push({
        product_id: item.product_id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total
      })
      orderItemsByOrderId.set(item.order_id, current)
    }
  }
  const ordersWithItems: Order[] = orderRows.map((order) => {
    const items = orderItemsByOrderId.get(order.id) ?? []
    return {
      ...order,
      item_count: items.reduce((sum, item) => sum + item.quantity, 0),
      items
    }
  })

  const taskRows = db.prepare(`
    SELECT
      t.id,
      a.name AS agent_name,
      c.name AS company_name,
      t.task_type,
      t.priority,
      t.prompt,
      t.status,
      t.due_at
    FROM ai_tasks t
    JOIN ai_agents a ON a.id = t.agent_id
    LEFT JOIN companies c ON c.id = t.company_id
    ORDER BY t.status, t.priority DESC, t.due_at ASC
    LIMIT 50
  `).all()

  const matrices = db.prepare(`
    SELECT
      m.id,
      m.segment,
      m.name,
      m.target_sku_count,
      m.rationale,
      GROUP_CONCAT(p.name, ', ') AS products
    FROM segment_matrices m
    LEFT JOIN matrix_items mi ON mi.matrix_id = m.id
    LEFT JOIN products p ON p.id = mi.product_id
    GROUP BY m.id
    ORDER BY m.id
  `).all()
  const matrixProductRows = plainRows<SqliteSegmentMatrixItem>(db.prepare(`
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
  `).all())

  const rawLaunch = getLaunchContent()
  const segmentLaunches = adaptSegmentLaunchesToSqliteCatalog({
    segmentLaunches: rawLaunch.segment_launches,
    crmSegments,
    products: productRows,
    matrixItems: matrixProductRows,
    minimumOrderAmount: activeStrategy.min_order_amount
  })
  const launch = {
    ...rawLaunch,
    summary: adaptLaunchSummaryToSqliteCatalog({
      summary: rawLaunch.summary,
      skuCount: productRows.length,
      minimumOrderAmount: activeStrategy.min_order_amount
    }),
    segment_launches: segmentLaunches,
    launch_matrix: adaptLaunchMatrixToSqliteCatalog({
      launchMatrix: rawLaunch.launch_matrix,
      segmentLaunches,
      minimumOrderAmount: activeStrategy.min_order_amount
    })
  }
  const productsWithPhotos = attachProductPhotos(productRows)
  const catalogAnalysisWithPhotos = attachProductPhotos(launch.catalog_analysis ?? [])
  const leadRows = plainRows<Lead>(leads)
  const { accountCompanies, companyPeople } = buildUnifiedRecords({
    leads: leadRows,
    localProspects,
    vendingCompanies: launch.vending_companies ?? [],
    dbContacts: dbContactRows,
    segmentLabelByCode
  })

  return {
    activeStrategy,
    stats,
    stages: plainRows<Stage>(stages),
    leads: leadRows,
    products: productsWithPhotos,
    orders: ordersWithItems,
    tasks: plainRows<AiTask>(taskRows),
    telegramCopilot: listTelegramCopilotItems({ limit: 60 }),
    matrices: plainRows<Matrix>(matrices),
    localProspects,
    catalogAnalysis: catalogAnalysisWithPhotos,
    launchSummary: launch.summary,
    launchMatrix: launch.launch_matrix,
    segmentLaunches: launch.segment_launches,
    crmSegments,
    projectSheetSegments,
    salesScripts: launch.sales_scripts,
    vendingCompanies: launch.vending_companies ?? [],
    objectionMap: launch.objection_map ?? [],
    accountCompanies,
    companyPeople,
    dbPath: getDbPath()
  }
}

export function updateDealStage(dealId: number, stageId: number) {
  const db = getDb()
  assertWritableDb()
  const result = db.prepare(`
    UPDATE deals
    SET stage_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(stageId, dealId)
  return result.changes
}

export function createAiTask(input: {
  agentCode: string
  companyId?: number | null
  dealId?: number | null
  taskType: string
  priority: number
  prompt: string
}) {
  const db = getDb()
  assertWritableDb()
  const agent = db.prepare("SELECT id FROM ai_agents WHERE code = ? AND is_active = 1").get(input.agentCode) as
    | { id: number }
    | undefined
  if (!agent) {
    throw new Error("Unknown or inactive AI agent")
  }
  const result = db.prepare(`
    INSERT INTO ai_tasks(agent_id, company_id, deal_id, task_type, priority, prompt, due_at)
    VALUES (?, ?, ?, ?, ?, ?, date('now', '+1 day'))
  `).run(agent.id, input.companyId ?? null, input.dealId ?? null, input.taskType, input.priority, input.prompt)
  return Number(result.lastInsertRowid)
}
