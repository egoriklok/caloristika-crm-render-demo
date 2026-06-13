import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { getDb } from "@/lib/db"

export type IntegrationStatus = {
  telegram_bot: {
    configured: boolean
    webhook_secret_configured: boolean
    public_base_url: string | null
    manager_chat_configured: boolean
  }
  miniapp: {
    path: string
    auth_required: boolean
    demo_mode: boolean
  }
  dgis: {
    configured: boolean
    env_key: "DGIS_API_KEY" | "TWO_GIS_API_KEY" | null
  }
  dadata: {
    configured: boolean
    env_key: "DADATA_API_KEY" | "DADATA_TOKEN" | null
  }
  apify: {
    configured: boolean
    operator_connected: boolean
  }
  agent_runtime: {
    provider: string
    configured: boolean
    mode: string
    requirement: string
    paperclip_configured: boolean
    hermes_configured: boolean
    openclaw_configured: boolean
    openai_configured: boolean
  }
  external_order_webhook: {
    configured: boolean
    url: string | null
    token_configured: boolean
  }
  mcp: {
    manifest_path: string
    protected_by_crm_key: boolean
  }
}

type ExportOrderRow = {
  id: number
  channel: string
  status: string
  delivery_method: string
  delivery_address: string | null
  delivery_date: string | null
  payment_date: string | null
  instructions: string | null
  total_amount: number
  payment_method: string
  manager_comment: string | null
  created_at: string
  company_id: number | null
  company_name: string | null
  company_segment: string | null
  company_region: string | null
  company_city: string | null
  company_website: string | null
  contact_name: string | null
  contact_role: string | null
  contact_email: string | null
  contact_phone: string | null
  telegram_chat_id: string | null
}

type ExportItemRow = {
  product_id: number
  name: string
  category: string
  barcode: string | null
  net_weight: string | null
  quantity: number
  unit_price: number
  line_total: number
}

type ExportEnrichmentRow = {
  inn: string | null
  legal_name: string | null
  dgis_id: string | null
  office_people_min: number
  office_people_max: number
  office_people_confidence: string
  recommended_portions: number
  recommended_sku: number
  estimated_launch_budget: number
}

function readSavedPublicBaseUrl() {
  const path = join(process.cwd(), "logs", "public_crm_url.txt")
  if (!existsSync(path)) return null
  const savedUrl = readFileSync(path, "utf-8").trim()
  if (!savedUrl) return null
  try {
    const url = new URL(savedUrl)
    url.search = ""
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

export function getPublicBaseUrl() {
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || readSavedPublicBaseUrl()
}

function firstConfigured(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value?.trim()))
}

function getAgentProvider() {
  const explicit = process.env.AGENT_LLM_PROVIDER?.trim().toLowerCase() || process.env.AGENT_RUNTIME_PROVIDER?.trim().toLowerCase()
  if (explicit) return explicit
  return process.env.AGENT_LLM_ENABLED === "1" ? "openai" : "offline"
}

function getAgentRuntimeIntegrationStatus() {
  const provider = getAgentProvider()
  const paperclipConfigured = firstConfigured(process.env.PAPERCLIP_AGENT_ENDPOINT, process.env.PAPERCLIP_API_URL, process.env.PAPERCLIP_AGENT_COMMAND)
  const hermesConfigured = firstConfigured(process.env.HERMES_AGENT_ENDPOINT, process.env.HERMES_GATEWAY_URL, process.env.HERMES_AGENT_COMMAND)
  const openclawConfigured = firstConfigured(process.env.OPENCLAW_AGENT_ENDPOINT, process.env.OPENCLAW_GATEWAY_URL, process.env.OPENCLAW_AGENT_COMMAND)
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY)
  if (provider === "offline") {
    return {
      provider,
      configured: true,
      mode: "offline",
      requirement: "Ничего подключать не нужно: CRM готовит deterministic-рекомендации без внешней модели.",
      paperclip_configured: paperclipConfigured,
      hermes_configured: hermesConfigured,
      openclaw_configured: openclawConfigured,
      openai_configured: openaiConfigured
    }
  }
  if (provider === "paperclip") {
    return {
      provider,
      configured: paperclipConfigured,
      mode: firstConfigured(process.env.PAPERCLIP_AGENT_ENDPOINT, process.env.PAPERCLIP_API_URL) ? "paperclip_http" : "paperclip_command",
      requirement: "Заполнить PAPERCLIP_AGENT_ENDPOINT или PAPERCLIP_AGENT_COMMAND.",
      paperclip_configured: paperclipConfigured,
      hermes_configured: hermesConfigured,
      openclaw_configured: openclawConfigured,
      openai_configured: openaiConfigured
    }
  }
  if (provider === "hermes") {
    return {
      provider,
      configured: hermesConfigured,
      mode: firstConfigured(process.env.HERMES_AGENT_ENDPOINT, process.env.HERMES_GATEWAY_URL) ? "hermes_http" : "hermes_command",
      requirement: "Заполнить HERMES_AGENT_ENDPOINT или HERMES_AGENT_COMMAND.",
      paperclip_configured: paperclipConfigured,
      hermes_configured: hermesConfigured,
      openclaw_configured: openclawConfigured,
      openai_configured: openaiConfigured
    }
  }
  if (provider === "openclaw") {
    return {
      provider,
      configured: openclawConfigured,
      mode: firstConfigured(process.env.OPENCLAW_AGENT_ENDPOINT, process.env.OPENCLAW_GATEWAY_URL) ? "openclaw_http" : "openclaw_command",
      requirement: "Заполнить OPENCLAW_AGENT_ENDPOINT, OPENCLAW_GATEWAY_URL или OPENCLAW_AGENT_COMMAND.",
      paperclip_configured: paperclipConfigured,
      hermes_configured: hermesConfigured,
      openclaw_configured: openclawConfigured,
      openai_configured: openaiConfigured
    }
  }
  return {
    provider,
    configured: openaiConfigured,
    mode: "openai_responses",
    requirement: "Для OpenAI нужен OPENAI_API_KEY; для отказа от OpenAI выберите paperclip, hermes или openclaw.",
    paperclip_configured: paperclipConfigured,
    hermes_configured: hermesConfigured,
    openclaw_configured: openclawConfigured,
    openai_configured: openaiConfigured
  }
}

export function ensureIntegrationSchema() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      provider TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      endpoint TEXT,
      request_json TEXT NOT NULL,
      response_status INTEGER,
      response_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_integration_events_order ON integration_events(order_id);
    CREATE INDEX IF NOT EXISTS idx_integration_events_provider_status ON integration_events(provider, status);
  `)
}

export function getIntegrationStatus(): IntegrationStatus {
  const dgisKey = process.env.DGIS_API_KEY ? "DGIS_API_KEY" : process.env.TWO_GIS_API_KEY ? "TWO_GIS_API_KEY" : null
  const dadataKey = process.env.DADATA_API_KEY ? "DADATA_API_KEY" : process.env.DADATA_TOKEN ? "DADATA_TOKEN" : null
  const externalUrl = process.env.EXTERNAL_ORDER_WEBHOOK_URL?.trim() || null
  const publicBaseUrl = getPublicBaseUrl()
  return {
    telegram_bot: {
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      webhook_secret_configured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
      public_base_url: publicBaseUrl,
      manager_chat_configured: Boolean(process.env.TELEGRAM_MANAGER_CHAT_ID)
    },
    miniapp: {
      path: "/miniapp",
      auth_required: process.env.MINIAPP_DEMO_MODE !== "1",
      demo_mode: process.env.MINIAPP_DEMO_MODE === "1"
    },
    dgis: {
      configured: Boolean(dgisKey),
      env_key: dgisKey
    },
    dadata: {
      configured: Boolean(dadataKey),
      env_key: dadataKey
    },
    apify: {
      configured: Boolean(process.env.APIFY_TOKEN),
      operator_connected: true
    },
    agent_runtime: getAgentRuntimeIntegrationStatus(),
    external_order_webhook: {
      configured: Boolean(externalUrl),
      url: externalUrl,
      token_configured: Boolean(process.env.EXTERNAL_ORDER_WEBHOOK_TOKEN)
    },
    mcp: {
      manifest_path: "/api/mcp/manifest",
      protected_by_crm_key: true
    }
  }
}

export function buildOrderExportPayload(orderId: number) {
  const db = getDb()
  const order = db.prepare(`
    SELECT
      o.id,
      o.channel,
      o.status,
      o.delivery_method,
      o.delivery_address,
      o.delivery_date,
      o.payment_date,
      o.instructions,
      o.total_amount,
      o.payment_method,
      o.manager_comment,
      o.created_at,
      c.id AS company_id,
      c.name AS company_name,
      c.segment AS company_segment,
      c.region AS company_region,
      c.city AS company_city,
      c.website AS company_website,
      ct.name AS contact_name,
      ct.role AS contact_role,
      ct.email AS contact_email,
      ct.phone AS contact_phone,
      b.telegram_chat_id
    FROM orders o
    LEFT JOIN companies c ON c.id = o.company_id
    LEFT JOIN bot_customers b ON b.id = o.bot_customer_id
    LEFT JOIN contacts ct ON ct.company_id = c.id
    WHERE o.id = ?
    ORDER BY ct.id
    LIMIT 1
  `).get(orderId) as ExportOrderRow | undefined

  if (!order) {
    throw new Error(`Order ${orderId} not found`)
  }

  const items = db.prepare(`
    SELECT
      oi.product_id,
      p.name,
      p.category,
      p.barcode,
      p.net_weight,
      oi.quantity,
      oi.unit_price,
      oi.line_total
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `).all(orderId) as ExportItemRow[]

  const enrichment = order.company_id
    ? (db.prepare(`
        SELECT
          inn,
          legal_name,
          dgis_id,
          office_people_min,
          office_people_max,
          office_people_confidence,
          recommended_portions,
          recommended_sku,
          estimated_launch_budget
        FROM company_enrichment_profiles
        WHERE company_id = ?
      `).get(order.company_id) as ExportEnrichmentRow | undefined)
    : undefined

  return {
    schema: "lunch_up.crm.order_export.v1",
    exported_at: new Date().toISOString(),
    order: {
      id: order.id,
      channel: order.channel,
      status: order.status,
      delivery_method: order.delivery_method,
      delivery_address: order.delivery_address,
      delivery_date: order.delivery_date,
      payment_date: order.payment_date,
      instructions: order.instructions,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      manager_comment: order.manager_comment,
      created_at: order.created_at
    },
    customer: {
      company_id: order.company_id,
      company_name: order.company_name,
      segment: order.company_segment,
      region: order.company_region,
      city: order.company_city,
      website: order.company_website,
      contact_name: order.contact_name,
      contact_role: order.contact_role,
      contact_email: order.contact_email,
      contact_phone: order.contact_phone,
      telegram_chat_id: order.telegram_chat_id
    },
    enrichment: enrichment ?? null,
    items
  }
}

export function recordIntegrationEvent(input: {
  orderId: number | null
  provider: string
  status: string
  endpoint?: string | null
  request: unknown
  responseStatus?: number | null
  response?: unknown
  error?: string | null
}) {
  ensureIntegrationSchema()
  const db = getDb()
  return Number(
    db.prepare(`
      INSERT INTO integration_events(order_id, provider, direction, status, endpoint, request_json, response_status, response_json, error)
      VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?)
    `).run(
      input.orderId,
      input.provider,
      input.status,
      input.endpoint ?? null,
      JSON.stringify(input.request),
      input.responseStatus ?? null,
      input.response === undefined ? null : JSON.stringify(input.response),
      input.error ?? null
    ).lastInsertRowid
  )
}

export async function exportOrderToExternalWebhook(orderId: number) {
  const webhookUrl = process.env.EXTERNAL_ORDER_WEBHOOK_URL?.trim()
  const payload = buildOrderExportPayload(orderId)
  const provider = process.env.EXTERNAL_ORDER_WEBHOOK_PROVIDER?.trim() || "external_order_webhook"

  if (!webhookUrl) {
    const eventId = recordIntegrationEvent({
      orderId,
      provider,
      status: "not_configured",
      request: payload,
      error: "EXTERNAL_ORDER_WEBHOOK_URL is not configured"
    })
    return {
      ok: false,
      status: "not_configured",
      integration_event_id: eventId,
      payload
    }
  }

  const headers: Record<string, string> = {
    "content-type": "application/json"
  }
  if (process.env.EXTERNAL_ORDER_WEBHOOK_TOKEN) {
    headers.authorization = `Bearer ${process.env.EXTERNAL_ORDER_WEBHOOK_TOKEN}`
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    })
    const responseText = await response.text()
    let responsePayload: unknown = responseText
    try {
      responsePayload = responseText ? JSON.parse(responseText) : null
    } catch {
      responsePayload = responseText
    }

    const eventId = recordIntegrationEvent({
      orderId,
      provider,
      status: response.ok ? "sent" : "failed",
      endpoint: webhookUrl,
      request: payload,
      responseStatus: response.status,
      response: responsePayload,
      error: response.ok ? null : `Webhook returned ${response.status}`
    })

    return {
      ok: response.ok,
      status: response.ok ? "sent" : "failed",
      integration_event_id: eventId,
      response_status: response.status,
      response: responsePayload,
      payload
    }
  } catch (error) {
    const eventId = recordIntegrationEvent({
      orderId,
      provider,
      status: "failed",
      endpoint: webhookUrl,
      request: payload,
      error: error instanceof Error ? error.message : "Unknown webhook error"
    })
    return {
      ok: false,
      status: "failed",
      integration_event_id: eventId,
      error: error instanceof Error ? error.message : "Unknown webhook error",
      payload
    }
  }
}

export function getRecentIntegrationEvents(limit = 20) {
  ensureIntegrationSchema()
  const db = getDb()
  return db.prepare(`
    SELECT id, order_id, provider, direction, status, endpoint, response_status, error, created_at
    FROM integration_events
    ORDER BY id DESC
    LIMIT ?
  `).all(limit)
}
