import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(import.meta.url), "..", "..")

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function readText(path) {
  const fullPath = join(root, path)
  assert(existsSync(fullPath), `Missing required file: ${path}`)
  return readFileSync(fullPath, "utf8")
}

function readJson(path) {
  try {
    return JSON.parse(readText(path))
  } catch (error) {
    fail(`Invalid JSON in ${path}: ${error.message}`)
  }
}

const requiredFiles = [
  "agent-swarm.manifest.json",
  "AGENTS.md",
  "README.md",
  "docs/AI_AGENT_SYSTEM_PRD.md",
  "docs/AGENT_HANDOFF.md",
  "docs/BACKUP_RESTORE.md",
  "docs/VPS_DEPLOYMENT_RUNBOOK.md",
  "docs/FRONTIER_AGENT_READINESS_QA.md",
  "docs/PAPERCLIP_ORCHESTRATOR_CONTRACT.md",
  "docs/AGENT_EVAL_GATES.md",
  "contracts/agent-orchestrator.contract.json",
  "contracts/sqlite-data-boundaries.contract.json",
  "evals/swarm-readiness.scenarios.json"
]

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `Missing required agent readiness artifact: ${file}`)
}

const manifest = readJson("agent-swarm.manifest.json")
for (const field of [
  "repo_name",
  "repo_type",
  "entrypoints",
  "setup_commands",
  "test_commands",
  "guardrails",
  "contracts",
  "eval_scenarios",
  "data_boundaries",
  "orchestrator",
  "readiness_gates"
]) {
  assert(manifest[field] !== undefined, `Manifest missing field: ${field}`)
}

assert(manifest.repo_name === "lunch-up-crm-agent-handoff", "Manifest repo_name is unexpected")
assert(Array.isArray(manifest.entrypoints) && manifest.entrypoints.length >= 4, "Manifest must define CRM entrypoints")
assert(Array.isArray(manifest.contracts) && manifest.contracts.length >= 3, "Manifest must define contracts")
assert(Array.isArray(manifest.eval_scenarios) && manifest.eval_scenarios.length >= 1, "Manifest must define eval scenarios")
assert(Array.isArray(manifest.subagents) && manifest.subagents.length >= 4, "Manifest must define subagents")
assert(manifest.orchestrator?.style === "paperclip_like_bounded_optimizer", "Manifest must define bounded paperclip-style orchestrator")

for (const contractPath of manifest.contracts.filter((path) => path.endsWith(".json"))) {
  readJson(contractPath)
}

const evals = readJson("evals/swarm-readiness.scenarios.json")
assert(Array.isArray(evals.scenarios) && evals.scenarios.length >= 5, "Readiness eval suite must contain at least five scenarios")
for (const scenario of evals.scenarios) {
  assert(scenario.id && scenario.goal && scenario.pass_command, `Eval scenario is incomplete: ${JSON.stringify(scenario)}`)
}

const textExpectations = [
  ["docs/FRONTIER_AGENT_READINESS_QA.md", ["frontier", "orchestrator", "subagent", "agent-swarm.manifest.json"]],
  ["docs/PAPERCLIP_ORCHESTRATOR_CONTRACT.md", ["bounded", "approval", "rollback", "subagent"]],
  ["docs/AGENT_EVAL_GATES.md", ["npm run agent:readiness", "npm run verify", "npm run build", "Red-Team"]]
]

for (const [file, terms] of textExpectations) {
  const source = readText(file).toLowerCase()
  for (const term of terms) {
    assert(source.includes(term.toLowerCase()), `${file} must mention ${term}`)
  }
}

const forbiddenFiles = []
const secretPatterns = [
  [/gho_[A-Za-z0-9_]{20,}/, "GitHub OAuth token"],
  [/github_pat_[A-Za-z0-9_]{20,}/, "GitHub fine-grained token"],
  [/apify_api_[A-Za-z0-9_-]{20,}/, "Apify API token"],
  [/sk-[A-Za-z0-9_-]{20,}/, "OpenAI-style API key"],
  [/[?&]key=(?!<|%3C|\$\{|encodeURIComponent|\$CRM_ACCESS_KEY)[A-Za-z0-9_-]{16,}/, "live CRM access key in URL"]
]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".git", ".next", "node_modules"].includes(entry.name)) continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
    } else {
      files.push(fullPath)
    }
  }
  return files
}

for (const fullPath of walk(root)) {
  const rel = relative(root, fullPath).replaceAll("\\", "/")
  if (rel === ".env" || rel.endsWith(".pem") || rel.endsWith(".key") || rel.endsWith("id_rsa") || /service-account.*\.json$/i.test(rel)) {
    forbiddenFiles.push(rel)
  }
  const stats = statSync(fullPath)
  if (stats.size > 1024 * 1024) continue
  const text = readFileSync(fullPath, "utf8")
  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(text)) {
      fail(`Potential secret detected (${label}) in ${rel}`)
    }
  }
}

assert(forbiddenFiles.length === 0, `Forbidden secret-like files found: ${forbiddenFiles.join(", ")}`)

console.log("Agent swarm readiness verification passed")
console.log(`Contracts: ${manifest.contracts.length}; eval scenarios: ${evals.scenarios.length}; subagents: ${manifest.subagents.length}`)
