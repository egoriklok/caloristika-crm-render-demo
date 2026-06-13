"use client"

import * as React from "react"
import {
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Minus,
  Mail,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserRound
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type MiniappProduct = {
  id: number
  category: string
  name: string
  barcode: string | null
  net_weight: string | null
  shelf_life_days: number | null
  wholesale_price: number
  image_url?: string | null
  product_url?: string | null
}

type MiniappCatalog = {
  launch_region: string
  active_strategy: {
    name: string
    brand_name?: string
    lo_delivery_terms: string
  }
  order_terms: {
    minimum_order_amount: number
    free_delivery_city: string
    free_delivery_days: string
    lo_delivery_terms: string
    order_lead_time_days: number
    order_cutoff_time: string
    payment_terms: string
  }
  products: MiniappProduct[]
}

type MiniappProfile = {
  company_name: string
  inn: string
  contact_name: string
  role: string
  phone: string
  email: string
  delivery_address: string
  website: string
  office_people: string
}

type MiniappSavedProfile = {
  company_name?: string | null
  inn?: string | null
  contact_name?: string | null
  role?: string | null
  phone?: string | null
  email?: string | null
  delivery_address?: string | null
  website?: string | null
  office_people?: number | string | null
}

type MiniappCheckout = {
  delivery_date: string
  payment_date: string
  instructions: string
}

type MiniappDraft = {
  profile?: Partial<MiniappProfile>
  checkout?: Partial<MiniappCheckout>
  quantities?: Record<string, number>
  email?: string
  enrichment?: Enrichment | null
  saved_at?: string
}

type OfficePeople = {
  min: number
  max: number
  confidence: "high" | "medium" | "low"
  method: string
  daily_present: number
  likely_buyers_min: number
  likely_buyers_max: number
  recommended_portions: number
  recommended_sku: number
  estimated_launch_budget: number
}

type Enrichment = {
  profile: {
    name: string
    legal_name: string | null
    inn: string | null
    address: string | null
    phone: string | null
    email: string | null
    website: string | null
    dgis_id: string | null
    branch_count: number | null
    employee_count_fns?: number | null
    employee_count_2gis?: number | null
    employee_count_website?: number | null
  }
  office_people: OfficePeople
  proposal: {
    headcount_source: string
    office_size_label: string
    confidence_label: string
    launch_scenario: string
    proposal_summary: string
    manager_next_step: string
    what_to_offer: string[]
    assumptions: string[]
  }
  sources: Array<{ source: string; status: string; title: string; note: string }>
}

type MiniappOrderHistoryItem = {
  product_id: number
  name: string
  category: string
  quantity: number
  unit_price: number
  line_total: number
}

type MiniappOrderHistory = {
  id: number
  status: string
  total_amount: number
  delivery_date: string | null
  payment_date: string | null
  manager_comment: string | null
  created_at: string
  items: MiniappOrderHistoryItem[]
}

type CustomerPortalInsights = {
  orders_count: number
  total_revenue: number
  sku_count: number
  last_order_at: string | null
  top_products: Array<{
    product_id: number
    name: string
    quantity: number
    revenue: number
  }>
  inventory: {
    sku_count: number
    on_hand: number
    reserved: number
    low_stock_sku: number
    low_stock: Array<{
      product_id: number
      name: string
      category: string
      on_hand_quantity: number
      reserved_quantity: number
      reorder_point: number
      target_stock: number
      available_quantity: number
    }>
  }
}

type MiniappOrderProps = {
  catalog: MiniappCatalog
}

type MiniappView = "catalog" | "cabinet" | "cart"

type TelegramWebApp = {
  initData?: string
  initDataUnsafe?: {
    start_param?: string
    user?: { first_name?: string; last_name?: string; username?: string }
  }
  ready?: () => void
  expand?: () => void
  close?: () => void
  setHeaderColor?: (color: string) => void
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy") => void
    notificationOccurred?: (type: "success" | "warning" | "error") => void
  }
  MainButton?: {
    setText: (text: string) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  enableClosingConfirmation?: () => void
  disableClosingConfirmation?: () => void
  showPopup?: (params: { title?: string; message: string; buttons?: Array<{ type?: string; text?: string }> }) => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

const emptyProfile: MiniappProfile = {
  company_name: "",
  inn: "",
  contact_name: "",
  role: "Закупки / офис-менеджер",
  phone: "",
  email: "",
  delivery_address: "",
  website: "",
  office_people: ""
}
const emptyCheckout: MiniappCheckout = {
  delivery_date: "",
  payment_date: "",
  instructions: ""
}
const draftStorageKey = "lunch-up-miniapp-draft-v1"

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value)
}

function qtyLabel(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value)
}

function sourceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    connected: "подключено",
    not_configured: "нужен ключ",
    not_found: "не найдено",
    error: "ошибка",
    estimated: "оценка"
  }
  return labels[status] ?? status
}

function sourceStatusVariant(status: string): "success" | "warning" | "outline" | "muted" {
  if (status === "connected") return "success"
  if (status === "estimated") return "warning"
  if (status === "not_configured") return "outline"
  return "muted"
}

function employeeCountRows(enrichment: Enrichment) {
  return [
    { label: "ФНС/DaData", value: enrichment.profile.employee_count_fns },
    { label: "2ГИС", value: enrichment.profile.employee_count_2gis },
    { label: "Сайт", value: enrichment.profile.employee_count_website }
  ].filter((item) => Number.isFinite(item.value) && Number(item.value) > 0) as Array<{ label: string; value: number }>
}

function shortDate(value: string | null) {
  if (!value) return "дата не указана"
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

function shortTime(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

const miniappOrderStatusMeta: Record<
  string,
  { label: string; hint: string; variant: "default" | "secondary" | "outline" | "muted" | "warning" | "success" }
> = {
  draft: {
    label: "Черновик",
    hint: "Заказ еще не отправлен менеджеру.",
    variant: "outline"
  },
  manager_review: {
    label: "На проверке",
    hint: "Менеджер проверяет состав, дату доставки и условия.",
    variant: "warning"
  },
  blocked_minimum: {
    label: "Ниже минимума",
    hint: "Сумма ниже минимального заказа. Менеджер подскажет, что добавить.",
    variant: "muted"
  },
  confirmed: {
    label: "Подтвержден",
    hint: "Заказ подтвержден и готовится к доставке.",
    variant: "success"
  },
  in_delivery: {
    label: "В доставке",
    hint: "Заказ передан в доставку.",
    variant: "secondary"
  },
  completed: {
    label: "Выполнен",
    hint: "Заказ выполнен.",
    variant: "success"
  },
  cancelled: {
    label: "Отменен",
    hint: "Заказ отменен.",
    variant: "muted"
  }
}

function orderStatusMeta(status: string) {
  return miniappOrderStatusMeta[status] ?? {
    label: status,
    hint: "Статус заказа обновляется менеджером.",
    variant: "outline" as const
  }
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function cutoffMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return 15 * 60
  return Number(match[1]) * 60 + Number(match[2])
}

function profilePayload(profile: MiniappProfile) {
  const people = Number(profile.office_people)
  return {
    company_name: profile.company_name,
    inn: profile.inn,
    contact_name: profile.contact_name,
    role: profile.role,
    phone: profile.phone,
    email: profile.email,
    delivery_address: profile.delivery_address,
    website: profile.website,
    office_people: Number.isFinite(people) && people > 0 ? people : undefined
  }
}

function authEmailValue(profile: MiniappProfile, email: string) {
  return email.trim() || profile.email.trim()
}

function savedProfileValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return String(value)
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function mergeSavedProfile(current: MiniappProfile, saved?: MiniappSavedProfile | null): MiniappProfile {
  if (!saved) return current
  const next = { ...current }
  for (const key of Object.keys(emptyProfile) as Array<keyof MiniappProfile>) {
    const incoming = savedProfileValue(saved[key])
    if (!next[key].trim() && incoming) {
      next[key] = incoming
    }
  }
  return next
}

function miniappViewFromIntent(value: string | null | undefined): MiniappView | null {
  const intent = String(value ?? "").trim().toLowerCase()
  if (!intent) return null
  if (["orders", "history", "repeat", "cabinet", "profile"].includes(intent)) return "cabinet"
  if (["cart", "checkout"].includes(intent)) return "cart"
  if (["catalog", "order", "start"].includes(intent)) return "catalog"
  return null
}

export function TelegramMiniappOrder({ catalog }: MiniappOrderProps) {
  const brandName = catalog.active_strategy.brand_name || catalog.active_strategy.name.split(":")[0] || "CRM"
  const [activeView, setActiveView] = React.useState<MiniappView>("catalog")
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("Все")
  const [profile, setProfile] = React.useState<MiniappProfile>(emptyProfile)
  const [checkout, setCheckout] = React.useState<MiniappCheckout>(emptyCheckout)
  const [quantities, setQuantities] = React.useState<Record<number, number>>({})
  const [telegramReady, setTelegramReady] = React.useState(false)
  const [initData, setInitData] = React.useState("")
  const [portalEmail, setPortalEmail] = React.useState("")
  const [accessCode, setAccessCode] = React.useState("")
  const [sessionStatus, setSessionStatus] = React.useState("Войдите по email")
  const [authWarnings, setAuthWarnings] = React.useState<string[]>([])
  const [orders, setOrders] = React.useState<MiniappOrderHistory[]>([])
  const [insights, setInsights] = React.useState<CustomerPortalInsights | null>(null)
  const [enrichment, setEnrichment] = React.useState<Enrichment | null>(null)
  const [draftHydrated, setDraftHydrated] = React.useState(false)
  const [draftSavedAt, setDraftSavedAt] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [agentMessage, setAgentMessage] = React.useState<string | null>(null)

  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined
  const categories = React.useMemo(() => ["Все", ...Array.from(new Set(catalog.products.map((product) => product.category)))], [catalog.products])
  const cartItems = React.useMemo(
    () =>
      catalog.products
        .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
        .filter((item) => item.quantity > 0),
    [catalog.products, quantities]
  )
  const total = React.useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.wholesale_price * item.quantity, 0),
    [cartItems]
  )
  const totalQty = React.useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])
  const minOrder = catalog.order_terms.minimum_order_amount
  const remaining = Math.max(0, minOrder - total)
  const topUpSuggestions = React.useMemo(() => {
    if (!remaining) return []
    return catalog.products
      .map((product) => {
        const quantity = Math.max(1, Math.min(99, Math.ceil(remaining / Math.max(1, product.wholesale_price))))
        return {
          product,
          quantity,
          lineTotal: product.wholesale_price * quantity
        }
      })
      .sort((a, b) => a.quantity - b.quantity || a.lineTotal - b.lineTotal || a.product.name.localeCompare(b.product.name, "ru"))
      .slice(0, 3)
  }, [catalog.products, remaining])
  const launchBasketSuggestions = React.useMemo(() => {
    if (!enrichment) return []
    const preferredCategories = ["Сэндвичи", "Салаты", "Завтраки", "Десерты"]
    const targetSku = Math.max(1, Math.min(enrichment.office_people.recommended_sku, catalog.products.length))
    const targetPortions = Math.max(targetSku, enrichment.office_people.recommended_portions)
    const selected: MiniappProduct[] = []
    const used = new Set<number>()
    const categoriesToUse = [
      ...preferredCategories,
      ...Array.from(new Set(catalog.products.map((product) => product.category))).filter((item) => !preferredCategories.includes(item))
    ]

    while (selected.length < targetSku && used.size < catalog.products.length) {
      let added = false
      for (const categoryName of categoriesToUse) {
        if (selected.length >= targetSku) break
        const product = catalog.products
          .filter((item) => item.category === categoryName && !used.has(item.id))
          .sort((a, b) => a.wholesale_price - b.wholesale_price || a.name.localeCompare(b.name, "ru"))[0]
        if (product) {
          selected.push(product)
          used.add(product.id)
          added = true
        }
      }
      if (!added) break
    }

    const baseQty = Math.max(1, Math.floor(targetPortions / Math.max(1, selected.length)))
    let extra = Math.max(0, targetPortions - baseQty * selected.length)
    return selected.map((product) => {
      const addOne = extra > 0
      const quantity = Math.min(99, baseQty + (addOne ? 1 : 0))
      if (addOne) extra -= 1
      return {
        product,
        quantity,
        lineTotal: product.wholesale_price * quantity
      }
    })
  }, [catalog.products, enrichment])
  const launchBasketTotal = React.useMemo(
    () => launchBasketSuggestions.reduce((sum, item) => sum + item.lineTotal, 0),
    [launchBasketSuggestions]
  )
  const minDeliveryDate = React.useMemo(() => {
    const next = new Date()
    const todayMinutes = next.getHours() * 60 + next.getMinutes()
    const extraDay = todayMinutes >= cutoffMinutes(catalog.order_terms.order_cutoff_time) ? 1 : 0
    next.setDate(next.getDate() + Math.max(0, catalog.order_terms.order_lead_time_days) + extraDay)
    return dateInputValue(next)
  }, [catalog.order_terms.order_cutoff_time, catalog.order_terms.order_lead_time_days])
  const canSubmit =
    totalQty > 0 &&
    Boolean(initData || authEmailValue(profile, portalEmail)) &&
    Boolean(profile.company_name.trim()) &&
    Boolean(profile.delivery_address.trim()) &&
    Boolean(checkout.delivery_date.trim()) &&
    checkout.delivery_date >= minDeliveryDate &&
    !busy

  const filteredProducts = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return catalog.products.filter((product) => {
      const categoryMatch = category === "Все" || product.category === category
      const text = [product.name, product.category, product.net_weight].filter(Boolean).join(" ").toLowerCase()
      return categoryMatch && (!needle || text.includes(needle))
    })
  }, [catalog.products, category, query])

  const updateProfile = (key: keyof MiniappProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  const setQuantity = (productId: number, quantity: number) => {
    setQuantities((current) => {
      const next = { ...current }
      if (quantity <= 0) {
        delete next[productId]
      } else {
        next[productId] = Math.min(quantity, 99)
      }
      return next
    })
    tg?.HapticFeedback?.impactOccurred?.("light")
  }

  const addMinimumTopUp = (productId: number, quantity: number) => {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.min((current[productId] ?? 0) + quantity, 99)
    }))
    setActiveView("cart")
    setMessage("Позиции для минимального заказа добавлены в корзину.")
    tg?.HapticFeedback?.notificationOccurred?.("success")
  }

  const applySessionPayload = (payload: {
    auth?: { mode?: string; email?: string | null; warnings?: string[] }
    customer?: { company_name?: string | null }
    profile?: MiniappSavedProfile | null
    orders?: MiniappOrderHistory[]
    insights?: CustomerPortalInsights | null
    enrichment?: Enrichment | null
  }) => {
    const authMode = payload.auth?.mode
    setSessionStatus(
      payload.customer?.company_name
        ? "Клиент авторизован"
        : authMode === "email"
          ? "Email-сессия активна"
          : authMode === "telegram"
            ? "Мессенджер подключен"
            : "Локальный просмотр"
    )
    setAuthWarnings(payload.auth?.warnings ?? [])
    if (payload.auth?.email) setPortalEmail(payload.auth.email)
    if (payload.profile) setProfile((current) => mergeSavedProfile(current, payload.profile))
    setOrders(payload.orders ?? [])
    setInsights(payload.insights ?? null)
    if (payload.enrichment) setEnrichment(payload.enrichment)
  }

  const applyLaunchBasket = () => {
    if (!launchBasketSuggestions.length) return
    setQuantities((current) => {
      const next = { ...current }
      for (const suggestion of launchBasketSuggestions) {
        next[suggestion.product.id] = Math.max(next[suggestion.product.id] ?? 0, suggestion.quantity)
      }
      return next
    })
    setActiveView("cart")
    setMessage(`Стартовый заказ добавлен в корзину: ${launchBasketSuggestions.length} SKU на ${money(launchBasketTotal)}.`)
    tg?.HapticFeedback?.notificationOccurred?.("success")
  }

  const repeatOrder = (order: MiniappOrderHistory) => {
    const next: Record<number, number> = {}
    for (const item of order.items) {
      const productExists = catalog.products.some((product) => product.id === item.product_id)
      if (productExists) next[item.product_id] = item.quantity
    }
    setQuantities(next)
    setActiveView("cart")
    setMessage(`Состав заказа #${order.id} добавлен в корзину.`)
    tg?.HapticFeedback?.notificationOccurred?.("success")
  }

  const syncSession = React.useCallback(
    async (nextProfile = profile) => {
      const email = authEmailValue(nextProfile, portalEmail)
      const response = await fetch("/api/miniapp/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData, email, accessCode, profile: profilePayload({ ...nextProfile, email: nextProfile.email || email }) })
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось обновить кабинет")
      }
      applySessionPayload(payload)
      return payload
    },
    [accessCode, initData, portalEmail, profile]
  )

  const loginWithEmail = async () => {
    const email = authEmailValue(profile, portalEmail)
    if (!email) {
      setMessage("Введите email для входа.")
      setActiveView("cabinet")
      return
    }
    const nextProfile = { ...profile, email: profile.email || email }
    setBusy(true)
    setMessage(null)
    try {
      await syncSession(nextProfile)
      setProfile(nextProfile)
      setPortalEmail(email)
      setMessage("Кабинет открыт и связан с CRM.")
      tg?.HapticFeedback?.notificationOccurred?.("success")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось войти")
      tg?.HapticFeedback?.notificationOccurred?.("error")
    } finally {
      setBusy(false)
    }
  }

  const requestAgentSupport = async () => {
    const email = authEmailValue(profile, portalEmail)
    if (!initData && !email) {
      setMessage("Введите email для входа.")
      setActiveView("cabinet")
      return
    }
    setBusy(true)
    setAgentMessage(null)
    try {
      const response = await fetch("/api/miniapp/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData,
          email,
          accessCode,
          profile: profilePayload({ ...profile, email: profile.email || email }),
          intent: "order_support",
          message: checkout.instructions
        })
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "AI-задача не создана")
      setInsights(payload.insights ?? null)
      setAgentMessage(`AI-задача #${payload.task_id} создана в CRM.`)
      tg?.HapticFeedback?.notificationOccurred?.("success")
    } catch (error) {
      setAgentMessage(error instanceof Error ? error.message : "AI-задача не создана")
      tg?.HapticFeedback?.notificationOccurred?.("error")
    } finally {
      setBusy(false)
    }
  }

  const enrichCompany = async () => {
    if (!profile.company_name.trim()) {
      setMessage("Введите название компании.")
      setActiveView("cabinet")
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch("/api/miniapp/enrichment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData,
          email: authEmailValue(profile, portalEmail),
          accessCode,
          company_name: profile.company_name,
          inn: profile.inn,
          website: profile.website,
          address: profile.delivery_address
        })
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Не удалось подтянуть данные")
      const next = payload.enrichment as Enrichment
      const nextProfile: MiniappProfile = {
        ...profile,
        inn: profile.inn || next.profile.inn || "",
        phone: profile.phone || next.profile.phone || "",
        email: profile.email || next.profile.email || "",
        website: profile.website || next.profile.website || "",
        delivery_address: profile.delivery_address || next.profile.address || "",
        office_people: profile.office_people || String(Math.round((next.office_people.min + next.office_people.max) / 2))
      }
      setEnrichment(next)
      setProfile(nextProfile)
      await syncSession(nextProfile)
      setMessage("Данные компании обновлены и сохранены в CRM.")
      tg?.HapticFeedback?.notificationOccurred?.("success")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подтянуть данные")
      tg?.HapticFeedback?.notificationOccurred?.("error")
    } finally {
      setBusy(false)
    }
  }

  const submitOrder = React.useCallback(async () => {
    if (!canSubmit) {
      setActiveView(profile.company_name.trim() ? "cart" : "cabinet")
      setMessage(
        !initData && !authEmailValue(profile, portalEmail)
          ? "Введите email для входа."
          : !profile.company_name.trim()
          ? "Заполните кабинет клиента."
          : !profile.delivery_address.trim()
            ? "Заполните адрес доставки."
            : !checkout.delivery_date.trim()
              ? "Выберите дату доставки."
              : `Дата доставки должна быть не раньше ${shortDate(minDeliveryDate)}.`
      )
      return
    }

    setBusy(true)
    setMessage(null)
    tg?.MainButton?.showProgress(true)
    try {
      await syncSession(profile)
      const response = await fetch("/api/miniapp/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData,
          email: authEmailValue(profile, portalEmail),
          accessCode,
          profile: profilePayload(profile),
          delivery_method: "delivery",
          delivery_address: profile.delivery_address,
          delivery_date: checkout.delivery_date,
          payment_date: checkout.payment_date || undefined,
          instructions: [
            enrichment
              ? `${enrichment.proposal.proposal_summary} Предложить: ${enrichment.proposal.what_to_offer.join("; ")}. Следующий шаг: ${enrichment.proposal.manager_next_step}`
              : null,
            checkout.instructions.trim() ? `Комментарий клиента: ${checkout.instructions.trim()}` : null
          ].filter(Boolean).join(" "),
          items: cartItems.map((item) => ({ product_id: item.product.id, quantity: item.quantity }))
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Заказ не создан")
      setOrders(payload.orders ?? [])
      setInsights(payload.insights ?? null)
      setQuantities({})
      setCheckout((current) => ({ ...current, instructions: "" }))
      setDraftSavedAt(new Date().toISOString())
      setActiveView("cabinet")
      setMessage(
        payload.ok
          ? `Заказ #${payload.order_id} отправлен менеджеру. Статус: ${orderStatusMeta(payload.status ?? "manager_review").label}.`
          : `Заказ #${payload.order_id} сохранен, нужно добрать ${money(payload.minimum_order_amount - payload.total_amount)}.`
      )
      tg?.HapticFeedback?.notificationOccurred?.(payload.ok ? "success" : "warning")
      tg?.showPopup?.({
        title: "Заказ в CRM",
        message: payload.ok ? `Заказ #${payload.order_id} отправлен менеджеру.` : "Заказ сохранен, сумма ниже минимальной.",
        buttons: [{ type: "ok" }]
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать заказ")
      tg?.HapticFeedback?.notificationOccurred?.("error")
    } finally {
      setBusy(false)
      tg?.MainButton?.hideProgress()
    }
  }, [accessCode, canSubmit, cartItems, checkout.delivery_date, checkout.instructions, checkout.payment_date, enrichment, initData, minDeliveryDate, portalEmail, profile, syncSession, tg])

  React.useEffect(() => {
    const webApp = window.Telegram?.WebApp
    webApp?.ready?.()
    webApp?.expand?.()
    webApp?.setHeaderColor?.("#ffffff")
    setInitData(webApp?.initData ?? "")
    setTelegramReady(Boolean(webApp?.initData))
  }, [])

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey)
      if (!raw) return
      const draft = JSON.parse(raw) as MiniappDraft
      if (draft.profile) {
        setProfile({ ...emptyProfile, ...draft.profile })
      }
      if (draft.email) {
        setPortalEmail(draft.email)
      }
      if (draft.checkout) {
        setCheckout({ ...emptyCheckout, ...draft.checkout })
      }
      if (draft.quantities) {
        const availableIds = new Set(catalog.products.map((product) => product.id))
        const restored: Record<number, number> = {}
        for (const [id, value] of Object.entries(draft.quantities)) {
          const productId = Number(id)
          const quantity = Number(value)
          if (availableIds.has(productId) && Number.isFinite(quantity) && quantity > 0) {
            restored[productId] = Math.min(Math.round(quantity), 99)
          }
        }
        setQuantities(restored)
      }
      if (draft.enrichment) setEnrichment(draft.enrichment)
      if (draft.saved_at) {
        setDraftSavedAt(draft.saved_at)
        setMessage("Черновик заказа восстановлен.")
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    } finally {
      setDraftHydrated(true)
    }
  }, [catalog.products])

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param
    const intent = params.get("tg_intent") ?? params.get("tg_view") ?? params.get("view") ?? startParam
    const view = miniappViewFromIntent(intent)
    if (view) {
      setActiveView(view)
      if (intent === "orders" || intent === "history" || intent === "repeat") {
        setMessage("Открыта история заказов в кабинете клиента.")
      }
    }
  }, [])

  React.useEffect(() => {
    if (!draftHydrated) return
    const savedAt = new Date().toISOString()
    const draft: MiniappDraft = {
      profile,
      checkout,
      quantities,
      email: authEmailValue(profile, portalEmail),
      enrichment,
      saved_at: savedAt
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft))
    setDraftSavedAt(savedAt)
  }, [checkout, draftHydrated, enrichment, portalEmail, profile, quantities])

  React.useEffect(() => {
    if (!initData && !authEmailValue(profile, portalEmail)) {
      setSessionStatus("Email-вход доступен")
      return
    }
    const email = authEmailValue(profile, portalEmail)
    fetch("/api/miniapp/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData, email, accessCode, profile: profilePayload({ ...emptyProfile, email }) })
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) {
          applySessionPayload(payload)
        }
      })
      .catch(() => {
        setSessionStatus(initData ? "Мессенджер не подключен" : "Email-вход доступен")
      })
  }, [accessCode, draftHydrated, initData, portalEmail])

  React.useEffect(() => {
    const mainButton = tg?.MainButton
    if (!mainButton) return
    if (cartItems.length > 0) {
      mainButton.setText(total >= minOrder ? `Оформить ${money(total)}` : `Добрать еще ${money(remaining)}`)
      if (canSubmit) mainButton.enable()
      else mainButton.disable()
      mainButton.show()
      mainButton.onClick(submitOrder)
    } else {
      mainButton.hide()
    }
    return () => {
      mainButton.offClick(submitOrder)
    }
  }, [canSubmit, cartItems.length, minOrder, remaining, submitOrder, tg, total])

  React.useEffect(() => {
    const backButton = tg?.BackButton
    if (!backButton) return
    const goToCatalog = () => {
      setActiveView("catalog")
      tg?.HapticFeedback?.impactOccurred?.("light")
    }
    if (activeView === "catalog") {
      backButton.hide()
    } else {
      backButton.show()
      backButton.onClick(goToCatalog)
    }
    return () => {
      backButton.offClick(goToCatalog)
    }
  }, [activeView, tg])

  React.useEffect(() => {
    const hasProfileDraft = Object.values(profile).some((value) => value.trim())
    const hasCheckoutDraft = Object.values(checkout).some((value) => value.trim())
    if (totalQty > 0 || hasProfileDraft || hasCheckoutDraft || enrichment) {
      tg?.enableClosingConfirmation?.()
    } else {
      tg?.disableClosingConfirmation?.()
    }
    return () => {
      tg?.disableClosingConfirmation?.()
    }
  }, [checkout, enrichment, profile, tg, totalQty])

  return (
    <main className="min-h-screen bg-[#fff8f4] text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 pb-28 pt-3 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-8">
        <section className="lg:col-span-2">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Web-каталог</Badge>
                  <Badge variant="outline">{telegramReady ? "Мессенджер" : "Email"}</Badge>
                  <Badge variant={insights?.inventory.low_stock_sku ? "warning" : "outline"}>
                    Остатки: {insights?.inventory.low_stock_sku ?? 0} ниже точки
                  </Badge>
                </div>
                <h1 className="mt-3 text-2xl font-semibold leading-tight">{brandName} каталог заказов</h1>
                <p className="mt-1 text-sm text-slate-600">{catalog.launch_region}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>{sessionStatus}</div>
                <div>до {catalog.order_terms.order_cutoff_time}</div>
                {draftSavedAt ? <div>Черновик {shortTime(draftSavedAt)}</div> : null}
              </div>
            </div>
            {message ? <div className="mt-3 rounded-md border bg-slate-50 px-3 py-2 text-sm">{message}</div> : null}
            {authWarnings.length ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                {authWarnings[0]}
              </div>
            ) : null}
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-white p-1 shadow-sm">
            {[
              { key: "catalog", label: "Каталог", icon: PackageCheck },
              { key: "cabinet", label: "Кабинет", icon: UserRound },
              { key: "cart", label: "Корзина", icon: ShoppingCart }
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`flex h-11 items-center justify-center gap-2 rounded-md text-sm font-medium ${
                    activeView === item.key ? "bg-primary text-primary-foreground" : "text-slate-700"
                  }`}
                  onClick={() => setActiveView(item.key as typeof activeView)}
                >
                  <Icon className="size-4" />
                  {item.label}
                  {item.key === "cart" && totalQty ? <span className="rounded-full bg-white/20 px-1.5 text-xs">{totalQty}</span> : null}
                </button>
              )
            })}
          </div>
        </section>

        <section className={activeView === "catalog" ? "flex flex-col gap-3" : "hidden lg:flex lg:flex-col lg:gap-3"}>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-md border bg-white pl-9 pr-3 text-sm outline-none focus:border-primary"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SKU, категория, вес"
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`h-9 shrink-0 rounded-md border px-3 text-sm ${
                    item === category ? "border-primary bg-primary text-primary-foreground" : "bg-white text-slate-700"
                  }`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const quantity = quantities[product.id] ?? 0
              return (
                <article key={product.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <div className="flex gap-3 p-3">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-slate-100">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400">{brandName}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500">{product.category}</div>
                      <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{product.name}</h2>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {product.net_weight ? <Badge variant="muted">{product.net_weight}</Badge> : null}
                        {product.shelf_life_days ? <Badge variant="outline">{product.shelf_life_days} дн.</Badge> : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="font-semibold">{money(product.wholesale_price)}</div>
                        {quantity ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => setQuantity(product.id, quantity - 1)} aria-label="Уменьшить">
                              <Minus className="size-4" />
                            </Button>
                            <div className="w-7 text-center text-sm font-semibold">{quantity}</div>
                            <Button size="sm" onClick={() => setQuantity(product.id, quantity + 1)} aria-label="Добавить">
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => setQuantity(product.id, 1)}>
                            <Plus className="size-4" />
                            В корзину
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <aside className={activeView === "cabinet" ? "flex flex-col gap-3" : "hidden lg:flex lg:flex-col lg:gap-3"}>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Кабинет клиента</h2>
                <p className="text-xs text-slate-500">B2B-профиль для счета и доставки</p>
              </div>
              <Building2 className="size-5 text-primary" />
            </div>
            <div className="mt-4 rounded-md border bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="size-4 text-primary" />
                Email-вход
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_128px]">
                <input
                  className="h-10 min-w-0 rounded-md border bg-white px-3 text-sm"
                  value={portalEmail}
                  onChange={(event) => {
                    setPortalEmail(event.target.value)
                    updateProfile("email", event.target.value)
                  }}
                  placeholder="email@company.ru"
                  inputMode="email"
                />
                <input
                  className="h-10 min-w-0 rounded-md border bg-white px-3 text-sm"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  placeholder="Код"
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0 text-xs text-slate-500">{sessionStatus}</div>
                <Button size="sm" onClick={loginWithEmail} disabled={busy || Boolean(initData)}>
                  <ShieldCheck className="size-4" />
                  Войти
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <input className="h-11 rounded-md border px-3 text-sm" value={profile.company_name} onChange={(event) => updateProfile("company_name", event.target.value)} placeholder="Компания" />
              <input className="h-11 rounded-md border px-3 text-sm" value={profile.inn} onChange={(event) => updateProfile("inn", event.target.value)} placeholder="ИНН" inputMode="numeric" />
              <input className="h-11 rounded-md border px-3 text-sm" value={profile.contact_name} onChange={(event) => updateProfile("contact_name", event.target.value)} placeholder="Контакт" />
              <input className="h-11 rounded-md border px-3 text-sm" value={profile.role} onChange={(event) => updateProfile("role", event.target.value)} placeholder="Роль" />
              <input className="h-11 rounded-md border px-3 text-sm" value={profile.phone} onChange={(event) => updateProfile("phone", event.target.value)} placeholder="Телефон" inputMode="tel" />
              <input
                className="h-11 rounded-md border px-3 text-sm"
                value={profile.email}
                onChange={(event) => {
                  updateProfile("email", event.target.value)
                  setPortalEmail(event.target.value)
                }}
                placeholder="Email"
                inputMode="email"
              />
              <input className="h-11 rounded-md border px-3 text-sm" value={profile.delivery_address} onChange={(event) => updateProfile("delivery_address", event.target.value)} placeholder="Адрес доставки" />
              <input className="h-11 rounded-md border px-3 text-sm" value={profile.website} onChange={(event) => updateProfile("website", event.target.value)} placeholder="Сайт" inputMode="url" />
              <input className="h-11 rounded-md border px-3 text-sm" value={profile.office_people} onChange={(event) => updateProfile("office_people", event.target.value)} placeholder="Людей в офисе" inputMode="numeric" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={enrichCompany} disabled={busy} className="gap-2">
                <Sparkles className="size-4" />
                2ГИС/ФНС
              </Button>
              <Button onClick={() => syncSession(profile).then(() => setMessage("Кабинет сохранен.")).catch((error) => setMessage(error.message))} disabled={busy}>
                Сохранить
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">CRM и AI</h2>
                <p className="text-xs text-slate-500">Единая база заказов и остатков</p>
              </div>
              <Bot className="size-5 text-primary" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border bg-slate-50 p-3">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <BarChart3 className="size-3.5" />
                  Заказы
                </div>
                <div className="mt-1 font-semibold">{qtyLabel(insights?.orders_count ?? orders.length)}</div>
              </div>
              <div className="rounded-md border bg-slate-50 p-3">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <ShoppingCart className="size-3.5" />
                  Выручка
                </div>
                <div className="mt-1 font-semibold">{money(insights?.total_revenue ?? 0)}</div>
              </div>
              <div className="rounded-md border bg-slate-50 p-3">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Boxes className="size-3.5" />
                  SKU
                </div>
                <div className="mt-1 font-semibold">{qtyLabel(insights?.inventory.sku_count ?? catalog.products.length)}</div>
              </div>
              <div className="rounded-md border bg-slate-50 p-3">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <PackageCheck className="size-3.5" />
                  Резерв
                </div>
                <div className="mt-1 font-semibold">{qtyLabel(insights?.inventory.reserved ?? 0)}</div>
              </div>
            </div>
            {insights?.top_products.length ? (
              <div className="mt-3 rounded-md border bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-500">Ходовые позиции клиента</div>
                <div className="mt-2 space-y-1">
                  {insights.top_products.slice(0, 3).map((item) => (
                    <div key={item.product_id} className="flex items-start justify-between gap-2 text-xs text-slate-600">
                      <span className="min-w-0">{item.name}</span>
                      <span className="shrink-0">{qtyLabel(item.quantity)} шт.</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {insights?.inventory.low_stock.length ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-medium text-amber-900">Контроль остатков</div>
                <div className="mt-2 space-y-1">
                  {insights.inventory.low_stock.slice(0, 3).map((item) => (
                    <div key={item.product_id} className="flex items-start justify-between gap-2 text-xs text-amber-900">
                      <span className="min-w-0">{item.name}</span>
                      <span className="shrink-0">{qtyLabel(item.available_quantity)} / {qtyLabel(item.target_stock)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {agentMessage ? <div className="mt-3 rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600">{agentMessage}</div> : null}
            <Button className="mt-3 w-full" variant="outline" onClick={requestAgentSupport} disabled={busy}>
              <Bot className="size-4" />
              Поставить AI-задачу
            </Button>
          </div>

          {enrichment ? (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Расчет КП</h2>
                <Badge variant={enrichment.office_people.confidence === "high" ? "success" : enrichment.office_people.confidence === "medium" ? "warning" : "muted"}>
                  {enrichment.office_people.confidence}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Офис</div>
                  <div className="font-semibold">{enrichment.office_people.min}-{enrichment.office_people.max}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Покупатели/день</div>
                  <div className="font-semibold">{enrichment.office_people.likely_buyers_min}-{enrichment.office_people.likely_buyers_max}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Старт</div>
                  <div className="font-semibold">{enrichment.office_people.recommended_portions} порций</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Бюджет</div>
                  <div className="font-semibold">{money(enrichment.office_people.estimated_launch_budget)}</div>
                </div>
              </div>
              {employeeCountRows(enrichment).length ? (
                <div className="mt-3 rounded-md border bg-slate-50 p-3">
                  <div className="text-xs font-medium text-slate-500">Источники численности</div>
                  <div className="mt-2 grid gap-2">
                    {employeeCountRows(enrichment).map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="font-semibold">{qtyLabel(item.value)} чел.</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-slate-500">{enrichment.office_people.method}</p>
              <div className="mt-3 rounded-md border bg-amber-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">{enrichment.proposal.office_size_label}</Badge>
                  <Badge variant="outline">{enrichment.proposal.confidence_label}</Badge>
                </div>
                <div className="mt-2 text-sm font-semibold text-amber-950">Что предложить</div>
                <p className="mt-1 text-xs leading-5 text-amber-900">{enrichment.proposal.launch_scenario}</p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-900">
                  {enrichment.proposal.what_to_offer.slice(0, 4).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
                <div className="mt-2 rounded-md bg-white/70 px-2 py-1.5 text-xs leading-5 text-amber-950">{enrichment.proposal.headcount_source}</div>
                <div className="mt-2 rounded-md bg-white/70 px-2 py-1.5 text-xs leading-5 text-amber-950">{enrichment.proposal.manager_next_step}</div>
              </div>
              {launchBasketSuggestions.length ? (
                <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-3">
                  <div className="text-sm font-semibold text-orange-950">Стартовый заказ</div>
                  <div className="mt-1 text-xs leading-5 text-orange-800">
                    {launchBasketSuggestions.length} SKU · {qtyLabel(launchBasketSuggestions.reduce((sum, item) => sum + item.quantity, 0))} порций · {money(launchBasketTotal)}
                  </div>
                  <Button className="mt-3 w-full" size="sm" onClick={applyLaunchBasket}>
                    <PackageCheck className="size-4" />
                    Собрать стартовый заказ
                  </Button>
                </div>
              ) : null}
              <div className="mt-3 space-y-2">
                {enrichment.sources.slice(0, 4).map((source) => (
                  <div key={`${source.source}-${source.title}`} className="flex items-start gap-2 rounded-md border bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                    <CheckCircle2 className="mt-0.5 size-3.5 text-primary" />
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800">{source.title}</span>
                      <span className="ml-1 inline-flex"><Badge variant={sourceStatusVariant(source.status)}>{sourceStatusLabel(source.status)}</Badge></span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border bg-white p-4 text-sm shadow-sm">
            <div className="font-semibold">Последние заказы</div>
            <div className="mt-3 space-y-2">
              {orders.length ? (
                orders.map((order) => {
                  const meta = orderStatusMeta(order.status)
                  return (
                    <div key={order.id} className="rounded-md border bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span>#{order.id}</span>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {money(order.total_amount)} · заказ {shortDate(order.created_at)} · доставка {shortDate(order.delivery_date)} · оплата {shortDate(order.payment_date)}
                      </div>
                      <div className="mt-2 rounded-md border bg-white px-2 py-1.5 text-xs leading-5 text-slate-600">
                        {meta.hint}
                      </div>
                      {order.items.length ? (
                        <div className="mt-2 space-y-1">
                          {order.items.slice(0, 4).map((item) => (
                            <div key={`${order.id}-${item.product_id}`} className="flex items-start justify-between gap-2 text-xs text-slate-600">
                              <span className="min-w-0">{item.name}</span>
                              <span className="shrink-0">{item.quantity} шт.</span>
                            </div>
                          ))}
                          {order.items.length > 4 ? (
                            <div className="text-xs text-slate-500">Еще {order.items.length - 4} SKU</div>
                          ) : null}
                        </div>
                      ) : null}
                      {order.manager_comment ? <div className="mt-2 rounded-md bg-white px-2 py-1.5 text-xs text-slate-500">Комментарий менеджера: {order.manager_comment}</div> : null}
                      {order.items.length ? (
                        <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => repeatOrder(order)}>
                          Повторить заказ
                        </Button>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <div className="text-xs text-slate-500">Пока нет заказов.</div>
              )}
            </div>
          </div>
        </aside>

        <aside className={activeView === "cart" ? "flex flex-col gap-3" : "hidden lg:flex lg:flex-col lg:gap-3"}>
          <div className="sticky top-3 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Корзина</h2>
              <Badge variant={remaining ? "warning" : "success"}>{qtyLabel(totalQty)} шт.</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {cartItems.length ? (
                cartItems.map((item) => (
                  <div key={item.product.id} className="rounded-md border bg-slate-50 p-3">
                    <div className="text-sm font-medium">{item.product.name}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-sm text-slate-600">{money(item.product.wholesale_price * item.quantity)}</div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => setQuantity(item.product.id, item.quantity - 1)} aria-label="Уменьшить">
                          <ChevronLeft className="size-4" />
                        </Button>
                        <div className="w-8 text-center text-sm font-semibold">{item.quantity}</div>
                        <Button size="sm" variant="outline" onClick={() => setQuantity(item.product.id, item.quantity + 1)} aria-label="Добавить">
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-500">Корзина пуста.</div>
              )}
            </div>
            <div className="mt-4 rounded-md border bg-white p-3">
              <div className="text-sm font-semibold">Доставка</div>
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1 text-xs text-slate-500">
                  Дата заказа
                  <input
                    className="h-10 rounded-md border bg-slate-50 px-3 text-sm text-slate-700"
                    type="date"
                    value={dateInputValue(new Date())}
                    readOnly
                  />
                </label>
                <label className="grid gap-1 text-xs text-slate-500">
                  Дата доставки
                  <input
                    className="h-10 rounded-md border bg-white px-3 text-sm text-slate-900"
                    type="date"
                    min={minDeliveryDate}
                    value={checkout.delivery_date}
                    onChange={(event) => setCheckout((current) => ({ ...current, delivery_date: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-xs text-slate-500">
                  Дата оплаты
                  <input
                    className="h-10 rounded-md border bg-white px-3 text-sm text-slate-900"
                    type="date"
                    value={checkout.payment_date}
                    onChange={(event) => setCheckout((current) => ({ ...current, payment_date: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-xs text-slate-500">
                  Комментарий к заказу
                  <textarea
                    className="min-h-20 rounded-md border bg-white px-3 py-2 text-sm text-slate-900"
                    value={checkout.instructions}
                    onChange={(event) => setCheckout((current) => ({ ...current, instructions: event.target.value }))}
                    placeholder="Например: доставить до 11:00, позвонить за 30 минут, нужна накладная."
                  />
                </label>
                <div className="text-xs leading-5 text-slate-500">
                  Минимальный срок: {catalog.order_terms.order_lead_time_days} дн. Заказ принимается {catalog.order_terms.order_cutoff_time.toLowerCase()}.
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-md border bg-slate-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span>Итого</span>
                <b>{money(total)}</b>
              </div>
              {remaining ? <div className="mt-1 text-xs text-amber-700">До минимума {money(remaining)}</div> : <div className="mt-1 text-xs text-orange-700">Минимум заказа выполнен</div>}
            </div>
            {remaining && topUpSuggestions.length ? (
              <div className="mt-3 rounded-md border bg-amber-50 p-3">
                <div className="text-sm font-semibold text-amber-950">Добрать минимум</div>
                <div className="mt-2 space-y-2">
                  {topUpSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.product.id}
                      type="button"
                      className="w-full rounded-md border bg-white p-2 text-left text-xs shadow-sm"
                      onClick={() => addMinimumTopUp(suggestion.product.id, suggestion.quantity)}
                    >
                      <div className="font-medium text-slate-900">{suggestion.product.name}</div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-slate-500">
                        <span>
                          +{suggestion.quantity} шт. · {suggestion.product.category}
                        </span>
                        <span className="shrink-0 font-semibold text-slate-700">{money(suggestion.lineTotal)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <Button className="mt-3 w-full" onClick={submitOrder} disabled={!canSubmit}>
              <ShoppingCart className="size-4" />
              Оформить заказ
            </Button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 p-3 shadow-lg backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button type="button" className="min-w-0 text-left" onClick={() => setActiveView("cart")}>
            <div className="text-xs text-slate-500">{totalQty ? `${qtyLabel(totalQty)} позиций` : "Корзина"}</div>
            <div className="font-semibold">{money(total)}</div>
          </button>
          <Button onClick={totalQty ? submitOrder : () => setActiveView("catalog")} disabled={totalQty > 0 && !canSubmit}>
            {totalQty ? "Оформить" : "Каталог"}
          </Button>
        </div>
      </div>
    </main>
  )
}
