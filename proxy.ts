import { NextRequest, NextResponse } from "next/server"

const ACCESS_COOKIE = "crm_access"
const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function normalizeHost(host: string | null) {
  const value = host?.split(",")[0]?.trim()
  if (!value) return ""

  try {
    return new URL(`http://${value}`).hostname.toLowerCase()
  } catch {
    return value.replace(/^\[/, "").replace(/\]$/, "").split(":")[0]?.toLowerCase() ?? ""
  }
}

function isLocalBrowserHost(request: NextRequest) {
  const forwardedHost = normalizeHost(request.headers.get("x-forwarded-host"))
  const host = normalizeHost(request.headers.get("host"))
  const nextHost = request.nextUrl.hostname.toLowerCase()

  if (forwardedHost) return LOCAL_BROWSER_HOSTS.has(forwardedHost)
  if (host) return LOCAL_BROWSER_HOSTS.has(host)

  return LOCAL_BROWSER_HOSTS.has(nextHost)
}

function unauthorizedHtml() {
  return new NextResponse(
    "<!doctype html><meta charset=\"utf-8\"><title>CRM access</title><body style=\"font-family:Arial;padding:32px\"><h1>Нужен ключ доступа</h1><p>Откройте CRM по полной ссылке с параметром <code>?key=...</code>.</p></body>",
    {
      status: 401,
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    }
  )
}

export function proxy(request: NextRequest) {
  const accessKey = process.env.CRM_ACCESS_KEY
  if (!accessKey) return NextResponse.next()
  if (isLocalBrowserHost(request)) return NextResponse.next()

  if (
    request.nextUrl.pathname === "/icon.svg" ||
    request.nextUrl.pathname === "/catalog" ||
    request.nextUrl.pathname.startsWith("/catalog/") ||
    request.nextUrl.pathname === "/miniapp" ||
    request.nextUrl.pathname.startsWith("/miniapp/") ||
    request.nextUrl.pathname.startsWith("/api/miniapp/") ||
    request.nextUrl.pathname === "/api/integrations/share-qr"
  ) {
    return NextResponse.next()
  }

  const providedKey = request.nextUrl.searchParams.get("key")
  const cookieKey = request.cookies.get(ACCESS_COOKIE)?.value
  const telegramSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const telegramAuthorized =
    request.nextUrl.pathname === "/api/telegram/webhook" &&
    Boolean(telegramSecret) &&
    request.headers.get("x-telegram-bot-api-secret-token") === telegramSecret
  const authorized = providedKey === accessKey || cookieKey === accessKey

  if (authorized || telegramAuthorized) {
    const response = NextResponse.next()
    if (providedKey === accessKey) {
      response.cookies.set(ACCESS_COOKIE, accessKey, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/"
      })
    }
    return response
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "CRM access key is required" }, { status: 401 })
  }

  return unauthorizedHtml()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}
