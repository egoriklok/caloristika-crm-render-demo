import { DatabaseSync } from "node:sqlite"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const db = new DatabaseSync(join(root, "data", "lunch_up_crm.sqlite"))
const contacts = JSON.parse(readFileSync(join(root, "data", "public-contacts.json"), "utf-8"))

const updateCompany = db.prepare(`
  UPDATE companies
  SET public_contact_url = COALESCE(?, public_contact_url),
      updated_at = CURRENT_TIMESTAMP
  WHERE name = ?
`)
const getCompany = db.prepare("SELECT id FROM companies WHERE name = ?")
const getContact = db.prepare("SELECT id FROM contacts WHERE company_id = ? LIMIT 1")
const updateContact = db.prepare(`
  UPDATE contacts
  SET name = 'Публичный B2B-канал',
      role = 'Коммерческий отдел / закупки / общий контакт',
      email = ?,
      phone = ?,
      preferred_channel = ?,
      is_public = 1,
      consent_basis = 'public_business_channel',
      notes = ?
  WHERE id = ?
`)
const insertContact = db.prepare(`
  INSERT INTO contacts(company_id, name, role, email, phone, preferred_channel, is_public, consent_basis, notes)
  VALUES (?, 'Публичный B2B-канал', 'Коммерческий отдел / закупки / общий контакт', ?, ?, ?, 1, 'public_business_channel', ?)
`)

let updated = 0
let withEmail = 0
let withPhone = 0
for (const item of contacts) {
  const company = getCompany.get(item.company)
  if (!company) continue
  updateCompany.run(item.source_url ?? null, item.company)
  const noteParts = [item.notes]
  if (item.source_url) noteParts.push(`Источник: ${item.source_url}`)
  const notes = noteParts.filter(Boolean).join(" ")
  const existing = getContact.get(company.id)
  if (existing) {
    updateContact.run(item.email ?? null, item.phone ?? null, item.preferred_channel ?? "site", notes, existing.id)
  } else {
    insertContact.run(company.id, item.email ?? null, item.phone ?? null, item.preferred_channel ?? "site", notes)
  }
  updated += 1
  if (item.email) withEmail += 1
  if (item.phone) withPhone += 1
}

db.close()
console.log(JSON.stringify({ updated, withEmail, withPhone }, null, 2))
