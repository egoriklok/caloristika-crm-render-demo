import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return null
  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed
  const equalsIndex = normalized.indexOf("=")
  if (equalsIndex <= 0) return null

  const key = normalized.slice(0, equalsIndex).trim()
  let value = normalized.slice(equalsIndex + 1).trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

export function loadLocalEnv(root) {
  const loaded = []
  for (const fileName of [".env.local", ".env"]) {
    const envPath = join(root, fileName)
    if (!existsSync(envPath)) continue
    const lines = readFileSync(envPath, "utf-8").split(/\r?\n/)
    for (const line of lines) {
      const parsed = parseEnvLine(line)
      if (!parsed) continue
      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value
        loaded.push(parsed.key)
      }
    }
  }
  return loaded
}
