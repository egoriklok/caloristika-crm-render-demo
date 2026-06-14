import type { Metadata } from "next"
import { headers } from "next/headers"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  LineChart,
  MapPinned,
  PackageCheck,
  PhoneCall,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "B2B Food CRM Demo",
  description: "Demo CRM для B2B-поставщиков готовой еды: сегменты, лиды, товарные матрицы, пилоты, заказы и повторы."
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

function getDemoData() {
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
          LIMIT 6
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

function SectionHeading({
  label,
  title,
  children
}: {
  label: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="mx-auto mb-8 flex max-w-5xl flex-col gap-4">
      <Badge variant="outline" className="w-fit border-primary/30 text-primary">
        {label}
      </Badge>
      <h2 className="max-w-4xl text-3xl font-semibold leading-tight tracking-normal md:text-5xl">{title}</h2>
      {children ? <div className="max-w-3xl text-lg leading-8 text-muted-foreground">{children}</div> : null}
    </div>
  )
}

const segments = [
  ["Кофейни и пекарни", "Добавить готовую еду к кофе с понятной закупкой, регулярной поставкой и контролем спроса."],
  ["Кофейные сети", "Согласовать матрицу по точкам, провести дегустации, увидеть продажи и управлять повтором."],
  ["Вендинг и микромаркеты", "Подобрать ассортимент для холодильников самообслуживания, офисных маршрутов и регулярной загрузки."],
  ["Офисы и БЦ", "Запустить готовую полку для сотрудников: график поставок, корзина, повтор и контроль минимума."],
  ["Фитнес и кампусы", "Подобрать быстрые завтраки, обеды и десерты для дневного трафика и регулярных закупок."]
]

const workflow = [
  {
    icon: MapPinned,
    title: "Найти подходящие точки",
    text: "CRM собирает локацию, сегмент, сайт, карту, источник и следующий шаг для менеджера."
  },
  {
    icon: PhoneCall,
    title: "Понять формат клиента",
    text: "Менеджер видит score, тип точки, риск списаний и вопрос для перехода к встрече."
  },
  {
    icon: PackageCheck,
    title: "Собрать товарную матрицу",
    text: "Для каждого сегмента есть короткий стартовый набор: что предложить, зачем и на какую глубину."
  },
  {
    icon: ShoppingBasket,
    title: "Провести пилот и повтор",
    text: "Пробная поставка становится заказом в CRM, а повтор остается в задачах менеджера."
  },
  {
    icon: Bot,
    title: "Подготовить действия менеджеру",
    text: "Агент готовит письмо, follow-up, скрипт, enrichment и рекомендацию. Все изменения подтверждает менеджер."
  }
]

const packages = [
  {
    title: "Знакомство с продуктом",
    price: "15-30 минут",
    text: "Показать путь работы: сегмент, лиды, предложение, пилот, заказ и повтор.",
    items: ["Публичный вход в CRM", "Клиентский каталог и Mini App", "CRM OS как модель повторяемого запуска"]
  },
  {
    title: "Пилот одного сегмента",
    price: "280-450 тыс. ₽",
    text: "Проверить один город и один B2B-сегмент в легком формате запуска.",
    items: ["100-150 B2B-компаний", "Воронка, КП и первые касания", "Каталог, Mini App и отчет по сигналам"]
  },
  {
    title: "CRM повторных заказов",
    price: "690 тыс. - 1,2 млн ₽",
    text: "Собрать рабочий контур для компаний, контактов, сделок, заказов и повторов.",
    items: ["Роли менеджера и руководителя", "Заказы и история клиента", "AI-задачи, интеграции, backup/restore"]
  },
  {
    title: "Ежемесячный рост",
    price: "90-180 тыс. ₽/мес",
    text: "Развивать подтвержденный канал: новые сегменты, города, скрипты и контроль воронки.",
    items: ["Новые лиды и enrichment", "Разбор просроченных задач", "Новые КП, офферы и агентские workflow"]
  }
]

const objections = [
  {
    title: "CRM уже есть",
    text: "Demo можно использовать как вертикальный слой B2B-продаж поверх текущего контура: сегмент -> товарная матрица -> пилот -> повтор."
  },
  {
    title: "Есть сайт и личный кабинет",
    text: "Сайт принимает интерес. CRM помогает менеджеру выбрать контакт, предложение, дату дегустации и следующий шаг к повтору."
  },
  {
    title: "Нужен простой старт",
    text: "Пилот можно вести отдельно. Когда появляется повторяемая экономика, подключаются API, Telegram, выгрузки или MCP."
  }
]

export default async function DemoPage() {
  const data = getDemoData()
  const baseUrl = await currentBaseUrl()
  const crmDashboardUrl = "/crm?tab=pipeline"
  const demoBaseLayers = [
    {
      title: "1. CRM Caloristika",
      repo: "caloristika-crm-render-demo",
      role: "Публичный вход в demo CRM без ключа: можно открыть воронку, единую базу, матрицу запуска и клиентские разделы.",
      links: [
        ["Открыть CRM", `${baseUrl}/crm?tab=pipeline`],
        ["Единая база", `${baseUrl}/crm?tab=accounts`],
        ["Матрица запуска", `${baseUrl}/crm?tab=launch`]
      ]
    },
    {
      title: "2. Клиентская сторона",
      repo: "caloristika-crm-render-demo",
      role: "Каталог и Mini App показывают, как клиент видит ассортимент, выбирает позиции и переходит к заказу.",
      links: [
        ["Каталог", `${baseUrl}/catalog`],
        ["Mini App", `${baseUrl}/miniapp`],
        ["Каталог в CRM", `${baseUrl}/crm?tab=catalog`]
      ]
    },
    {
      title: "3. CRM OS / RouteOps blueprint",
      repo: "agentic-crm-product-blueprint",
      role: "Архитектурная витрина: как повторять запуск под новую компанию, подключать агентов, источники данных, Telegram и внешние API.",
      links: [
        ["GitHub Pages", "https://egoriklok.github.io/agentic-crm-product-blueprint/"],
        ["Render static", "https://agentic-crm-product-blueprint.onrender.com"]
      ]
    }
  ]

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <a className="flex items-center gap-3 font-semibold" href="#top" aria-label="B2B Food CRM Demo">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">CRM</span>
            <span>Caloristika CRM Demo</span>
          </a>
          <nav className="hidden items-center gap-5 text-sm font-medium text-muted-foreground lg:flex" aria-label="Навигация demo">
            <a className="hover:text-foreground" href="#result">
              Результат
            </a>
            <a className="hover:text-foreground" href="#demobase">
              Demobase
            </a>
            <a className="hover:text-foreground" href="#show">
              Что показать
            </a>
            <a className="hover:text-foreground" href="#workflow">
              Процесс
            </a>
            <a className="hover:text-foreground" href="#offer">
              Оффер
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <a href="/crm?tab=pipeline">
                Открыть CRM
                <ExternalLink />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section id="top" className="border-b px-4 py-12 lg:px-6 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-5">
              <h1 className="max-w-5xl text-4xl font-semibold leading-none tracking-normal md:text-6xl">
                CRM для B2B-продаж готовой еды: от первого интереса до повторного заказа
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground md:text-2xl">
                Когда поставщик готовой еды запускает B2B-продажи, команде нужно быстро понять,
                какие компании подходят, что предложить каждому сегменту, как провести дегустацию,
                принять первый заказ и закрепить повтор. Demo собирает этот путь в одном рабочем месте:
                локальные лиды, сегменты, SKU-матрицы, клиентский каталог, Telegram Mini App, заказы
                и AI-задачи менеджеру.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="/crm?tab=pipeline">
                  Открыть CRM Caloristika
                  <ArrowRight />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/catalog">
                  Открыть каталог
                  <ExternalLink />
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href="/miniapp">
                  Открыть Mini App
                  <ExternalLink />
                </a>
              </Button>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Данные собраны на примере компании и открытого каталога. Это demo-кейс для показа логики продукта. Для первого просмотра используйте публичный вход в CRM без ключа.
            </p>
          </div>

          <Card className="overflow-hidden border-primary/30">
            <CardHeader>
              <CardTitle className="text-2xl">Маршрут роста B2B-продаж</CardTitle>
              <CardDescription>
                На примере {data.exampleCompany}: как выбрать точки, собрать предложение, принять заказ и вернуться за повтором.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["B2B-локаций", data.companies],
                  ["SKU в demo", data.activeProducts],
                  ["Матриц запуска", data.matrices],
                  ["Repo слоя", 3]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-muted/45 p-4">
                    <div className="text-3xl font-semibold">{value}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border bg-accent/40 p-4 text-sm leading-6 text-muted-foreground">
                <b className="text-foreground">Что посмотреть в CRM:</b> воронка, сегмент, товарная матрица, каталог, заказ и задача менеджеру.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="result" className="px-4 py-14 lg:px-6">
        <SectionHeading label="Задача клиента" title="Проверить B2B-канал и довести первые сделки до повтора">
          Команде нужен понятный маршрут: найти подходящие компании, подобрать стартовый набор,
          провести дегустацию, принять первый заказ и вовремя вернуться к клиенту за повтором.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {[
            {
              icon: Store,
              title: "Локальные B2B-сегменты",
              text: "Кофейни, микромаркеты, офисы, кампусы, фитнес и другие точки с регулярным спросом."
            },
            {
              icon: PackageCheck,
              title: "Предложение под формат точки",
              text: "Короткая стартовая матрица объясняет, какие позиции подходят точке и с какой глубиной запускать тест."
            },
            {
              icon: LineChart,
              title: "Повтор как главный KPI",
              text: "CRM держит менеджера на следующем действии после дегустации, пилота и первой поставки."
            }
          ].map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title}>
                <CardHeader>
                  <Icon className="size-7 text-primary" />
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>

      <section id="demobase" className="border-y bg-secondary/60 px-4 py-14 lg:px-6">
        <SectionHeading label="Единая demobase" title="Одна история продукта: CRM, каталог и операционная модель">
          Внешнему клиенту показываем одну цепочку: сначала открываем CRM Caloristika, затем смотрим клиентский каталог и Mini App, затем объясняем CRM OS как модель запуска для следующей компании.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          {demoBaseLayers.map((layer) => (
            <Card key={layer.title}>
              <CardHeader>
                <CardTitle>{layer.title}</CardTitle>
                <CardDescription>{layer.role}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Badge variant="outline" className="w-fit">
                  {layer.repo}
                </Badge>
                <div className="flex flex-wrap gap-2">
                  {layer.links.map(([label, href]) => (
                    <Button asChild key={href} size="sm" variant="outline">
                      <a href={href} target="_blank" rel="noreferrer">
                        {label}
                        <ExternalLink />
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="show" className="border-y bg-muted/55 px-4 py-14 lg:px-6">
        <SectionHeading label="Что открыть в CRM" title="Путь от первой точки до повторного заказа">
          На странице можно открыть CRM Caloristika без ключа, пройти воронку, посмотреть товарные матрицы, каталог, Mini App и задачи менеджеру. На созвоне этот сценарий занимает 12-15 минут.
        </SectionHeading>
        <div className="mx-auto max-w-7xl">
          <Tabs defaultValue="segments">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-background p-2">
              <TabsTrigger value="segments">Сегменты</TabsTrigger>
              <TabsTrigger value="screens">CRM-экраны</TabsTrigger>
              <TabsTrigger value="products">Товары</TabsTrigger>
              <TabsTrigger value="script">Скрипт</TabsTrigger>
            </TabsList>

            <TabsContent value="segments" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {segments.map(([title, text]) => (
                  <Card key={title}>
                    <CardHeader>
                      <CardTitle>{title}</CardTitle>
                      <CardDescription>{text}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="screens" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["Воронка", "Открыть сделки на стадиях: новый лид, квалификация, контакт, дегустация, пробная поставка."],
                  ["Единая база", "Посмотреть компании, сегменты, score, адрес, источники и следующий шаг менеджера."],
                  ["Матрица запуска", "Понять, что предлагать конкретному сегменту и с какой глубиной запускать тест."],
                  ["ИИ-агенты", "Посмотреть задачи: письмо, follow-up, товарная рекомендация, enrichment и проверка источников."]
                ].map(([title, text]) => (
                  <Card key={title}>
                    <CardHeader>
                      <CardTitle>{title}</CardTitle>
                      <CardDescription>{text}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="products" className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data.productPreviews.map((product) => (
                  <article key={product.id} className="overflow-hidden rounded-lg border bg-card">
                    <div className="aspect-[4/3] bg-muted">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Фото SKU</div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="text-xs font-medium text-muted-foreground">{product.category}</div>
                      <h3 className="mt-1 min-h-12 text-sm font-semibold leading-5">{product.name}</h3>
                      <Badge variant="success" className="mt-3">
                        Закупка {money(product.wholesale_price)}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="script" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Формулировка для первого разговора</CardTitle>
                  <CardDescription>
                    “Мы показываем CRM на примере поставщика готовой еды в Петербурге. Сценарий простой:
                    найти подходящие точки, выбрать стартовую товарную матрицу, провести дегустацию, оформить
                    пилот и довести клиента до повтора. На вашей категории можно быстро проверить, какие действия
                    должен получать менеджер и какие сигналы стоит собирать в CRM.”
                  </CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <section id="workflow" className="px-4 py-14 lg:px-6">
        <SectionHeading label="Процесс продажи" title="Маршрут от базы до денег">
          CRM помогает держать следующий шаг по каждому лиду, пилоту и повтору, чтобы менеджер видел приоритет и двигал сделку дальше.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-5">
          {workflow.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title}>
                <CardHeader>
                  <Icon className="size-7 text-primary" />
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>

      <section id="offer" className="border-y bg-accent/30 px-4 py-14 lg:px-6">
        <SectionHeading label="Коммерческий оффер" title="Что предлагать после просмотра CRM">
          Начать с короткого знакомства с продуктом, затем предложить платный пилот на одном сегменте. Внедрение CRM повторных заказов обсуждать после сигнала по лидам, дегустациям и первым заказам.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.text}</CardDescription>
                <div className="text-2xl font-semibold">{item.price}</div>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {item.items.map((feature) => (
                    <li className="flex gap-2" key={feature}>
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-4 py-14 lg:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col gap-4">
            <Badge variant="outline" className="w-fit">
              Работа с возражениями
            </Badge>
            <h2 className="text-3xl font-semibold leading-tight tracking-normal md:text-5xl">Ответы на вопросы клиента</h2>
            <p className="text-lg leading-8 text-muted-foreground">
              Страница должна звучать как рабочий инструмент для роста B2B-продаж: понятные сегменты, предложения, действия менеджера и контроль повтора.
            </p>
          </div>
          <div className="grid gap-3">
            {objections.map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 lg:px-6">
        <Card className="mx-auto max-w-7xl border-primary/30 bg-primary text-primary-foreground">
          <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-5" />
                Ссылка для первого просмотра
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal">{baseUrl}/crm</h2>
              <p className="mt-3 max-w-3xl text-primary-foreground/85">
                Эту ссылку можно отправлять для просмотра CRM без ключа. Человек сразу попадает внутрь панели Caloristika и видит воронку, базу, каталог, заказы и AI-задачи.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg" className="bg-background text-foreground hover:bg-background/90">
              <a href={crmDashboardUrl}>
                Открыть CRM
                <ArrowRight />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t px-4 py-8 text-sm text-muted-foreground lg:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>Демо построено на примере компании и открытых каталогах. Формат страницы: demo-кейс продукта на данных {data.exampleCompany}.</div>
          <div className="flex flex-wrap gap-4">
            <a className="hover:text-foreground" href="/catalog">
              Каталог
            </a>
            <a className="hover:text-foreground" href="/miniapp">
              Mini App
            </a>
            <a className="hover:text-foreground" href="https://github.com/egoriklok/caloristika-crm-render-demo" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
