import type { Metadata } from "next"
import { ExternalLink } from "lucide-react"

import { ClientCatalogActions } from "@/components/client-catalog-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getActiveStrategy, isDefaultStrategyToken } from "@/lib/active-strategy"
import { competitiveAnalysisGeneratedAt, competitiveInsights, competitivePlayers, lunchUpCompetitiveBaseline } from "@/lib/competitive-analysis"
import { getClientCatalogData } from "@/lib/client-catalog"
import { buildSamokatUnitEconomics } from "@/lib/samokat-unit-economics"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Клиентский каталог CRM",
  description: "Печатный A4-каталог с фото блюд, описаниями и сегментами запуска"
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value)
}

function moneyOrDash(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : money(value)
}

function shelfLife(days: number | null) {
  if (!days) return "срок уточняется"
  return `${days} сут.`
}

function generatedDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

function externalHref(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return "#"
  if (/^https?:/i.test(trimmed) || /^\/(?!\/)/.test(trimmed) || trimmed.startsWith("#")) return trimmed
  if (/^www\./i.test(trimmed) || /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

type CatalogPageProps = {
  searchParams?: Promise<{ print?: string; segment?: string; view?: string }>
}

function competitivePrice(player: (typeof competitivePlayers)[number]) {
  if (player.publicPriceLow === null || player.publicPriceHigh === null) return "цена по запросу"
  if (player.publicPriceLow === player.publicPriceHigh) return money(player.publicPriceLow)
  return `${money(player.publicPriceLow)}-${money(player.publicPriceHigh)}`
}

function percent(value: number) {
  return `${value}%`
}

function scenarioShelfStatus(scenario: { within_shelf_life: boolean; shelf_life_safety_days: number }) {
  return scenario.within_shelf_life ? `запас ${scenario.shelf_life_safety_days} дн.` : "риск списаний"
}

function demoBrandName(strategy: ReturnType<typeof getActiveStrategy>) {
  return strategy.name.split(":")[0]?.trim() || "CRM demo"
}

function DemoClientCatalog({
  data,
  activeStrategy
}: {
  data: ReturnType<typeof getClientCatalogData>
  activeStrategy: ReturnType<typeof getActiveStrategy>
}) {
  const brandName = demoBrandName(activeStrategy)
  const photoCount = data.products.filter((product) => product.image_url).length
  const averagePrice = data.products.length
    ? Math.round(data.products.reduce((sum, product) => sum + product.price, 0) / data.products.length)
    : 0

  return (
    <main className="client-catalog-page">
      <div className="client-catalog-inner">
        <header className="client-catalog-top">
          <div>
            <div className="client-catalog-kicker">Санкт-Петербург</div>
            <h1 className="client-catalog-title">{brandName}: клиентский каталог demo</h1>
            <p className="client-catalog-subtitle">
              Каталог сформирован из активной SQLite-базы CRM: товары, фото, цены, сегменты запуска и Mini App используют один источник данных.
            </p>
            <div className="client-catalog-commercial-terms" aria-label="Ключевые условия demo-каталога">
              <div>
                <span>Фокус продаж</span>
                <b>Санкт-Петербург</b>
              </div>
              <div>
                <span>Минимальный заказ</span>
                <b>{money(data.order_terms.minimum_order_amount)}</b>
              </div>
              <div>
                <span>Заказ</span>
                <b>
                  {data.order_terms.order_lead_time_days} дн. до {data.order_terms.order_cutoff_time}
                </b>
              </div>
            </div>
            <div className="client-catalog-commercial-metrics" aria-label="Сводка demo-каталога">
              <div>
                <span>SKU</span>
                <b>{data.products.length}</b>
                <small>из CRM SQLite</small>
              </div>
              <div>
                <span>Фото</span>
                <b>{photoCount}/{data.products.length}</b>
                <small>для клиентской витрины</small>
              </div>
              <div>
                <span>Средняя закупка</span>
                <b>{money(averagePrice)}</b>
                <small>demo-цены требуют сверки</small>
              </div>
              <div>
                <span>Сегменты</span>
                <b>{data.segment_launches.length}</b>
                <small>для фильтров CRM</small>
              </div>
            </div>
          </div>
          <div className="client-catalog-top-panel">
            <ClientCatalogActions label="Печать A4" />
            <div className="client-catalog-count">{data.products.length} SKU</div>
            <div className="client-catalog-date">Обновлено {generatedDate(data.generated_at)}</div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Для встречи</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              <b className="text-foreground">Что показывать:</b> как CRM собирает B2B-лиды, связывает сегмент с SKU, принимает заказы через Mini App и ставит AI-задачи менеджеру.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Позиционирование</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">{activeStrategy.description}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ограничение demo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Цены и фото взяты из demo-среза публичных карточек. Рабочий прайс, остатки и договорные условия загружаются после согласования доступа.
            </CardContent>
          </Card>
        </section>

        <section className="mt-5 grid gap-5">
          {data.categories.map((category) => (
            <Card key={category.name}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>{category.name}</CardTitle>
                <Badge variant="outline">{category.products.length} SKU</Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Фото</TableHead>
                      <TableHead>Позиция</TableHead>
                      <TableHead>Вес</TableHead>
                      <TableHead>Срок</TableHead>
                      <TableHead>Закупка</TableHead>
                      <TableHead>Где использовать</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {category.products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="size-16 overflow-hidden rounded-md border bg-muted">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{brandName}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium">{product.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{product.description}</div>
                        </TableCell>
                        <TableCell>{product.net_weight || "—"}</TableCell>
                        <TableCell>{shelfLife(product.shelf_life_days)}</TableCell>
                        <TableCell>{money(product.price)}</TableCell>
                        <TableCell className="min-w-[240px] text-sm text-muted-foreground">
                          {product.launch_segments.length
                            ? product.launch_segments.slice(0, 3).map((item) => item.format).join(", ")
                            : "Подбирается менеджером под формат точки"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </section>

        <footer className="client-catalog-footer">
          <div>
            <b>{brandName}</b>
            <span>Demo CRM catalog</span>
          </div>
          <span className="no-print">Источник: CRM SQLite products</span>
        </footer>
      </div>
    </main>
  )
}

const allItemsCommercialTerms = [
  { label: "Минимальный заказ", value: "7 000 ₽" },
  { label: "Заказ", value: "за 2 дня до 15:00" },
  { label: "Доставка", value: "Санкт-Петербург, Понедельник-четверг" }
]

const allItemsCommercialMetrics = [
  { label: "Итого набор", value: "12 044 ₽", note: "97 порций · 10 SKU" },
  { label: "Средняя цена порции", value: "124 ₽", note: "оптовая цена запуска" },
  { label: "Базовый выкуп", value: "5 рабочих дней", note: "22 покупки в день" },
  { label: "Покупатели", value: "86 человек", note: "с учетом 12% повторных покупок" }
]

const officeShowcasePrintDecision = {
  label: "Коммерческое предложение: Офисная витрина",
  title: 'Запуск "Офисная витрина"',
  summary:
    "Запустить офисную витрину Lunch-UP на 7-10 дней: 10-12 SKU, две поставки в неделю, контроль списаний.",
  bullets: [
    "Минимальный заказ: 7 000 ₽.",
    "Заказ: за 2 дня до 15:00.",
    "Доставка: Санкт-Петербург, Понедельник-четверг.",
    "Итого набор: 12 044 ₽ / 97 порций / 10 SKU.",
    "Базовый выкуп: 5 рабочих дней при 22 покупках в день.",
    "Покупатели: 86 человек с учетом 12% повторных покупок."
  ],
  nextStep: "Sell-through 65-70% за 3 дня; повторный заказ; список арендаторов/ответственный за питание."
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams
  const isCompetitiveView = params?.view === "competition"
  const isSamokatView = params?.view === "samokat"
  const isAllItemsView = params?.view === "all"
  const isPrintForm = params?.print === "1"
  const data = getClientCatalogData(isAllItemsView ? undefined : params?.segment)
  const activeStrategy = getActiveStrategy()
  const isCustomDemoStrategy = !isDefaultStrategyToken(activeStrategy.token)
  if (isCustomDemoStrategy) {
    return <DemoClientCatalog data={data} activeStrategy={activeStrategy} />
  }
  const samokatEconomics = buildSamokatUnitEconomics(data.products)
  const samokatGroups = data.categories
    .map((category, index) => ({
      id: `samokat-category-${index + 1}`,
      category: category.name,
      rows: samokatEconomics.rows.filter((row) => row.category === category.name)
    }))
    .filter((group) => group.rows.length)
  const selectedCrmSegment = data.selected_crm_segment
  const selectedSegment = data.selected_segment
  const proposal = data.commercial_proposal
  const offer = data.commercial_offer
  const isReferenceView = isCompetitiveView || isSamokatView
  const isOfferView = !isReferenceView && !isAllItemsView
  const isCommercialPrintMaterial = !isReferenceView
  const shouldRenderPrintDecision = isCommercialPrintMaterial || isReferenceView
  const shouldRenderOfferSections = isOfferView && !isPrintForm
  const catalogHref = data.selected_segment_slug
    ? `/catalog?segment=${encodeURIComponent(data.selected_segment_slug)}`
    : "/catalog"
  const title = isSamokatView
    ? "Lunch Up: экономика по точным внешним SKU"
    : isCompetitiveView
    ? "Lunch Up: конкурентный анализ"
    : isCommercialPrintMaterial
    ? "Коммерческое предложение: Офисная витрина"
    : "Lunch Up: клиентский каталог"
  const financialModel = offer?.financial_model ?? null
  const waterfallMax = financialModel
    ? Math.max(
        financialModel.retail_revenue,
        financialModel.revenue_after_tax,
        financialModel.purchase_cost,
        financialModel.tax_amount,
        financialModel.net_profit
      )
    : 1
  const waterfallBars = financialModel
    ? [
        { label: "Выручка", value: financialModel.retail_revenue, tone: "revenue" },
        { label: "Налог", value: financialModel.tax_amount, tone: "tax" },
        { label: "Закупка", value: financialModel.purchase_cost, tone: "cost" },
        { label: "Прибыль", value: financialModel.net_profit, tone: "profit" }
      ]
    : []
  const printDecision = officeShowcasePrintDecision

  return (
    <main className={`client-catalog-page${isSamokatView ? " is-samokat-view" : ""}${isAllItemsView ? " is-all-items-view" : ""}${isCommercialPrintMaterial ? " is-commercial-print-material" : ""}${isPrintForm ? " is-print-form" : ""}`}>
      <div className="client-catalog-inner">
        <header className="client-catalog-top">
          <div>
            <div className="client-catalog-kicker">{isAllItemsView ? "Санкт-Петербург и Ленинградская область" : "Санкт-Петербург"}</div>
            <h1 className="client-catalog-title">{title}</h1>
            <p className="client-catalog-subtitle">
              {isSamokatView
                ? `Финансовое обоснование для B2B-клиента: SKU, закупочные цены и фото Lunch Up берутся из единого CRM/SQLite-каталога; сравнение с Купером, Самокатом, ВкусВиллом, Перекрестком и Окей показывается только для точных внешних SKU, в расчете использован ${samokatEconomics.taxLabel}.`
                : isCompetitiveView
                ? "Сравнение Lunch Up с основными B2B-поставщиками, офисными обедами, розничными сервисами готовой еды и локальными HoReCa-альтернативами в СПб."
                : isCommercialPrintMaterial
                ? "Стартовый набор готовой еды с расчетом закупки, сценариями выкупа и понятной экономикой пилота."
                : "Lunch Up - фабрика готовой охлажденной еды для B2B-витрин, кофе-зон, микромаркетов, офисов, ритейла и grab&go-точек."}
            </p>
            {isCommercialPrintMaterial ? (
              <>
                <div className="client-catalog-commercial-terms" aria-label="Ключевые условия коммерческого предложения">
                  {allItemsCommercialTerms.map((term) => (
                    <div key={term.label}>
                      <span>{term.label}</span>
                      <b>{term.value}</b>
                    </div>
                  ))}
                </div>
                <div className="client-catalog-commercial-metrics" aria-label="Экономика запуска Офисная витрина">
                  {allItemsCommercialMetrics.map((metric) => (
                    <div key={metric.label}>
                      <span>{metric.label}</span>
                      <b>{metric.value}</b>
                      <small>{metric.note}</small>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <div className="client-catalog-top-panel">
            <ClientCatalogActions label={isAllItemsView ? "Скачать PDF A4" : "Печать A4"} />
            <div className="client-catalog-count">
              {isSamokatView
                ? `${samokatEconomics.summary.skuCount} SKU`
                : isCompetitiveView
                ? `${competitivePlayers.length - 1} конкурентов`
                : isCommercialPrintMaterial
                ? "12 044 ₽ / 97 порций"
                : `${data.products.length} SKU`}
            </div>
            <div className="client-catalog-date">Обновлено {generatedDate(data.generated_at)}</div>
          </div>
        </header>

        {shouldRenderPrintDecision ? (
          <section className="client-catalog-print-brief print-only" aria-label="Печатный лист для решения после переговоров">
            <div className="client-catalog-print-decision">
              <span>{printDecision.label}</span>
              <h2>{printDecision.title}</h2>
              <p>{printDecision.summary}</p>
              <ul>
                {printDecision.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="client-catalog-print-next">
                <span>Следующий шаг</span>
                <b>{printDecision.nextStep}</b>
              </div>
            </div>
          </section>
        ) : null}

        <nav className="client-catalog-view-tabs no-print" aria-label="Вкладки клиентского каталога">
          <a className={isOfferView ? "is-active" : ""} href={catalogHref}>
            Каталог и КП
          </a>
          <a className={isAllItemsView ? "is-active" : ""} href="/catalog?view=all">
            Все позиции PDF
          </a>
          <a className={isCompetitiveView ? "is-active" : ""} href="/catalog?view=competition">
            Конкурентный анализ
          </a>
          <a className={isSamokatView ? "is-active" : ""} href="/catalog?view=samokat">
            Экономика с Самокатом
          </a>
        </nav>

        {isOfferView ? (
        <nav className="client-catalog-segments no-print" aria-label="Коммерческие предложения по сегментам CRM">
          <a className={!selectedCrmSegment ? "is-active" : ""} href="/catalog">
            Весь каталог
          </a>
          {data.segment_groups.map((group) => (
            <div className="client-catalog-segment-group" key={group.code}>
              <strong>{group.label}</strong>
              <div>
                {group.segments.map((segment) => (
                  <a
                    key={segment.code}
                    className={data.selected_segment_slug === segment.slug ? "is-active" : ""}
                    href={`/catalog?segment=${encodeURIComponent(segment.slug)}`}
                  >
                    {segment.label}
                    <span>{segment.sku_count} SKU · {money(segment.package_total)}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
        ) : null}

        {isCompetitiveView ? (
          <section className="client-competitive-analysis">
            <div className="client-competitive-summary">
              <div>
                <span className="client-catalog-summary-label">Позиция Lunch Up</span>
                <h2>Сравнение против B2B, офисных обедов и экспресс-розницы</h2>
                <p>
                  Базовый вывод: Lunch Up не должен спорить с Самокатом или Лавкой по скорости доставки конечному
                  покупателю. Сильная позиция - дать клиенту собственную готовую полку с понятной закупкой, маржой,
                  KPI выкупа и регулярным повтором.
                </p>
              </div>
              <div className="client-competitive-baseline">
                <div>
                  <span>Коридор Lunch Up</span>
                  <b>{lunchUpCompetitiveBaseline.priceBand}</b>
                  <small>{lunchUpCompetitiveBaseline.averageBand}</small>
                </div>
                <div>
                  <span>Минимальный заказ</span>
                  <b>{lunchUpCompetitiveBaseline.minimumOrder}</b>
                  <small>{lunchUpCompetitiveBaseline.delivery}</small>
                </div>
                <div>
                  <span>Заказ и оплата</span>
                  <b>{lunchUpCompetitiveBaseline.leadTime}</b>
                  <small>{lunchUpCompetitiveBaseline.payment}</small>
                </div>
              </div>
            </div>

            <div className="client-competitive-insights">
              {competitiveInsights.map((insight) => (
                <article key={insight.title}>
                  <span>Вывод</span>
                  <h3>{insight.title}</h3>
                  <p>{insight.body}</p>
                </article>
              ))}
            </div>

            <div className="client-competitive-section-head">
              <div>
                <span>Матрица сравнения</span>
                <h2>Стоимость, условия и отстройка</h2>
              </div>
              <small>Проверено по публичным источникам: {generatedDate(competitiveAnalysisGeneratedAt)}</small>
            </div>

            <div className="client-competitive-table-wrap">
              <table className="client-competitive-table">
                <thead>
                  <tr>
                    <th>Игрок</th>
                    <th>Модель</th>
                    <th>Стоимость</th>
                    <th>Условия</th>
                    <th>Как продавать против</th>
                  </tr>
                </thead>
                <tbody>
                  {competitivePlayers.map((player) => (
                    <tr key={player.name}>
                      <td>
                        <strong>{player.name}</strong>
                        <span>{player.directness}</span>
                        <a href={externalHref(player.source.url)} target="_blank" rel="noreferrer">
                          {player.source.label} <ExternalLink className="size-3" />
                        </a>
                      </td>
                      <td>
                        <b>{player.segment}</b>
                        <p>{player.model}</p>
                      </td>
                      <td>
                        <b>{competitivePrice(player)}</b>
                        <p>{player.priceUnit}</p>
                        <small>{player.priceNote}</small>
                      </td>
                      <td>
                        <p><b>Минимум:</b> {player.minOrder}</p>
                        <p><b>Срок:</b> {player.leadTime}</p>
                        <p><b>Доставка:</b> {player.deliveryTerms}</p>
                        <p><b>Хранение:</b> {player.shelfTerms}</p>
                      </td>
                      <td>
                        <p>{player.lunchUpCounter}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="client-competitive-card-grid">
              {competitivePlayers.filter((player) => player.name !== "Lunch Up").map((player) => (
                <article className="client-competitive-card" key={player.name}>
                  <div className="client-competitive-card-head">
                    <div>
                      <span>{player.directness}</span>
                      <h3>{player.name}</h3>
                    </div>
                    <strong>{competitivePrice(player)}</strong>
                  </div>
                  <div className="client-competitive-card-columns">
                    <div>
                      <span>Сильные стороны</span>
                      <ul>
                        {player.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span>Уязвимости</span>
                      <ul>
                        {player.weakSpots.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p>{player.source.note}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {isSamokatView ? (
          <section className="client-samokat-economics">
            <div className="client-samokat-summary">
              <div>
                <span className="client-catalog-summary-label">Unit-экономика клиента</span>
                <h2>Сколько зарабатывает точка по точным внешним SKU</h2>
                <p>
                  Вкладка считает выгоду с позиции B2B-клиента: единый каталог Lunch Up берется из SQLite CRM вместе
                  с фото продукции, закупка приведена к цене с {samokatEconomics.taxLabel}. Внешняя цена показывается
                  только когда найден точный публичный SKU; без точного совпадения рынок не заявляется.
                </p>
              </div>
              <div className="client-samokat-formula">
                {samokatEconomics.assumptions.map((assumption) => (
                  <span key={assumption}>{assumption}</span>
                ))}
              </div>
            </div>

            <section className="client-samokat-metrics" aria-label="Сводка unit-экономики по точным внешним SKU Купер, Самокат и ВкусВилл">
              <div>
                <span>Закупка каталога с {samokatEconomics.taxLabel}</span>
                <b>{money(samokatEconomics.summary.totalPurchaseWithTax)}</b>
                <small>{samokatEconomics.summary.skuCount} SKU · {samokatEconomics.summary.comparableSkuCount} точных внешних совпадений</small>
              </div>
              <div>
                <span>Рекомендованная выручка</span>
                <b>{money(samokatEconomics.summary.totalRecommendedRevenue)}</b>
                <small>экономия к рыночным ориентирам {money(samokatEconomics.summary.totalCustomerSavingsVsMarket)}</small>
              </div>
              <div>
                <span>Прибыль после НДС</span>
                <b>{money(samokatEconomics.summary.totalRecommendedProfitAfterTax)}</b>
                <small>в среднем {money(samokatEconomics.summary.averageRecommendedProfitAfterTax)} / SKU</small>
              </div>
              <div>
                <span>Потенциал по точным SKU</span>
                <b>{money(samokatEconomics.summary.totalMarketPriceProfitAfterTax)}</b>
                <small>без точного совпадения рыночная цена не учитывается</small>
              </div>
            </section>

            <div className="client-samokat-section-head">
              <div>
                <span>Полный каталог</span>
                <h2>Закупка, РРЦ и точное рыночное сравнение</h2>
              </div>
              <small>Обновлено {generatedDate(samokatEconomics.generatedAt)}</small>
            </div>

            <Card className="client-samokat-shadcn-menu no-print" aria-label="Двухуровневое меню экономики Самоката">
              <CardContent className="grid gap-2 p-3">
                {samokatGroups.map((group) => (
                  <div className="grid min-w-0 gap-2 md:grid-cols-[180px_minmax(0,1fr)]" key={group.category}>
                    <a
                      className="flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold leading-tight text-primary-foreground no-underline"
                      href={`#${group.id}`}
                    >
                      <span className="min-w-0 break-words">{group.category}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {group.rows.length} SKU
                      </Badge>
                    </a>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {group.rows.map((row) => (
                        <a
                          className="inline-flex min-h-8 max-w-full items-center rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium leading-tight text-foreground no-underline transition-colors hover:bg-muted"
                          href={`#samokat-sku-${row.productId}`}
                          key={row.productId}
                        >
                          <span className="min-w-0 break-words">{row.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {samokatGroups.map((group) => (
                <Card className="scroll-mt-4 overflow-hidden" id={group.id} key={group.category}>
                  <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-muted/30 p-4">
                    <CardTitle className="text-xl text-[#7a2600]">{group.category}</CardTitle>
                    <Badge variant="outline">{group.rows.length} SKU</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table className="client-samokat-shadcn-table table-fixed">
                      <colgroup>
                        <col className="w-[27%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[21%]" />
                        <col className="w-[16%]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>SKU Lunch Up</TableHead>
                          <TableHead>Lunch Up закупка</TableHead>
                          <TableHead>Рекоменд. продажа</TableHead>
                          <TableHead>Рынок продажа</TableHead>
                          <TableHead>Разница / прибыль</TableHead>
                          <TableHead>Источник сравнения</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.rows.map((row) => (
                          <TableRow className="align-top" id={`samokat-sku-${row.productId}`} key={row.productId}>
                            <TableCell className="min-w-0" data-label="SKU Lunch Up">
                              <div className="client-samokat-product-cell">
                                <a
                                  className="client-samokat-product-photo"
                                  href={externalHref(row.productUrl ?? row.imageUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Фото ${row.name}`}
                                >
                                  {row.imageUrl ? (
                                    <img src={row.imageUrl} alt={row.name} loading="lazy" />
                                  ) : (
                                    <span>Фото Lunch Up</span>
                                  )}
                                </a>
                                <div className="grid min-w-0 gap-2">
                                  <b className="break-words text-base leading-tight text-[#7a2600]">{row.name}</b>
                                  <Badge variant="outline" className="w-fit max-w-full break-words">
                                    {row.category}{row.netWeight ? ` · ${row.netWeight}` : ""}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell data-label="Lunch Up закупка">
                              <b className="block text-lg leading-tight text-[#7a2600]">{money(row.lunchUpPurchaseWithTax)}</b>
                              <small className="mt-1 block break-words text-xs leading-snug text-muted-foreground">
                                CRM {money(row.lunchUpPurchaseBase)} + {samokatEconomics.taxLabel}
                              </small>
                            </TableCell>
                            <TableCell data-label="Рекоменд. продажа">
                              <b className="block text-lg leading-tight text-[#7a2600]">{money(row.recommendedSellPrice)}</b>
                              <small className="mt-1 block break-words text-xs leading-snug text-muted-foreground">
                                {percent(row.recommendedMarginPercent)} маржа после НДС
                              </small>
                            </TableCell>
                            <TableCell data-label="Рынок продажа">
                              <b className="block text-lg leading-tight text-[#7a2600]">{moneyOrDash(row.marketSellPrice)}</b>
                              <small className="mt-1 block break-words text-xs leading-snug text-muted-foreground">
                                {row.benchmark ? row.benchmark.label : "публичный ориентир не найден"}
                              </small>
                            </TableCell>
                            <TableCell data-label="Разница / прибыль">
                              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                                <div className="min-w-0 rounded-md border bg-background p-2">
                                  <span className="client-samokat-diff-label block font-bold uppercase leading-tight text-muted-foreground">
                                    Разница
                                  </span>
                                  <b className="mt-1 block text-base leading-tight text-[#7a2600]">{moneyOrDash(row.customerSavingsVsMarket)}</b>
                                </div>
                                <div className="min-w-0 rounded-md border bg-background p-2">
                                  <span className="client-samokat-diff-label block font-bold uppercase leading-tight text-muted-foreground">
                                    Прибыль
                                  </span>
                                  <b className="mt-1 block text-base leading-tight text-[#7a2600]">{money(row.recommendedProfitAfterTax)}</b>
                                </div>
                                <div className="min-w-0 rounded-md border bg-background p-2">
                                  <span className="client-samokat-diff-label block font-bold uppercase leading-tight text-muted-foreground">
                                    Потенциал
                                  </span>
                                  <b className="mt-1 block text-base leading-tight text-[#7a2600]">{moneyOrDash(row.marketPriceProfitAfterTax)}</b>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-0" data-label="Источник сравнения">
                              <div className="grid gap-1.5">
                                <Badge variant="outline" className="w-fit max-w-full break-words">
                                  {row.benchmark ? row.benchmark.confidence : "Нет точного SKU"}
                                </Badge>
                                <b className="break-words text-xs leading-tight text-[#ff550c]">
                                  {row.benchmark ? row.benchmark.sourceLabel : "Внешнее сравнение исключено"}
                                </b>
                                {row.benchmark ? (
                                  <a
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff550c] no-underline"
                                    href={externalHref(row.benchmark.sourceUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Источник <ExternalLink className="size-3" />
                                  </a>
                                ) : null}
                                <small className="block break-words text-xs leading-snug text-muted-foreground">
                                  {row.benchmark
                                    ? `${row.benchmark.sourceNote} Основание: ${row.benchmark.matchBasis}.`
                                    : "РРЦ рассчитана от закупки Lunch Up без заявления экономии относительно рынка."}
                                </small>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {isOfferView && !selectedCrmSegment && data.segment_groups.length ? (
          <section className="client-launch-readiness" aria-label="Матрица стартовых наборов по сроку годности и выкупу">
            <div className="client-proposal-section-head">
              <span>Стартовые наборы: срок годности и выкуп</span>
              <b>пилот без списаний</b>
            </div>
            <p>
              Каждый набор пересчитан от минимального заказа Lunch Up и самого короткого срока годности в SKU.
              Базовый план показывает, сколько покупок и людей нужно, чтобы набор выкупился в пределах ОСГ или раньше.
            </p>
            <div className="client-launch-readiness-table" role="table">
              <div role="row">
                <span>Сегмент</span>
                <span>Набор</span>
                <span>ОСГ</span>
                <span>Выкуп</span>
                <span>Покупок/день</span>
                <span>Людей</span>
              </div>
              {data.segment_groups.flatMap((group) =>
                group.segments.filter((segment) => segment.sku_count > 0).map((segment) => (
                  <a
                    className={data.selected_segment_slug === segment.slug ? "is-active" : ""}
                    href={`/catalog?segment=${encodeURIComponent(segment.slug)}`}
                    key={segment.code}
                    role="row"
                  >
                    <b>
                      {segment.label}
                      <small>{group.label}</small>
                    </b>
                    <span>{money(segment.package_total)} · {segment.total_units} порций</span>
                    <span>{segment.min_shelf_life_days} сут.</span>
                    <span>{segment.target_days} дн. · запас {segment.sellout_safety_days} дн.</span>
                    <span>{segment.target_daily_buyers}</span>
                    <span>{segment.people_to_sell_out}</span>
                  </a>
                ))
              )}
            </div>
          </section>
        ) : null}

        {shouldRenderOfferSections && proposal ? (
          <section className="client-proposal-brief">
            <div className="client-proposal-brief-main">
              <span>Почему это актуально</span>
              <h2>{proposal.audience}</h2>
              <div className="client-proposal-points">
                {proposal.client_pains.map((item) => (
                  <p key={item}><b>Боль:</b> {item}</p>
                ))}
                {proposal.client_needs.map((item) => (
                  <p key={item}><b>Потребность:</b> {item}</p>
                ))}
              </div>
            </div>
            <div className="client-proposal-solution">
              <span>Предложение Lunch Up</span>
              <p>{proposal.recommended_solution}</p>
              <ul>
                {proposal.pilot_scope.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {shouldRenderOfferSections && offer ? (
          <>
            <section className="client-proposal-metrics">
              <div>
                <span>Итого набор</span>
                <b>{money(offer.package_total)}</b>
                <small>{offer.total_units} порций · {offer.sku_count} SKU</small>
              </div>
              <div>
                <span>Плановый выкуп</span>
                <b>{offer.target_days} рабочих дней</b>
                <small>крайний срок {offer.shelf_life_deadline_days} дн. · запас {offer.sellout_safety_days} дн.</small>
              </div>
              <div>
                <span>План продаж</span>
                <b>{offer.target_daily_buyers} покупок/день</b>
                <small>{offer.target_units} порций за {offer.target_days} дн.</small>
              </div>
              <div>
                <span>Люди для прогноза</span>
                <b>{offer.people_to_sell_out} человек</b>
                <small>примерно {offer.forecast_daily_people} людей/день с учетом повторов</small>
              </div>
            </section>

            <section className="client-financial-model">
              <div className="client-proposal-section-head">
                <span>{"Финансовая модель pilot P&L"}</span>
                <b>
                  {money(offer.financial_model.retail_revenue)} выручка · {money(offer.financial_model.tax_amount)} налог ·{" "}
                  {offer.financial_model.net_margin_percent}% маржа
                </b>
              </div>
              <div className="client-financial-metrics">
                <div>
                  <span>Клиент платит</span>
                  <b>{money(offer.financial_model.purchase_cost)}</b>
                  <small>закупка Lunch Up</small>
                </div>
                <div>
                  <span>Итого выручка по РРЦ</span>
                  <b>{money(offer.financial_model.retail_revenue)}</b>
                  <small>если набор продан полностью</small>
                </div>
                <div>
                  <span>Итого налоги</span>
                  <b>{money(offer.financial_model.tax_amount)}</b>
                  <small>{offer.financial_model.tax_mode_label}</small>
                </div>
                <div>
                  <span>Выручка после налога</span>
                  <b>{money(offer.financial_model.revenue_after_tax)}</b>
                  <small>для покрытия закупки и прибыли</small>
                </div>
                <div>
                  <span>Чистая прибыль</span>
                  <b>{money(offer.financial_model.net_profit)}</b>
                  <small>после налога и закупки</small>
                </div>
                <div>
                  <span>Итого маржа</span>
                  <b>{offer.financial_model.net_margin_percent}%</b>
                  <small>чистая прибыль / выручка</small>
                </div>
                <div>
                  <span>Food cost</span>
                  <b>{offer.financial_model.food_cost_percent}%</b>
                  <small>закупка / выручка</small>
                </div>
                <div>
                  <span>ROI к закупке</span>
                  <b>{offer.financial_model.roi_percent}%</b>
                  <small>чистая прибыль / закупка</small>
                </div>
                <div>
                  <span>Окупаемость</span>
                  <b>{offer.financial_model.break_even_units} порций</b>
                  <small>{offer.financial_model.break_even_days} дн. при базовом темпе</small>
                </div>
                <div>
                  <span>Без списаний</span>
                  <b>{offer.financial_model.no_writeoff_days} дн.</b>
                  <small>ОСГ {offer.financial_model.min_shelf_life_days} дн. · запас {offer.financial_model.sellout_safety_days} дн.</small>
                </div>
                <div>
                  <span>Прогноз заказа</span>
                  <b>{offer.financial_model.required_daily_buyers} покупок/день</b>
                  <small>{offer.financial_model.forecast_daily_people} людей/день · {offer.financial_model.forecast_total_people} людей за пилот</small>
                </div>
              </div>
              <div className="client-financial-pnl">
                <div className="client-financial-statement" role="table" aria-label="P&L модель стартового набора">
                  <div role="row">
                    <span>Строка P&amp;L</span>
                    <span>Расчет</span>
                    <span>Итого</span>
                  </div>
                  <div role="row">
                    <b>Выручка по РРЦ gross</b>
                    <span>{offer.financial_model.total_units} порций x средняя РРЦ {money(offer.financial_model.average_retail_price)}</span>
                    <strong>{money(offer.financial_model.retail_revenue)}</strong>
                  </div>
                  <div role="row">
                    <b>Налог с выручки</b>
                    <span>{offer.financial_model.tax_mode_label} от retail sales</span>
                    <strong>{money(offer.financial_model.tax_amount)}</strong>
                  </div>
                  <div role="row">
                    <b>Выручка после налога</b>
                    <span>выручка gross - налог</span>
                    <strong>{money(offer.financial_model.revenue_after_tax)}</strong>
                  </div>
                  <div role="row">
                    <b>Себестоимость закупки</b>
                    <span>{offer.financial_model.food_cost_percent}% food cost</span>
                    <strong>{money(offer.financial_model.purchase_cost)}</strong>
                  </div>
                  <div role="row">
                    <b>Валовая прибыль до налога</b>
                    <span>{offer.financial_model.gross_margin_percent}% gross margin</span>
                    <strong>{money(offer.financial_model.gross_profit)}</strong>
                  </div>
                  <div role="row" className="is-total">
                    <b>Чистая прибыль pilot</b>
                    <span>
                      {offer.financial_model.net_margin_percent}% net margin · {offer.financial_model.roi_percent}% ROI
                    </span>
                    <strong>{money(offer.financial_model.net_profit)}</strong>
                  </div>
                </div>
                <div className="client-financial-waterfall" aria-label="Визуальная модель выручки, налогов и маржи">
                  {waterfallBars.map((bar) => (
                    <div className={`client-financial-waterfall-bar is-${bar.tone}`} key={bar.label}>
                      <b style={{ height: `${Math.max(14, Math.round((bar.value / waterfallMax) * 100))}%` }} />
                      <span>{bar.label}</span>
                      <strong>{money(bar.value)}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="client-financial-table" role="table" aria-label="Unit экономика пилотного набора">
                <div role="row">
                  <span>Позиция</span>
                  <span>Шт.</span>
                  <span>ОСГ</span>
                  <span>План/день</span>
                  <span>Закупка</span>
                  <span>РРЦ</span>
                  <span>Выручка</span>
                  <span>Налог</span>
                  <span>Вал.приб.</span>
                  <span>Прибыль</span>
                  <span>Маржа</span>
                </div>
                {offer.financial_model.items.map((item) => (
                  <div role="row" key={`${item.category}-${item.name}`}>
                    <b>{item.name}</b>
                    <span>{item.quantity}</span>
                    <span>{item.shelf_life_days ?? offer.financial_model.min_shelf_life_days} сут.</span>
                    <span>{item.required_daily_sales}</span>
                    <span>{money(item.wholesale_total)}</span>
                    <span>{money(item.retail_price)}</span>
                    <span>{money(item.retail_revenue)}</span>
                    <span>{money(item.tax_amount)}</span>
                    <span>{money(item.gross_profit)}</span>
                    <span>{money(item.net_profit)}</span>
                    <span>{item.net_margin_percent}%</span>
                  </div>
                ))}
              </div>
              <div className="client-model-assumptions">
                <span>{offer.financial_model.diversity_note}</span>
                <span>{offer.financial_model.no_writeoff_note}</span>
                <span>{offer.financial_model.retail_price_source}</span>
                <span>{offer.financial_model.tax_basis}.</span>
                <span>{offer.financial_model.tax_scenario_note}</span>
              </div>
            </section>

            <section className="client-proposal-grid">
              <div className="client-proposal-bundles">
                <div className="client-proposal-section-head">
                  <span>Состав стартового набора</span>
                  <b>{money(offer.package_total)}</b>
                </div>
                <div className="client-bundle-grid">
                  {offer.bundles.map((bundle) => (
                    <article className="client-bundle-card" key={bundle.category}>
                      <div className="client-bundle-card-head">
                        <h3>{bundle.category}</h3>
                        <strong>{money(bundle.total_amount)}</strong>
                      </div>
                      <p>{bundle.total_units} порций в наборе</p>
                      <div className="client-bundle-financials" aria-label={`Финансовая модель набора ${bundle.category}`}>
                        <span>
                          <b>{money(bundle.retail_revenue)}</b>
                          <small>выручка</small>
                        </span>
                        <span>
                          <b>{money(bundle.tax_amount)}</b>
                          <small>налог</small>
                        </span>
                        <span>
                          <b>{money(bundle.net_profit)}</b>
                          <small>прибыль</small>
                        </span>
                        <span>
                          <b>{bundle.net_margin_percent}%</b>
                          <small>маржа</small>
                        </span>
                      </div>
                      <ul>
                        {bundle.items.map((item) => (
                          <li key={`${bundle.category}-${item.name}`}>
                            <span>{item.name} x{item.quantity ?? 0}</span>
                            <b>{money(item.total_amount)}</b>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="client-proposal-model">
                <div className="client-proposal-section-head">
                  <span>Модель выкупа</span>
                  <b>{offer.target_units} порций за {offer.target_days} дн.</b>
                </div>
                <p>
                  {offer.shelf_life_plan_note} Это дает клиенту понятный ориентир для будущего заказа:
                  если фактический поток выше базового, следующий заказ можно увеличивать; если ниже - сокращать глубину SKU.
                </p>
                <div className="client-model-table" role="table" aria-label="Сценарии выкупа набора">
                  <div role="row">
                    <span>Сценарий</span>
                    <span>Покупок/день</span>
                    <span>Полный выкуп</span>
                    <span>Людей</span>
                    <span>ОСГ</span>
                  </div>
                  {offer.scenarios.map((scenario) => (
                    <div role="row" key={scenario.label}>
                      <b>{scenario.label}</b>
                      <span>{scenario.daily_buyers}</span>
                      <span>{scenario.sellout_days} дн.</span>
                      <span>{scenario.unique_people}</span>
                      <span>{scenarioShelfStatus(scenario)}</span>
                    </div>
                  ))}
                </div>
                <div className="client-model-assumptions">
                  {offer.assumptions.map((assumption) => (
                    <span key={assumption}>{assumption}</span>
                  ))}
                </div>
              </aside>
            </section>
          </>
        ) : null}

        {shouldRenderOfferSections && proposal ? (
          <section className="client-proposal-decision">
            <article>
              <span>KPI пилота</span>
              <h3>{proposal.kpi}</h3>
              <p>
                Первая поставка фиксирует продажи, темп выкупа и SKU-лидеры. Расширение ассортимента обсуждаем только
                после фактического спроса.
              </p>
            </article>
            <article>
              <span>Типовое возражение</span>
              <h3>{proposal.objection.title}</h3>
              <p>{proposal.objection.response}</p>
              <small>{proposal.objection.proof}</small>
            </article>
            <article>
              <span>Закрытие первой поставки</span>
              <h3>{proposal.objection.next_question}</h3>
              <p>{proposal.closing_script}</p>
            </article>
          </section>
        ) : null}

        {shouldRenderOfferSections && selectedSegment ? (
          <section className="client-catalog-segment-note">
            <div>
              <span>Идея запуска</span>
              <b>{offer ? money(offer.package_total) : `${data.products.length} SKU`}</b>
            </div>
            <p>{proposal?.launch_idea ?? selectedSegment.pitch}</p>
          </section>
        ) : null}

        {shouldRenderOfferSections && proposal ? (
          <section className="client-proposal-handoff">
            <div>
              <span>Условия первой поставки</span>
              <ul>
                {proposal.first_delivery.terms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {isOfferView || isAllItemsView ? (
        <div className="client-catalog-category-list">
          {data.categories.map((category) => (
            <section className="client-catalog-category" key={category.name}>
              <div className="client-catalog-category-header">
                <h2>{category.name}</h2>
                <span>{category.products.length} SKU</span>
              </div>
              <div className="client-menu-grid">
                {category.products.map((product) => (
                  <article className="client-menu-card" key={product.id}>
                    <a className="client-menu-photo" href={externalHref(product.product_url ?? product.image_url)} target="_blank" rel="noreferrer">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} loading="lazy" />
                      ) : (
                        <span>Фото Lunch Up</span>
                      )}
                    </a>
                      <div className="client-menu-card-body">
                        <div className="client-menu-card-head">
                          <h3>{product.name}</h3>
                          <Badge variant="outline" className="client-menu-card-price">
                            <span>Закупка</span>
                            <b>{money(product.price)}</b>
                          </Badge>
                        </div>
                      <p className="client-menu-card-description">{product.description}</p>
                      <div className="client-menu-product-details">
                        <div>
                          <span>Состав</span>
                          <p>{product.composition ?? "уточняется по ассортиментному файлу"}</p>
                        </div>
                        <div>
                          <span>Б/Ж/У порция</span>
                          <p>{product.nutrition ?? "уточняется по ассортиментному файлу"}</p>
                        </div>
                        <div>
                          <span>Условия хранения</span>
                          <p>{product.storage_condition} {product.storage_handling}</p>
                        </div>
                      </div>
                      <div className="client-menu-technical-meta" aria-label={`Технические условия ${product.name}`}>
                        <Badge variant="outline">{product.net_weight ?? "вес уточняется"}</Badge>
                        <Badge variant="outline">{shelfLife(product.shelf_life_days)}</Badge>
                        <Badge variant="muted">{product.storage_temperature}</Badge>
                      </div>
                      <div className="client-menu-commercial-meta" aria-label={`Коммерческие цены ${product.name}`}>
                        <Badge variant="success" className="client-menu-commercial-badge">
                          <span>РРЦ</span>
                          <b>{money(product.retail_price)}</b>
                        </Badge>
                        <Badge variant="success" className="client-menu-commercial-badge">
                          <span>Прибыль после налога</span>
                          <b>{money(product.client_profit_per_unit)}</b>
                        </Badge>
                        {product.selected_quantity ? (
                          <Badge variant="secondary" className="client-menu-commercial-badge">
                            <span>В запуске</span>
                            <b>{product.selected_quantity} шт.</b>
                          </Badge>
                        ) : null}
                        {product.selected_line_total ? (
                          <Badge variant="secondary" className="client-menu-commercial-badge">
                            <span>Сумма позиции</span>
                            <b>{money(product.selected_line_total)}</b>
                          </Badge>
                        ) : null}
                        {product.selected_client_profit_total ? (
                          <Badge variant="success" className="client-menu-commercial-badge">
                            <span>Прибыль позиции</span>
                            <b>{money(product.selected_client_profit_total)}</b>
                          </Badge>
                        ) : null}
                      </div>
                      {isOfferView && !selectedSegment && product.launch_segments.length ? (
                        <div className="client-menu-launches">
                          {product.launch_segments.slice(0, 4).map((segment) => (
                            <span key={`${product.id}-${segment.format}`}>{segment.format}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
        ) : null}

        <footer className="client-catalog-footer">
          <div>
            <b>Lunch Up</b>
            <span>фабрика готовой охлажденной еды для B2B-клиентов Санкт-Петербурга</span>
          </div>
          <a className="no-print" href="https://lunch-up.ru/" target="_blank" rel="noreferrer">
            lunch-up.ru <ExternalLink className="size-3" />
          </a>
        </footer>
      </div>
    </main>
  )
}
