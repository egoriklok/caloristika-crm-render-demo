import { getDb } from "@/lib/db"
import { normalizeDgisUrl, normalizeDriveMinutes } from "@/lib/location-logistics"

export type CompanyEnrichmentInput = {
  company_id?: number | null
  company_name: string
  inn?: string | null
  website?: string | null
  address?: string | null
  segment?: string | null
}

export type CompanyEnrichmentSource = {
  source: "2gis" | "crm" | "dadata" | "fns" | "website" | "apify" | "heuristic"
  status: "connected" | "not_configured" | "not_found" | "error" | "estimated"
  title: string
  url?: string | null
  note: string
}

export type OfficePeopleEstimate = {
  min: number
  max: number
  confidence: "high" | "medium" | "low"
  method: string
  daily_present: number
  likely_buyers_min: number
  likely_buyers_max: number
  recommended_portions: number
  recommended_sku: number
  estimated_launch_budget: number
}

export type HeadcountEvidence = {
  source: "fns_dadata" | "2gis" | "website" | "crm_segment" | "heuristic"
  label: string
  value: number | null
  confidence: "high" | "medium" | "low"
  used_for_estimate: boolean
  note: string
  url?: string | null
}

export type CommercialProposalGuidance = {
  headcount_source: string
  office_size_label: string
  confidence_label: string
  launch_scenario: string
  proposal_summary: string
  manager_next_step: string
  what_to_offer: string[]
  assumptions: string[]
}

export type CompanyEnrichmentResult = {
  profile: {
    name: string
    legal_name: string | null
    inn: string | null
    address: string | null
    phone: string | null
    email: string | null
    website: string | null
    dgis_id: string | null
    dgis_url: string | null
    drive_minutes_from_production: number | null
    drive_minutes_source: string | null
    branch_count: number | null
    employee_count_fns: number | null
    employee_count_2gis: number | null
    employee_count_website: number | null
  }
  office_people: OfficePeopleEstimate
  headcount_evidence: HeadcountEvidence[]
  proposal: CommercialProposalGuidance
  sources: CompanyEnrichmentSource[]
  cache?: {
    hit: boolean
    updated_at: string | null
    age_hours: number | null
    ttl_hours: number
  }
}

export type CompanyEnrichmentOptions = {
  useCache?: boolean
  ttlHours?: number
}

export const DEFAULT_ENRICHMENT_CACHE_TTL_HOURS = 72

type DgisItem = {
  id?: string
  name?: string
  full_name?: string
  address_name?: string
  employees_org_count?: number | string
  itin?: string
  contact_groups?: Array<{
    contacts?: Array<{
      type?: string
      text?: string
      value?: string
      url?: string
    }>
  }>
  links?: Record<string, unknown>
  point?: { lat?: number; lon?: number }
}

type DadataPartySuggestion = {
  value?: string
  unrestricted_value?: string
  data?: {
    inn?: string
    ogrn?: string
    kpp?: string
    branch_count?: number | string | null
    employee_count?: number | string | null
    name?: {
      full_with_opf?: string
      short_with_opf?: string
      full?: string
      short?: string
    }
    address?: {
      value?: string
      unrestricted_value?: string
    }
    state?: {
      status?: string
    }
    phones?: Array<{ value?: string }>
    emails?: Array<{ value?: string }>
  }
}

type DadataResult = {
  item: DadataPartySuggestion | null
  source: CompanyEnrichmentSource
}

type WebsiteResult = {
  phone: string | null
  email: string | null
  website: string | null
  employee_count: number | null
  source: CompanyEnrichmentSource
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function enrichmentTtlHours(value?: number | null) {
  if (!Number.isFinite(value)) return DEFAULT_ENRICHMENT_CACHE_TTL_HOURS
  return Math.max(1, Math.min(24 * 30, Math.round(Number(value))))
}

function hoursSince(value: string | null) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.round(((Date.now() - time) / 3_600_000) * 10) / 10)
}

function normalizePhone(value: string | null) {
  if (!value) return null
  return value.replace(/\s+/g, " ").trim()
}

function firstContact(item: DgisItem | null, patterns: RegExp[]) {
  const contacts = item?.contact_groups?.flatMap((group) => group.contacts ?? []) ?? []
  for (const contact of contacts) {
    const joined = [contact.type, contact.text, contact.value, contact.url].filter(Boolean).join(" ")
    if (patterns.some((pattern) => pattern.test(joined))) {
      return cleanText(contact.value) ?? cleanText(contact.text) ?? cleanText(contact.url)
    }
  }
  return null
}

function firstDadataValue(values?: Array<{ value?: string }>) {
  return values?.map((item) => cleanText(item.value)).find(Boolean) ?? null
}

function normalizeWebsiteUrl(value?: string | null) {
  const cleaned = cleanText(value)
  if (!cleaned) return null
  try {
    const url = new URL(/^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`)
    if (!["http:", "https:"].includes(url.protocol)) return null
    url.hash = ""
    return url.toString()
  } catch {
    return null
  }
}

function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
}

function firstEmail(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
  return match?.find((item) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item)) ?? null
}

function firstPhone(value: string) {
  const match = value.match(/(?:\+7|8)[\s(.-]*\d{3}[\s).-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/g)
  return normalizePhone(match?.[0] ?? null)
}

function parseHumanNumber(value: string) {
  const parsed = Number(value.replace(/[\s,]/g, ""))
  if (!Number.isFinite(parsed)) return null
  if (parsed < 5 || parsed > 100000) return null
  return parsed
}

function extractWebsiteEmployeeCount(value: string) {
  const patterns = [
    /(?:более|свыше|больше)\s+(\d[\d\s]{0,8})\s+(?:сотрудник|специалист|человек)/gi,
    /(?:команда|штат|коллектив)[^.\n]{0,90}?(\d[\d\s]{0,8})\s+(?:сотрудник|специалист|человек)/gi,
    /(\d[\d\s]{0,8})\s+(?:сотрудник(?:ов|а)?|специалист(?:ов|а)?|человек)\s+(?:в штате|в команде|работают|работает|по всей сети)?/gi,
    /(?:over|more than)\s+(\d[\d,\s]{0,8})\s+(?:employees|team members|people)/gi,
    /(\d[\d,\s]{0,8})\s+(?:employees|team members)/gi
  ]
  const candidates: number[] = []
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const parsed = parseHumanNumber(match[1] ?? "")
      if (parsed) candidates.push(parsed)
    }
  }
  return candidates.length ? Math.max(...candidates) : null
}

async function fetchWithTimeout(url: string, timeoutMs = 6000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "LunchUpCRM/0.1 company-enrichment"
      }
    })
  } finally {
    clearTimeout(timeout)
  }
}

function apiBaseUrl(value: string | undefined, fallback: string) {
  const cleaned = cleanText(value)
  if (!cleaned) return fallback
  try {
    return new URL(cleaned).toString()
  } catch {
    return fallback
  }
}

function dadataEndpoint(path: string) {
  const base = cleanText(process.env.DADATA_API_BASE_URL)
  if (!base) return `https://suggestions.dadata.ru${path}`
  try {
    return new URL(path, base.endsWith("/") ? base : `${base}/`).toString()
  } catch {
    return `https://suggestions.dadata.ru${path}`
  }
}

async function fetchWebsite(input: { website?: string | null }): Promise<WebsiteResult> {
  const website = normalizeWebsiteUrl(input.website)
  if (!website) {
    return {
      phone: null,
      email: null,
      website: null,
      employee_count: null,
      source: {
        source: "website",
        status: "not_configured",
        title: "Сайт компании / открытые источники",
        note: "Сайт не найден в CRM, 2ГИС или входных данных."
      }
    }
  }

  const root = new URL(website)
  const candidates = Array.from(
    new Set([root.toString(), new URL("/contacts", root).toString(), new URL("/kontakty", root).toString()])
  )
  const chunks: string[] = []
  let lastError: string | null = null

  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate)
      if (!response.ok) {
        lastError = `HTTP ${response.status}`
        continue
      }
      const contentType = response.headers.get("content-type") ?? ""
      if (contentType && !/text|html|xml|json/i.test(contentType)) continue
      const html = await response.text()
      chunks.push(`${html}\n${textFromHtml(html)}`.slice(0, 180000))
      const joined = chunks.join("\n")
      if (firstEmail(joined) && firstPhone(joined) && extractWebsiteEmployeeCount(joined)) break
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown"
    }
  }

  if (!chunks.length) {
    return {
      phone: null,
      email: null,
      website,
      employee_count: null,
      source: {
        source: "website",
        status: "error",
        title: "Сайт компании / открытые источники",
        url: website,
        note: `Сайт не удалось прочитать автоматически: ${lastError ?? "нет ответа"}.`
      }
    }
  }

  const joined = chunks.join("\n")
  const employeeCount = extractWebsiteEmployeeCount(joined)
  return {
    phone: firstPhone(joined),
    email: firstEmail(joined),
    website,
    employee_count: employeeCount,
    source: {
      source: "website",
      status: "connected",
      title: "Сайт компании / открытые источники",
      url: website,
      note: employeeCount
        ? "Сайт прочитан; найдена публичная фраза о численности команды."
        : "Сайт прочитан; контакты используются как fallback, численность не найдена."
    }
  }
}

function guessSegmentPeople(segment?: string | null) {
  const value = String(segment ?? "").toLowerCase()
  if (/office|офис|business|бц|коворк/.test(value)) return { min: 60, max: 180, label: "оценка по офисному сегменту" }
  if (/vending|micro|вендинг|микромаркет/.test(value)) return { min: 80, max: 240, label: "оценка по микромаркету или вендингу" }
  if (/retail|store|ритейл|магазин|азс/.test(value)) return { min: 20, max: 80, label: "оценка по торговой точке" }
  if (/horeca|coffee|кафе|кофе|пекар/.test(value)) return { min: 15, max: 60, label: "оценка по HoReCa-точке" }
  return { min: 30, max: 120, label: "осторожная оценка по B2B-лиду" }
}

function buildOfficeEstimate(input: {
  fnsEmployees?: number | null
  dgisEmployees?: number | null
  websiteEmployees?: number | null
  branchCount?: number | null
  segment?: string | null
}): OfficePeopleEstimate {
  const exactEmployees = input.fnsEmployees ?? input.dgisEmployees ?? input.websiteEmployees ?? null
  const branchDivisor = input.branchCount && input.branchCount > 1 ? Math.min(input.branchCount, 12) : 1
  let min: number
  let max: number
  let confidence: OfficePeopleEstimate["confidence"]
  let method: string

  if (exactEmployees && exactEmployees > 1) {
    const officeBase = exactEmployees / branchDivisor
    min = Math.max(8, Math.round(officeBase * 0.55))
    max = Math.max(min + 5, Math.round(officeBase * 0.9))
    confidence = input.fnsEmployees ? "high" : "medium"
    method = input.fnsEmployees
      ? "Среднесписочная численность ФНС распределена по офисам/филиалам."
      : input.dgisEmployees
        ? "Численность 2ГИС распределена по офисам/филиалам."
        : "Публичная численность с сайта распределена по офисам/филиалам."
  } else {
    const guessed = guessSegmentPeople(input.segment)
    min = guessed.min
    max = guessed.max
    confidence = "low"
    method = guessed.label
  }

  const midpoint = Math.round((min + max) / 2)
  const dailyPresent = Math.max(5, Math.round(midpoint * 0.7))
  const likelyBuyersMin = Math.max(3, Math.round(dailyPresent * 0.15))
  const likelyBuyersMax = Math.max(likelyBuyersMin, Math.round(dailyPresent * 0.25))
  const recommendedPortions = Math.max(20, likelyBuyersMax * 2)
  const recommendedSku = recommendedPortions > 80 ? 14 : recommendedPortions > 45 ? 10 : 8

  return {
    min,
    max,
    confidence,
    method,
    daily_present: dailyPresent,
    likely_buyers_min: likelyBuyersMin,
    likely_buyers_max: likelyBuyersMax,
    recommended_portions: recommendedPortions,
    recommended_sku: recommendedSku,
    estimated_launch_budget: Math.round(recommendedPortions * 124)
  }
}

function confidenceLabel(value: OfficePeopleEstimate["confidence"]) {
  if (value === "high") return "высокая уверенность"
  if (value === "medium") return "средняя уверенность"
  return "оценка требует проверки менеджером"
}

function officeSizeLabel(officePeople: OfficePeopleEstimate) {
  if (officePeople.max <= 45) return "малый офис"
  if (officePeople.max <= 120) return "средний офис"
  if (officePeople.max <= 260) return "крупный офис"
  return "якорный офис или распределенная команда"
}

function headcountSource(input: {
  fnsEmployees?: number | null
  dgisEmployees?: number | null
  websiteEmployees?: number | null
  branchCount?: number | null
}) {
  if (input.fnsEmployees) {
    return `ФНС/DaData: ${input.fnsEmployees} сотрудников юрлица${input.branchCount && input.branchCount > 1 ? `, ${input.branchCount} филиал(а)` : ""}`
  }
  if (input.dgisEmployees) return `2ГИС: ${input.dgisEmployees} сотрудников организации`
  if (input.websiteEmployees) return `сайт компании: ${input.websiteEmployees} сотрудников в публичном описании`
  return "прямой численности нет; используется осторожная оценка по сегменту и CRM-контексту"
}

function buildHeadcountEvidence(input: {
  officePeople: OfficePeopleEstimate
  fnsEmployees?: number | null
  dgisEmployees?: number | null
  websiteEmployees?: number | null
  branchCount?: number | null
  segment?: string | null
  fnsUrl?: string | null
  dgisUrl?: string | null
  websiteUrl?: string | null
}): HeadcountEvidence[] {
  const usedSource = input.fnsEmployees ? "fns_dadata" : input.dgisEmployees ? "2gis" : input.websiteEmployees ? "website" : "heuristic"
  const rows: HeadcountEvidence[] = []
  if (input.fnsEmployees) {
    rows.push({
      source: "fns_dadata",
      label: "ФНС/DaData",
      value: input.fnsEmployees,
      confidence: "high",
      used_for_estimate: usedSource === "fns_dadata",
      url: input.fnsUrl ?? null,
      note: input.branchCount && input.branchCount > 1
        ? `Среднесписочная численность юрлица распределена по ${input.branchCount} филиалам/точкам.`
        : "Среднесписочная численность юрлица используется как самый сильный источник."
    })
  }
  if (input.dgisEmployees) {
    rows.push({
      source: "2gis",
      label: "2ГИС",
      value: input.dgisEmployees,
      confidence: input.fnsEmployees ? "medium" : "medium",
      used_for_estimate: usedSource === "2gis",
      url: input.dgisUrl ?? null,
      note: "Публичное поле карточки организации; использовать как подтверждающий сигнал, если ФНС/DaData пустые."
    })
  }
  if (input.websiteEmployees) {
    rows.push({
      source: "website",
      label: "Сайт компании",
      value: input.websiteEmployees,
      confidence: input.fnsEmployees || input.dgisEmployees ? "medium" : "low",
      used_for_estimate: usedSource === "website",
      url: input.websiteUrl ?? null,
      note: "Найдена публичная фраза о размере команды на сайте или странице контактов."
    })
  }
  rows.push({
    source: input.segment ? "crm_segment" : "heuristic",
    label: input.segment ? "CRM-сегмент" : "Эвристика",
    value: null,
    confidence: input.officePeople.confidence,
    used_for_estimate: usedSource === "heuristic",
    note: `${input.officePeople.method}. Итог для КП: ${input.officePeople.min}-${input.officePeople.max} человек в офисе.`
  })
  return rows
}

function buildCommercialProposalGuidance(input: {
  officePeople: OfficePeopleEstimate
  fnsEmployees?: number | null
  dgisEmployees?: number | null
  websiteEmployees?: number | null
  branchCount?: number | null
}): CommercialProposalGuidance {
  const officeLabel = officeSizeLabel(input.officePeople)
  const confidence = confidenceLabel(input.officePeople.confidence)
  const launchScenario =
    input.officePeople.recommended_portions >= 100
      ? "якорный запуск с расширенным ассортиментом и пополнением после первой недели"
      : input.officePeople.recommended_portions >= 55
        ? "двухнедельный пилот с офисной витриной, завтраками, салатами, сэндвичами и десертами"
        : "точечный пилот для проверки спроса с компактной стартовой корзиной"
  const whatToOffer = [
    `${input.officePeople.recommended_sku} SKU на старт, ${input.officePeople.recommended_portions} порций в первой поставке`,
    `расчет на ${input.officePeople.likely_buyers_min}-${input.officePeople.likely_buyers_max} покупателей в день`,
    "корзину из готовых блюд, завтраков, салатов, сэндвичей и десертов",
    "контроль остатков после первой поставки и корректировку матрицы под фактический спрос"
  ]
  return {
    headcount_source: headcountSource(input),
    office_size_label: officeLabel,
    confidence_label: confidence,
    launch_scenario: launchScenario,
    proposal_summary: `Для КП используем диапазон ${input.officePeople.min}-${input.officePeople.max} человек в офисе: ${officeLabel}, ${confidence}. Рекомендуемый старт: ${input.officePeople.recommended_portions} порций, ${input.officePeople.recommended_sku} SKU, бюджет ${input.officePeople.estimated_launch_budget} руб.`,
    manager_next_step: "Подтвердить фактическую ежедневную посещаемость, формат хранения еды и желаемые дни поставки, затем отправить КП с пилотной корзиной.",
    what_to_offer: whatToOffer,
    assumptions: [
      `ежедневно на месте около ${input.officePeople.daily_present} человек`,
      "покупательская конверсия на старте оценена как 15-25% от присутствующих",
      "численность в КП указывать как оценочный диапазон, не как точное юридическое число"
    ]
  }
}

function findLocalCompany(input: CompanyEnrichmentInput) {
  const db = getDb()
  const needle = `%${input.company_name.trim()}%`
  const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name))
  const company = db.prepare(`
    SELECT name, website, public_contact_url, segment, city, district, notes
    FROM companies
    WHERE lower(name) LIKE lower(?)
    ORDER BY lead_score DESC
    LIMIT 1
  `).get(needle) as
    | { name: string; website: string | null; public_contact_url: string | null; segment: string; city: string; district: string | null; notes: string | null }
    | undefined
  const prospect = tables.has("local_prospects")
    ? (db.prepare(`
        SELECT name, address, phone, email, website, inn, legal_name, segment
        FROM local_prospects
        WHERE lower(name) LIKE lower(?) OR inn = ?
        ORDER BY score DESC
        LIMIT 1
      `).get(needle, input.inn ?? "") as
        | {
            name: string
            address: string | null
            phone: string | null
            email: string | null
            website: string | null
            inn: string | null
            legal_name: string | null
            segment: string | null
          }
        | undefined)
    : undefined

  return { company, prospect }
}

async function fetchDgis(input: CompanyEnrichmentInput) {
  const key = process.env.DGIS_API_KEY ?? process.env.TWO_GIS_API_KEY
  if (!key) {
    return {
      item: null,
      source: {
        source: "2gis",
        status: "not_configured",
        title: "2ГИС Places API",
        note: "Ключ DGIS_API_KEY не задан; CRM использует локальные и эвристические данные."
      } satisfies CompanyEnrichmentSource
    }
  }

  const query = [input.company_name, input.inn, input.address, "Санкт-Петербург"].filter(Boolean).join(" ")
  const url = new URL(apiBaseUrl(process.env.DGIS_API_BASE_URL, "https://catalog.api.2gis.com/3.0/items"))
  url.searchParams.set("q", query)
  url.searchParams.set("key", key)
  url.searchParams.set("page_size", "5")
  url.searchParams.set("fields", "items.point,items.contact_groups,items.rubrics,items.address_name,items.full_name,items.reviews,items.links,items.employees_org_count,items.itin")

  try {
    const response = await fetch(url, { cache: "no-store" })
    const payload = (await response.json()) as { result?: { items?: DgisItem[]; total?: number }; meta?: { code?: number; message?: string } }
    const item = payload.result?.items?.[0] ?? null
    return {
      item,
      total: payload.result?.total ?? null,
      source: {
        source: "2gis",
        status: item ? "connected" : "not_found",
        title: "2ГИС Places API",
        url: normalizeDgisUrl({
          dgisId: item?.id,
          name: cleanText(item?.name) ?? input.company_name,
          address: cleanText(item?.address_name),
          city: "Санкт-Петербург"
        }),
        note: item ? "Карточка найдена через официальный Places API." : "Карточка по запросу не найдена."
      } satisfies CompanyEnrichmentSource
    }
  } catch (error) {
    return {
      item: null,
      source: {
        source: "2gis",
        status: "error",
        title: "2ГИС Places API",
        note: `Ошибка запроса 2ГИС: ${error instanceof Error ? error.message : "unknown"}`
      } satisfies CompanyEnrichmentSource
    }
  }
}

async function fetchDadata(input: CompanyEnrichmentInput): Promise<DadataResult> {
  const token = process.env.DADATA_API_KEY ?? process.env.DADATA_TOKEN
  if (!token) {
    return {
      item: null,
      source: {
        source: "dadata",
        status: "not_configured",
        title: "DaData / ФНС",
        note: "Ключ DADATA_API_KEY не задан; среднесписочная численность ФНС не подтягивается автоматически."
      }
    }
  }

  const byInn = Boolean(input.inn?.trim())
  const url = byInn
    ? dadataEndpoint("/suggestions/api/4_1/rs/findById/party")
    : dadataEndpoint("/suggestions/api/4_1/rs/suggest/party")
  const body = byInn
    ? { query: input.inn?.trim(), count: 1 }
    : {
        query: [input.company_name, input.address, "Санкт-Петербург"].filter(Boolean).join(" "),
        count: 3
      }

  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })
    if (!response.ok) {
      return {
        item: null,
        source: {
          source: "dadata",
          status: "error",
          title: "DaData / ФНС",
          note: `DaData вернула HTTP ${response.status}; проверьте ключ и доступ к подсказкам организаций.`
        }
      }
    }

    const payload = (await response.json()) as { suggestions?: DadataPartySuggestion[] }
    const item = payload.suggestions?.[0] ?? null
    const employeeCount = Number(item?.data?.employee_count)
    return {
      item,
      source: {
        source: "dadata",
        status: item ? "connected" : "not_found",
        title: "DaData / ФНС",
        url: item?.data?.inn ? `https://pb.nalog.ru/search.html#quick-result?queryAll=${encodeURIComponent(item.data.inn)}` : null,
        note: item
          ? Number.isFinite(employeeCount) && employeeCount > 0
            ? "Организация найдена; среднесписочная численность получена из карточки организации."
            : "Организация найдена, но среднесписочная численность в ответе отсутствует."
          : "Организация по названию/ИНН не найдена."
      }
    }
  } catch (error) {
    return {
      item: null,
      source: {
        source: "dadata",
        status: "error",
        title: "DaData / ФНС",
        note: `Ошибка запроса DaData: ${error instanceof Error ? error.message : "unknown"}`
      }
    }
  }
}

export function readCachedCompanyEnrichment(companyId: number, options: CompanyEnrichmentOptions = {}) {
  ensureCompanyEnrichmentSchema()
  const ttlHours = enrichmentTtlHours(options.ttlHours)
  const db = getDb()
  const row = db.prepare(`
    SELECT
      c.name,
      ep.dgis_id,
      ep.dgis_url,
      ep.drive_minutes_from_production,
      ep.drive_minutes_source,
      ep.inn,
      ep.legal_name,
      ep.address,
      ep.website,
      ep.phone,
      ep.email,
      ep.employee_count_fns,
      ep.employee_count_2gis,
      ep.employee_count_website,
      ep.office_people_min,
      ep.office_people_max,
      ep.office_people_confidence,
      ep.office_people_method,
      ep.office_people_daily_present,
      ep.likely_buyers_min,
      ep.likely_buyers_max,
      ep.recommended_portions,
      ep.recommended_sku,
      ep.estimated_launch_budget,
      ep.source_summary,
      ep.updated_at
    FROM company_enrichment_profiles ep
    JOIN companies c ON c.id = ep.company_id
    WHERE ep.company_id = ?
  `).get(companyId) as
    | {
        name: string
        dgis_id: string | null
        dgis_url: string | null
        drive_minutes_from_production: number | null
        drive_minutes_source: string | null
        inn: string | null
        legal_name: string | null
        address: string | null
        website: string | null
        phone: string | null
        email: string | null
        employee_count_fns: number | null
        employee_count_2gis: number | null
        employee_count_website: number | null
        office_people_min: number
        office_people_max: number
        office_people_confidence: OfficePeopleEstimate["confidence"]
        office_people_method: string
        office_people_daily_present: number | null
        likely_buyers_min: number | null
        likely_buyers_max: number | null
        recommended_portions: number
        recommended_sku: number
        estimated_launch_budget: number
        source_summary: string
        updated_at: string
      }
    | undefined
  if (!row) return null
  const ageHours = hoursSince(row.updated_at)
  if (ageHours === null || ageHours > ttlHours) return null
  let sources: CompanyEnrichmentSource[] = []
  try {
    const parsed = JSON.parse(row.source_summary)
    if (Array.isArray(parsed)) sources = parsed as CompanyEnrichmentSource[]
  } catch {
    sources = []
  }
  if (!sources.length) {
    sources = [
      {
        source: "crm",
        status: "connected",
        title: "CRM enrichment cache",
        note: "Сохраненный профиль компании из CRM."
      }
    ]
  }
  const profile = {
      name: row.name,
      legal_name: row.legal_name,
      inn: row.inn,
      address: row.address,
      phone: row.phone,
      email: row.email,
      website: row.website,
      dgis_id: row.dgis_id,
      dgis_url: normalizeDgisUrl({
        dgisUrl: row.dgis_url,
        dgisId: row.dgis_id,
        name: row.name,
        address: row.address
      }),
      drive_minutes_from_production: row.drive_minutes_from_production,
      drive_minutes_source: row.drive_minutes_source,
      branch_count: null,
      employee_count_fns: row.employee_count_fns,
      employee_count_2gis: row.employee_count_2gis,
      employee_count_website: row.employee_count_website
    }
  const officePeople = {
      min: row.office_people_min,
      max: row.office_people_max,
      confidence: row.office_people_confidence,
      method: row.office_people_method,
      daily_present: row.office_people_daily_present ?? Math.max(5, Math.round(((row.office_people_min + row.office_people_max) / 2) * 0.7)),
      likely_buyers_min: row.likely_buyers_min ?? Math.max(3, Math.round(row.office_people_min * 0.1)),
      likely_buyers_max: row.likely_buyers_max ?? Math.max(3, Math.round(row.office_people_max * 0.2)),
      recommended_portions: row.recommended_portions,
      recommended_sku: row.recommended_sku,
      estimated_launch_budget: row.estimated_launch_budget
    }
  const headcountEvidence = buildHeadcountEvidence({
    officePeople,
    fnsEmployees: profile.employee_count_fns,
    dgisEmployees: profile.employee_count_2gis,
    websiteEmployees: profile.employee_count_website,
    branchCount: profile.branch_count,
    websiteUrl: profile.website
  })
  return {
    profile,
    office_people: officePeople,
    headcount_evidence: headcountEvidence,
    proposal: buildCommercialProposalGuidance({
      officePeople,
      fnsEmployees: profile.employee_count_fns,
      dgisEmployees: profile.employee_count_2gis,
      websiteEmployees: profile.employee_count_website,
      branchCount: profile.branch_count
    }),
    sources: [
      {
        source: "crm",
        status: "connected",
        title: "CRM enrichment cache",
        note: `Использован сохраненный enrichment; возраст ${ageHours} ч., TTL ${ttlHours} ч.`
      },
      ...sources
    ],
    cache: {
      hit: true,
      updated_at: row.updated_at,
      age_hours: ageHours,
      ttl_hours: ttlHours
    }
  } satisfies CompanyEnrichmentResult
}

export const getCachedCompanyEnrichment = readCachedCompanyEnrichment

export async function lookupCompanyEnrichment(input: CompanyEnrichmentInput, options: CompanyEnrichmentOptions = {}): Promise<CompanyEnrichmentResult> {
  if (options.useCache !== false && Number.isInteger(input.company_id) && Number(input.company_id) > 0) {
    const cached = readCachedCompanyEnrichment(Number(input.company_id), options)
    if (cached) return cached
  }
  const local = findLocalCompany(input)
  const [dgis, dadata] = await Promise.all([fetchDgis(input), fetchDadata(input)])
  const dgisItem = dgis.item
  const dadataItem = dadata.item
  const dgisPhone = normalizePhone(firstContact(dgisItem, [/phone|тел/i]) ?? null)
  const dgisEmail = firstContact(dgisItem, [/mail|email|почт/i])
  const dgisWebsite = normalizeWebsiteUrl(firstContact(dgisItem, [/site|url|web|сайт/i]))
  const inputWebsite = normalizeWebsiteUrl(input.website)
  const localWebsite = normalizeWebsiteUrl(local.prospect?.website ?? local.company?.website ?? null)
  const websiteResult = await fetchWebsite({ website: inputWebsite ?? dgisWebsite ?? localWebsite })
  const dgisEmployees = Number(dgisItem?.employees_org_count)
  const dadataEmployees = Number(dadataItem?.data?.employee_count)
  const websiteEmployees = Number(websiteResult.employee_count)
  const dadataBranchCount = Number(dadataItem?.data?.branch_count)
  const localSegment = input.segment ?? local.prospect?.segment ?? local.company?.segment ?? null
  const officePeople = buildOfficeEstimate({
    fnsEmployees: Number.isFinite(dadataEmployees) && dadataEmployees > 0 ? dadataEmployees : null,
    dgisEmployees: Number.isFinite(dgisEmployees) && dgisEmployees > 0 ? dgisEmployees : null,
    websiteEmployees: Number.isFinite(websiteEmployees) && websiteEmployees > 0 ? websiteEmployees : null,
    branchCount: Number.isFinite(dadataBranchCount) && dadataBranchCount > 0 ? dadataBranchCount : null,
    segment: localSegment
  })

  const phone = dgisPhone ?? firstDadataValue(dadataItem?.data?.phones) ?? websiteResult.phone ?? local.prospect?.phone ?? null
  const email = dgisEmail ?? firstDadataValue(dadataItem?.data?.emails) ?? websiteResult.email ?? local.prospect?.email ?? null
  const website = dgisWebsite ?? inputWebsite ?? websiteResult.website ?? localWebsite
  const address = cleanText(dgisItem?.address_name) ?? cleanText(dadataItem?.data?.address?.value) ?? input.address ?? local.prospect?.address ?? null
  const dgisUrl = normalizeDgisUrl({
    dgisUrl: dgis.source.url ?? null,
    dgisId: cleanText(dgisItem?.id),
    name: cleanText(dgisItem?.name) ?? input.company_name,
    address
  })
  const driveMinutes = normalizeDriveMinutes({
    latitude: dgisItem?.point?.lat,
    longitude: dgisItem?.point?.lon,
    address,
    segment: localSegment
  })
  const dadataName =
    cleanText(dadataItem?.data?.name?.short_with_opf) ??
    cleanText(dadataItem?.data?.name?.full_with_opf) ??
    cleanText(dadataItem?.value)
  const dadataLegalName =
    cleanText(dadataItem?.data?.name?.full_with_opf) ??
    cleanText(dadataItem?.unrestricted_value) ??
    cleanText(dadataItem?.value)

  const sources: CompanyEnrichmentSource[] = [
    dgis.source,
    dadata.source,
    {
      source: "crm",
      status: local.company || local.prospect ? "connected" : "not_found",
      title: "CRM и локальные лиды",
      note: local.company || local.prospect ? "Найдены совпадения в текущей базе CRM." : "Совпадений в текущей CRM не найдено."
    },
    websiteResult.source,
    {
      source: "fns",
      status: Number.isFinite(dadataEmployees) && dadataEmployees > 0 ? "connected" : "not_configured",
      title: "ФНС / среднесписочная численность",
      url: dadataItem?.data?.inn ? `https://pb.nalog.ru/search.html#quick-result?queryAll=${encodeURIComponent(dadataItem.data.inn)}` : null,
      note:
        Number.isFinite(dadataEmployees) && dadataEmployees > 0
          ? "Численность получена через DaData на базе сведений по организации."
          : "Для точной численности нужен ИНН и подключенный источник ФНС/DaData."
    },
    {
      source: "apify",
      status: process.env.APIFY_TOKEN ? "connected" : "not_configured",
      title: "Apify / открытые сайты",
      note: process.env.APIFY_TOKEN
        ? "Можно запускать server-side actor для сайта, вакансий и публичных страниц."
        : "APIFY_TOKEN не задан; actor-запуски не выполняются автоматически."
    },
    {
      source: "heuristic",
      status: "estimated",
      title: "Оценка людей для КП",
      note: officePeople.method
    }
  ]

  const profile = {
    name: cleanText(dgisItem?.name) ?? dadataName ?? local.prospect?.name ?? local.company?.name ?? input.company_name,
    legal_name: cleanText(dgisItem?.full_name) ?? dadataLegalName ?? local.prospect?.legal_name ?? null,
    inn: cleanText(dgisItem?.itin) ?? cleanText(dadataItem?.data?.inn) ?? input.inn ?? local.prospect?.inn ?? null,
    address,
    phone,
    email,
    website,
    dgis_id: cleanText(dgisItem?.id),
    dgis_url: dgisUrl,
    drive_minutes_from_production: driveMinutes,
    drive_minutes_source: dgisItem?.point ? "estimated_from_2gis_coordinates" : "estimated_from_address",
    branch_count: Number.isFinite(dadataBranchCount) && dadataBranchCount > 0 ? dadataBranchCount : null,
    employee_count_fns: Number.isFinite(dadataEmployees) && dadataEmployees > 0 ? dadataEmployees : null,
    employee_count_2gis: Number.isFinite(dgisEmployees) && dgisEmployees > 0 ? dgisEmployees : null,
    employee_count_website: Number.isFinite(websiteEmployees) && websiteEmployees > 0 ? websiteEmployees : null
  }
  const fnsUrl = profile.inn ? `https://pb.nalog.ru/search.html#quick-result?queryAll=${encodeURIComponent(profile.inn)}` : null
  const headcountEvidence = buildHeadcountEvidence({
    officePeople,
    fnsEmployees: profile.employee_count_fns,
    dgisEmployees: profile.employee_count_2gis,
    websiteEmployees: profile.employee_count_website,
    branchCount: profile.branch_count,
    segment: localSegment,
    fnsUrl,
    dgisUrl: dgis.source.url ?? null,
    websiteUrl: profile.website
  })

  return {
    profile,
    office_people: officePeople,
    headcount_evidence: headcountEvidence,
    proposal: buildCommercialProposalGuidance({
      officePeople,
      fnsEmployees: profile.employee_count_fns,
      dgisEmployees: profile.employee_count_2gis,
      websiteEmployees: profile.employee_count_website,
      branchCount: profile.branch_count
    }),
    sources,
    cache: {
      hit: false,
      updated_at: null,
      age_hours: null,
      ttl_hours: enrichmentTtlHours(options.ttlHours)
    }
  }
}

export function ensureCompanyEnrichmentSchema() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_enrichment_profiles (
      company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      dgis_id TEXT,
      dgis_url TEXT,
      inn TEXT,
      legal_name TEXT,
      address TEXT,
      website TEXT,
      phone TEXT,
      email TEXT,
      employee_count_fns INTEGER,
      employee_count_2gis INTEGER,
      employee_count_website INTEGER,
      office_people_min INTEGER NOT NULL,
      office_people_max INTEGER NOT NULL,
      office_people_confidence TEXT NOT NULL,
      office_people_method TEXT NOT NULL,
      office_people_daily_present INTEGER,
      likely_buyers_min INTEGER,
      likely_buyers_max INTEGER,
      recommended_portions INTEGER NOT NULL,
      recommended_sku INTEGER NOT NULL,
      estimated_launch_budget REAL NOT NULL,
      source_summary TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_enrichment_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      source_url TEXT,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  addColumnIfMissing("company_enrichment_profiles", "employee_count_website", "INTEGER")
  addColumnIfMissing("company_enrichment_profiles", "dgis_url", "TEXT")
  addColumnIfMissing("company_enrichment_profiles", "drive_minutes_from_production", "INTEGER")
  addColumnIfMissing("company_enrichment_profiles", "drive_minutes_source", "TEXT")
  addColumnIfMissing("company_enrichment_profiles", "office_people_daily_present", "INTEGER")
  addColumnIfMissing("company_enrichment_profiles", "likely_buyers_min", "INTEGER")
  addColumnIfMissing("company_enrichment_profiles", "likely_buyers_max", "INTEGER")
  addColumnIfMissing("companies", "address", "TEXT")
  addColumnIfMissing("companies", "dgis_url", "TEXT")
  addColumnIfMissing("companies", "drive_minutes_from_production", "INTEGER")
  addColumnIfMissing("companies", "drive_minutes_source", "TEXT")
  addColumnIfMissing("contacts", "address", "TEXT")
  addColumnIfMissing("contacts", "dgis_url", "TEXT")
  addColumnIfMissing("contacts", "drive_minutes_from_production", "INTEGER")
  addColumnIfMissing("contacts", "drive_minutes_source", "TEXT")
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  const db = getDb()
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export function saveCompanyEnrichment(companyId: number, enrichment: CompanyEnrichmentResult) {
  ensureCompanyEnrichmentSchema()
  const db = getDb()
  const dgisUrl = normalizeDgisUrl({
    dgisUrl: enrichment.profile.dgis_url,
    dgisId: enrichment.profile.dgis_id,
    name: enrichment.profile.name,
    address: enrichment.profile.address
  })
  const driveMinutes = normalizeDriveMinutes({
    value: enrichment.profile.drive_minutes_from_production,
    address: enrichment.profile.address,
    segment: null
  })
  const driveSource = enrichment.profile.drive_minutes_source ?? "estimated_from_enrichment_address"
  db.prepare(`
    INSERT INTO company_enrichment_profiles(
      company_id, dgis_id, dgis_url, inn, legal_name, address, website, phone, email,
      employee_count_fns, employee_count_2gis, employee_count_website, office_people_min, office_people_max,
      office_people_confidence, office_people_method, office_people_daily_present, likely_buyers_min, likely_buyers_max, recommended_portions, recommended_sku,
      estimated_launch_budget, drive_minutes_from_production, drive_minutes_source, source_summary, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(company_id) DO UPDATE SET
      dgis_id = excluded.dgis_id,
      dgis_url = excluded.dgis_url,
      inn = excluded.inn,
      legal_name = excluded.legal_name,
      address = excluded.address,
      website = excluded.website,
      phone = excluded.phone,
      email = excluded.email,
      employee_count_fns = excluded.employee_count_fns,
      employee_count_2gis = excluded.employee_count_2gis,
      employee_count_website = excluded.employee_count_website,
      office_people_min = excluded.office_people_min,
      office_people_max = excluded.office_people_max,
      office_people_confidence = excluded.office_people_confidence,
      office_people_method = excluded.office_people_method,
      office_people_daily_present = excluded.office_people_daily_present,
      likely_buyers_min = excluded.likely_buyers_min,
      likely_buyers_max = excluded.likely_buyers_max,
      recommended_portions = excluded.recommended_portions,
      recommended_sku = excluded.recommended_sku,
      estimated_launch_budget = excluded.estimated_launch_budget,
      drive_minutes_from_production = excluded.drive_minutes_from_production,
      drive_minutes_source = excluded.drive_minutes_source,
      source_summary = excluded.source_summary,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    companyId,
    enrichment.profile.dgis_id,
    dgisUrl,
    enrichment.profile.inn,
    enrichment.profile.legal_name,
    enrichment.profile.address,
    enrichment.profile.website,
    enrichment.profile.phone,
    enrichment.profile.email,
    enrichment.profile.employee_count_fns,
    enrichment.profile.employee_count_2gis,
    enrichment.profile.employee_count_website,
    enrichment.office_people.min,
    enrichment.office_people.max,
    enrichment.office_people.confidence,
    enrichment.office_people.method,
    enrichment.office_people.daily_present,
    enrichment.office_people.likely_buyers_min,
    enrichment.office_people.likely_buyers_max,
    enrichment.office_people.recommended_portions,
    enrichment.office_people.recommended_sku,
    enrichment.office_people.estimated_launch_budget,
    driveMinutes,
    driveSource,
    JSON.stringify(enrichment.sources)
  )

  db.prepare(`
    UPDATE companies
    SET
      address = COALESCE(address, ?),
      dgis_url = COALESCE(dgis_url, ?),
      drive_minutes_from_production = COALESCE(drive_minutes_from_production, ?),
      drive_minutes_source = COALESCE(drive_minutes_source, ?),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(enrichment.profile.address, dgisUrl, driveMinutes, driveSource, companyId)

  db.prepare(`
    UPDATE contacts
    SET
      address = COALESCE(address, ?),
      dgis_url = COALESCE(dgis_url, ?),
      drive_minutes_from_production = COALESCE(drive_minutes_from_production, ?),
      drive_minutes_source = COALESCE(drive_minutes_source, ?)
    WHERE company_id = ?
  `).run(enrichment.profile.address, dgisUrl, driveMinutes, driveSource, companyId)

  const insertSource = db.prepare(`
    INSERT INTO company_enrichment_sources(company_id, source, status, title, source_url, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const source of enrichment.sources) {
    insertSource.run(companyId, source.source, source.status, source.title, source.url ?? null, source.note)
  }
}
