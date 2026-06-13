import { getDb } from "@/lib/db"
import { createBotOrder, type BotOrderPayload } from "@/lib/bot-orders"
import { lookupCompanyEnrichment, saveCompanyEnrichment, type CompanyEnrichmentResult } from "@/lib/company-enrichment"
import {
  authenticateCustomerPortal,
  customerPortalDisplayName,
  type CustomerPortalAuth
} from "@/lib/customer-portal-auth"
import { exportOrderToExternalWebhook } from "@/lib/external-integrations"
import {
  ensureCustomerPortalAgents,
  ensureInventorySchema,
  getInventorySummary,
  recordCustomerIdentity
} from "@/lib/inventory"
import { normalizeDgisUrl, normalizeDriveMinutes } from "@/lib/location-logistics"
import { sendCustomerOrderStatusMessage, sendManagerOrderNotification } from "@/lib/telegram-bot"
import { createAiTask } from "@/lib/queries"

export type MiniappCustomerProfile = {
  company_name?: string
  inn?: string
  contact_name?: string
  role?: string
  phone?: string
  email?: string
  delivery_address?: string
  website?: string
  office_people?: number
}

export type MiniappSessionInput = {
  initData?: string | null
  email?: string | null
  accessCode?: string | null
  profile?: MiniappCustomerProfile
}

export type MiniappOrderHistoryItem = {
  product_id: number
  name: string
  category: string
  quantity: number
  unit_price: number
  line_total: number
}

export type MiniappOrderHistory = {
  id: number
  company_name: string | null
  status: string
  delivery_date: string | null
  payment_date: string | null
  total_amount: number
  manager_comment: string | null
  created_at: string
  items: MiniappOrderHistoryItem[]
}

export type MiniappSavedProfile = {
  company_name: string | null
  inn: string | null
  contact_name: string | null
  role: string | null
  phone: string | null
  email: string | null
  delivery_address: string | null
  website: string | null
  office_people: number | null
}

export type CustomerPortalInsights = {
  orders_count: number
  total_revenue: number
  sku_count: number
  last_order_at: string | null
  top_products: Array<{
    product_id: number
    name: string
    quantity: number
    revenue: number
  }>
  inventory: ReturnType<typeof getInventorySummary>
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function ensureMiniappCustomerProfileSchema() {
  const db = getDb()
  ensureInventorySchema()
  ensureCustomerPortalAgents()
  db.exec(`
    CREATE TABLE IF NOT EXISTS miniapp_customer_profiles (
      telegram_chat_id TEXT PRIMARY KEY,
      company_name TEXT,
      inn TEXT,
      contact_name TEXT,
      role TEXT,
      phone TEXT,
      email TEXT,
      delivery_address TEXT,
      website TEXT,
      office_people INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

function upsertMiniappCustomerProfile(chatId: string, profile: MiniappCustomerProfile) {
  ensureMiniappCustomerProfileSchema()
  const officePeople = Number(profile.office_people)
  const values = {
    company_name: clean(profile.company_name),
    inn: clean(profile.inn),
    contact_name: clean(profile.contact_name),
    role: clean(profile.role),
    phone: clean(profile.phone),
    email: clean(profile.email),
    delivery_address: clean(profile.delivery_address),
    website: clean(profile.website),
    office_people: Number.isFinite(officePeople) && officePeople > 0 ? Math.round(officePeople) : null
  }
  if (!Object.values(values).some((value) => value !== null)) return
  const db = getDb()
  db.prepare(`
    INSERT INTO miniapp_customer_profiles(
      telegram_chat_id, company_name, inn, contact_name, role, phone, email, delivery_address, website, office_people, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(telegram_chat_id) DO UPDATE SET
      company_name = COALESCE(excluded.company_name, company_name),
      inn = COALESCE(excluded.inn, inn),
      contact_name = COALESCE(excluded.contact_name, contact_name),
      role = COALESCE(excluded.role, role),
      phone = COALESCE(excluded.phone, phone),
      email = COALESCE(excluded.email, email),
      delivery_address = COALESCE(excluded.delivery_address, delivery_address),
      website = COALESCE(excluded.website, website),
      office_people = COALESCE(excluded.office_people, office_people),
      updated_at = CURRENT_TIMESTAMP
  `).run(
    chatId,
    values.company_name,
    values.inn,
    values.contact_name,
    values.role,
    values.phone,
    values.email,
    values.delivery_address,
    values.website,
    values.office_people
  )
}

function companyNotes(profile: MiniappCustomerProfile, enrichment?: CompanyEnrichmentResult | null) {
  const parts = [
    profile.inn ? `ИНН: ${profile.inn}` : null,
    profile.office_people ? `Заявленная численность офиса: ${profile.office_people}` : null,
    enrichment ? `Оценка офиса: ${enrichment.office_people.min}-${enrichment.office_people.max} человек (${enrichment.office_people.confidence}).` : null,
    enrichment ? `КП: ${enrichment.proposal.proposal_summary}` : null,
    enrichment ? `Следующий шаг: ${enrichment.proposal.manager_next_step}` : null,
    "Компания создана или обновлена через клиентский web-каталог."
  ]
  return parts.filter(Boolean).join(" ")
}

function findOrCreateCompany(profile: MiniappCustomerProfile, enrichment?: CompanyEnrichmentResult | null) {
  const companyName = clean(profile.company_name)
  if (!companyName) return null

  const db = getDb()
  const existing = db.prepare("SELECT id FROM companies WHERE lower(name) = lower(?) LIMIT 1").get(companyName) as { id: number } | undefined
  const website = clean(profile.website) ?? enrichment?.profile.website ?? null
  const publicContactUrl = website ?? enrichment?.profile.website ?? null
  const address = clean(profile.delivery_address) ?? enrichment?.profile.address ?? null
  const dgisUrl = normalizeDgisUrl({
    dgisUrl: enrichment?.profile.dgis_url,
    dgisId: enrichment?.profile.dgis_id,
    name: companyName,
    city: "Санкт-Петербург",
    address
  })
  const driveMinutes = normalizeDriveMinutes({
    value: enrichment?.profile.drive_minutes_from_production,
    address,
    city: "Санкт-Петербург",
    segment: "telegram_order"
  })
  const driveSource = enrichment?.profile.drive_minutes_source ?? "estimated_from_miniapp_address"
  const notes = companyNotes(profile, enrichment)

  if (existing) {
    db.prepare(`
      UPDATE companies
      SET
        website = COALESCE(?, website),
        public_contact_url = COALESCE(?, public_contact_url),
        address = COALESCE(?, address),
        dgis_url = COALESCE(?, dgis_url),
        drive_minutes_from_production = COALESCE(?, drive_minutes_from_production),
        drive_minutes_source = COALESCE(?, drive_minutes_source),
        notes = CASE WHEN COALESCE(notes, '') = '' THEN ? ELSE notes || ' ' || ? END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(website, publicContactUrl, address, dgisUrl, driveMinutes, driveSource, notes, notes, existing.id)
    return existing.id
  }

  return Number(
    db.prepare(`
      INSERT INTO companies(
        name, segment, region, city, district, address, dgis_url, drive_minutes_from_production, drive_minutes_source,
        website, public_contact_url, source, lead_status, lead_score, fit_reason, notes
      )
      VALUES (?, 'telegram_order', 'Санкт-Петербург и Ленинградская область', 'Санкт-Петербург', NULL, ?, ?, ?, ?, ?, ?, 'customer_portal', 'contacted', 68, 'Клиент авторизовался в web-каталоге и начал оформление заказа.', ?)
    `).run(companyName, address, dgisUrl, driveMinutes, driveSource, website, publicContactUrl, notes).lastInsertRowid
  )
}

function upsertContact(companyId: number, auth: CustomerPortalAuth, profile: MiniappCustomerProfile) {
  const db = getDb()
  const name = clean(profile.contact_name) ?? customerPortalDisplayName(auth)
  const role = clean(profile.role) ?? "Заказчик"
  const email = clean(profile.email) ?? auth.email
  const phone = clean(profile.phone)
  const address = clean(profile.delivery_address)
  const dgisUrl = normalizeDgisUrl({ name: clean(profile.company_name), city: "Санкт-Петербург", address })
  const driveMinutes = normalizeDriveMinutes({ address, city: "Санкт-Петербург", segment: "telegram_order" })
  const existing = db.prepare(`
    SELECT id FROM contacts
    WHERE company_id = ?
      AND COALESCE(email, '') = COALESCE(?, '')
      AND COALESCE(phone, '') = COALESCE(?, '')
    LIMIT 1
  `).get(companyId, email, phone) as { id: number } | undefined

  if (existing) return existing.id

  return Number(
    db.prepare(`
      INSERT INTO contacts(
        company_id, name, role, email, phone, address, dgis_url, drive_minutes_from_production, drive_minutes_source,
        preferred_channel, telegram_handle, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'estimated_from_miniapp_address', ?, ?, 'Контакт из клиентского web-каталога; B2B-канал требует подтверждения менеджером.')
    `).run(
      companyId,
      name,
      role,
      email,
      phone,
      address,
      dgisUrl,
      driveMinutes,
      auth.preferred_channel,
      auth.mode === "telegram" && auth.user.username ? `@${auth.user.username}` : null
    ).lastInsertRowid
  )
}

export function getMiniappOrders(chatId: string) {
  const db = getDb()
  const customer = db.prepare("SELECT id, company_id FROM bot_customers WHERE telegram_chat_id = ?").get(chatId) as
    | { id: number; company_id: number | null }
    | undefined
  const orders = db.prepare(`
    SELECT DISTINCT o.id, c.name AS company_name, o.status, o.delivery_date, o.payment_date, o.total_amount, o.manager_comment, o.created_at
    FROM orders o
    JOIN bot_customers b ON b.id = o.bot_customer_id
    LEFT JOIN companies c ON c.id = o.company_id
    WHERE b.telegram_chat_id = ?
       OR (? IS NOT NULL AND o.company_id = ?)
    ORDER BY o.id DESC
    LIMIT 8
  `).all(chatId, customer?.company_id ?? null, customer?.company_id ?? null) as Array<Omit<MiniappOrderHistory, "items">>

  const itemQuery = db.prepare(`
    SELECT
      oi.product_id,
      p.name,
      p.category,
      oi.quantity,
      oi.unit_price,
      oi.line_total
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `)

  return orders.map((order) => ({
    ...order,
    items: itemQuery.all(order.id) as MiniappOrderHistoryItem[]
  }))
}

function getOrderItemPreview(orderId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT
      p.name,
      oi.quantity,
      oi.line_total
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
    ORDER BY oi.line_total DESC, oi.id
    LIMIT 6
  `).all(orderId) as Array<{ name: string; quantity: number; line_total: number }>
}

export function getMiniappCustomerProfile(chatId: string): MiniappSavedProfile | null {
  ensureMiniappCustomerProfileSchema()
  const db = getDb()
  const row = db.prepare(`
    SELECT
      b.id AS bot_customer_id,
      b.display_name,
      mp.company_name AS saved_company_name,
      mp.inn AS saved_inn,
      mp.contact_name AS saved_contact_name,
      mp.role AS saved_role,
      mp.phone AS saved_phone,
      mp.email AS saved_email,
      mp.delivery_address AS saved_delivery_address,
      mp.website AS saved_website,
      mp.office_people AS saved_office_people,
      c.id AS company_id,
      c.name AS company_name,
      c.website AS company_website,
      ep.inn,
      ep.address AS enrichment_address,
      ep.website AS enrichment_website,
      ep.phone AS enrichment_phone,
      ep.email AS enrichment_email,
      ep.office_people_min,
      ep.office_people_max
    FROM bot_customers b
    LEFT JOIN miniapp_customer_profiles mp ON mp.telegram_chat_id = b.telegram_chat_id
    LEFT JOIN companies c ON c.id = b.company_id
    LEFT JOIN company_enrichment_profiles ep ON ep.company_id = c.id
    WHERE b.telegram_chat_id = ?
    LIMIT 1
  `).get(chatId) as
    | {
        bot_customer_id: number
        display_name: string | null
        saved_company_name: string | null
        saved_inn: string | null
        saved_contact_name: string | null
        saved_role: string | null
        saved_phone: string | null
        saved_email: string | null
        saved_delivery_address: string | null
        saved_website: string | null
        saved_office_people: number | null
        company_id: number | null
        company_name: string | null
        company_website: string | null
        inn: string | null
        enrichment_address: string | null
        enrichment_website: string | null
        enrichment_phone: string | null
        enrichment_email: string | null
        office_people_min: number | null
        office_people_max: number | null
      }
    | undefined
  if (!row) return null

  const contact = row.company_id
    ? (db.prepare(`
        SELECT name, role, email, phone
        FROM contacts
        WHERE company_id = ?
        ORDER BY CASE WHEN preferred_channel = 'telegram' THEN 0 ELSE 1 END, id DESC
        LIMIT 1
      `).get(row.company_id) as
        | {
            name: string | null
            role: string | null
            email: string | null
            phone: string | null
          }
        | undefined)
    : undefined
  const latestDelivery = db.prepare(`
    SELECT delivery_address
    FROM orders
    WHERE bot_customer_id = ?
      AND COALESCE(TRIM(delivery_address), '') <> ''
    ORDER BY id DESC
    LIMIT 1
  `).get(row.bot_customer_id) as { delivery_address: string | null } | undefined
  const officeMin = Number(row.office_people_min)
  const officeMax = Number(row.office_people_max)
  const officePeople =
    Number.isFinite(officeMin) && Number.isFinite(officeMax) && officeMin > 0 && officeMax > 0
      ? Math.round((officeMin + officeMax) / 2)
      : null

  return {
    company_name: row.saved_company_name ?? row.company_name,
    inn: row.saved_inn ?? row.inn,
    contact_name: row.saved_contact_name ?? contact?.name ?? row.display_name,
    role: row.saved_role ?? contact?.role ?? null,
    phone: row.saved_phone ?? contact?.phone ?? row.enrichment_phone,
    email: row.saved_email ?? contact?.email ?? row.enrichment_email,
    delivery_address: row.saved_delivery_address ?? latestDelivery?.delivery_address ?? row.enrichment_address,
    website: row.saved_website ?? row.company_website ?? row.enrichment_website,
    office_people: row.saved_office_people ?? officePeople
  }
}

export async function upsertMiniappSession(input: MiniappSessionInput) {
  const auth = authenticateCustomerPortal(input)
  const db = getDb()
  const profile: MiniappCustomerProfile = {
    ...(input.profile ?? {}),
    email: input.profile?.email ?? auth.email ?? undefined
  }
  upsertMiniappCustomerProfile(auth.chat_id, profile)
  let enrichment: CompanyEnrichmentResult | null = null

  if (clean(profile.company_name)) {
    enrichment = await lookupCompanyEnrichment({
      company_name: clean(profile.company_name) ?? "",
      inn: clean(profile.inn),
      website: clean(profile.website),
      address: clean(profile.delivery_address)
    })
  }

  const companyId = findOrCreateCompany(profile, enrichment)
  if (companyId) {
    upsertContact(companyId, auth, profile)
    if (enrichment) saveCompanyEnrichment(companyId, enrichment)
  }

  db.prepare(`
    INSERT INTO bot_customers(telegram_user_id, telegram_chat_id, display_name, company_id, state)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(telegram_chat_id) DO UPDATE SET
      telegram_user_id = COALESCE(excluded.telegram_user_id, telegram_user_id),
      display_name = COALESCE(excluded.display_name, display_name),
      company_id = COALESCE(excluded.company_id, company_id),
      state = excluded.state,
      last_seen_at = CURRENT_TIMESTAMP
  `).run(String(auth.user.id), auth.chat_id, customerPortalDisplayName(auth), companyId, companyId ? "verified_profile" : "identified")

  const customer = db.prepare(`
    SELECT b.id, b.telegram_user_id, b.telegram_chat_id, b.display_name, b.state, b.company_id, c.name AS company_name
    FROM bot_customers b
    LEFT JOIN companies c ON c.id = b.company_id
    WHERE b.telegram_chat_id = ?
  `).get(auth.chat_id) as
    | {
        id: number
        telegram_user_id: string | null
        telegram_chat_id: string
        display_name: string | null
        state: string
        company_id: number | null
        company_name: string | null
      }
    | undefined

  if (customer) {
    recordCustomerIdentity({
      identityType: auth.mode,
      identityKey: auth.chat_id,
      botCustomerId: customer.id,
      companyId: customer.company_id,
      email: auth.email ?? profile.email ?? null,
      telegramChatId: auth.mode === "telegram" ? auth.chat_id : null,
      verified: auth.mode === "telegram" ? auth.init_data_valid : !auth.warnings.length,
      warnings: auth.warnings
    })
  }

  return {
    ok: true,
    auth,
    customer,
    profile: getMiniappCustomerProfile(auth.chat_id),
    enrichment,
    orders: getMiniappOrders(auth.chat_id),
    insights: getCustomerPortalInsights(auth.chat_id)
  }
}

export function getMiniappOrderHistory(input: Pick<MiniappSessionInput, "initData" | "email" | "accessCode" | "profile">) {
  const auth = authenticateCustomerPortal(input)
  return {
    ok: true,
    auth,
    profile: getMiniappCustomerProfile(auth.chat_id),
    orders: getMiniappOrders(auth.chat_id),
    insights: getCustomerPortalInsights(auth.chat_id)
  }
}

export async function createMiniappOrder(input: MiniappSessionInput & Omit<BotOrderPayload, "telegram_chat_id" | "telegram_user_id" | "display_name" | "company_name">) {
  const session = await upsertMiniappSession(input)
  const profile = input.profile ?? {}
  const companyName = clean(profile.company_name) ?? "Клиент web-каталога"
  const rawInstructions = clean(input.instructions)
  const proposalInstruction = session.enrichment?.proposal && !rawInstructions?.includes(session.enrichment.proposal.proposal_summary)
    ? `${session.enrichment.proposal.proposal_summary} Предложить: ${session.enrichment.proposal.what_to_offer.join("; ")}.`
    : null
  const result = createBotOrder({
    telegram_user_id: String(session.auth.user.id),
    telegram_chat_id: session.auth.chat_id,
    display_name: customerPortalDisplayName(session.auth),
    company_name: companyName,
    channel: session.auth.channel,
    contact_role: clean(profile.role) ?? "Заказчик",
    contact_email: clean(profile.email) ?? session.auth.email ?? undefined,
    contact_phone: clean(profile.phone) ?? undefined,
    inn: clean(profile.inn) ?? undefined,
    office_people: profile.office_people,
    delivery_method: input.delivery_method,
    delivery_address: clean(input.delivery_address) ?? clean(profile.delivery_address) ?? undefined,
    delivery_date: clean(input.delivery_date) ?? undefined,
    payment_date: clean(input.payment_date) ?? undefined,
    instructions: [proposalInstruction, rawInstructions].filter(Boolean).join(" ") || undefined,
    items: input.items
  })
  const externalExport = await exportOrderToExternalWebhook(result.body.order_id)
  const orders = getMiniappOrders(session.auth.chat_id)
  const deliveryAddress = clean(input.delivery_address) ?? clean(profile.delivery_address)
  const deliveryDate = clean(input.delivery_date)
  const instructions = [proposalInstruction, rawInstructions].filter(Boolean).join(" ") || null
  const managerNotification = await sendManagerOrderNotification({
    order_id: result.body.order_id,
    status: result.body.status,
    total_amount: result.body.total_amount,
    company_name: companyName,
    delivery_address: deliveryAddress,
    delivery_date: deliveryDate,
    instructions,
    item_count: input.items.reduce((sum, item) => sum + item.quantity, 0),
    item_preview: getOrderItemPreview(result.body.order_id)
  })
  const customerOrderConfirmation =
    session.auth.mode === "telegram"
      ? await sendCustomerOrderStatusMessage({
          chat_id: session.auth.chat_id,
          order_id: result.body.order_id,
          status: result.body.status,
          total_amount: result.body.total_amount,
          manager_comment: result.body.manager_comment
        })
      : { ok: false, skipped: true, error: "Customer notification is available after messenger link" }

  return {
    ...result,
    session,
    orders,
    insights: getCustomerPortalInsights(session.auth.chat_id),
    external_export: externalExport,
    manager_notification: managerNotification,
    customer_order_confirmation: customerOrderConfirmation
  }
}

export function getCustomerPortalInsights(chatId: string): CustomerPortalInsights {
  ensureInventorySchema()
  const db = getDb()
  const customer = db.prepare("SELECT id, company_id FROM bot_customers WHERE telegram_chat_id = ?").get(chatId) as
    | { id: number; company_id: number | null }
    | undefined
  const empty = {
    orders_count: 0,
    total_revenue: 0,
    sku_count: 0,
    last_order_at: null,
    top_products: [],
    inventory: getInventorySummary()
  } satisfies CustomerPortalInsights
  if (!customer) return empty

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS orders_count,
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      MAX(created_at) AS last_order_at
    FROM orders
    WHERE bot_customer_id = ?
       OR (? IS NOT NULL AND company_id = ?)
  `).get(customer.id, customer.company_id ?? null, customer.company_id ?? null) as { orders_count: number; total_revenue: number; last_order_at: string | null }
  const topProducts = db.prepare(`
    SELECT
      p.id AS product_id,
      p.name,
      SUM(oi.quantity) AS quantity,
      SUM(oi.line_total) AS revenue
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.bot_customer_id = ?
       OR (? IS NOT NULL AND o.company_id = ?)
    GROUP BY p.id, p.name
    ORDER BY quantity DESC, revenue DESC
    LIMIT 5
  `).all(customer.id, customer.company_id ?? null, customer.company_id ?? null) as CustomerPortalInsights["top_products"]

  return {
    orders_count: Number(summary.orders_count ?? 0),
    total_revenue: Number(summary.total_revenue ?? 0),
    sku_count: topProducts.length,
    last_order_at: summary.last_order_at,
    top_products: topProducts,
    inventory: getInventorySummary()
  }
}

export function createCustomerPortalAgentTask(input: MiniappSessionInput & { intent?: string | null; message?: string | null }) {
  const auth = authenticateCustomerPortal(input)
  ensureCustomerPortalAgents()
  const db = getDb()
  const customer = db.prepare(`
    SELECT b.company_id, d.id AS deal_id
    FROM bot_customers b
    LEFT JOIN deals d ON d.company_id = b.company_id
    WHERE b.telegram_chat_id = ?
    ORDER BY d.id DESC
    LIMIT 1
  `).get(auth.chat_id) as { company_id: number | null; deal_id: number | null } | undefined
  const taskId = createAiTask({
    agentCode: "customer_order_concierge",
    companyId: customer?.company_id ?? null,
    dealId: customer?.deal_id ?? null,
    taskType: "customer_order_concierge",
    priority: 82,
    prompt: [
      `Сопроводить клиента ${customerPortalDisplayName(auth)} в web-каталоге Lunch Up.`,
      input.intent ? `Интент: ${input.intent}.` : null,
      input.message ? `Сообщение клиента: ${input.message}.` : null,
      "Проверить профиль, корзину, историю заказов, повторяемость SKU, риски остатков и следующий шаг для менеджера."
    ].filter(Boolean).join(" ")
  })
  return {
    ok: true,
    task_id: taskId,
    auth,
    insights: getCustomerPortalInsights(auth.chat_id)
  }
}
