"use client"

import { useEffect } from "react"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

type ClientCatalogActionsProps = {
  label?: string
}

export function ClientCatalogActions({ label = "Печать A4" }: ClientCatalogActionsProps) {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get("print") !== "1") return

    const timer = window.setTimeout(() => window.print(), 450)
    return () => window.clearTimeout(timer)
  }, [])

  function handlePrint() {
    const url = new URL(window.location.href)
    url.searchParams.set("print", "1")

    const printWindow = window.open(url.toString(), "_blank")
    if (!printWindow) {
      window.location.href = url.toString()
    } else {
      printWindow.focus()
    }
  }

  return (
    <Button type="button" className="client-catalog-print-button no-print" size="sm" onClick={handlePrint}>
      <Printer data-icon="inline-start" />
      {label}
    </Button>
  )
}
