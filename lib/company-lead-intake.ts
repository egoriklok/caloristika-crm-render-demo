import { assertWritableDb, getDb } from "@/lib/db"
import {
  ensureCompanyEnrichmentSchema,
  lookupCompanyEnrichment,
  saveCompanyEnrichment,
  type CompanyEnrichmentResult
} from "@/lib/company-enrichment"
import { normalizeDgisUrl, normalizeDriveMinutes } from "@/lib/location-logistics"
import { createAiTask } from "@/lib/queries"

export type CompanyLeadIntakeInput = {
  company_name?: string
  inn?: string | null
  segment?: string | null
  region?: string | null
  city?: string | null
  district?: string | null
  website?: string | null
  address?: string | null
  dgis_url?: string | null
  telegram_url?: string | null
  telegram_username?: string | null
  telegram_channel_type?: string | null
  telegram_contact_status?: string | null
  telegram_source_url?: string | null
  telegram_source_note?: string | null
  agent_contact_policy?: string | null
  agent_contact_readiness?: string | null
  agent_contact_next_step?: string | null
  drive_minutes_from_production?: number | null
  drive_minutes_source?: string | null
  source?: string | null
  lead_score?: number | null
  fit_reason?: string | null
  notes?: string | null
  next_action?: string | null
  contact?: {
    name?: string | null
    role?: string | null
    email?: string | null
    phone?: string | null
    telegram_handle?: string | null
    preferred_channel?: string | null
  } | null
  dry_run?: boolean
  create_ai_task?: boolean
}

export type CompanyLeadIntakeResult = {
  ok: true
  dry_run: boolean
  company_id: number | null
  deal_id: number | null
  contact_id: number | null
  ai_task_id: number | null
  created_company: boolean
  created_deal: boolean
  next_action: string
  enrichment: CompanyEnrichmentResult
}

export class CompanyLeadIntakeError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = "CompanyLeadIntakeError"
  }
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function cleanTelegramUsername(value: unknown) {
  const cleaned = clean(value)
  if (!cleaned) return null
  const fromUrl = cleaned.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]{5,32})/i)?.[1]
  const raw = fromUrl ?? cleaned.replace(/^@/, "")
  return /^[A-Za-z0-9_]{5,32}$/.test(raw) ? raw : null
}

function normalizeTelegramUrl(value: unknown, username: string | null) {
  const cleaned = clean(value)
  if (cleaned && /^(https?:\/\/)?(?:t\.me|telegram\.me)\//i.test(cleaned)) {
    const url = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`
    return url.replace("telegram.me/", "t.me/")
  }
  return username ? `https://t.me/${username}` : null
}

function clampLeadScore(value: unknown, fallback: number) {
  const score = Number(value)
  if (!Number.isFinite(score)) return fallback
  return Math.max(1, Math.min(100, Math.round(score)))
}

function datePlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function priorityForScore(score: number) {
  if (score >= 85) return "high"
  if (score >= 68) return "medium"
  return "low"
}

function estimateMonthlyRevenue(enrichment: CompanyEnrichmentResult, score: number) {
  const launchBudget = Number(enrichment.office_people.estimated_launch_budget)
  const weeklyLaunchCadence = Number.isFinite(launchBudget) && launchBudget > 0 ? launchBudget * 4 : 0
  return Math.max(score * 2600, weeklyLaunchCadence, 30000)
}

function buildFitReason(input: CompanyLeadIntakeInput, enrichment: CompanyEnrichmentResult) {
  return (
    clean(input.fit_reason) ??
    `Автозаполнение CRM: офис ${enrichment.office_people.min}-${enrichment.office_people.max} человек, старт ${enrichment.office_people.recommended_portions} порций.`
  )
}

function buildNotes(input: CompanyLeadIntakeInput, enrichment: CompanyEnrichmentResult) {
  const driveMinutes = normalizeDriveMinutes({
    value: input.drive_minutes_from_production,
    address: clean(input.address) ?? enrichment.profile.address,
    district: input.district,
    city: input.city,
    segment: input.segment
  })
  return [
    clean(input.notes),
    enrichment.profile.inn ? `ИНН: ${enrichment.profile.inn}` : null,
    enrichment.profile.address ? `Адрес: ${enrichment.profile.address}` : null,
    `Логистика: ${driveMinutes} мин на авто от производства Lunch Up, Уральская улица, 13.`,
    `Оценка офиса: ${enrichment.office_people.min}-${enrichment.office_people.max} человек (${enrichment.office_people.confidence}).`,
    `Источник оценки: ${enrichment.office_people.method}`,
    clean(input.telegram_url) || clean(input.telegram_username) || clean(input.contact?.telegram_handle)
      ? "Telegram: публичный канал передан в карточку компании; перед первым сообщением нужна проверка источника."
      : null,
    "Карточка создана или обновлена через защищенный lead-intake API."
  ]
    .filter(Boolean)
    .join(" ")
}

function buildNextAction(input: CompanyLeadIntakeInput, enrichment: CompanyEnrichmentResult) {
  return (
    clean(input.next_action) ??
    `Проверить ЛПР и отправить КП на ${enrichment.office_people.recommended_portions} порций / ${enrichment.office_people.recommended_sku} SKU`
  )
}

function findExistingCompany(companyName: string, inn: string | null) {
  ensureCompanyEnrichmentSchema()
  const db = getDb()
  return db.prepare(`
    SELECT c.id
    FROM companies c
    LEFT JOIN company_enrichment_profiles ep ON ep.company_id = c.id
    WHERE lower(c.name) = lower(?)
       OR (? IS NOT NULL AND ep.inn = ?)
    ORDER BY c.id
    LIMIT 1
  `).get(companyName, inn, inn) as { id: number } | undefined
}

function findOpenDeal(companyId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT d.id
    FROM deals d
    JOIN pipeline_stages ps ON ps.id = d.stage_id
    WHERE d.company_id = ?
      AND ps.code NOT IN ('won', 'lost')
    ORDER BY d.id DESC
    LIMIT 1
  `).get(companyId) as { id: number } | undefined
}

function findExistingContact(companyId: number, contact: NonNullable<CompanyLeadIntakeInput["contact"]>) {
  const email = clean(contact.email)
  const phone = clean(contact.phone)
  const telegram = cleanTelegramUsername(contact.telegram_handle)
  const name = clean(contact.name)
  if (!email && !phone && !telegram && !name) return null
  const db = getDb()
  return db.prepare(`
    SELECT id
    FROM contacts
    WHERE company_id = ?
      AND (
        (? IS NOT NULL AND lower(COALESCE(email, '')) = lower(?))
        OR (? IS NOT NULL AND COALESCE(phone, '') = ?)
        OR (? IS NOT NULL AND lower(COALESCE(telegram_handle, '')) = lower(?))
        OR (? IS NOT NULL AND lower(COALESCE(name, '')) = lower(?))
      )
    LIMIT 1
  `).get(companyId, email, email, phone, phone, telegram ? `@${telegram}` : null, telegram ? `@${telegram}` : null, name, name) as { id: number } | undefined
}

function queueLeadIntakeTask(input: {
  companyId: number
  dealId: number | null
  companyName: string
  score: number
  enrichment: CompanyEnrichmentResult
}) {
  try {
    return createAiTask({
      agentCode: "lead_research",
      companyId: input.companyId,
      dealId: input.dealId,
      taskType: "lead_intake_enrichment",
      priority: input.score,
      prompt:
        `Проверить новую карточку ${input.companyName}: подтвердить публичные контакты, ИНН, адрес, оценку офиса ` +
        `${input.enrichment.office_people.min}-${input.enrichment.office_people.max} человек и подготовить КП под старт ` +
        `${input.enrichment.office_people.recommended_portions} порций / ${input.enrichment.office_people.recommended_sku} SKU.`
    })
  } catch {
    return null
  }
}

export async function createOrUpdateCompanyLead(input: CompanyLeadIntakeInput): Promise<CompanyLeadIntakeResult> {
  const companyName = clean(input.company_name)
  if (!companyName) {
    throw new CompanyLeadIntakeError("company_name is required")
  }

  const enrichment = await lookupCompanyEnrichment({
    company_name: companyName,
    inn: clean(input.inn),
    website: clean(input.website),
    address: clean(input.address),
    segment: clean(input.segment)
  })
  const nextAction = buildNextAction(input, enrichment)
  const score = clampLeadScore(input.lead_score, enrichment.office_people.confidence === "high" ? 82 : enrichment.office_people.confidence === "medium" ? 72 : 62)

  if (input.dry_run) {
    return {
      ok: true,
      dry_run: true,
      company_id: null,
      deal_id: null,
      contact_id: null,
      ai_task_id: null,
      created_company: false,
      created_deal: false,
      next_action: nextAction,
      enrichment
    }
  }

  assertWritableDb()
  ensureCompanyEnrichmentSchema()
  const db = getDb()
  const inn = enrichment.profile.inn ?? clean(input.inn)
  const website = clean(input.website) ?? enrichment.profile.website
  const source = clean(input.source) ?? "lead_intake_api"
  const segment = clean(input.segment) ?? "office_cluster"
  const region = clean(input.region) ?? "Санкт-Петербург и Ленинградская область"
  const city = clean(input.city) ?? "Санкт-Петербург"
  const district = clean(input.district)
  const address = clean(input.address) ?? enrichment.profile.address
  const dgisUrl = normalizeDgisUrl({
    dgisUrl: clean(input.dgis_url) ?? enrichment.profile.dgis_url,
    dgisId: enrichment.profile.dgis_id,
    name: companyName,
    city,
    address
  })
  const driveMinutes = normalizeDriveMinutes({
    value: input.drive_minutes_from_production,
    address,
    district: input.district,
    city,
    segment: input.segment
  })
  const driveSource = clean(input.drive_minutes_source) ?? (input.drive_minutes_from_production ? "input" : "estimated_from_address")
  const notes = buildNotes(input, enrichment)
  const fitReason = buildFitReason(input, enrichment)
  const publicContactUrl = website
  const telegramUsername =
    cleanTelegramUsername(input.telegram_username) ??
    cleanTelegramUsername(input.telegram_url) ??
    cleanTelegramUsername(input.contact?.telegram_handle)
  const telegramUrl = normalizeTelegramUrl(input.telegram_url, telegramUsername)
  const hasTelegramCandidate = Boolean(telegramUrl || telegramUsername)
  const telegramChannelTypeForUpdate = clean(input.telegram_channel_type) ?? (hasTelegramCandidate ? "public_channel" : null)
  const telegramContactStatusForUpdate = clean(input.telegram_contact_status) ?? (hasTelegramCandidate ? "public_found" : null)
  const telegramSourceUrlForUpdate = clean(input.telegram_source_url) ?? (hasTelegramCandidate ? dgisUrl ?? publicContactUrl : null)
  const telegramSourceNoteForUpdate =
    clean(input.telegram_source_note) ??
    (hasTelegramCandidate ? "Публичный Telegram передан через lead-intake; проверить источник перед первым сообщением." : null)
  const agentContactPolicyForUpdate = clean(input.agent_contact_policy) ?? (hasTelegramCandidate ? "manual_review_required" : null)
  const agentContactReadinessForUpdate = clean(input.agent_contact_readiness) ?? (hasTelegramCandidate ? "public_channel" : null)
  const agentContactNextStepForUpdate =
    clean(input.agent_contact_next_step) ??
    (hasTelegramCandidate
      ? "Проверить, что Telegram является публичным B2B-каналом компании; затем подготовить короткое сообщение от AI seller agent."
      : null)
  const telegramChannelTypeForInsert = telegramChannelTypeForUpdate ?? "unknown"
  const telegramContactStatusForInsert = telegramContactStatusForUpdate ?? "not_found"
  const telegramSourceNoteForInsert =
    telegramSourceNoteForUpdate ?? "Публичный Telegram компании пока не найден в CRM, 2ГИС или переданных открытых источниках."
  const agentContactPolicyForInsert = agentContactPolicyForUpdate ?? "manual_review_required"
  const agentContactReadinessForInsert = agentContactReadinessForUpdate ?? "none"
  const agentContactNextStepForInsert =
    agentContactNextStepForUpdate ?? "Проверить официальный сайт, 2ГИС и публичные соцсети; не писать userbot без подтвержденного B2B-канала."
  const stage = db.prepare("SELECT id FROM pipeline_stages WHERE code = 'lead'").get() as { id: number } | undefined
  if (!stage) {
    throw new CompanyLeadIntakeError("pipeline stage lead is missing", 500)
  }

  let companyId: number
  let dealId: number | null = null
  let contactId: number | null = null
  let createdCompany = false
  let createdDeal = false

  db.exec("BEGIN IMMEDIATE")
  try {
    const existing = findExistingCompany(companyName, inn)
    if (existing) {
      companyId = existing.id
      db.prepare(`
        UPDATE companies
        SET
          website = COALESCE(?, website),
          public_contact_url = COALESCE(?, public_contact_url),
          telegram_url = COALESCE(?, telegram_url),
          telegram_username = COALESCE(?, telegram_username),
          telegram_channel_type = COALESCE(?, telegram_channel_type),
          telegram_contact_status = COALESCE(?, telegram_contact_status),
          telegram_source_url = COALESCE(?, telegram_source_url),
          telegram_source_note = COALESCE(?, telegram_source_note),
          telegram_discovered_at = CASE
            WHEN ? IS NOT NULL AND telegram_discovered_at IS NULL THEN CURRENT_TIMESTAMP
            ELSE telegram_discovered_at
          END,
          agent_contact_policy = COALESCE(?, agent_contact_policy),
          agent_contact_readiness = COALESCE(?, agent_contact_readiness),
          agent_contact_next_step = COALESCE(?, agent_contact_next_step),
          address = COALESCE(?, address),
          dgis_url = COALESCE(?, dgis_url),
          drive_minutes_from_production = COALESCE(?, drive_minutes_from_production),
          drive_minutes_source = COALESCE(?, drive_minutes_source),
          lead_score = max(lead_score, ?),
          fit_reason = COALESCE(fit_reason, ?),
          notes = CASE
            WHEN COALESCE(notes, '') = '' THEN ?
            WHEN instr(notes, ?) > 0 THEN notes
            ELSE notes || ' ' || ?
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        website,
        publicContactUrl,
        telegramUrl,
        telegramUsername,
        telegramChannelTypeForUpdate,
        telegramContactStatusForUpdate,
        telegramSourceUrlForUpdate,
        telegramSourceNoteForUpdate,
        telegramUrl,
        agentContactPolicyForUpdate,
        agentContactReadinessForUpdate,
        agentContactNextStepForUpdate,
        address,
        dgisUrl,
        driveMinutes,
        driveSource,
        score,
        fitReason,
        notes,
        notes,
        notes,
        companyId
      )
    } else {
      companyId = Number(
        db.prepare(`
          INSERT INTO companies(
            name, segment, region, city, district, address, dgis_url, drive_minutes_from_production, drive_minutes_source,
            website, public_contact_url, telegram_url, telegram_username, telegram_channel_type, telegram_contact_status,
            telegram_source_url, telegram_source_note, telegram_discovered_at, agent_contact_policy, agent_contact_readiness,
            agent_contact_next_step, source, lead_status, lead_score, fit_reason, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?, ?, ?, 'lead', ?, ?, ?)
        `).run(
          companyName,
          segment,
          region,
          city,
          district,
          address,
          dgisUrl,
          driveMinutes,
          driveSource,
          website,
          publicContactUrl,
          telegramUrl,
          telegramUsername,
          telegramChannelTypeForInsert,
          telegramContactStatusForInsert,
          telegramSourceUrlForUpdate,
          telegramSourceNoteForInsert,
          telegramUrl,
          agentContactPolicyForInsert,
          agentContactReadinessForInsert,
          agentContactNextStepForInsert,
          source,
          score,
          fitReason,
          notes
        ).lastInsertRowid
      )
      createdCompany = true
    }

    const contact = input.contact ?? null
    if (contact && (clean(contact.name) || clean(contact.email) || clean(contact.phone) || cleanTelegramUsername(contact.telegram_handle))) {
      const existingContact = findExistingContact(companyId, contact)
      if (existingContact) {
        contactId = existingContact.id
      } else {
        contactId = Number(
          db.prepare(`
            INSERT INTO contacts(
              company_id, name, role, email, phone, address, dgis_url, drive_minutes_from_production, drive_minutes_source,
              telegram_handle, preferred_channel, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Контакт добавлен через защищенный lead-intake API; перед массовым outreach подтвердить актуальность.')
          `).run(
            companyId,
            clean(contact.name) ?? "Публичный B2B-канал",
            clean(contact.role) ?? "Закупки / офис-менеджер / общий контакт",
            clean(contact.email),
            clean(contact.phone),
            address,
            dgisUrl,
            driveMinutes,
            driveSource,
            cleanTelegramUsername(contact.telegram_handle) ? `@${cleanTelegramUsername(contact.telegram_handle)}` : null,
            clean(contact.preferred_channel) ?? (cleanTelegramUsername(contact.telegram_handle) ? "telegram" : "site")
          ).lastInsertRowid
        )
      }
    }

    const existingDeal = findOpenDeal(companyId)
    if (existingDeal) {
      dealId = existingDeal.id
    } else {
      dealId = Number(
        db.prepare(`
          INSERT INTO deals(company_id, stage_id, title, estimated_monthly_revenue, expected_close_date, priority, next_action, next_action_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          companyId,
          stage.id,
          `Запуск Lunch Up: ${companyName}`,
          estimateMonthlyRevenue(enrichment, score),
          datePlus(score >= 85 ? 21 : 35),
          priorityForScore(score),
          nextAction,
          datePlus(score >= 85 ? 2 : 5)
        ).lastInsertRowid
      )
      createdDeal = true
      db.prepare(`
        INSERT INTO activities(company_id, deal_id, type, subject, notes, due_at)
        VALUES (?, ?, 'next_step', 'Проверить карточку и подготовить КП', ?, ?)
      `).run(companyId, dealId, notes, datePlus(score >= 85 ? 2 : 5))
    }

    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }

  saveCompanyEnrichment(companyId!, enrichment)
  const aiTaskId =
    input.create_ai_task === false
      ? null
      : queueLeadIntakeTask({
          companyId: companyId!,
          dealId,
          companyName,
          score,
          enrichment
        })

  return {
    ok: true,
    dry_run: false,
    company_id: companyId!,
    deal_id: dealId,
    contact_id: contactId,
    ai_task_id: aiTaskId,
    created_company: createdCompany,
    created_deal: createdDeal,
    next_action: nextAction,
    enrichment
  }
}
