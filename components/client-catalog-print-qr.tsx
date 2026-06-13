"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"

const printQrSyncEvent = "lunchup:catalog-sync-print-qr"

type PrintQrState = {
  pageUrl: string
  qrSrc: string
  updatedAt: string
}

type PrintQrEventDetail = {
  pageUrl?: string
  qrSrc?: string
}

type ClientCatalogPrintQrProps = {
  enabled?: boolean
}

function normalizedPageUrl(candidate?: string) {
  const url = new URL(candidate ?? window.location.href)
  url.hash = ""
  return url.toString()
}

function qrSrcFor(pageUrl: string) {
  return `/api/integrations/share-qr?url=${encodeURIComponent(pageUrl)}&v=${Date.now()}`
}

function printedAt() {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date())
}

export function ClientCatalogPrintQr({ enabled = false }: ClientCatalogPrintQrProps) {
  if (!enabled) return null

  return <ClientCatalogPrintQrBody />
}

function ClientCatalogPrintQrBody() {
  const imageRef = useRef<HTMLImageElement>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const urlRef = useRef<HTMLElement>(null)
  const stampRef = useRef<HTMLElement>(null)
  const [state, setState] = useState<PrintQrState>({
    pageUrl: "",
    qrSrc: "",
    updatedAt: ""
  })

  const syncQr = useCallback((detail?: PrintQrEventDetail) => {
    const pageUrl = normalizedPageUrl(detail?.pageUrl)
    const qrSrc = detail?.qrSrc ?? qrSrcFor(pageUrl)
    const updatedAt = printedAt()

    setState({ pageUrl, qrSrc, updatedAt })

    if (imageRef.current) imageRef.current.src = qrSrc
    if (linkRef.current) linkRef.current.href = pageUrl
    if (urlRef.current) urlRef.current.textContent = pageUrl
    if (stampRef.current) stampRef.current.textContent = `QR проверен перед печатью: ${updatedAt}`
  }, [])

  useLayoutEffect(() => {
    syncQr()

    const handleSync = (event: Event) => syncQr((event as CustomEvent<PrintQrEventDetail>).detail)
    const handleRouteState = () => syncQr()
    const printMedia = window.matchMedia("print")

    window.addEventListener(printQrSyncEvent, handleSync)
    window.addEventListener("beforeprint", handleRouteState)
    window.addEventListener("pageshow", handleRouteState)
    window.addEventListener("popstate", handleRouteState)
    window.addEventListener("hashchange", handleRouteState)
    printMedia.addEventListener("change", handleRouteState)
    document.addEventListener("visibilitychange", handleRouteState)

    return () => {
      window.removeEventListener(printQrSyncEvent, handleSync)
      window.removeEventListener("beforeprint", handleRouteState)
      window.removeEventListener("pageshow", handleRouteState)
      window.removeEventListener("popstate", handleRouteState)
      window.removeEventListener("hashchange", handleRouteState)
      printMedia.removeEventListener("change", handleRouteState)
      document.removeEventListener("visibilitychange", handleRouteState)
    }
  }, [syncQr])

  return (
    <aside className="client-catalog-print-qr" aria-label="QR-ссылка на актуальную страницу каталога">
      <div>
        <span>Онлайн-версия</span>
        <b>Открыть эту страницу после встречи</b>
        <p>QR берется из текущего адреса вкладки, поэтому при Cloudflare-ссылке в печать попадет именно она.</p>
        <a ref={linkRef} href={state.pageUrl || "#"}>
          <code ref={urlRef}>{state.pageUrl || "адрес будет проверен перед печатью"}</code>
        </a>
        <small ref={stampRef}>
          {state.updatedAt ? `QR проверен перед печатью: ${state.updatedAt}` : "QR проверяется перед печатью"}
        </small>
      </div>
      <img
        ref={imageRef}
        className="client-catalog-print-qr-image"
        src={state.qrSrc || undefined}
        alt="QR-код актуальной страницы каталога Lunch Up"
      />
    </aside>
  )
}
