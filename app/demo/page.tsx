import type { Metadata } from "next"
import { headers } from "next/headers"
import { Bot, Database, ExternalLink, ListChecks, LockKeyhole, MonitorSmartphone, ShieldCheck, ShoppingCart } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "B2B Food CRM demo | Portfolio",
  description: "Публичная demo-страница CRM: каталог, Mini App, заказы, AI-задачи и Render-ссылки для портфолио."
}

type ProductPreview = {
  id: number
  category: string
  name: string
  wholesale_price: number
  image_url: string | null
}

type SegmentPreview = {
  segment: string
  name: string
  target_sku_count: string
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value)
}

function count(db: ReturnType<typeof getDb>, sql: string) {
  try {
    const row = db.prepare(sql).get() as { count?: number } | undefined
    return Number(row?.count ?? 0)
  } catch {
    return 0
  }
}

function setting(db: ReturnType<typeof getDb>, key: string, fallback: string) {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value?: string } | undefined
    return row?.value?.trim() || fallback
  } catch {
    return fallback
  }
}

function getDemoStats() {
  const db = getDb()
  return {
    exampleCompany: setting(db, "demo_customer_name", "пример компании"),
    geography: setting(db, "active_strategy_geography", "Санкт-Петербург"),
    firstOffer: setting(db, "active_strategy_first_offer", "Пилотная CRM-демонстрация для B2B-продаж."),
    companies: count(db, "SELECT COUNT(*) AS count FROM companies"),
    activeProducts: count(db, "SELECT COUNT(*) AS count FROM products WHERE is_active = 1"),
    matrices: count(db, "SELECT COUNT(*) AS count FROM segment_matrices"),
    orders: count(db, "SELECT COUNT(*) AS count FROM orders"),
    queuedTasks: count(db, "SELECT COUNT(*) AS count FROM ai_tasks WHERE status = 'queued'"),
    productPreviews: db
      .prepare(
        `
          SELECT id, category, name, wholesale_price, image_url
          FROM products
          WHERE is_active = 1
          ORDER BY image_url IS NULL, id
          LIMIT 4
        `
      )
      .all() as ProductPreview[],
    segmentPreviews: db
      .prepare(
        `
          SELECT segment, name, target_sku_count
          FROM segment_matrices
          ORDER BY id
          LIMIT 5
        `
      )
      .all() as SegmentPreview[]
  }
}

async function currentBaseUrl() {
  const requestHeaders = await headers()
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3011"
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") || host.startsWith("127.") ? "http" : "https")
  return `${protocol}://${host}`.replace(/\/+$/, "")
}

const capabilityCards = [
  {
    title: "CRM-воронка и база",
    text: "Сегменты, компании, стадии, сделки и менеджерские действия собраны в одном рабочем интерфейсе.",
    icon: Database
  },
  {
    title: "Каталог и КП",
    text: "SKU, фото, цены, стартовые матрицы и клиентский каталог читаются из одной SQLite-базы.",
    icon: ListChecks
  },
  {
    title: "Telegram Mini App",
    text: "Клиентский каталог, кабинет, корзина, история заказов и повтор заказа готовы к подключению бота.",
    icon: MonitorSmartphone
  },
  {
    title: "AI-задачи менеджеру",
    text: "Агенты готовят next steps, enrichment и проверки источников, но не меняют CRM без подтверждения.",
    icon: Bot
  }
]

export default async function DemoPage() {
  const stats = getDemoStats()
  const baseUrl = await currentBaseUrl()
  const publicLinks = [
    { label: "Публичный обзор", href: "/demo", value: `${baseUrl}/demo` },
    { label: "Клиентский каталог", href: "/catalog", value: `${baseUrl}/catalog` },
    { label: "Telegram Mini App demo", href: "/miniapp", value: `${baseUrl}/miniapp` },
    { label: "Health check", href: "/api/health", value: `${baseUrl}/api/health` }
  ]

  return (
    <main className="crm-shell">
      <div className="crm-workspace">
        <section className="rounded-lg border bg-card p-5 shadow-sm lg:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Render live demo</Badge>
                <Badge variant="outline">Портфолио</Badge>
                <Badge variant="muted">Без секретов в публичной ссылке</Badge>
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-normal text-foreground lg:text-5xl">
                B2B Food CRM demo для отправки клиентам
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground lg:text-lg">
                CRM демонстрирует B2B-воронку, каталог SKU, клиентский Mini App, заказы и AI-задачи менеджеру. Данные собраны на примере компании и открытом каталоге; это не заявление о партнерстве. Эту Render-ссылку можно отправлять клиентам и размещать в портфолио без передачи CRM-ключа.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href="/catalog">
                    Открыть каталог
                    <ExternalLink />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="/miniapp">
                    Открыть Mini App
                    <ExternalLink />
                  </a>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <a href="/?tab=overview">
                    Demo CRM dashboard по ключу
                    <LockKeyhole />
                  </a>
                </Button>
              </div>
            </div>

            <Card className="bg-accent/35">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  Ссылка для отправки
                </CardTitle>
                <CardDescription>Начинайте с этой страницы: она публичная, аккуратная и не раскрывает внутренний доступ.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-background p-3 text-sm font-medium break-all">{baseUrl}/demo</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Полный dashboard этой demo CRM защищен ключом: его можно показывать на созвоне или отправлять отдельной ссылкой только выбранному человеку.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["B2B-компаний", stats.companies],
            ["Активных SKU", stats.activeProducts],
            ["Матриц запуска", stats.matrices],
            ["Demo-заказов", stats.orders],
            ["AI-задач", stats.queuedTasks]
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="dense-label">{label}</div>
                <div className="mt-2 text-3xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          {capabilityCards.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-5 text-primary" />
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">{item.text}</CardContent>
              </Card>
            )
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Что видит клиент по публичной ссылке</CardTitle>
              <CardDescription>Пример данных: {stats.exampleCompany}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {publicLinks.map((link) => (
                <a
                  key={link.href}
                  className="flex min-w-0 flex-col gap-1 rounded-md border bg-background p-3 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
                  href={link.href}
                >
                  <span className="font-medium">{link.label}</span>
                  <span className="min-w-0 break-all text-sm text-muted-foreground">{link.value}</span>
                </a>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Безопасность портфолио</CardTitle>
              <CardDescription>Публичная часть отделена от операционной CRM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                Открыто без ключа: overview, каталог, Mini App demo и health check. Они нужны для портфолио и первого просмотра.
              </p>
              <p>
                Закрыто ключом: полный demo dashboard CRM, dashboard API, экспорт заказов, enrichment, Apify, 2ГИС, Telegram setup и агентские операции.
              </p>
              <p>
                Demo построено на примере компании и открытом каталоге; это не заявление о партнерстве. Внешнему клиенту не показываются API-токены, server-side secrets и технические настройки Render.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle>Живые SKU из CRM-каталога</CardTitle>
              <CardDescription>Фото и цены подтягиваются из той же базы, что использует каталог и Mini App.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.productPreviews.map((product) => (
                  <article key={product.id} className="min-w-0 overflow-hidden rounded-lg border bg-background">
                    <div className="aspect-[4/3] bg-muted">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Фото SKU</div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-medium text-muted-foreground">{product.category}</div>
                      <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</h3>
                      <div className="mt-3 inline-flex rounded-md border border-[#ffd8c2] bg-[#fff2eb] px-2 py-1 text-sm font-semibold text-[#a63400]">
                        {money(product.wholesale_price)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-primary" />
                Первый оффер
              </CardTitle>
              <CardDescription>{stats.geography}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>{stats.firstOffer}</p>
              <div className="space-y-2">
                {stats.segmentPreviews.map((segment) => (
                  <div key={`${segment.segment}-${segment.name}`} className="rounded-md border bg-background p-3">
                    <div className="font-medium text-foreground">{segment.segment}</div>
                    <div className="mt-1 text-muted-foreground">{segment.name}</div>
                    <Badge variant="outline" className="mt-2">
                      {segment.target_sku_count} SKU
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
