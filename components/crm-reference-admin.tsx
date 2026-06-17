"use client"

import * as React from "react"
import { Database, Pencil, Plus, RefreshCw, Save, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ReferenceField = {
  key: string
  label: string
  type: "text" | "textarea" | "number" | "boolean" | "select" | "date"
  required?: boolean
  readonly?: boolean
  createOnly?: boolean
  valueType?: "text" | "number"
  options?: Array<{ value: string | number; label: string }>
  defaultValue?: string | number | boolean | null
}

type ReferenceConfig = {
  id: string
  label: string
  description: string
  pk: string
  pkType: "text" | "number"
  titleField: string
  fields: ReferenceField[]
}

type ReferenceRowsPayload = {
  ok: boolean
  config: ReferenceConfig
  rows: Array<Record<string, unknown>>
  row_count: number
  error?: string
}

type ReferenceConfigsPayload = {
  ok: boolean
  configs: ReferenceConfig[]
  error?: string
}

type ReferenceMutationPayload = {
  ok: boolean
  id: string | number
  changes: number
  error?: string
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "да" : "нет"
  return String(value)
}

function formValue(field: ReferenceField, value: unknown) {
  if (field.type === "boolean") {
    return value === true || value === 1 || value === "1" || value === "true"
  }
  if (value === null || value === undefined) return ""
  return String(value)
}

function emptyForm(config: ReferenceConfig) {
  return Object.fromEntries(
    config.fields.map((field) => [field.key, field.defaultValue ?? (field.type === "boolean" ? false : "")])
  ) as Record<string, unknown>
}

function rowForm(config: ReferenceConfig, row: Record<string, unknown>) {
  return Object.fromEntries(config.fields.map((field) => [field.key, formValue(field, row[field.key])])) as Record<string, unknown>
}

function withAccessKey(path: string, accessKey?: string | null) {
  if (!accessKey) return path
  return `${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(accessKey)}`
}

function fieldGridClass(field: ReferenceField) {
  return field.type === "textarea" ? "space-y-1 text-xs font-medium md:col-span-2 xl:col-span-3" : "space-y-1 text-xs font-medium"
}

export function CrmReferenceAdmin({ accessKey }: { accessKey?: string | null }) {
  const [configs, setConfigs] = React.useState<ReferenceConfig[]>([])
  const [activeRef, setActiveRef] = React.useState("companies")
  const [query, setQuery] = React.useState("")
  const [rows, setRows] = React.useState<Array<Record<string, unknown>>>([])
  const [activeConfig, setActiveConfig] = React.useState<ReferenceConfig | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"create" | "edit" | null>(null)
  const [editingId, setEditingId] = React.useState<string | number | null>(null)
  const [form, setForm] = React.useState<Record<string, unknown>>({})

  const selectedConfig = activeConfig ?? configs.find((item) => item.id === activeRef) ?? null
  const tableFields = React.useMemo(() => selectedConfig?.fields.slice(0, 6) ?? [], [selectedConfig])

  const loadConfigs = React.useCallback(async () => {
    const response = await fetch(withAccessKey("/api/reference-admin", accessKey), { cache: "no-store" })
    const payload = (await response.json()) as ReferenceConfigsPayload
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Не удалось загрузить список справочников")
    }
    setConfigs(payload.configs)
    if (!payload.configs.some((item) => item.id === activeRef)) {
      setActiveRef(payload.configs[0]?.id ?? "companies")
    }
  }, [accessKey, activeRef])

  const loadRows = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ ref: activeRef, limit: "80" })
      if (query.trim()) params.set("q", query.trim())
      const response = await fetch(withAccessKey(`/api/reference-admin?${params.toString()}`, accessKey), { cache: "no-store" })
      const payload = (await response.json()) as ReferenceRowsPayload
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить справочник")
      }
      setActiveConfig(payload.config)
      setRows(payload.rows)
      setStatus(`Загружено строк: ${payload.row_count}`)
    } catch (caught) {
      setRows([])
      setError(caught instanceof Error ? caught.message : "Не удалось загрузить справочник")
    } finally {
      setLoading(false)
    }
  }, [accessKey, activeRef, query])

  React.useEffect(() => {
    loadConfigs().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Не удалось загрузить список справочников")
      setLoading(false)
    })
  }, [loadConfigs])

  React.useEffect(() => {
    loadRows()
  }, [loadRows])

  function updateField(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function startCreate() {
    if (!selectedConfig) return
    setMode("create")
    setEditingId(null)
    setForm(emptyForm(selectedConfig))
    setError(null)
    setStatus(`Новая запись: ${selectedConfig.label}`)
  }

  function startEdit(row: Record<string, unknown>) {
    if (!selectedConfig) return
    setMode("edit")
    setEditingId(row[selectedConfig.pk] as string | number)
    setForm(rowForm(selectedConfig, row))
    setError(null)
    setStatus(`Редактирование: ${displayValue(row[selectedConfig.titleField])}`)
  }

  function cancelEdit() {
    setMode(null)
    setEditingId(null)
    setForm({})
    setError(null)
  }

  async function saveReference() {
    if (!selectedConfig || !mode) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(withAccessKey("/api/reference-admin", accessKey), {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: selectedConfig.id,
          id: editingId,
          values: form
        })
      })
      const payload = (await response.json()) as ReferenceMutationPayload
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось сохранить справочник")
      }
      setStatus(mode === "create" ? "Запись добавлена" : "Запись обновлена")
      setMode(null)
      setEditingId(null)
      setForm({})
      await loadRows()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сохранить справочник")
    } finally {
      setSaving(false)
    }
  }

  function renderField(field: ReferenceField) {
    const disabled = saving || field.readonly || (mode === "edit" && field.createOnly)
    const value = form[field.key]
    return (
      <label key={field.key} className={fieldGridClass(field)}>
        <span>
          {field.label}
          {field.required ? <span className="text-destructive"> *</span> : null}
        </span>
        {field.type === "textarea" ? (
          <textarea
            className="min-h-[76px] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={String(value ?? "")}
            disabled={disabled}
            onChange={(event) => updateField(field.key, event.target.value)}
          />
        ) : field.type === "select" ? (
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={String(value ?? "")}
            disabled={disabled}
            onChange={(event) => updateField(field.key, field.valueType === "number" ? Number(event.target.value) : event.target.value)}
          >
            {!field.required ? <option value="">—</option> : null}
            {(field.options ?? []).map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === "boolean" ? (
          <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm shadow-sm">
            <input
              type="checkbox"
              checked={Boolean(value)}
              disabled={disabled}
              onChange={(event) => updateField(field.key, event.target.checked)}
            />
            <span>{Boolean(value) ? "да" : "нет"}</span>
          </label>
        ) : (
          <Input
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            value={String(value ?? "")}
            disabled={disabled}
            onChange={(event) => updateField(field.key, event.target.value)}
          />
        )}
      </label>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4" />
              Справочники CRM
            </CardTitle>
            <CardDescription>Добавление и редактирование основных справочников из внешнего Web UI.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="gap-2" disabled={loading} onClick={loadRows}>
              <RefreshCw className="size-3.5" />
              Обновить
            </Button>
            <Button type="button" className="gap-2" disabled={!selectedConfig || saving} onClick={startCreate}>
              <Plus className="size-3.5" />
              Добавить
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[260px_minmax(240px,1fr)_auto]">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm"
            value={activeRef}
            onChange={(event) => {
              setActiveRef(event.target.value)
              setMode(null)
              setQuery("")
            }}
          >
            {configs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.label}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по справочнику" />
          </div>
          <Button type="button" variant="outline" disabled={loading} onClick={loadRows}>
            Найти
          </Button>
        </div>
        {selectedConfig ? (
          <p className="text-xs text-muted-foreground">
            {selectedConfig.description} {status ? `· ${status}` : ""}
          </p>
        ) : null}
        {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">{error}</div> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedConfig && mode ? (
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">{mode === "create" ? "Новая запись" : "Редактирование записи"}</div>
                <div className="text-xs text-muted-foreground">{selectedConfig.label}</div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="gap-2" disabled={saving} onClick={saveReference}>
                  <Save className="size-3.5" />
                  {saving ? "Сохраняю" : "Сохранить"}
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-2" disabled={saving} onClick={cancelEdit}>
                  <X className="size-3.5" />
                  Закрыть
                </Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selectedConfig.fields.map(renderField)}
            </div>
          </div>
        ) : null}
        {loading && !rows.length ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">Загружаю справочник</div>
        ) : rows.length ? (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[96px]">ID</TableHead>
                  {tableFields.map((field) => (
                    <TableHead key={field.key}>{field.label}</TableHead>
                  ))}
                  <TableHead className="w-[160px]">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(selectedConfig ? row[selectedConfig.pk] : Math.random())}>
                    <TableCell>
                      <Badge variant="outline">{selectedConfig ? displayValue(row[selectedConfig.pk]) : "—"}</Badge>
                    </TableCell>
                    {tableFields.map((field) => (
                      <TableCell key={field.key} className="max-w-[280px] truncate text-sm">
                        {field.type === "boolean" ? (row[field.key] ? "да" : "нет") : displayValue(row[field.key])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button type="button" size="sm" variant="outline" className="gap-2" disabled={saving} onClick={() => startEdit(row)}>
                        <Pencil className="size-3.5" />
                        Редактировать
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            Записей не найдено. Измените поиск или добавьте новую запись.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
