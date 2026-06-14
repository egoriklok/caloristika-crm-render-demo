"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CrmDashboard } from "@/components/crm-dashboard"
import type { DashboardData } from "@/lib/types"

function dashboardUrl(publicDemo: boolean) {
  const params = new URLSearchParams(window.location.search)
  const key = params.get("key")
  if (publicDemo) return "/api/dashboard?demo=caloristika"
  return key ? `/api/dashboard?key=${encodeURIComponent(key)}` : "/api/dashboard"
}

export function CrmDashboardLoader({ initialTab, publicDemo = false }: { initialTab?: string; publicDemo?: boolean }) {
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(dashboardUrl(publicDemo), {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || `CRM API вернул ${response.status}`)
        }
        return response.json() as Promise<DashboardData>
      })
      .then((payload) => {
        setData(payload)
      })
      .catch((nextError) => {
        if (controller.signal.aborted) return
        setError(nextError instanceof Error ? nextError.message : "Не удалось загрузить CRM")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [publicDemo, reloadKey])

  if (data) return <CrmDashboard data={data} initialTab={initialTab} publicDemo={publicDemo} />

  return (
    <main className="crm-shell">
      <div className="crm-workspace">
        <section className="crm-command-bar no-print">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal lg:text-[28px]">CRM</h1>
            <p className="mt-1 text-sm text-muted-foreground">Загрузка единой базы, заказов, каталога и AI-задач.</p>
          </div>
          <Button type="button" variant="outline" className="gap-2" disabled={loading} onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {["Клиенты", "Заказы", "Каталог", "ИИ-агенты"].map((label) => (
            <div key={label} className="crm-kpi-card min-h-24">
              <div className="dense-label">{label}</div>
              <div className="mt-4 h-6 w-24 rounded bg-muted" />
              <div className="mt-3 h-3 w-32 rounded bg-muted" />
            </div>
          ))}
        </section>

        <section className="rounded-lg border bg-card p-5">
          {error ? (
            <>
              <h2 className="text-lg font-semibold">CRM временно недоступна</h2>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Подготавливаем рабочее пространство</h2>
              <p className="mt-2 text-sm text-muted-foreground">Первый экран открывается отдельно от тяжёлой CRM-выгрузки, чтобы приложение быстрее стартовало на сервере.</p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
