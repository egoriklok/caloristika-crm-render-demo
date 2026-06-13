import { copyFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const publicContactsPath = join(root, "data", "public-contacts.json")

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, "utf-8"))
}

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\b(ооо|ао|пао|ип|зао|llc)\b/g, "")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim()
}

function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

function telegramUrlFromText(text) {
  const value = String(text ?? "")
  const urlMatch = value.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_+][A-Za-z0-9_/?=-]*)/i)
  if (urlMatch) {
    const path = urlMatch[1].replace(/^s\//, "")
    return `https://t.me/${path}`.replace(/\/+$/, "")
  }
  if (!/(telegram|телеграм)/i.test(value)) return null
  const handleMatch = value.match(/(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{5,32})(?=$|[^A-Za-z0-9_])/)
  return handleMatch ? `https://t.me/${handleMatch[2]}` : null
}

function telegramUsername(url) {
  const value = clean(url)
  if (!value) return null
  const match = value.match(/t\.me\/([A-Za-z0-9_]{5,32})(?:$|[/?#])/i)
  return match?.[1] ?? null
}

function telegramChannelType(text, url) {
  const value = [text, url].filter(Boolean).join(" ").toLowerCase()
  if (value.includes("joinchat") || /t\.me\/\+/.test(value)) return "invite_link"
  if (/bot\b|бот/.test(value)) return "company_bot"
  if (/chat|group|чат|групп/.test(value)) return "public_group"
  return "public_channel"
}

function publicContactForCompany(publicContacts, companyName) {
  const key = norm(companyName)
  const exact = publicContacts.find((item) => norm(item.company) === key)
  if (exact) return exact
  return publicContacts
    .filter((item) => {
      const itemKey = norm(item.company)
      return key && itemKey && (itemKey.includes(key) || key.includes(itemKey))
    })
    .sort((a, b) => Math.abs(norm(a.company).length - key.length) - Math.abs(norm(b.company).length - key.length))[0]
}

function evidenceFromCompany(company, publicContact, contacts) {
  const fields = [
    company.telegram_url,
    company.telegram_username ? `@${company.telegram_username}` : null,
    publicContact?.telegram_url,
    publicContact?.telegram_username ? `@${publicContact.telegram_username}` : null,
    publicContact?.telegram,
    publicContact?.telegram_handle,
    publicContact?.source_url,
    publicContact?.notes,
    company.website,
    company.public_contact_url,
    company.dgis_url,
    company.notes,
    ...contacts.flatMap((contact) => [contact.telegram_handle, contact.notes])
  ]
  for (const field of fields) {
    const url = telegramUrlFromText(field)
    if (url) {
      return {
        url,
        username: telegramUsername(url),
        channelType: telegramChannelType(field, url),
        status: "public_found",
        sourceUrl: clean(publicContact?.telegram_source_url) ?? clean(publicContact?.source_url) ?? clean(company.public_contact_url) ?? clean(company.dgis_url),
        sourceNote:
          clean(publicContact?.telegram_source_note) ??
          "Публичный Telegram найден в CRM/открытом источнике; перед первым сообщением проверить, что это B2B-канал компании.",
        readiness: "public_channel",
        nextStep: "Проверить публичный Telegram-канал, затем подготовить короткое сообщение от AI seller agent без массовой рассылки."
      }
    }
  }
  const mentionsTelegram = fields.some((field) => /(telegram|телеграм)/i.test(String(field ?? "")))
  if (mentionsTelegram) {
    return {
      url: null,
      username: null,
      channelType: "unknown",
      status: "needs_verification",
      sourceUrl: clean(publicContact?.source_url) ?? clean(company.public_contact_url) ?? clean(company.dgis_url),
      sourceNote: "Открытый источник упоминает Telegram, но URL/username не сохранен. Нужно открыть источник и подтвердить публичный B2B-канал.",
      readiness: "human_operator",
      nextStep: "Открыть источник, найти точную Telegram-ссылку и сохранить ее в карточку компании перед любым сообщением."
    }
  }
  return null
}

if (!existsSync(dbPath)) {
  throw new Error("Missing SQLite database. Run npm run db:init first.")
}

const backupDir = mkdtempSync(join(tmpdir(), "lunch-up-crm-telegram-backfill-"))
for (const suffix of ["", "-wal", "-shm"]) {
  const source = `${dbPath}${suffix}`
  if (existsSync(source)) {
    copyFileSync(source, join(backupDir, `${basename(dbPath)}${suffix}`))
  }
}

const db = new DatabaseSync(dbPath)
db.exec("PRAGMA foreign_keys = ON;")

addColumnIfMissing(db, "companies", "telegram_url", "TEXT")
addColumnIfMissing(db, "companies", "telegram_username", "TEXT")
addColumnIfMissing(db, "companies", "telegram_channel_type", "TEXT NOT NULL DEFAULT 'unknown'")
addColumnIfMissing(db, "companies", "telegram_contact_status", "TEXT NOT NULL DEFAULT 'not_found'")
addColumnIfMissing(db, "companies", "telegram_source_url", "TEXT")
addColumnIfMissing(db, "companies", "telegram_source_note", "TEXT")
addColumnIfMissing(db, "companies", "telegram_discovered_at", "TEXT")
addColumnIfMissing(db, "companies", "agent_contact_policy", "TEXT NOT NULL DEFAULT 'manual_review_required'")
addColumnIfMissing(db, "companies", "agent_contact_readiness", "TEXT NOT NULL DEFAULT 'none'")
addColumnIfMissing(db, "companies", "agent_contact_next_step", "TEXT")
db.exec("CREATE INDEX IF NOT EXISTS idx_companies_telegram_status ON companies(telegram_contact_status, agent_contact_readiness);")

db.prepare(`
  INSERT OR IGNORE INTO ai_agents(code, name, mission, trigger_rule)
  VALUES (
    'company_telegram_channel_researcher',
    'AI Company Telegram Channel Researcher',
    'Ищет и проверяет публичные Telegram, боты, website chat и agent-ready каналы компании, сохраняя источник и политику контакта.',
    'Компания создана без подтвержденного Telegram/AI-канала или 2ГИС/сайт дал новый публичный канал'
  )
`).run()

const publicContacts = readJson(publicContactsPath, [])
const contactRows = db.prepare(`
  SELECT id, company_id, telegram_handle, notes
  FROM contacts
`).all()
const contactsByCompany = new Map()
for (const contact of contactRows) {
  const list = contactsByCompany.get(contact.company_id) ?? []
  list.push(contact)
  contactsByCompany.set(contact.company_id, list)
}

const companies = db.prepare(`
  SELECT
    id,
    name,
    website,
    public_contact_url,
    dgis_url,
    notes,
    telegram_url,
    telegram_username
  FROM companies
  ORDER BY id
`).all()

const updateCompany = db.prepare(`
  UPDATE companies
  SET
    telegram_url = COALESCE(?, telegram_url),
    telegram_username = COALESCE(?, telegram_username),
    telegram_channel_type = ?,
    telegram_contact_status = ?,
    telegram_source_url = COALESCE(?, telegram_source_url),
    telegram_source_note = ?,
    telegram_discovered_at = CASE
      WHEN ? IS NOT NULL AND telegram_discovered_at IS NULL THEN CURRENT_TIMESTAMP
      ELSE telegram_discovered_at
    END,
    agent_contact_policy = 'manual_review_required',
    agent_contact_readiness = ?,
    agent_contact_next_step = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`)

const agent = db.prepare("SELECT id FROM ai_agents WHERE code = 'company_telegram_channel_researcher'").get()
const findExistingTask = db.prepare(`
  SELECT id
  FROM ai_tasks
  WHERE agent_id = ?
    AND company_id = ?
    AND task_type = 'telegram_channel_research'
    AND status IN ('queued', 'running', 'needs_review')
  LIMIT 1
`)
const insertTask = db.prepare(`
  INSERT INTO ai_tasks(agent_id, company_id, task_type, priority, prompt, due_at)
  VALUES (?, ?, 'telegram_channel_research', ?, ?, date('now', '+2 day'))
`)

let publicFound = 0
let needsVerification = 0
let notFound = 0
let tasksInserted = 0

db.exec("BEGIN IMMEDIATE")
try {
  for (const company of companies) {
    const publicContact = publicContactForCompany(publicContacts, company.name)
    const contacts = contactsByCompany.get(company.id) ?? []
    const evidence = evidenceFromCompany(company, publicContact, contacts)
    const status = evidence?.status ?? "not_found"
    const sourceNote =
      evidence?.sourceNote ??
      "Публичный Telegram компании пока не найден в CRM, 2ГИС или сохраненных открытых источниках."
    const readiness = evidence?.readiness ?? "none"
    const nextStep =
      evidence?.nextStep ??
      "Проверить официальный сайт, 2ГИС и публичные соцсети; не писать userbot без подтвержденного B2B-канала."

    updateCompany.run(
      evidence?.url ?? null,
      evidence?.username ?? null,
      evidence?.channelType ?? "unknown",
      status,
      evidence?.sourceUrl ?? null,
      sourceNote,
      evidence?.url ?? (status === "needs_verification" ? "needs_verification" : null),
      readiness,
      nextStep,
      company.id
    )

    if (status === "public_found") publicFound += 1
    else if (status === "needs_verification") needsVerification += 1
    else notFound += 1

    if (agent && !findExistingTask.get(agent.id, company.id)) {
      const priority = status === "needs_verification" ? 78 : status === "public_found" ? 72 : 58
      insertTask.run(
        agent.id,
        company.id,
        priority,
        `Проверить Telegram/AI-канал компании ${company.name}. Статус: ${status}. ${nextStep} Источник/заметка: ${sourceNote}`
      )
      tasksInserted += 1
    }
  }
  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
}

db.close()

console.log(JSON.stringify({
  companiesProcessed: companies.length,
  publicFound,
  needsVerification,
  notFound,
  tasksInserted,
  backupDir
}, null, 2))
