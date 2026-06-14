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
    `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>CRM access</title>
  </head>
  <body style="margin:0;background:#fff7f1;color:#142033;font-family:Arial,sans-serif">
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
      <section style="max-width:720px;border:1px solid #ead6c8;border-radius:12px;background:white;padding:28px;box-shadow:0 10px 30px rgba(20,32,51,.08)">
        <p style="margin:0 0 10px;color:#a63a00;font-size:13px;font-weight:700;text-transform:uppercase">Защищенная CRM</p>
        <h1 style="margin:0;color:#142033;font-size:32px;line-height:1.15">Нужен ключ доступа</h1>
        <p style="margin:14px 0 0;color:#5f6b7a;font-size:16px;line-height:1.6">
          Полный dashboard demo CRM открывается только по персональной ссылке с параметром <code>?key=...</code>.
          Для первого просмотра используйте публичную demo-страницу.
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:22px">
          <a href="/demo" style="display:inline-flex;align-items:center;min-height:42px;border-radius:8px;background:#ff5a14;color:white;padding:0 16px;text-decoration:none;font-weight:700">Открыть публичное demo</a>
          <a href="/catalog" style="display:inline-flex;align-items:center;min-height:42px;border:1px solid #ead6c8;border-radius:8px;color:#142033;padding:0 16px;text-decoration:none;font-weight:700">Клиентский каталог</a>
        </div>
      </section>
    </main>
  </body>
</html>`,
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
    request.nextUrl.pathname === "/api/health" ||
    request.nextUrl.pathname === "/demo" ||
    request.nextUrl.pathname.startsWith("/demo/") ||
    request.nextUrl.pathname === "/crm" ||
    request.nextUrl.pathname.startsWith("/crm/") ||
    request.nextUrl.pathname === "/catalog" ||
    request.nextUrl.pathname.startsWith("/catalog/") ||
    request.nextUrl.pathname === "/miniapp" ||
    request.nextUrl.pathname.startsWith("/miniapp/") ||
    request.nextUrl.pathname.startsWith("/api/miniapp/") ||
    request.nextUrl.pathname === "/api/integrations/share-qr"
  ) {
    return NextResponse.next()
  }

  if (
    request.method === "GET" &&
    request.nextUrl.pathname === "/api/dashboard" &&
    request.nextUrl.searchParams.get("demo") === "caloristika"
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
