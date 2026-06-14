import { spawn } from "node:child_process"
import { agentResultSchema, normalizeAgentResult } from "./agent-runtime-sql.mjs"

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
      input += chunk
    })
    process.stdin.on("error", reject)
    process.stdin.on("end", () => resolve(input))
  })
}

function extractJsonCandidate(value) {
  if (!value) return null
  if (typeof value === "object") return value
  const text = String(value).trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

function chatContent(payload, rawText) {
  if (typeof payload?.choices?.[0]?.message?.content === "string") return payload.choices[0].message.content
  if (typeof payload?.choices?.[0]?.text === "string") return payload.choices[0].text
  if (typeof payload?.output_text === "string") return payload.output_text
  return rawText
}

function fallbackResult(providerRequest, error = null) {
  const task = providerRequest?.context?.task ?? {}
  const companyName = providerRequest?.context?.company?.name || task.company_name || "CRM account"
  return normalizeAgentResult({
    summary: `OmniRoute adapter prepared fallback manager review for ${companyName}.`,
    confidence: "low",
    risk_level: "medium",
    recommended_actions: [
      {
        type: "manager_review",
        title: `Review CRM task #${task.id ?? "unknown"} manually`,
        owner: "sales_manager",
        due_at: null,
        requires_manager_approval: true
      }
    ],
    customer_message_draft: null,
    manager_note: error
      ? `OmniRoute adapter fallback because structured JSON was not returned: ${String(error).slice(0, 500)}`
      : "OmniRoute adapter fallback. Verify the task manually before any business mutation.",
    evidence_sources: [
      {
        label: "CRM task context",
        source_type: "crm",
        url: null,
        note: `Task #${task.id ?? "unknown"}, agent_code=${task.agent_code ?? "unknown"}.`
      }
    ],
    inventory_watchlist: [],
    memory_updates: [],
    next_status: "needs_review"
  })
}

function runOmniRoute(prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn("omniroute", ["--output", "json", "chat", prompt], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    })
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error(`omniroute chat timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(`omniroute chat exited ${code}: ${stderr.slice(0, 1000)}`))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

const rawInput = await readStdin()
const providerRequest = extractJsonCandidate(rawInput)
if (!providerRequest) {
  console.log(JSON.stringify({ result: fallbackResult(null, "Provider request JSON was missing or invalid.") }))
  process.exit(0)
}

const prompt = [
  "You are a CRM AI agent for B2B prepared-food sales.",
  "Return only valid JSON matching the provided result_schema.",
  "Do not wrap the JSON in markdown.",
  "Do not mutate CRM records. Prepare manager-reviewable recommendations only.",
  "Use the CRM context as source of truth and include evidence_sources.",
  JSON.stringify(
    {
      objective: providerRequest.objective,
      instructions: providerRequest.instructions,
      result_schema: providerRequest.result_schema ?? agentResultSchema,
      context: providerRequest.context
    },
    null,
    2
  )
].join("\n\n")

try {
  const timeoutMs = Number.parseInt(process.env.AGENT_LLM_TIMEOUT_MS || "45000", 10)
  const { stdout } = await runOmniRoute(prompt, Number.isFinite(timeoutMs) ? timeoutMs : 45000)
  const completion = extractJsonCandidate(stdout)
  const content = chatContent(completion, stdout)
  const resultJson = extractJsonCandidate(content)
  const result = normalizeAgentResult(resultJson?.result ?? resultJson ?? fallbackResult(providerRequest, "No JSON result in OmniRoute response."))
  console.log(JSON.stringify({ result }))
} catch (error) {
  console.log(JSON.stringify({ result: fallbackResult(providerRequest, error?.message ?? error) }))
}
