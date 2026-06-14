import { NextResponse } from "next/server"

const ACCESS_COOKIE = "crm_access"

function cookieValue(cookieHeader: string | null, name: string) {
  for (const part of String(cookieHeader ?? "").split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=")
    if (rawKey === name) return decodeURIComponent(rawValue.join("=") || "")
  }
  return null
}

export function hasCrmAccess(request: Request) {
  const accessKey = process.env.CRM_ACCESS_KEY?.trim()
  if (!accessKey) return true

  const url = new URL(request.url)
  const providedKey = url.searchParams.get("key")
  const cookieKey = cookieValue(request.headers.get("cookie"), ACCESS_COOKIE)
  const headerKey = request.headers.get("x-crm-access-key")?.trim()
  const authorization = request.headers.get("authorization") ?? ""
  const bearerKey = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()

  return providedKey === accessKey || cookieKey === accessKey || headerKey === accessKey || bearerKey === accessKey
}

export function requireCrmAccess(request: Request) {
  if (hasCrmAccess(request)) return null
  return NextResponse.json({ ok: false, error: "CRM access key is required" }, { status: 401 })
}
