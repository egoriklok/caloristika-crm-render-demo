import { DatabaseSync } from "node:sqlite"
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const db = new DatabaseSync(join(root, "data", "lunch_up_crm.sqlite"))

const companies = db.prepare(`
  SELECT id, name, website, public_contact_url
  FROM companies
  WHERE website IS NOT NULL
  ORDER BY lead_score DESC, name
`).all()

const contactPaths = [
  "",
  "/contacts",
  "/kontakty",
  "/contact",
  "/about/contacts"
]

function normalizePhone(value) {
  return value
    .replace(/^tel:/i, "")
    .replace(/[\u00a0\s]+/g, " ")
    .replace(/[^\d+() -]/g, "")
    .trim()
}

function normalizeEmail(value) {
  return value.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase()
}

function extractContacts(html) {
  const emails = new Set()
  const phones = new Set()

  for (const match of html.matchAll(/mailto:([^"'<>\s]+)/gi)) {
    emails.add(normalizeEmail(match[0]))
  }
  for (const match of html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const email = normalizeEmail(match[0])
    if (!email.includes(".png") && !email.includes(".jpg") && !email.includes(".webp")) {
      emails.add(email)
    }
  }
  for (const match of html.matchAll(/tel:([^"'<>\s]+)/gi)) {
    const phone = normalizePhone(match[0])
    if (phone.length >= 7) phones.add(phone)
  }
  for (const match of html.matchAll(/(?:\+7|8)[\s(.-]*\d{3}[\s). -]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g)) {
    phones.add(normalizePhone(match[0]))
  }
  return {
    emails: [...emails].filter(Boolean),
    phones: [...phones].filter(Boolean)
  }
}

function candidateUrls(rawUrl) {
  if (!rawUrl || rawUrl.includes("google.com/search")) return []
  const base = new URL(rawUrl)
  return [...new Set(contactPaths.map((path) => new URL(path, base.origin).toString()))]
}

const results = []
for (const company of companies) {
  const urls = candidateUrls(company.public_contact_url || company.website)
  const found = { emails: new Set(), phones: new Set(), sources: [] }
  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3500)
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 LunchUpCRMContactResearch/1.0"
        },
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (!response.ok) continue
      const contentType = response.headers.get("content-type") || ""
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) continue
      const html = await response.text()
      const contacts = extractContacts(html)
      contacts.emails.forEach((email) => found.emails.add(email))
      contacts.phones.forEach((phone) => found.phones.add(phone))
      if (contacts.emails.length || contacts.phones.length) found.sources.push(url)
      if (found.emails.size || found.phones.size) break
    } catch {
      // Keep going: many sites block bots or rely on client-side rendering.
    }
  }
  results.push({
    id: company.id,
    name: company.name,
    website: company.website,
    email: [...found.emails][0] || null,
    phone: [...found.phones][0] || null,
    source_url: found.sources[0] || company.public_contact_url || company.website
  })
  writeFileSync(join(root, "logs", "public-contact-discovery.json"), JSON.stringify(results, null, 2), "utf-8")
}

writeFileSync(join(root, "logs", "public-contact-discovery.json"), JSON.stringify(results, null, 2), "utf-8")
console.log(JSON.stringify(results, null, 2))
db.close()
