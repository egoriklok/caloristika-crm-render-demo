import { getDb } from "@/lib/db"
import {
  ensureCompanyEnrichmentSchema,
  lookupCompanyEnrichment,
  saveCompanyEnrichment,
  type CompanyEnrichmentInput,
  type CompanyEnrichmentResult
} from "@/lib/company-enrichment"

export class CompanyEnrichmentRefreshError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "CompanyEnrichmentRefreshError"
    this.status = status
  }
}

export type CompanyEnrichmentRefreshOptions = {
  force_refresh?: boolean
  forceRefresh?: boolean
  cache_ttl_hours?: number
  cacheTtlHours?: number
  dry_run?: boolean
  dryRun?: boolean
}

export type CompanyEnrichmentBatchOptions = CompanyEnrichmentRefreshOptions & {
  company_ids?: number[]
  companyIds?: number[]
  only_missing?: boolean
  onlyMissing?: boolean
  limit?: number
  segment?: string | null
}

export type CompanyEnrichmentRefreshResult = {
  ok: true
  company_id: number
  company_name: string
  dry_run: boolean
  saved: boolean
  cache_hit: boolean
  cache: CompanyEnrichmentResult["cache"] | null
  source_statuses: Record<string, string>
  enrichment: CompanyEnrichmentResult
}

export type CompanyEnrichmentBatchResult = {
  ok: true
  dry_run: boolean
  limit: number
  requested: number
  processed: number
  saved: number
  cache_hits: number
  failed: number
  only_missing: boolean
  segment: string | null
  results: Array<
    | (CompanyEnrichmentRefreshResult & { error?: never })
    | {
        ok: false
        company_id: number
        company_name: string | null
        error: string
      }
  >
}

type CompanyEnrichmentSeed = CompanyEnrichmentInput & {
  company_id: number
  company_name: string
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 10
  return Math.max(1, Math.min(10, Math.round(parsed)))
}

function normalizeTtlHours(options: CompanyEnrichmentRefreshOptions) {
  const candidate = Number(options.cache_ttl_hours ?? options.cacheTtlHours)
  return Number.isFinite(candidate) && candidate > 0 ? candidate : undefined
}

function normalizeCompanyIds(options: CompanyEnrichmentBatchOptions) {
  const ids = options.company_ids ?? options.companyIds ?? []
  return Array.from(
    new Set(
      ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  )
}

function sourceStatuses(enrichment: CompanyEnrichmentResult) {
  return Object.fromEntries(enrichment.sources.map((source) => [source.source, source.status]))
}

export function getCompanyEnrichmentSeed(companyId: number): CompanyEnrichmentSeed {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new CompanyEnrichmentRefreshError("Invalid company id", 400)
  }

  const db = getDb()
  const company = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.segment,
      c.website,
      c.address AS company_address,
      lp.inn,
      lp.address AS local_address
    FROM companies c
    LEFT JOIN local_prospects lp
      ON lower(lp.name) LIKE lower('%' || c.name || '%')
      OR (c.website IS NOT NULL AND lp.website = c.website)
    WHERE c.id = ?
    ORDER BY lp.score DESC
    LIMIT 1
  `).get(companyId) as
    | {
        id: number
        name: string
        segment: string | null
        website: string | null
        company_address: string | null
        inn: string | null
        local_address: string | null
      }
    | undefined

  if (!company) {
    throw new CompanyEnrichmentRefreshError("Company not found", 404)
  }

  return {
    company_id: company.id,
    company_name: company.name,
    inn: company.inn,
    website: company.website,
    address: company.company_address ?? company.local_address,
    segment: company.segment
  }
}

export function listCompanyEnrichmentBatchTargets(options: CompanyEnrichmentBatchOptions = {}) {
  ensureCompanyEnrichmentSchema()
  const explicitIds = normalizeCompanyIds(options)
  if (explicitIds.length) return explicitIds.slice(0, normalizeLimit(options.limit))

  const db = getDb()
  const limit = normalizeLimit(options.limit)
  const onlyMissing = options.only_missing ?? options.onlyMissing ?? true
  const segment = cleanText(options.segment)
  const params: Array<string | number> = []
  const where = ["1 = 1"]

  if (onlyMissing) {
    where.push("(ep.company_id IS NULL OR ep.office_people_min IS NULL OR ep.updated_at IS NULL)")
  }

  if (segment) {
    where.push("lower(c.segment) = lower(?)")
    params.push(segment)
  }

  params.push(limit)
  const rows = db.prepare(`
    SELECT c.id
    FROM companies c
    LEFT JOIN company_enrichment_profiles ep ON ep.company_id = c.id
    WHERE ${where.join(" AND ")}
    ORDER BY
      CASE WHEN ep.company_id IS NULL THEN 0 ELSE 1 END,
      c.lead_score DESC,
      c.id DESC
    LIMIT ?
  `).all(...params) as Array<{ id: number }>

  return rows.map((row) => row.id)
}

export async function refreshCompanyEnrichmentById(companyId: number, options: CompanyEnrichmentRefreshOptions = {}): Promise<CompanyEnrichmentRefreshResult> {
  const seed = getCompanyEnrichmentSeed(companyId)
  const dryRun = options.dry_run === true || options.dryRun === true
  const forceRefresh = options.force_refresh === true || options.forceRefresh === true
  const enrichment = await lookupCompanyEnrichment(seed, {
    useCache: !forceRefresh,
    ttlHours: normalizeTtlHours(options)
  })
  const cacheHit = enrichment.cache?.hit === true
  const saved = !dryRun && !cacheHit

  if (saved) {
    saveCompanyEnrichment(seed.company_id, enrichment)
  }

  return {
    ok: true,
    company_id: seed.company_id,
    company_name: seed.company_name,
    dry_run: dryRun,
    saved,
    cache_hit: cacheHit,
    cache: enrichment.cache ?? null,
    source_statuses: sourceStatuses(enrichment),
    enrichment
  }
}

export async function refreshCompanyEnrichmentBatch(options: CompanyEnrichmentBatchOptions = {}): Promise<CompanyEnrichmentBatchResult> {
  const limit = normalizeLimit(options.limit)
  const dryRun = options.dry_run === true || options.dryRun === true
  const onlyMissing = options.only_missing ?? options.onlyMissing ?? true
  const segment = cleanText(options.segment)
  const targetIds = listCompanyEnrichmentBatchTargets({ ...options, limit })
  const results: CompanyEnrichmentBatchResult["results"] = []

  for (const companyId of targetIds) {
    try {
      results.push(await refreshCompanyEnrichmentById(companyId, options))
    } catch (error) {
      let companyName: string | null = null
      try {
        companyName = getCompanyEnrichmentSeed(companyId).company_name
      } catch {
        companyName = null
      }
      results.push({
        ok: false,
        company_id: companyId,
        company_name: companyName,
        error: error instanceof Error ? error.message : "Unknown enrichment error"
      })
    }
  }

  const successful = results.filter((item) => item.ok)
  return {
    ok: true,
    dry_run: dryRun,
    limit,
    requested: targetIds.length,
    processed: results.length,
    saved: successful.filter((item) => item.saved).length,
    cache_hits: successful.filter((item) => item.cache_hit).length,
    failed: results.filter((item) => !item.ok).length,
    only_missing: onlyMissing,
    segment,
    results
  }
}
