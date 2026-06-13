import {
  CompanyLeadIntakeError,
  createOrUpdateCompanyLead,
  type CompanyLeadIntakeInput,
  type CompanyLeadIntakeResult
} from "@/lib/company-lead-intake"
import { normalizeDgisUrl, normalizeDriveMinutes } from "@/lib/location-logistics"

type DgisContact = {
  type?: string
  name?: string
  text?: string
  value?: string
  url?: string
  link?: string
}

type DgisLeadItem = {
  id?: string
  name?: string
  full_name?: string
  address_name?: string
  employees_org_count?: number | string
  itin?: string
  contact_groups?: Array<{ contacts?: DgisContact[] }>
  links?: DgisContact[]
  point?: { lat?: number; lon?: number }
  rubrics?: Array<{ name?: string }>
}

export type DgisLeadSearchInput = {
  query?: string
  segment?: string | null
  city?: string | null
  district?: string | null
  limit?: number
  dry_run?: boolean
  dryRun?: boolean
  confirm_import?: boolean
  confirmImport?: boolean
  create_ai_task?: boolean
  createAiTask?: boolean
}

export type DgisLeadCandidate = {
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
  suggested_payload: CompanyLeadIntakeInput
}

export type DgisLeadSearchResult = {
  ok: true
  dry_run: boolean
  imported: boolean
  query: string
  city: string
  segment: string
  limit: number
  total: number | null
  candidates: DgisLeadCandidate[]
  imports: Array<{
    candidate: DgisLeadCandidate
    result: CompanyLeadIntakeResult | null
    error: string | null
  }>
}

export class DgisLeadSearchError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "DgisLeadSearchError"
    this.status = status
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 10
  return Math.max(1, Math.min(10, Math.round(parsed)))
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

function normalizePhone(value: string | null) {
  if (!value) return null
  return value.replace(/\s+/g, " ").trim()
}

function normalizeTelegramUrl(value: string | null) {
  const cleaned = cleanText(value)
  if (!cleaned) return null
  const match = cleaned.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_+][A-Za-z0-9_/?=-]*)/i)
  if (match) {
    const path = match[1].replace(/^s\//, "")
    return `https://t.me/${path}`.replace(/\/+$/, "")
  }
  const handle = cleaned.match(/(^|\s)@([A-Za-z0-9_]{5,32})(\s|$)/)?.[2]
  return handle ? `https://t.me/${handle}` : null
}

function telegramUsernameFromUrl(value: string | null) {
  const url = normalizeTelegramUrl(value)
  if (!url) return null
  const username = url.match(/t\.me\/([A-Za-z0-9_]{5,32})(?:$|[/?#])/i)?.[1] ?? null
  return username && !username.startsWith("+") ? username : null
}

function telegramChannelType(value: string | null) {
  const cleaned = cleanText(value)?.toLowerCase() ?? ""
  if (cleaned.includes("joinchat") || /t\.me\/\+/.test(cleaned)) return "invite_link"
  if (/bot\b|бот/.test(cleaned)) return "company_bot"
  if (/chat|group|чат|групп/.test(cleaned)) return "public_group"
  return "public_channel"
}

function firstContact(item: DgisLeadItem, patterns: RegExp[]) {
  const contacts = item.contact_groups?.flatMap((group) => group.contacts ?? []) ?? []
  for (const contact of contacts) {
    const joined = [contact.type, contact.name, contact.text, contact.value, contact.url, contact.link].filter(Boolean).join(" ")
    if (patterns.some((pattern) => pattern.test(joined))) {
      return cleanText(contact.value) ?? cleanText(contact.text) ?? cleanText(contact.url) ?? cleanText(contact.link)
    }
  }
  return null
}

function firstTelegramChannel(item: DgisLeadItem) {
  const contacts = item.contact_groups?.flatMap((group) => group.contacts ?? []) ?? []
  const candidates = [...contacts, ...(item.links ?? [])]
  for (const contact of candidates) {
    const joined = [contact.type, contact.name, contact.text, contact.value, contact.url, contact.link].filter(Boolean).join(" ")
    if (!/(telegram|телеграм|t\.me|telegram\.me|^@)/i.test(joined)) continue
    const url = normalizeTelegramUrl(joined)
    const username = telegramUsernameFromUrl(url)
    if (url || username) {
      return {
        url,
        username,
        channelType: telegramChannelType(joined),
        sourceNote: "Telegram найден в публичных полях ответа 2ГИС; перед первым сообщением нужна ручная проверка карточки."
      }
    }
  }
  return null
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

function defaultQuery(input: DgisLeadSearchInput) {
  const segment = cleanText(input.segment)
  if (/office|офис|business|бц|коворк/i.test(segment ?? "")) return "бизнес центр офисы"
  if (/vending|micro|вендинг|микромаркет/i.test(segment ?? "")) return "вендинг микромаркет офис"
  if (/clinic|health|мед|клиник/i.test(segment ?? "")) return "клиника медицинский центр"
  if (/bath|spa|бан|саун|терм/i.test(segment ?? "")) return "банный комплекс сауна SPA термы"
  if (/склад|логист|производ|смен/i.test(segment ?? "")) return "склад производство логистика"
  if (/campus|education|универс|образ/i.test(segment ?? "")) return "университет кампус колледж"
  if (/жк|апарт|resident|residential/i.test(segment ?? "")) return "апарт отель жилой комплекс"
  if (/ло|ленинград|anchor|якор/i.test(segment ?? "")) return "производство склад офис ленинградская область"
  if (/rail|uvenco|оператор|партнер/i.test(segment ?? "")) return "вендинговый оператор кофепоинт микромаркет"
  if (/retail|store|ритейл|магазин|азс/i.test(segment ?? "")) return "магазин готовая еда"
  if (/horeca|coffee|кафе|кофе|пекар/i.test(segment ?? "")) return "кафе пекарня кофе"
  return "бизнес центр Санкт-Петербург"
}

function sourceUrl(name: string, city: string) {
  return `https://2gis.ru/spb/search/${encodeURIComponent(`${name} ${city}`)}`
}

function leadScore(item: DgisLeadItem, employees: number | null) {
  let score = employees && employees >= 80 ? 84 : employees && employees >= 30 ? 76 : 68
  if (firstContact(item, [/phone|тел/i])) score += 4
  if (firstContact(item, [/mail|email|почт/i])) score += 4
  if (firstContact(item, [/site|url|web|сайт/i])) score += 3
  if (firstTelegramChannel(item)) score += 3
  return Math.max(1, Math.min(100, score))
}

function candidateFromItem(item: DgisLeadItem, input: { city: string; segment: string; sourceQuery: string }): DgisLeadCandidate | null {
  const name = cleanText(item.name) ?? cleanText(item.full_name)
  if (!name) return null
  const employees = Number(item.employees_org_count)
  const employeesOrgCount = Number.isFinite(employees) && employees > 0 ? employees : null
  const phone = normalizePhone(firstContact(item, [/phone|тел/i]))
  const email = firstContact(item, [/mail|email|почт/i])
  const website = normalizeWebsiteUrl(firstContact(item, [/site|url|web|сайт/i]))
  const telegram = firstTelegramChannel(item)
  const address = cleanText(item.address_name)
  const inn = cleanText(item.itin)
  const source = normalizeDgisUrl({ dgisId: cleanText(item.id), name, city: input.city, address }) ?? sourceUrl(name, input.city)
  const driveMinutes = normalizeDriveMinutes({
    latitude: item.point?.lat,
    longitude: item.point?.lon,
    address,
    city: input.city,
    segment: input.segment
  })
  const score = leadScore(item, employeesOrgCount)
  const suggestedPayload: CompanyLeadIntakeInput = {
    company_name: name,
    inn,
    segment: input.segment,
    region: "Санкт-Петербург и Ленинградская область",
    city: input.city,
    address,
    dgis_url: source,
    drive_minutes_from_production: driveMinutes,
    drive_minutes_source: item.point ? "estimated_from_2gis_coordinates" : "estimated_from_2gis_address",
    website,
    telegram_url: telegram?.url ?? null,
    telegram_username: telegram?.username ?? null,
    telegram_channel_type: telegram?.channelType ?? null,
    telegram_contact_status: telegram ? "public_found" : "not_found",
    telegram_source_url: telegram ? source : null,
    telegram_source_note: telegram?.sourceNote ?? "2ГИС не вернул публичный Telegram-канал в карточке кандидата.",
    agent_contact_policy: "manual_review_required",
    agent_contact_readiness: telegram ? "public_channel" : "none",
    agent_contact_next_step: telegram
      ? "Проверить публичный Telegram-канал компании, затем подготовить короткое B2B-сообщение от AI seller agent."
      : "Проверить официальный сайт и 2ГИС вручную; не использовать userbot без подтвержденного B2B-канала.",
    source: "2gis_lead_search",
    lead_score: score,
    fit_reason: employeesOrgCount
      ? `2ГИС: ${employeesOrgCount} сотрудников/признак размера организации; подходит для КП под офисный спрос.`
      : "2ГИС lead candidate; численность нужно подтвердить через enrichment и звонок.",
    notes: `Найдено через server-side 2ГИС Places API по запросу: ${input.sourceQuery}. Источник: ${source}`,
    next_action: "Проверить ЛПР, подтвердить фактическую посещаемость офиса и подготовить КП Lunch Up.",
    create_ai_task: true,
    contact: phone || email || telegram?.username
      ? {
          name: "Публичный B2B-канал",
          role: "Общий контакт / офис / закупки",
          phone,
          email,
          telegram_handle: telegram?.username ? `@${telegram.username}` : null,
          preferred_channel: telegram?.username ? "telegram" : email ? "email" : "phone"
        }
      : null
  }

  return {
    dgis_id: cleanText(item.id),
    name,
    legal_name: cleanText(item.full_name),
    address,
    phone,
    email,
    website,
    telegram_url: telegram?.url ?? null,
    telegram_username: telegram?.username ?? null,
    telegram_contact_status: telegram ? "public_found" : "not_found",
    agent_contact_readiness: telegram ? "public_channel" : "none",
    inn,
    employees_org_count: employeesOrgCount,
    rubrics: (item.rubrics ?? []).map((rubric) => cleanText(rubric.name)).filter(Boolean) as string[],
    source_url: source,
    drive_minutes_from_production: driveMinutes,
    suggested_payload: suggestedPayload
  }
}

export async function searchDgisLeadCandidates(input: DgisLeadSearchInput = {}): Promise<DgisLeadSearchResult> {
  const key = process.env.DGIS_API_KEY ?? process.env.TWO_GIS_API_KEY
  if (!key) {
    throw new DgisLeadSearchError("DGIS_API_KEY is required for 2GIS lead search", 424)
  }

  const limit = normalizeLimit(input.limit)
  const city = cleanText(input.city) ?? "Санкт-Петербург"
  const segment = cleanText(input.segment) ?? "office_cluster"
  const query = [cleanText(input.query) ?? defaultQuery(input), city, cleanText(input.district)].filter(Boolean).join(" ")
  const url = new URL(apiBaseUrl(process.env.DGIS_API_BASE_URL, "https://catalog.api.2gis.com/3.0/items"))
  url.searchParams.set("q", query)
  url.searchParams.set("key", key)
  url.searchParams.set("page_size", String(limit))
  url.searchParams.set("fields", "items.point,items.contact_groups,items.rubrics,items.address_name,items.full_name,items.links,items.employees_org_count,items.itin")

  const response = await fetch(url, { cache: "no-store" })
  const payload = (await response.json()) as { result?: { items?: DgisLeadItem[]; total?: number }; meta?: { message?: string } }
  if (!response.ok) {
    throw new DgisLeadSearchError(`2GIS returned HTTP ${response.status}: ${payload.meta?.message ?? "unknown error"}`, 502)
  }

  const candidates = (payload.result?.items ?? [])
    .map((item) => candidateFromItem(item, { city, segment, sourceQuery: query }))
    .filter(Boolean) as DgisLeadCandidate[]
  const dryRun = input.dry_run !== false && input.dryRun !== false
  const shouldImport = !dryRun && (input.confirm_import === true || input.confirmImport === true)
  const imports: DgisLeadSearchResult["imports"] = []

  if (shouldImport) {
    for (const candidate of candidates) {
      try {
        const result = await createOrUpdateCompanyLead({
          ...candidate.suggested_payload,
          dry_run: false,
          create_ai_task: input.create_ai_task ?? input.createAiTask ?? true
        })
        imports.push({ candidate, result, error: null })
      } catch (error) {
        const message = error instanceof CompanyLeadIntakeError || error instanceof Error ? error.message : "Unknown import error"
        imports.push({ candidate, result: null, error: message })
      }
    }
  }

  return {
    ok: true,
    dry_run: !shouldImport,
    imported: shouldImport,
    query,
    city,
    segment,
    limit,
    total: payload.result?.total ?? null,
    candidates,
    imports
  }
}
