import { spawn } from "node:child_process"

import { agentResultSchema, boundedInteger, normalizeAgentResult } from "./agent-runtime-sql.mjs"

const supportedProviders = new Set(["offline", "openai", "paperclip", "hermes", "openclaw", "omniroute"])

function clean(value) {
  const text = String(value ?? "").trim()
  return text.length ? text : null
}

function firstConfigured(...values) {
  for (const value of values) {
    const text = clean(value)
    if (text) return text
  }
  return null
}

function normalizeProvider(value) {
  const provider = clean(value)?.toLowerCase() ?? null
  if (!provider) return null
  if (provider === "none" || provider === "dry-run" || provider === "dry_run" || provider === "no-llm") return "offline"
  if (provider === "openai_responses") return "openai"
  if (provider === "omnirouter") return "omniroute"
  return supportedProviders.has(provider) ? provider : null
}

function providerEndpoint(provider) {
  if (provider === "paperclip") {
    return firstConfigured(process.env.PAPERCLIP_AGENT_ENDPOINT, process.env.PAPERCLIP_API_URL)
  }
  if (provider === "hermes") {
    return firstConfigured(process.env.HERMES_AGENT_ENDPOINT, process.env.HERMES_GATEWAY_URL)
  }
  if (provider === "openclaw") {
    return firstConfigured(process.env.OPENCLAW_AGENT_ENDPOINT, process.env.OPENCLAW_GATEWAY_URL)
  }
  if (provider === "omniroute") {
    return firstConfigured(process.env.OMNIROUTER_AGENT_ENDPOINT, process.env.OMNIROUTE_AGENT_ENDPOINT)
  }
  return null
}

function providerCommand(provider) {
  if (provider === "paperclip") return clean(process.env.PAPERCLIP_AGENT_COMMAND)
  if (provider === "hermes") return clean(process.env.HERMES_AGENT_COMMAND)
  if (provider === "openclaw") return clean(process.env.OPENCLAW_AGENT_COMMAND)
  if (provider === "omniroute") return firstConfigured(process.env.OMNIROUTER_AGENT_COMMAND, process.env.OMNIROUTE_AGENT_COMMAND)
  return null
}

function providerApiKey(provider) {
  if (provider === "paperclip") return clean(process.env.PAPERCLIP_API_KEY)
  if (provider === "hermes") return clean(process.env.HERMES_API_KEY)
  if (provider === "openclaw") return clean(process.env.OPENCLAW_API_KEY)
  if (provider === "omniroute") return firstConfigured(process.env.OMNIROUTER_API_KEY, process.env.OMNIROUTE_API_KEY)
  return null
}

function providerModel(provider, args) {
  const explicit = clean(args.values.get("model"))
  if (explicit) return explicit
  if (provider === "openai") return firstConfigured(process.env.OPENAI_AGENT_MODEL, process.env.AGENT_LLM_MODEL) ?? "gpt-4.1-mini"
  if (provider === "paperclip") return firstConfigured(process.env.PAPERCLIP_AGENT_MODEL, process.env.AGENT_LLM_MODEL)
  if (provider === "hermes") return firstConfigured(process.env.HERMES_AGENT_MODEL, process.env.AGENT_LLM_MODEL)
  if (provider === "openclaw") return firstConfigured(process.env.OPENCLAW_AGENT_MODEL, process.env.AGENT_LLM_MODEL)
  if (provider === "omniroute") return firstConfigured(process.env.OMNIROUTER_MODEL, process.env.OMNIROUTE_MODEL, process.env.AGENT_LLM_MODEL)
  return null
}

function providerBaseUrl(provider) {
  if (provider === "omniroute") return firstConfigured(process.env.OMNIROUTER_BASE_URL, process.env.OMNIROUTE_BASE_URL)
  return null
}

export function resolveAgentRuntime(args) {
  const forcedOffline = args.flags.has("no-llm") || args.flags.has("dry-run")
  const explicitProvider = normalizeProvider(args.values.get("provider") ?? process.env.AGENT_LLM_PROVIDER ?? process.env.AGENT_RUNTIME_PROVIDER)
  const legacyProvider = process.env.AGENT_LLM_ENABLED === "1" ? "openai" : "offline"
  const provider = forcedOffline ? "offline" : explicitProvider ?? legacyProvider
  const model = providerModel(provider, args)
  const endpoint = providerEndpoint(provider)
  const command = providerCommand(provider)
  const baseUrl = providerBaseUrl(provider)

  if (!supportedProviders.has(provider)) {
    throw new Error(`Unsupported AGENT_LLM_PROVIDER: ${provider}`)
  }

  let mode = "offline"
  if (provider === "openai") mode = "openai_responses"
  if (provider === "omniroute" && !endpoint && !command) mode = "omniroute_chat_completions"
  if (provider !== "offline" && provider !== "openai") mode = endpoint ? `${provider}_http` : `${provider}_command`
  if (provider === "omniroute" && !endpoint && !command) mode = "omniroute_chat_completions"

  return {
    provider,
    mode,
    model,
    endpoint,
    baseUrl,
    command,
    timeoutMs: boundedInteger(process.env.AGENT_LLM_TIMEOUT_MS, 45000, 5000, 180000),
    apiKeyConfigured: Boolean(providerApiKey(provider)),
    endpointConfigured: Boolean(endpoint || baseUrl),
    commandConfigured: Boolean(command)
  }
}

function buildProviderRequest(provider, context) {
  return {
    schema_version: "lunch-up-crm-agent-runtime.v1",
    provider,
    objective:
      "Analyze this Lunch Up CRM task and produce manager-reviewable next actions for sales, orders, support, replenishment or lead enrichment.",
    instructions: [
      "Return only JSON matching result_schema.",
      "Use CRM context as authoritative. Do not invent prices, SKU, order dates, stock counts, contacts or legal facts.",
      "Every recommendation must include evidence_sources with CRM/API/source notes. Use null url when evidence is internal CRM context.",
      "Do not mutate CRM data directly. Any order, stock, contact, deal, export or customer message needs manager approval.",
      "Customer-facing copy must be concise, B2B-safe and in Russian.",
      "Commercial scope is Saint Petersburg and Leningrad Oblast."
    ],
    result_schema: agentResultSchema,
    context
  }
}

function parseJsonCandidate(value) {
  if (!value) return null
  if (typeof value === "object") return value
  if (typeof value !== "string") return null
  const text = value.trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractJsonFromText(text) {
  const direct = parseJsonCandidate(text)
  if (direct) return direct
  const trimmed = String(text ?? "").trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return parseJsonCandidate(trimmed.slice(start, end + 1))
}

function coerceProviderResult(payload, fallbackSummary) {
  if (payload && typeof payload === "object") {
    const direct = payload
    if (direct.result && typeof direct.result === "object") return normalizeAgentResult(direct.result)
    if (direct.output && typeof direct.output === "object" && !Array.isArray(direct.output)) return normalizeAgentResult(direct.output)
    if (typeof direct.output_text === "string") {
      const parsed = extractJsonFromText(direct.output_text)
      return parsed ? normalizeAgentResult(parsed.result ?? parsed) : normalizeAgentResult({ summary: direct.output_text })
    }
    if (typeof direct.text === "string") {
      const parsed = extractJsonFromText(direct.text)
      return parsed ? normalizeAgentResult(parsed.result ?? parsed) : normalizeAgentResult({ summary: direct.text })
    }
    return normalizeAgentResult(direct)
  }
  const parsed = extractJsonFromText(payload)
  if (parsed) return normalizeAgentResult(parsed.result ?? parsed)
  return normalizeAgentResult({ summary: fallbackSummary })
}

function extractOpenAiText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text
  const parts = []
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") parts.push(content.text)
    }
  }
  return parts.join("\n").trim()
}

async function callOpenAi(context, runtime) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when AGENT_LLM_PROVIDER=openai")
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), runtime.timeoutMs)
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: runtime.model,
        instructions: buildProviderRequest("openai", context).instructions.join("\n"),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(
                  {
                    objective:
                      "Analyze this CRM task and produce manager-reviewable next actions for orders, customer support, sales demand, or replenishment.",
                    context
                  },
                  null,
                  2
                )
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "lunch_up_crm_agent_result",
            schema: agentResultSchema,
            strict: true
          }
        }
      })
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(`OpenAI Responses API returned ${response.status}: ${JSON.stringify(payload)?.slice(0, 1000)}`)
    }
    const text = extractOpenAiText(payload)
    if (!text) throw new Error("OpenAI Responses API returned no text output")
    return normalizeAgentResult(JSON.parse(text))
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").replace(/\/+$/, "")
}

async function callOmniroute(context, runtime) {
  const baseUrl = normalizeBaseUrl(runtime.baseUrl)
  if (!baseUrl) {
    throw new Error("OMNIROUTER_BASE_URL or OMNIROUTE_BASE_URL is required when AGENT_LLM_PROVIDER=omniroute")
  }
  const model = runtime.model
  if (!model) {
    throw new Error("OMNIROUTER_MODEL, OMNIROUTE_MODEL or AGENT_LLM_MODEL is required when AGENT_LLM_PROVIDER=omniroute")
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), runtime.timeoutMs)
  const headers = {
    "content-type": "application/json"
  }
  const apiKey = providerApiKey("omniroute")
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  const providerRequest = buildProviderRequest("omniroute", context)
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: providerRequest.instructions.join("\n")
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                objective: providerRequest.objective,
                result_schema: providerRequest.result_schema,
                context
              },
              null,
              2
            )
          }
        ]
      })
    })
    const text = await response.text()
    const parsed = extractJsonFromText(text)
    if (!response.ok) {
      throw new Error(`OmniRoute chat/completions returned ${response.status}: ${text.slice(0, 1000)}`)
    }
    const content = parsed?.choices?.[0]?.message?.content ?? parsed?.choices?.[0]?.text ?? parsed?.output_text ?? text
    const contentJson = extractJsonFromText(content)
    return coerceProviderResult(contentJson ?? content, "OmniRoute returned a non-JSON response.")
  } finally {
    clearTimeout(timeout)
  }
}

async function callHttpProvider(context, runtime) {
  if (!runtime.endpoint) {
    throw new Error(`${runtime.provider} provider requires ${runtime.provider.toUpperCase()}_AGENT_ENDPOINT or a provider command`)
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), runtime.timeoutMs)
  const headers = {
    "content-type": "application/json"
  }
  const apiKey = providerApiKey(runtime.provider)
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  try {
    const response = await fetch(runtime.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify(buildProviderRequest(runtime.provider, context))
    })
    const text = await response.text()
    const parsed = extractJsonFromText(text)
    if (!response.ok) {
      throw new Error(`${runtime.provider} HTTP provider returned ${response.status}: ${text.slice(0, 1000)}`)
    }
    return coerceProviderResult(parsed ?? text, `${runtime.provider} returned a non-JSON response.`)
  } finally {
    clearTimeout(timeout)
  }
}

async function callCommandProvider(context, runtime) {
  if (!runtime.command) {
    throw new Error(`${runtime.provider} provider requires an HTTP endpoint or ${runtime.provider.toUpperCase()}_AGENT_COMMAND`)
  }
  const payload = JSON.stringify(buildProviderRequest(runtime.provider, context))
  return new Promise((resolve, reject) => {
    const child = spawn(runtime.command, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    })
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error(`${runtime.provider} command timed out after ${runtime.timeoutMs}ms`))
    }, runtime.timeoutMs)

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
        reject(new Error(`${runtime.provider} command exited ${code}: ${stderr.slice(0, 1000)}`))
        return
      }
      const parsed = extractJsonFromText(stdout)
      resolve(coerceProviderResult(parsed ?? stdout, `${runtime.provider} command returned no structured JSON.`))
    })
    child.stdin.end(payload)
  })
}

export async function runAgentProvider(context, runtime) {
  if (runtime.provider === "offline") {
    throw new Error("Offline provider is handled by deterministic worker mode")
  }
  if (runtime.provider === "openai") return callOpenAi(context, runtime)
  if (runtime.provider === "omniroute" && !runtime.endpoint && !runtime.command) return callOmniroute(context, runtime)
  if (runtime.endpoint) return callHttpProvider(context, runtime)
  return callCommandProvider(context, runtime)
}
