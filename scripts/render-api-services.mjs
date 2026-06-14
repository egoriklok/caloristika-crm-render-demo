import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadLocalEnv } from "./local-env.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const workspaceRoot = join(root, "..")
loadLocalEnv(root)

const apiBaseUrl = "https://api.render.com/v1"
const command = process.argv[2] || "plan"
const apiKey = (process.env.RENDER_API_KEY || "").trim()
const ownerId = (readArg("--owner-id") || process.env.RENDER_OWNER_ID || "").trim()

const services = [
  {
    name: "caloristika-crm-demo",
    kind: "web_service",
    repo: "https://github.com/egoriklok/caloristika-crm-render-demo",
    localPath: root,
    branch: "main",
    requiredEnv: ["CRM_ACCESS_KEY"],
    optionalEnv: ["DGIS_API_KEY", "DADATA_API_KEY", "APIFY_TOKEN", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"],
    envVars: [
      ["NODE_VERSION", "24.14.1"],
      ["NODE_ENV", "production"],
      ["NEXT_TELEMETRY_DISABLED", "1"],
      ["CRM_NEXT_MODE", "start"],
      ["HOST", "0.0.0.0"],
      ["LUNCH_UP_CRM_DB_PATH", "/opt/render/project/src/data/caloristika_demo_crm.sqlite"],
      ["LUNCH_UP_SQLITE_WAL", "0"],
      ["LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS", "5000"],
      ["LUNCH_UP_SQLITE_MMAP_SIZE", "268435456"],
      ["AGENT_LLM_PROVIDER", "offline"]
    ],
    serviceDetails: {
      runtime: "node",
      plan: "free",
      region: "oregon",
      healthCheckPath: "/api/health",
      envSpecificDetails: {
        buildCommand: "npm ci --include=dev && npm run build:render",
        startCommand: "npm run start:render"
      }
    }
  },
  {
    name: "caloristika-b2b-crm-demo",
    kind: "static_site",
    repo: "https://github.com/egoriklok/caloristika-b2b-crm-demo",
    localPath: join(workspaceRoot, "caloristika-b2b-crm-demo"),
    branch: "main",
    envVars: [
      ["NODE_VERSION", "24.14.1"],
      ["VITE_BASE_PATH", "/"]
    ],
    serviceDetails: {
      buildCommand: "npm ci && npm run build",
      publishPath: "dist",
      routes: [{ type: "rewrite", source: "/*", destination: "/index.html" }]
    }
  },
  {
    name: "agentic-crm-product-blueprint",
    kind: "static_site",
    repo: "https://github.com/egoriklok/agentic-crm-product-blueprint",
    localPath: join(workspaceRoot, "agentic-crm-product-blueprint"),
    branch: "main",
    envVars: [
      ["NODE_VERSION", "24.14.1"],
      ["VITE_BASE_PATH", "/"]
    ],
    serviceDetails: {
      buildCommand: "npm ci && npm run verify",
      publishPath: "dist",
      routes: [{ type: "rewrite", source: "/*", destination: "/index.html" }]
    }
  }
]

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ""
}

function redact(value) {
  return value ? "<set>" : "<empty>"
}

function expectedGitRemote(service) {
  return `${service.repo}.git`
}

function buildEnvVars(service) {
  const envVars = service.envVars.map(([key, value]) => ({ key, value }))
  for (const key of service.requiredEnv || []) {
    const value = (process.env[key] || "").trim()
    if (!value) {
      throw new Error(`${service.name} requires ${key}. Set it in .env.local or process env before create.`)
    }
    envVars.push({ key, value })
  }
  for (const key of service.optionalEnv || []) {
    const value = (process.env[key] || "").trim()
    if (value) envVars.push({ key, value })
  }
  return envVars
}

function buildPayload(service) {
  return {
    type: service.kind,
    name: service.name,
    ownerId,
    repo: service.repo,
    branch: service.branch,
    autoDeploy: "yes",
    envVars: buildEnvVars(service),
    serviceDetails: service.serviceDetails
  }
}

function redactedPayload(service) {
  const payload = buildPayload({ ...service, requiredEnv: [], optionalEnv: [] })
  const envKeys = [
    ...payload.envVars.map((item) => ({ key: item.key, value: item.value })),
    ...(service.requiredEnv || []).map((key) => ({ key, value: redact(process.env[key]) })),
    ...(service.optionalEnv || []).map((key) => ({ key, value: redact(process.env[key]) }))
  ]
  return { ...payload, ownerId: ownerId || "<RENDER_OWNER_ID>", envVars: envKeys }
}

function renderBlueprintLink(service) {
  return `https://render.com/deploy?repo=${encodeURIComponent(service.repo)}`
}

function git(repoPath, args) {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim()
}

function repoPreflight(service) {
  const result = {
    name: service.name,
    path: service.localPath,
    exists: existsSync(service.localPath),
    clean: false,
    onMain: false,
    remoteMatches: false,
    renderYaml: false,
    status: "",
    remote: "",
    errors: []
  }

  if (!result.exists) {
    result.errors.push("local repo path is missing")
    return result
  }

  try {
    result.status = git(service.localPath, ["status", "--short", "--branch"])
    const statusLines = result.status.split(/\r?\n/).filter(Boolean)
    result.onMain = statusLines[0]?.startsWith("## main") ?? false
    result.clean = statusLines.length === 1
  } catch (error) {
    result.errors.push(`git status failed: ${error.message}`)
  }

  try {
    result.remote = git(service.localPath, ["remote", "get-url", "origin"])
    result.remoteMatches = result.remote === service.repo || result.remote === expectedGitRemote(service)
  } catch (error) {
    result.errors.push(`git remote failed: ${error.message}`)
  }

  result.renderYaml = existsSync(join(service.localPath, "render.yaml"))
  if (!result.renderYaml) result.errors.push("render.yaml is missing")

  return result
}

function printPreflight() {
  console.log("Render migration preflight")
  console.log(`- RENDER_API_KEY: ${redact(apiKey)}`)
  console.log(`- RENDER_OWNER_ID: ${ownerId || "<missing>"}`)
  console.log(`- CRM_ACCESS_KEY: ${redact(process.env.CRM_ACCESS_KEY)}`)
  console.log(`- DGIS_API_KEY: ${redact(process.env.DGIS_API_KEY)}`)
  console.log(`- APIFY_TOKEN: ${redact(process.env.APIFY_TOKEN)}`)
  console.log("")

  let reposReady = true
  for (const service of services) {
    const result = repoPreflight(service)
    const ready = result.exists && result.clean && result.onMain && result.remoteMatches && result.renderYaml && result.errors.length === 0
    reposReady = reposReady && ready
    console.log(`${ready ? "OK" : "CHECK"} ${service.name}`)
    console.log(`  type: ${service.kind}`)
    console.log(`  repo: ${service.repo}`)
    console.log(`  local: ${result.path}`)
    console.log(`  branch/main: ${result.onMain ? "yes" : "no"}`)
    console.log(`  clean: ${result.clean ? "yes" : "no"}`)
    console.log(`  remote matches: ${result.remoteMatches ? "yes" : "no"}`)
    console.log(`  render.yaml: ${result.renderYaml ? "yes" : "no"}`)
    console.log(`  dashboard deploy: ${renderBlueprintLink(service)}`)
    if (result.errors.length > 0) console.log(`  issues: ${result.errors.join("; ")}`)
    console.log("")
  }

  const readyToCreate = Boolean(apiKey && ownerId && process.env.CRM_ACCESS_KEY && reposReady)
  if (readyToCreate) {
    console.log("Next: npm run render:api -- create")
  } else {
    console.log("Next actions:")
    if (!apiKey || !process.env.CRM_ACCESS_KEY) console.log("- Run: npm run render:env")
    if (apiKey && !ownerId) console.log("- Run: npm run render:api -- workspaces, then npm run render:env -- -OwnerId <tea_...>")
    if (!reposReady) console.log("- Fix repo checks before creating Render services")
  }
}

async function renderApi(path, options = {}) {
  if (!apiKey) throw new Error("RENDER_API_KEY is missing. Set it locally; do not paste it into chat.")
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`Render API ${options.method || "GET"} ${path} failed: HTTP ${response.status} ${JSON.stringify(payload)}`)
  }
  return payload
}

async function listWorkspaces() {
  const rows = await renderApi("/owners?limit=100")
  console.log("Render workspaces:")
  for (const row of rows) {
    const owner = row.owner || row
    console.log(`- ${owner.name || owner.email || "workspace"}: ${owner.id}`)
  }
}

async function listServices() {
  if (!ownerId) throw new Error("RENDER_OWNER_ID is missing. Run `npm run render:api -- workspaces` and set RENDER_OWNER_ID.")
  const rows = await renderApi(`/services?ownerId=${encodeURIComponent(ownerId)}&limit=100`)
  return rows.map((row) => row.service || row)
}

async function createServices() {
  if (!ownerId) throw new Error("RENDER_OWNER_ID is missing. Run `npm run render:api -- workspaces` and set RENDER_OWNER_ID.")
  const existing = await listServices()
  const byName = new Map(existing.map((service) => [service.name, service]))
  for (const service of services) {
    if (byName.has(service.name)) {
      const current = byName.get(service.name)
      console.log(`Skip existing ${service.name}: ${current.serviceDetails?.url || current.dashboardUrl || current.id}`)
      continue
    }
    const created = await renderApi("/services", {
      method: "POST",
      body: JSON.stringify(buildPayload(service))
    })
    const createdService = created.service || created
    console.log(`Created ${service.name}: ${createdService.serviceDetails?.url || createdService.dashboardUrl || createdService.id}`)
  }
}

function printPlan() {
  console.log("Render API deployment plan")
  console.log(`- RENDER_API_KEY: ${redact(apiKey)}`)
  console.log(`- RENDER_OWNER_ID: ${ownerId || "<missing>"}`)
  for (const service of services) {
    console.log("")
    console.log(JSON.stringify(redactedPayload(service), null, 2))
  }
}

if (command === "preflight") {
  printPreflight()
} else if (command === "plan") {
  printPlan()
} else if (command === "workspaces") {
  await listWorkspaces()
} else if (command === "services") {
  const rows = await listServices()
  for (const service of rows) {
    console.log(`- ${service.name}: ${service.type} ${service.serviceDetails?.url || service.dashboardUrl || service.id}`)
  }
} else if (command === "create") {
  await createServices()
} else {
  console.error("Usage:")
  console.error("  npm run render:api -- preflight")
  console.error("  npm run render:api -- plan")
  console.error("  npm run render:api -- workspaces")
  console.error("  npm run render:api -- services --owner-id <tea_...>")
  console.error("  npm run render:api -- create --owner-id <tea_...>")
  process.exit(2)
}
