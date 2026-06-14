import { NextResponse } from "next/server"
import QRCode from "qrcode"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function safeQrValue(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length < 8 || trimmed.length > 1200) return null
  try {
    const url = new URL(trimmed)
    if (!["http:", "https:"].includes(url.protocol)) return null
    url.hash = ""
    return url.toString()
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const value = safeQrValue(new URL(request.url).searchParams.get("url"))
  if (!value) {
    return NextResponse.json({ ok: false, error: "Valid http/https url is required" }, { status: 400 })
  }

  const svg = await QRCode.toString(value, {
    type: "svg",
    width: 256,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#17221d",
      light: "#fffdf7"
    }
  })

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  })
}
