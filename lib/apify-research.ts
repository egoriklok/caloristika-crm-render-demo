import { getDb } from "@/lib/db"
import { recordIntegrationEvent } from "@/lib/external-integrations"
import { createAiTask } from "@/lib/queries"

export type ApifyCompanyResearchInput = {
  company_id?: number | null
  company_name?: string | null
  inn?: string | null
  website?: string | null
  address?: string | null
  segment?: string | null
  actor_id?: string | null
  actor_input?: Record<string, unknown> | null
  dry_run?: boolean
  confirm_run?: boolean
  max_items?: number | null
}

type CompanyResearchRow = {
  id: number
  name: string
  segment: string
  region: string
  city: string
  district: string | null
  website: string | null
  public_contact_url: string | null
  lead_score: number
  fit_reason: string | null
  contact_email: string | null
  contact_phone: string | null
  enrichment_inn: string | null
  enrichment_address: string | null
  enrichment_website: string | null
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeActorId(value: string) {
  return value.trim().replace("/", "~")
}

function normalizeUrl(value: string | null | undefined) {
  const cleaned = clean(value)
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

function findCompany(input: ApifyCompanyResearchInput) {
  const db = getDb()
  if (Number.isInteger(input.company_id) && Number(input.company_id) > 0) {
    const companyId = Number(input.company_id)
    return db.prepare(`
      SELECT
        c.id,
        c.name,
        c.segment,
        c.region,
        c.city,
        c.district,
        c.website,
        c.public_contact_url,
        c.lead_score,
        c.fit_reason,
        ct.email AS contact_email,
        ct.phone AS contact_phone,
        ep.inn AS enrichment_inn,
        ep.address AS enrichment_address,
        ep.website AS enrichment_website
      FROM companies c
      LEFT JOIN contacts ct ON ct.company_id = c.id
      LEFT JOIN company_enrichment_profiles ep ON ep.company_id = c.id
      WHERE c.id = ?
      ORDER BY ct.id
      LIMIT 1
    `).get(companyId) as CompanyResearchRow | undefined
  }

  const companyName = clean(input.company_name)
  if (!companyName) return null
  return db.prepare(`
    SELECT
      c.id,
      c.name,
      c.segment,
      c.region,
      c.city,
      c.district,
      c.website,
      c.public_contact_url,
      c.lead_score,
      c.fit_reason,
      ct.email AS contact_email,
      ct.phone AS contact_phone,
      ep.inn AS enrichment_inn,
      ep.address AS enrichment_address,
      ep.website AS enrichment_website
    FROM companies c
    LEFT JOIN contacts ct ON ct.company_id = c.id
    LEFT JOIN company_enrichment_profiles ep ON ep.company_id = c.id
    WHERE lower(c.name) = lower(?)
       OR lower(c.name) LIKE lower(?)
       OR (? IS NOT NULL AND ep.inn = ?)
    ORDER BY c.lead_score DESC, c.id
    LIMIT 1
  `).get(companyName, `%${companyName}%`, clean(input.inn), clean(input.inn)) as CompanyResearchRow | undefined
}

function uniqueUrls(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(normalizeUrl).filter(Boolean) as string[]))
}

export function buildApifyCompanyResearchPayload(input: ApifyCompanyResearchInput) {
  const company = findCompany(input)
  const companyName = clean(input.company_name) ?? company?.name
  if (!companyName) {
    throw new Error("company_name or company_id is required")
  }

  const website = normalizeUrl(input.website) ?? normalizeUrl(company?.enrichment_website) ?? normalizeUrl(company?.website)
  const publicContactUrl = normalizeUrl(company?.public_contact_url)
  const startUrls = uniqueUrls([website, publicContactUrl])
  const inn = clean(input.inn) ?? company?.enrichment_inn ?? null
  const address = clean(input.address) ?? company?.enrichment_address ?? null
  const segment = clean(input.segment) ?? company?.segment ?? "office_cluster"
  const maxItems = Math.max(1, Math.min(50, Math.round(Number(input.max_items ?? 10))))

  const defaultInput = {
    schema: "lunch_up.crm.apify_company_research.v1",
    task: "public_b2b_company_research",
    region_scope: "Санкт-Петербург и Ленинградская область",
    max_items: maxItems,
    company: {
      id: company?.id ?? null,
      name: companyName,
      inn,
      segment,
      address,
      city: company?.city ?? "Санкт-Петербург",
      district: company?.district ?? null,
      website,
      public_contact_url: publicContactUrl,
      current_contact_email: company?.contact_email ?? null,
      current_contact_phone: company?.contact_phone ?? null
    },
    search_terms: [
      `${companyName} официальный сайт`,
      `${companyName} контакты`,
      inn ? `${inn} ФНС` : null,
      address ? `${companyName} ${address}` : null,
      `${companyName} Санкт-Петербург сотрудники офис`
    ].filter(Boolean),
    startUrls: startUrls.map((url) => ({ url })),
    extraction_goals: [
      "Подтвердить официальный сайт и публичные B2B-контакты.",
      "Найти открытые признаки размера офиса: команда, вакансии, филиалы, арендаторы, адрес.",
      "Вернуть источники ссылками и не утверждать личные данные сотрудников.",
      "Подготовить черновик enrichment для менеджера Lunch Up, без автозаписи в сделки."
    ],
    guardrails: [
      "Только публичные источники.",
      "Не обходить авторизацию и paywall.",
      "Не собирать личные контакты сотрудников без правового основания.",
      "Не менять CRM напрямую; результат должен пройти менеджера."
    ]
  }

  return {
    actor_id: clean(input.actor_id) ?? clean(process.env.APIFY_DEFAULT_RESEARCH_ACTOR_ID),
    company_id: company?.id ?? null,
    company_name: companyName,
    start_urls: startUrls,
    actor_input: input.actor_input && Object.keys(input.actor_input).length ? input.actor_input : defaultInput
  }
}

export async function runApifyCompanyResearch(input: ApifyCompanyResearchInput) {
  const payload = buildApifyCompanyResearchPayload(input)
  const token = process.env.APIFY_TOKEN?.trim()
  const actorId = payload.actor_id

  if (input.dry_run !== false || !input.confirm_run) {
    return {
      ok: true,
      status: "dry_run",
      configured: Boolean(token && actorId),
      message: "Apify actor run was not started. Set dry_run=false and confirm_run=true to execute.",
      payload
    }
  }

  if (!token) {
    return {
      ok: false,
      status: "not_configured",
      message: "APIFY_TOKEN is not configured.",
      payload
    }
  }

  if (!actorId) {
    return {
      ok: false,
      status: "not_configured",
      message: "actor_id or APIFY_DEFAULT_RESEARCH_ACTOR_ID is required.",
      payload
    }
  }

  const normalizedActorId = normalizeActorId(actorId)
  const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(normalizedActorId)}/runs`
  const requestForAudit = {
    actor_id: actorId,
    company_id: payload.company_id,
    company_name: payload.company_name,
    actor_input: payload.actor_input
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload.actor_input)
    })
    const responseText = await response.text()
    let responsePayload: unknown = responseText
    try {
      responsePayload = responseText ? JSON.parse(responseText) : null
    } catch {
      responsePayload = responseText
    }

    const run = (responsePayload as { data?: { id?: string; status?: string; defaultDatasetId?: string } })?.data
    const eventId = recordIntegrationEvent({
      orderId: null,
      provider: "apify_actor_research",
      status: response.ok ? "started" : "failed",
      endpoint,
      request: requestForAudit,
      responseStatus: response.status,
      response: responsePayload,
      error: response.ok ? null : `Apify returned ${response.status}`
    })

    let aiTaskId: number | null = null
    if (response.ok) {
      aiTaskId = createAiTask({
        agentCode: "apify_actor_researcher",
        companyId: payload.company_id,
        taskType: "apify_actor_result_review",
        priority: 78,
        prompt:
          `Проверить результат Apify actor ${actorId} для ${payload.company_name}. ` +
          `Run ID: ${run?.id ?? "unknown"}. Dataset: ${run?.defaultDatasetId ?? "unknown"}. ` +
          "Сверить публичные источники, выделить только B2B-контакты и предложить enrichment без автозаписи в сделки."
      })
    }

    return {
      ok: response.ok,
      status: response.ok ? "started" : "failed",
      integration_event_id: eventId,
      ai_task_id: aiTaskId,
      actor_id: actorId,
      run_id: run?.id ?? null,
      run_status: run?.status ?? null,
      default_dataset_id: run?.defaultDatasetId ?? null,
      response_status: response.status
    }
  } catch (error) {
    const eventId = recordIntegrationEvent({
      orderId: null,
      provider: "apify_actor_research",
      status: "failed",
      endpoint,
      request: requestForAudit,
      error: error instanceof Error ? error.message : "Unknown Apify error"
    })
    return {
      ok: false,
      status: "failed",
      integration_event_id: eventId,
      error: error instanceof Error ? error.message : "Unknown Apify error"
    }
  }
}
