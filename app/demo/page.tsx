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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "B2B Food CRM Demo",
  description: "Продающее demo CRM для B2B-поставщиков готовой еды: лиды, каталог, матрицы запуска, заказы и AI-задачи."
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
  ["Кофейни и пекарни", "Допродажа готовой еды к кофе без собственной кухни и сложной закупки."],
  ["Кофейные сети", "Единая матрица по точкам, дегустации, контроль списаний и повторного заказа."],
  ["Вендинг и микромаркеты", "Холодильники самообслуживания, офисные маршруты и понятная SKU-глубина."],
  ["Офисы и БЦ", "Готовая полка для сотрудников: график поставок, корзина, повтор и контроль минимума."],
  ["Фитнес и кампусы", "Быстрые завтраки, обеды и десерты для дневного трафика без очереди в столовой."]
]

const workflow = [
  {
    icon: MapPinned,
    title: "Лид найден",
    text: "CRM собирает локацию, сегмент, сайт, карту, источник и следующий шаг для менеджера."
  },
  {
    icon: PhoneCall,
    title: "Квалификация",
    text: "Менеджер видит score, формат точки, риск списаний и вопрос, который переводит лид к встрече."
  },
  {
    icon: PackageCheck,
    title: "Матрица SKU",
    text: "Под каждый сегмент есть короткий стартовый набор: что предложить, зачем и на какую глубину."
  },
  {
    icon: ShoppingBasket,
    title: "Пилот и повтор",
    text: "Пробная поставка становится заказом в CRM, а повтор не теряется в переписке."
  },
  {
    icon: Bot,
    title: "AI-задачи",
    text: "Агент готовит письмо, follow-up, скрипт, enrichment и рекомендацию, но не меняет CRM без менеджера."
  }
]

const packages = [
  {
    title: "Demo-показ",
    price: "15 минут",
    text: "Показать полный CRM-сценарий на примере B2B-поставщика готовой еды.",
    items: ["Воронка и база лидов", "Каталог и SKU-матрицы", "Mini App и заказы"]
  },
  {
    title: "Пилот на 14 дней",
    price: "1 сегмент",
    text: "Проверить один B2B-сегмент: лиды, дегустации, запуск, повтор и next steps.",
    items: ["30-50 B2B-кандидатов", "5-10 встреч или дегустаций", "Контроль первого повтора"]
  },
  {
    title: "Масштабирование",
    price: "ежемесячно",
    text: "Добавлять сегменты, источники, enrichment, интеграции и AI-операции для менеджеров.",
    items: ["Новые локальные лиды", "Отчеты по pipeline", "API, Telegram, MCP-интеграции"]
  }
]

const objections = [
  {
    title: "У нас уже есть CRM",
    text: "Это не замена всему контуру. Demo показывает вертикальный слой продаж: сегмент -> SKU-матрица -> пилот -> повтор."
  },
  {
    title: "Есть сайт и личный кабинет",
    text: "Сайт принимает интерес. CRM доводит до закупки: кому звонить, что предложить, когда ставить дегустацию и как дожимать повтор."
  },
  {
    title: "Не хотим еще одну систему",
    text: "Пилот можно вести отдельно. Если появляется повторяемая экономика, дальше подключаются API, Telegram, выгрузки или MCP."
  }
]

export default async function DemoPage() {
  const data = getDemoData()
  const baseUrl = await currentBaseUrl()
  const crmDashboardUrl = "/?tab=funnel"

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <a className="flex items-center gap-3 font-semibold" href="#top" aria-label="B2B Food CRM Demo">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">CRM</span>
            <span>B2B Food CRM Demo</span>
          </a>
          <nav className="hidden items-center gap-5 text-sm font-medium text-muted-foreground lg:flex" aria-label="Навигация demo">
            <a className="hover:text-foreground" href="#result">
              Результат
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
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href="/catalog">
              Каталог demo
              <ExternalLink />
            </a>
          </Button>
        </div>
      </header>

      <section id="top" className="border-b px-4 py-12 lg:px-6 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-7">
            <Badge variant="success" className="w-fit">
              Render demo для портфолио и клиентских показов
            </Badge>
            <div className="flex flex-col gap-5">
              <h1 className="max-w-5xl text-4xl font-semibold leading-none tracking-normal md:text-6xl">
                CRM для продажи готовой еды B2B: от первого лида до повторного заказа
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground md:text-2xl">
                Demo показывает не “еще одну CRM”, а готовый sales-контур: локальные лиды, сегменты, SKU-матрицы,
                клиентский каталог, Telegram Mini App, заказы и AI-задачи менеджеру.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="#show">
                  Смотреть сценарий demo
                  <ArrowRight />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/catalog">
                  Каталог клиента
                  <ExternalLink />
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href="/miniapp">
                  Mini App demo
                  <ExternalLink />
                </a>
              </Button>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Данные собраны на примере компании и открытого каталога. Это демонстрационный кейс, а не заявление о партнерстве или внедрении. Полный dashboard этой же demo CRM открывается по ключу на созвоне или для выбранного клиента.
            </p>
          </div>

          <Card className="overflow-hidden border-primary/30">
            <CardHeader>
              <Badge variant="outline" className="w-fit">
                Что видит потенциальный клиент
              </Badge>
              <CardTitle className="text-2xl">Готовая история роста, а не список функций</CardTitle>
              <CardDescription>
                На примере {data.exampleCompany}: как найти точки, что предложить, как принять заказ и когда возвращаться за повтором.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["B2B-локаций", data.companies],
                  ["SKU в demo", data.activeProducts],
                  ["Матриц запуска", data.matrices],
                  ["Demo-заказов", data.orders]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-muted/45 p-4">
                    <div className="text-3xl font-semibold">{value}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border bg-accent/40 p-4 text-sm leading-6 text-muted-foreground">
                <b className="text-foreground">Сценарий показа:</b> воронка, сегмент, матрица SKU, каталог, заказ и AI follow-up.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="result" className="px-4 py-14 lg:px-6">
        <SectionHeading label="Зачем это клиенту" title="CRM продает управляемый рост B2B-канала">
          Потенциальному клиенту важны не технологии, а понятный ответ: где брать партнеров, какой набор предложить,
          как не потерять дегустации и как довести первую поставку до повтора.
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
              title: "Предложение под формат",
              text: "Не общий каталог, а короткая стартовая матрица с объяснением, почему эти SKU подходят точке."
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

      <section id="show" className="border-y bg-muted/55 px-4 py-14 lg:px-6">
        <SectionHeading label="Что открыть на demo" title="Показываем рабочий путь от интереса до заказа">
          Страница ведет клиента к полному demo CRM dashboard, каталогу и Mini App. На созвоне можно пройти сценарий за 12-15 минут.
        </SectionHeading>
        <div className="mx-auto max-w-7xl">
          <Tabs defaultValue="segments">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-background p-2">
              <TabsTrigger value="segments">Сегменты</TabsTrigger>
              <TabsTrigger value="screens">CRM-экраны</TabsTrigger>
              <TabsTrigger value="products">SKU</TabsTrigger>
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
                  ["Воронка", "Показать сделки на стадиях: новый лид, квалификация, контакт, дегустация, пробная поставка."],
                  ["Единая база", "Показать компании, сегменты, score, адрес, источники и следующий шаг менеджера."],
                  ["Матрица запуска", "Показать, что предлагать конкретному сегменту и почему этот набор должен продаваться."],
                  ["ИИ-агенты", "Показать очередь задач: письмо, follow-up, SKU-рекомендация, enrichment и проверка источников."]
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
                        Demo закупка {money(product.wholesale_price)}
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
                    “Мы собрали demo CRM для B2B ready-to-eat в Петербурге. Она показывает не сайт и не общий каталог,
                    а управляемую воронку: лид, сегмент, SKU-матрица, дегустация, пилот, повтор. На примере вашей
                    категории можно быстро проверить, где продажи теряются и какие действия должен получать менеджер.”
                  </CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <section id="workflow" className="px-4 py-14 lg:px-6">
        <SectionHeading label="Процесс продажи" title="Один маршрут от базы до денег">
          Главная мысль для потенциального клиента: CRM нужна не ради отчетности, а чтобы ни один лид, пилот или повтор не завис без следующего действия.
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
        <SectionHeading label="Коммерческий оффер" title="Что продавать после просмотра demo CRM">
          Начать с короткого demo-показа, затем предложить пилот на одном сегменте. Большое внедрение продавать только после сигнала по лидам, дегустациям и повторным заказам.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
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
              Demo должно звучать как бизнес-инструмент для роста B2B-продаж, а не как техническая панель с таблицами.
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
                Ссылка для отправки
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal">{baseUrl}/demo</h2>
              <p className="mt-3 max-w-3xl text-primary-foreground/85">
                Отправляйте эту страницу как sales demo. Полный dashboard этой же demo CRM открывается по ключу, чтобы база не индексировалась публично.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg" className="bg-background text-foreground hover:bg-background/90">
              <a href={crmDashboardUrl}>
                Demo CRM dashboard
                <ArrowRight />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t px-4 py-8 text-sm text-muted-foreground lg:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>Демо построено на примере компании и открытых каталогах. Это не заявление о партнерстве или внедрении у {data.exampleCompany}.</div>
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
