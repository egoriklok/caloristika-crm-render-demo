import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
loadLocalEnv(root)

const args = process.argv.slice(2)
const queryArg = args.find((arg) => arg.startsWith("--query="))
const query = queryArg ? queryArg.slice("--query=".length).trim() : "Санкт-Петербург бизнес центр"
const key = (process.env.DGIS_API_KEY || process.env.TWO_GIS_API_KEY || "").trim()
const baseUrl = (process.env.DGIS_API_BASE_URL || "https://catalog.api.2gis.com/3.0/items").trim()
const fields = [
  "items.point",
  "items.contact_groups",
  "items.rubrics",
  "items.address_name",
  "items.full_name",
  "items.reviews",
  "items.links",
  "items.employees_org_count",
  "items.itin"
].join(",")

function maskSecret(value) {
  if (!value) return value
  let masked = String(value)
  if (key) masked = masked.split(key).join("<DGIS_API_KEY>")
  return masked
}

function printResult(status, lines) {
  console.log(`2GIS key check: ${status}`)
  for (const line of lines) console.log(`- ${line}`)
}

if (!key) {
  printResult("NEEDS KEY", [
    "DGIS_API_KEY is empty or missing in .env.local / process environment.",
    "Set DGIS_API_KEY locally or in Render environment variables. The key must not be committed or sent to clients."
  ])
  process.exit(1)
}

const url = new URL(baseUrl)
url.searchParams.set("q", query)
url.searchParams.set("key", key)
url.searchParams.set("page_size", "1")
url.searchParams.set("fields", fields)

const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 15_000)

try {
  const response = await fetch(url, {
    cache: "no-store",
    signal: controller.signal
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message = maskSecret(payload?.error?.message || payload?.meta?.error?.message || payload?.message || text || response.statusText)
    printResult("FAILED", [
      `HTTP ${response.status}`,
      `message: ${message || "2GIS returned an error without a readable message."}`
    ])
    process.exit(2)
  }

  const total = Number(payload?.result?.total ?? 0)
  const items = Array.isArray(payload?.result?.items) ? payload.result.items : []
  const first = items[0] ?? null
  printResult("OK", [
    `official API reachable: ${baseUrl}`,
    `query: ${query}`,
    `total: ${Number.isFinite(total) ? total : "unknown"}`,
    first?.name ? `first result: ${first.name}` : "first result: not returned",
    "secret value was not printed"
  ])
} catch (error) {
  printResult("FAILED", [
    error?.name === "AbortError" ? "request timed out after 15 seconds" : maskSecret(error instanceof Error ? error.message : String(error))
  ])
  process.exit(2)
} finally {
  clearTimeout(timeout)
}
