import { assertWritableDb, getDb } from "@/lib/db"

export class CompanyEditError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export type CompanyEditInput = Record<string, unknown>

function hasOwn(input: CompanyEditInput, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key)
}

function readText(input: CompanyEditInput, key: string) {
  if (!hasOwn(input, key)) return undefined
  const value = input[key]
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  return trimmed || null
}

function patchText(input: CompanyEditInput, key: string, current: string | null, options?: { required?: boolean }) {
  const next = readText(input, key)
  const value = next === undefined ? current : next
  if (options?.required && !value) {
    throw new CompanyEditError(`${key} is required`)
  }
  return value
}

function patchInteger(input: CompanyEditInput, key: string, current: number | null, options?: { min?: number; max?: number }) {
  if (!hasOwn(input, key)) return current
  const value = input[key]
  if (value === null || value === undefined || String(value).trim() === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new CompanyEditError(`${key} must be a number`)
  }
  const rounded = Math.round(parsed)
  if (options?.min !== undefined && rounded < options.min) {
    throw new CompanyEditError(`${key} must be at least ${options.min}`)
  }
  if (options?.max !== undefined && rounded > options.max) {
    throw new CompanyEditError(`${key} must be at most ${options.max}`)
  }
  return rounded
}

function patchMoney(input: CompanyEditInput, key: string, current: number | null) {
  if (!hasOwn(input, key)) return current
  const value = input[key]
  if (value === null || value === undefined || String(value).trim() === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new CompanyEditError(`${key} must be a positive number`)
  }
  return Math.round(parsed)
}

function normalizeTelegramUsername(value: string | null) {
  if (!value) return null
  const direct = value
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^https?:\/\/telegram\.me\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    ?.trim()
  return direct || null
}

function normalizeTelegramUrl(url: string | null, username: string | null) {
  if (url) return url
  return username ? `https://t.me/${username}` : null
}

function preferredChannelFallback(input: {
  preferredChannel: string | null
  telegramUsername: string | null
  telegramUrl: string | null
  email: string | null
  phone: string | null
}) {
  if (input.preferredChannel) return input.preferredChannel
  if (input.telegramUsername || input.telegramUrl) return "telegram"
  if (input.email) return "email"
  if (input.phone) return "phone"
  return "site"
}

export function updateCompanyFromWebUi(companyId: number, input: CompanyEditInput) {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new CompanyEditError("Invalid company id")
  }

  assertWritableDb()
  const db = getDb()
  const company = db.prepare(`
    SELECT
      id,
      name,
      segment,
      region,
      city,
      district,
      address,
      dgis_url,
      drive_minutes_from_production,
      drive_minutes_source,
      website,
      public_contact_url,
      telegram_url,
      telegram_username,
      telegram_channel_type,
      telegram_contact_status,
      telegram_source_url,
      telegram_source_note,
      agent_contact_policy,
      agent_contact_readiness,
      agent_contact_next_step,
      lead_score,
      fit_reason,
      notes
    FROM companies
    WHERE id = ?
  `).get(companyId) as
    | {
        id: number
        name: string
        segment: string
        region: string
        city: string
        district: string | null
        address: string | null
        dgis_url: string | null
        drive_minutes_from_production: number | null
        drive_minutes_source: string | null
        website: string | null
        public_contact_url: string | null
        telegram_url: string | null
        telegram_username: string | null
        telegram_channel_type: string | null
        telegram_contact_status: string | null
        telegram_source_url: string | null
        telegram_source_note: string | null
        agent_contact_policy: string | null
        agent_contact_readiness: string | null
        agent_contact_next_step: string | null
        lead_score: number | null
        fit_reason: string | null
        notes: string | null
      }
    | undefined

  if (!company) {
    throw new CompanyEditError("Company not found", 404)
  }

  const companyName = patchText(input, "company_name", company.name, { required: true })!
  const segment = patchText(input, "segment", company.segment, { required: true })!
  const segmentExists = db.prepare("SELECT code FROM crm_segments WHERE code = ?").get(segment)
  if (!segmentExists) {
    throw new CompanyEditError("CRM segment not found", 404)
  }

  const region = patchText(input, "region", company.region, { required: true })!
  const city = patchText(input, "city", company.city, { required: true })!
  const district = patchText(input, "district", company.district)
  const address = patchText(input, "address", company.address)
  const dgisUrl = patchText(input, "dgis_url", company.dgis_url)
  const driveMinutes = patchInteger(input, "drive_minutes_from_production", company.drive_minutes_from_production, {
    min: 0,
    max: 240
  })
  const driveSource = patchText(input, "drive_minutes_source", company.drive_minutes_source)
  const website = patchText(input, "website", company.website)
  const publicContactUrl = patchText(input, "public_contact_url", company.public_contact_url)
  const telegramUsername = normalizeTelegramUsername(patchText(input, "telegram_username", company.telegram_username))
  const telegramUrl = normalizeTelegramUrl(patchText(input, "telegram_url", company.telegram_url), telegramUsername)
  const telegramContactStatus =
    patchText(input, "telegram_contact_status", company.telegram_contact_status ?? "not_found") ?? "not_found"
  const telegramSourceUrl = patchText(input, "telegram_source_url", company.telegram_source_url)
  const telegramSourceNote = patchText(input, "telegram_source_note", company.telegram_source_note)
  const telegramChannelType =
    patchText(input, "telegram_channel_type", company.telegram_channel_type ?? null) ??
    (telegramUrl || telegramUsername ? "public_channel" : "unknown")
  const agentContactPolicy =
    patchText(input, "agent_contact_policy", company.agent_contact_policy ?? null) ?? "manual_review_required"
  const agentContactReadiness =
    patchText(input, "agent_contact_readiness", company.agent_contact_readiness ?? null) ??
    (telegramUrl || telegramUsername ? "public_channel" : "none")
  const agentContactNextStep = patchText(input, "agent_contact_next_step", company.agent_contact_next_step)
  const leadScore = patchInteger(input, "lead_score", company.lead_score, { min: 0, max: 100 }) ?? 0
  const fitReason = patchText(input, "fit_reason", company.fit_reason)
  const notes = patchText(input, "notes", company.notes)

  const requestedDealId = patchInteger(input, "deal_id", null, { min: 1 })
  const deal = requestedDealId
    ? db.prepare("SELECT id, estimated_monthly_revenue, next_action, next_action_at FROM deals WHERE id = ? AND company_id = ?").get(
        requestedDealId,
        companyId
      )
    : db.prepare(`
        SELECT id, estimated_monthly_revenue, next_action, next_action_at
        FROM deals
        WHERE company_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `).get(companyId)

  if (!deal) {
    throw new CompanyEditError("Deal not found", 404)
  }

  const typedDeal = deal as {
    id: number
    estimated_monthly_revenue: number | null
    next_action: string | null
    next_action_at: string | null
  }
  const estimatedMonthlyRevenue = patchMoney(input, "estimated_monthly_revenue", typedDeal.estimated_monthly_revenue)
  const nextAction = patchText(input, "next_action", typedDeal.next_action)
  const nextActionAt = patchText(input, "next_action_at", typedDeal.next_action_at)

  const contact = db.prepare(`
    SELECT id, name, role, email, phone, telegram_handle, preferred_channel, notes
    FROM contacts
    WHERE company_id = ?
    ORDER BY id
    LIMIT 1
  `).get(companyId) as
    | {
        id: number
        name: string | null
        role: string | null
        email: string | null
        phone: string | null
        telegram_handle: string | null
        preferred_channel: string | null
        notes: string | null
      }
    | undefined

  const contactName = patchText(input, "contact_name", contact?.name ?? null)
  const contactRole = patchText(input, "contact_role", contact?.role ?? null)
  const contactEmail = patchText(input, "contact_email", contact?.email ?? null)
  const contactPhone = patchText(input, "contact_phone", contact?.phone ?? null)
  const contactTelegram = normalizeTelegramUsername(patchText(input, "contact_telegram_handle", contact?.telegram_handle ?? null))
  const preferredChannel = preferredChannelFallback({
    preferredChannel: patchText(input, "preferred_channel", contact?.preferred_channel ?? null),
    telegramUsername: contactTelegram ?? telegramUsername,
    telegramUrl,
    email: contactEmail,
    phone: contactPhone
  })
  const contactNotes = patchText(input, "contact_notes", contact?.notes ?? null)
  const shouldPersistContact = Boolean(
    contact || contactName || contactRole || contactEmail || contactPhone || contactTelegram || contactNotes
  )

  db.exec("BEGIN IMMEDIATE")
  try {
    const companyResult = db.prepare(`
      UPDATE companies
      SET
        name = ?,
        segment = ?,
        region = ?,
        city = ?,
        district = ?,
        address = ?,
        dgis_url = ?,
        drive_minutes_from_production = ?,
        drive_minutes_source = ?,
        website = ?,
        public_contact_url = ?,
        telegram_url = ?,
        telegram_username = ?,
        telegram_channel_type = ?,
        telegram_contact_status = ?,
        telegram_source_url = ?,
        telegram_source_note = ?,
        telegram_discovered_at = CASE
          WHEN ? IS NOT NULL AND telegram_discovered_at IS NULL THEN CURRENT_TIMESTAMP
          ELSE telegram_discovered_at
        END,
        agent_contact_policy = ?,
        agent_contact_readiness = ?,
        agent_contact_next_step = ?,
        lead_score = ?,
        fit_reason = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
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
      telegramChannelType,
      telegramContactStatus,
      telegramSourceUrl,
      telegramSourceNote,
      telegramUrl,
      agentContactPolicy,
      agentContactReadiness,
      agentContactNextStep,
      leadScore,
      fitReason,
      notes,
      companyId
    )

    const dealResult = db.prepare(`
      UPDATE deals
      SET
        estimated_monthly_revenue = ?,
        next_action = ?,
        next_action_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `).run(estimatedMonthlyRevenue, nextAction, nextActionAt, typedDeal.id, companyId)

    let contactId = contact?.id ?? null
    let contactChanges = 0
    if (shouldPersistContact && contact) {
      const result = db.prepare(`
        UPDATE contacts
        SET
          name = ?,
          role = ?,
          email = ?,
          phone = ?,
          telegram_handle = ?,
          preferred_channel = ?,
          notes = ?,
          address = ?,
          dgis_url = ?,
          drive_minutes_from_production = ?,
          drive_minutes_source = ?
        WHERE id = ? AND company_id = ?
      `).run(
        contactName,
        contactRole,
        contactEmail,
        contactPhone,
        contactTelegram ? `@${contactTelegram}` : null,
        preferredChannel,
        contactNotes,
        address,
        dgisUrl,
        driveMinutes,
        driveSource,
        contact.id,
        companyId
      )
      contactChanges = Number(result.changes)
    } else if (shouldPersistContact) {
      const result = db.prepare(`
        INSERT INTO contacts(
          company_id, name, role, email, phone, telegram_handle, preferred_channel, notes,
          address, dgis_url, drive_minutes_from_production, drive_minutes_source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyId,
        contactName,
        contactRole,
        contactEmail,
        contactPhone,
        contactTelegram ? `@${contactTelegram}` : null,
        preferredChannel,
        contactNotes,
        address,
        dgisUrl,
        driveMinutes,
        driveSource
      )
      contactId = Number(result.lastInsertRowid)
      contactChanges = Number(result.changes)
    }

    db.exec("COMMIT")

    return {
      ok: true,
      company_id: companyId,
      deal_id: typedDeal.id,
      contact_id: contactId,
      changes: {
        company: Number(companyResult.changes),
        deal: Number(dealResult.changes),
        contact: contactChanges
      }
    }
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}
