import { assertWritableDb, getDb } from "@/lib/db"
import type { SQLInputValue } from "node:sqlite"

export class ReferenceAdminError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

type FieldType = "text" | "textarea" | "number" | "boolean" | "select" | "date"
type FieldValueType = "text" | "number"
type OptionSource = "ai_agents" | "companies" | "crm_segments" | "deals" | "matrices" | "pipeline_stages" | "products"

export type ReferenceField = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  readonly?: boolean
  createOnly?: boolean
  valueType?: FieldValueType
  options?: Array<{ value: string | number; label: string }>
  optionSource?: OptionSource
  defaultValue?: string | number | boolean | null
}

type ReferenceConfig = {
  id: string
  label: string
  description: string
  table: string
  pk: string
  pkType: FieldValueType
  titleField: string
  searchFields: string[]
  orderBy: string
  fields: ReferenceField[]
}

const commonPriorityOptions = [
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" }
]

const references: ReferenceConfig[] = [
  {
    id: "settings",
    label: "Настройки",
    description: "Ключевые параметры CRM и Mini App.",
    table: "settings",
    pk: "key",
    pkType: "text",
    titleField: "key",
    searchFields: ["key", "value", "description"],
    orderBy: "key",
    fields: [
      { key: "key", label: "Ключ", type: "text", required: true, createOnly: true },
      { key: "value", label: "Значение", type: "textarea", required: true },
      { key: "description", label: "Описание", type: "textarea" }
    ]
  },
  {
    id: "pipeline_stages",
    label: "Стадии воронки",
    description: "Этапы продаж, порядок и вероятность.",
    table: "pipeline_stages",
    pk: "id",
    pkType: "number",
    titleField: "name",
    searchFields: ["code", "name"],
    orderBy: "position, id",
    fields: [
      { key: "code", label: "Код", type: "text", required: true },
      { key: "name", label: "Название", type: "text", required: true },
      { key: "position", label: "Позиция", type: "number", required: true },
      { key: "probability", label: "Вероятность, %", type: "number", required: true, defaultValue: 10 }
    ]
  },
  {
    id: "products",
    label: "SKU каталога",
    description: "Карточки продуктов, цены, сроки и ссылки.",
    table: "products",
    pk: "id",
    pkType: "number",
    titleField: "name",
    searchFields: ["category", "name", "barcode", "composition", "nutrition", "site_title"],
    orderBy: "category, name",
    fields: [
      { key: "category", label: "Категория", type: "text", required: true },
      { key: "name", label: "Название", type: "text", required: true },
      { key: "barcode", label: "Штрихкод", type: "text" },
      { key: "net_weight", label: "Вес", type: "text" },
      { key: "shelf_life_days", label: "Срок, дней", type: "number" },
      { key: "wholesale_price", label: "Цена", type: "number", required: true },
      { key: "composition", label: "Состав", type: "textarea" },
      { key: "nutrition", label: "БЖУ / калории", type: "textarea" },
      { key: "image_url", label: "Фото URL", type: "text" },
      { key: "product_url", label: "Ссылка на продукт", type: "text" },
      { key: "site_title", label: "Заголовок сайта", type: "text" },
      { key: "is_active", label: "Активен", type: "boolean", defaultValue: true }
    ]
  },
  {
    id: "crm_segments",
    label: "CRM-сегменты",
    description: "Направления, сегменты и формат запуска.",
    table: "crm_segments",
    pk: "code",
    pkType: "text",
    titleField: "label",
    searchFields: ["code", "label", "direction_label", "launch_format"],
    orderBy: "direction_position, segment_position, label",
    fields: [
      { key: "code", label: "Код", type: "text", required: true, createOnly: true },
      { key: "label", label: "Название", type: "text", required: true },
      { key: "direction_code", label: "Код направления", type: "text", required: true },
      { key: "direction_label", label: "Направление", type: "text", required: true },
      { key: "direction_description", label: "Описание направления", type: "textarea", required: true },
      { key: "direction_position", label: "Позиция направления", type: "number", required: true },
      { key: "segment_position", label: "Позиция сегмента", type: "number", required: true },
      { key: "launch_format", label: "Формат запуска", type: "text", required: true },
      { key: "is_active", label: "Активен", type: "boolean", defaultValue: true }
    ]
  },
  {
    id: "segment_matrices",
    label: "Матрицы запуска",
    description: "Пакеты предложений по сегментам.",
    table: "segment_matrices",
    pk: "id",
    pkType: "number",
    titleField: "name",
    searchFields: ["segment", "name", "rationale"],
    orderBy: "segment, name",
    fields: [
      { key: "segment", label: "Сегмент", type: "select", valueType: "text", optionSource: "crm_segments", required: true },
      { key: "name", label: "Название", type: "text", required: true },
      { key: "target_sku_count", label: "Целевой SKU", type: "text", required: true },
      { key: "rationale", label: "Логика", type: "textarea", required: true }
    ]
  },
  {
    id: "matrix_items",
    label: "SKU в матрицах",
    description: "Связка матриц запуска с продуктами.",
    table: "matrix_items",
    pk: "id",
    pkType: "number",
    titleField: "role",
    searchFields: ["role"],
    orderBy: "matrix_id, priority, id",
    fields: [
      { key: "matrix_id", label: "Матрица", type: "select", valueType: "number", optionSource: "matrices", required: true },
      { key: "product_id", label: "Продукт", type: "select", valueType: "number", optionSource: "products", required: true },
      { key: "role", label: "Роль", type: "text", required: true },
      { key: "priority", label: "Приоритет", type: "number", required: true, defaultValue: 50 }
    ]
  },
  {
    id: "companies",
    label: "Компании",
    description: "B2B-компании, сегмент, источники и контактная готовность.",
    table: "companies",
    pk: "id",
    pkType: "number",
    titleField: "name",
    searchFields: ["name", "city", "address", "website", "fit_reason", "notes"],
    orderBy: "lead_score DESC, name",
    fields: [
      { key: "name", label: "Компания", type: "text", required: true },
      { key: "segment", label: "Сегмент", type: "select", valueType: "text", optionSource: "crm_segments", required: true },
      { key: "region", label: "Регион", type: "text", required: true, defaultValue: "Санкт-Петербург и Ленинградская область" },
      { key: "city", label: "Город", type: "text", required: true, defaultValue: "Санкт-Петербург" },
      { key: "district", label: "Район", type: "text" },
      { key: "address", label: "Адрес", type: "text" },
      { key: "website", label: "Сайт", type: "text" },
      { key: "public_contact_url", label: "Публичный контакт", type: "text" },
      { key: "dgis_url", label: "2ГИС", type: "text" },
      { key: "source", label: "Источник", type: "text", required: true, defaultValue: "external_webui" },
      { key: "lead_status", label: "Статус лида", type: "text", required: true, defaultValue: "new" },
      { key: "lead_score", label: "Score", type: "number", required: true, defaultValue: 50 },
      { key: "fit_reason", label: "Почему подходит", type: "textarea" },
      { key: "notes", label: "Заметки", type: "textarea" },
      { key: "telegram_url", label: "Telegram URL", type: "text" },
      { key: "telegram_username", label: "Telegram username", type: "text" },
      { key: "telegram_contact_status", label: "Статус Telegram", type: "select", required: true, defaultValue: "not_found", options: [
        { value: "not_found", label: "не найден" },
        { value: "needs_verification", label: "проверить" },
        { value: "public_found", label: "публичный найден" },
        { value: "approved_to_contact", label: "можно писать" },
        { value: "opted_out", label: "не писать" }
      ] },
      { key: "agent_contact_readiness", label: "AI-готовность", type: "text", required: true, defaultValue: "none" }
    ]
  },
  {
    id: "contacts",
    label: "Контакты",
    description: "Люди и публичные B2B-каналы компаний.",
    table: "contacts",
    pk: "id",
    pkType: "number",
    titleField: "role",
    searchFields: ["name", "role", "email", "phone", "telegram_handle", "notes"],
    orderBy: "company_id, role, id",
    fields: [
      { key: "company_id", label: "Компания", type: "select", valueType: "number", optionSource: "companies", required: true },
      { key: "name", label: "Имя / канал", type: "text" },
      { key: "role", label: "Роль", type: "text", required: true },
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Телефон", type: "text" },
      { key: "telegram_handle", label: "Telegram", type: "text" },
      { key: "preferred_channel", label: "Канал", type: "select", required: true, defaultValue: "site", options: [
        { value: "site", label: "сайт" },
        { value: "phone", label: "телефон" },
        { value: "email", label: "email" },
        { value: "telegram", label: "telegram" }
      ] },
      { key: "is_public", label: "Публичный", type: "boolean", defaultValue: true },
      { key: "consent_basis", label: "Основание", type: "text", required: true, defaultValue: "public_business_channel" },
      { key: "notes", label: "Заметки", type: "textarea" }
    ]
  },
  {
    id: "deals",
    label: "Сделки",
    description: "Сделки, стадия, потенциал и следующий шаг.",
    table: "deals",
    pk: "id",
    pkType: "number",
    titleField: "title",
    searchFields: ["title", "priority", "owner", "next_action"],
    orderBy: "created_at DESC, id DESC",
    fields: [
      { key: "company_id", label: "Компания", type: "select", valueType: "number", optionSource: "companies", required: true },
      { key: "stage_id", label: "Стадия", type: "select", valueType: "number", optionSource: "pipeline_stages", required: true },
      { key: "title", label: "Название", type: "text", required: true },
      { key: "estimated_monthly_revenue", label: "Потенциал ₽/мес", type: "number", required: true, defaultValue: 0 },
      { key: "expected_close_date", label: "Ожидаемое закрытие", type: "date" },
      { key: "priority", label: "Приоритет", type: "select", required: true, defaultValue: "medium", options: commonPriorityOptions },
      { key: "owner", label: "Владелец", type: "text", required: true, defaultValue: "Директор по продажам" },
      { key: "next_action", label: "Следующее действие", type: "textarea" },
      { key: "next_action_at", label: "Дата шага", type: "date" }
    ]
  },
  {
    id: "local_prospects",
    label: "Локальные лиды",
    description: "Локальная outreach-база рядом с производством.",
    table: "local_prospects",
    pk: "id",
    pkType: "number",
    titleField: "name",
    searchFields: ["name", "segment", "address", "fit_reason", "offer", "next_action"],
    orderBy: "score DESC, name",
    fields: [
      { key: "name", label: "Название", type: "text", required: true },
      { key: "segment", label: "Сегмент", type: "select", valueType: "text", optionSource: "crm_segments", required: true },
      { key: "address", label: "Адрес", type: "text", required: true },
      { key: "walk_min", label: "Пешком, мин", type: "number" },
      { key: "distance_band", label: "Дистанция", type: "text" },
      { key: "priority", label: "Приоритет", type: "text" },
      { key: "score", label: "Score", type: "number", defaultValue: 50 },
      { key: "fit_reason", label: "Почему подходит", type: "textarea" },
      { key: "offer", label: "Оффер", type: "textarea" },
      { key: "next_action", label: "Следующее действие", type: "textarea" },
      { key: "phone", label: "Телефон", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "website", label: "Сайт", type: "text" },
      { key: "source_2gis", label: "2ГИС", type: "text" },
      { key: "notes", label: "Заметки", type: "textarea" }
    ]
  },
  {
    id: "ai_agents",
    label: "AI-агенты",
    description: "Справочник агентов и правил запуска.",
    table: "ai_agents",
    pk: "id",
    pkType: "number",
    titleField: "name",
    searchFields: ["code", "name", "mission", "trigger_rule"],
    orderBy: "code",
    fields: [
      { key: "code", label: "Код", type: "text", required: true },
      { key: "name", label: "Название", type: "text", required: true },
      { key: "mission", label: "Миссия", type: "textarea", required: true },
      { key: "trigger_rule", label: "Правило запуска", type: "textarea", required: true },
      { key: "is_active", label: "Активен", type: "boolean", defaultValue: true }
    ]
  },
  {
    id: "ai_tasks",
    label: "AI-задачи",
    description: "Очередь задач для AI-агентов.",
    table: "ai_tasks",
    pk: "id",
    pkType: "number",
    titleField: "task_type",
    searchFields: ["task_type", "prompt", "status", "result_summary"],
    orderBy: "created_at DESC, id DESC",
    fields: [
      { key: "agent_id", label: "Агент", type: "select", valueType: "number", optionSource: "ai_agents", required: true },
      { key: "company_id", label: "Компания", type: "select", valueType: "number", optionSource: "companies" },
      { key: "deal_id", label: "Сделка", type: "select", valueType: "number", optionSource: "deals" },
      { key: "task_type", label: "Тип", type: "text", required: true },
      { key: "priority", label: "Приоритет", type: "number", required: true, defaultValue: 50 },
      { key: "prompt", label: "Промпт", type: "textarea", required: true },
      { key: "status", label: "Статус", type: "text", required: true, defaultValue: "queued" },
      { key: "result_summary", label: "Результат", type: "textarea" },
      { key: "due_at", label: "Срок", type: "date" }
    ]
  },
  {
    id: "cjm_events",
    label: "CJM-события",
    description: "Этапы пути клиента и метрики.",
    table: "cjm_events",
    pk: "id",
    pkType: "number",
    titleField: "stage",
    searchFields: ["stage", "customer_goal", "lunch_up_action", "metric"],
    orderBy: "id DESC",
    fields: [
      { key: "company_id", label: "Компания", type: "select", valueType: "number", optionSource: "companies" },
      { key: "stage", label: "Этап", type: "text", required: true },
      { key: "customer_goal", label: "Цель клиента", type: "textarea", required: true },
      { key: "lunch_up_action", label: "Действие Lunch Up", type: "textarea", required: true },
      { key: "metric", label: "Метрика", type: "text", required: true }
    ]
  },
  {
    id: "inventory_positions",
    label: "Остатки",
    description: "Складские уровни по SKU.",
    table: "inventory_positions",
    pk: "product_id",
    pkType: "number",
    titleField: "product_id",
    searchFields: [],
    orderBy: "product_id",
    fields: [
      { key: "product_id", label: "Продукт", type: "select", valueType: "number", optionSource: "products", required: true, createOnly: true },
      { key: "on_hand_quantity", label: "На складе", type: "number", required: true, defaultValue: 48 },
      { key: "reserved_quantity", label: "Резерв", type: "number", required: true, defaultValue: 0 },
      { key: "reorder_point", label: "Точка заказа", type: "number", required: true, defaultValue: 18 },
      { key: "target_stock", label: "Целевой запас", type: "number", required: true, defaultValue: 96 }
    ]
  }
]

const tableById = new Map(references.map((item) => [item.id, item]))

function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function sqlInput(value: unknown): SQLInputValue {
  if (value === undefined) return null
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value
  if (typeof value === "boolean") return value ? 1 : 0
  return String(value)
}

function configFor(ref: string | null | undefined) {
  const config = tableById.get(ref ?? "")
  if (!config) {
    throw new ReferenceAdminError("Unknown reference")
  }
  return config
}

function parsePrimaryKey(config: ReferenceConfig, value: unknown) {
  if (config.pkType === "number") {
    const parsed = Number(value)
    if (!Number.isInteger(parsed)) {
      throw new ReferenceAdminError("Invalid row id")
    }
    return parsed
  }
  const parsed = String(value ?? "").trim()
  if (!parsed) {
    throw new ReferenceAdminError("Invalid row id")
  }
  return parsed
}

function parseFieldValue(field: ReferenceField, raw: unknown, mode: "create" | "update") {
  if (field.readonly || (mode === "update" && field.createOnly)) {
    return undefined
  }
  if (raw === undefined) {
    return field.defaultValue ?? null
  }
  if (field.type === "boolean") {
    return raw === true || raw === "true" || raw === 1 || raw === "1" ? 1 : 0
  }
  if (field.type === "number" || field.valueType === "number") {
    if (raw === null || raw === "") return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      throw new ReferenceAdminError(`${field.label}: нужно число`)
    }
    return parsed
  }
  const value = raw === null ? null : String(raw).trim()
  return value || null
}

function buildValues(config: ReferenceConfig, input: Record<string, unknown>, mode: "create" | "update") {
  const values: Record<string, unknown> = {}
  for (const field of config.fields) {
    if (field.readonly || (mode === "update" && field.createOnly)) continue
    if (mode === "update" && !Object.prototype.hasOwnProperty.call(input, field.key)) continue
    const value = parseFieldValue(field, input[field.key], mode)
    if (field.required && (value === null || value === "" || value === undefined)) {
      throw new ReferenceAdminError(`${field.label}: обязательное поле`)
    }
    if (mode === "create" || Object.prototype.hasOwnProperty.call(input, field.key)) {
      values[field.key] = value
    }
  }
  return values
}

function optionRows(source: OptionSource) {
  const db = getDb()
  if (source === "ai_agents") {
    return db.prepare("SELECT id AS value, name || ' · ' || code AS label FROM ai_agents ORDER BY code").all()
  }
  if (source === "companies") {
    return db.prepare("SELECT id AS value, name AS label FROM companies ORDER BY name LIMIT 300").all()
  }
  if (source === "crm_segments") {
    return db.prepare("SELECT code AS value, label AS label FROM crm_segments WHERE is_active = 1 ORDER BY direction_position, segment_position, label").all()
  }
  if (source === "deals") {
    return db.prepare("SELECT id AS value, '#' || id || ' · ' || title AS label FROM deals ORDER BY created_at DESC, id DESC LIMIT 300").all()
  }
  if (source === "matrices") {
    return db.prepare("SELECT id AS value, name || ' · ' || segment AS label FROM segment_matrices ORDER BY segment, name").all()
  }
  if (source === "pipeline_stages") {
    return db.prepare("SELECT id AS value, name AS label FROM pipeline_stages ORDER BY position").all()
  }
  return db.prepare("SELECT id AS value, category || ' · ' || name AS label FROM products ORDER BY category, name LIMIT 300").all()
}

function publicConfig(config: ReferenceConfig) {
  return {
    id: config.id,
    label: config.label,
    description: config.description,
    pk: config.pk,
    pkType: config.pkType,
    titleField: config.titleField,
    fields: config.fields.map((field) => ({
      ...field,
      options: field.optionSource ? optionRows(field.optionSource) : field.options
    }))
  }
}

export function listReferenceConfigs() {
  return references.map(publicConfig)
}

export function readReferenceRows(input: { ref: string; q?: string | null; limit?: number | null }) {
  const config = configFor(input.ref)
  const db = getDb()
  const limit = Math.min(200, Math.max(1, Number(input.limit) || 60))
  const columns = Array.from(new Set([config.pk, ...config.fields.map((field) => field.key)]))
  const params: SQLInputValue[] = []
  let where = ""
  const needle = input.q?.trim()
  if (needle && config.searchFields.length) {
    where = `WHERE ${config.searchFields.map((field) => `${quoteIdent(field)} LIKE ?`).join(" OR ")}`
    for (const _field of config.searchFields) {
      params.push(`%${needle}%`)
    }
  }
  const sql = `
    SELECT ${columns.map(quoteIdent).join(", ")}
    FROM ${quoteIdent(config.table)}
    ${where}
    ORDER BY ${config.orderBy}
    LIMIT ?
  `
  const rows = db.prepare(sql).all(...params, limit)
  return {
    ok: true,
    config: publicConfig(config),
    rows,
    row_count: rows.length
  }
}

export function createReferenceRow(input: { ref: string; values: Record<string, unknown> }) {
  assertWritableDb()
  const config = configFor(input.ref)
  const db = getDb()
  const values = buildValues(config, input.values ?? {}, "create")
  const columns = Object.keys(values)
  if (!columns.length) {
    throw new ReferenceAdminError("No values to create")
  }
  const sql = `
    INSERT INTO ${quoteIdent(config.table)}(${columns.map(quoteIdent).join(", ")})
    VALUES (${columns.map(() => "?").join(", ")})
  `
  const result = db.prepare(sql).run(...columns.map((key) => sqlInput(values[key])))
  const id = config.pkType === "number" && !columns.includes(config.pk) ? Number(result.lastInsertRowid) : values[config.pk]
  return { ok: true, ref: config.id, id, changes: Number(result.changes) }
}

export function updateReferenceRow(input: { ref: string; id: unknown; values: Record<string, unknown> }) {
  assertWritableDb()
  const config = configFor(input.ref)
  const db = getDb()
  const id = parsePrimaryKey(config, input.id)
  const values = buildValues(config, input.values ?? {}, "update")
  const columns = Object.keys(values)
  if (!columns.length) {
    throw new ReferenceAdminError("No values to update")
  }
  const sql = `
    UPDATE ${quoteIdent(config.table)}
    SET ${columns.map((key) => `${quoteIdent(key)} = ?`).join(", ")}
    WHERE ${quoteIdent(config.pk)} = ?
  `
  const result = db.prepare(sql).run(...columns.map((key) => sqlInput(values[key])), sqlInput(id))
  if (!result.changes) {
    throw new ReferenceAdminError("Row not found", 404)
  }
  return { ok: true, ref: config.id, id, changes: Number(result.changes) }
}
