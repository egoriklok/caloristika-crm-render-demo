import type { CrmSegment, LaunchMatrixRow, LaunchSummary, SegmentLaunch } from "@/lib/types"

export type SqliteLaunchProduct = {
  id: number
  category: string
  name: string
  wholesale_price: number
  shelf_life_days?: number | null
}

export type SqliteSegmentMatrixItem = SqliteLaunchProduct & {
  segment: string
  role: string | null
  priority: number | null
}

type LaunchField = "breakfasts" | "salads" | "sandwiches" | "desserts"

type PricedMatrixItem = SqliteSegmentMatrixItem & {
  quantity: number
  line_total: number
}

const formatCopy: Record<string, { launch_format: string; pitch: string; kpi: string }> = {
  "Еда к кофе": {
    launch_format: "Полка рядом с кофе: сырники, десерты и компактный обеденный добор без запуска кухни.",
    pitch:
      "Дать точке короткий food-to-coffee запуск Caloristika: 11 SKU из каталога, малая глубина по каждой позиции и замер прироста среднего чека.",
    kpi: "2-3 SKU-лидера за 7-10 дней; прирост среднего чека; повторный заказ без расширения кухни."
  },
  "Ритейл fresh-полка": {
    launch_format: "Fresh-полка у кофе, кассы или холодильника: быстрый выбор на ежедневном потоке.",
    pitch:
      "Запустить локальную fresh-полку Caloristika на 11 SKU: обеденная позиция, салат, завтрак и десертная линейка для импульсной покупки.",
    kpi: "Продажа 60% партии до следующей поставки; понятные SKU-лидеры; решение о регулярной матрице."
  },
  "Офисная витрина": {
    launch_format: "Холодильная витрина для рабочего дня: завтрак, обед, салат и десерт к чаю.",
    pitch:
      "Поставить офисную витрину Caloristika на 11 SKU и проверить дневной спрос сотрудников без подключения столовой или ручных закупок.",
    kpi: "Sell-through 65% за 3-4 дня; повторный заказ; понятная обратная связь сотрудников."
  },
  "Коворкинг холодильник": {
    launch_format: "Холодильник самообслуживания для резидентов, студентов или жителей: короткий набор на весь день.",
    pitch:
      "Запустить холодильник Caloristika на 11 SKU: маленькая глубина, весь каталог в тесте и расширение только по фактическим продажам.",
    kpi: "Повтор после первой недели; не выше 15-20% остатков; 3 SKU-лидера для постоянной выкладки."
  },
  "Медицинский персонал": {
    launch_format: "Аккуратная витрина для смен и посетителей: понятный состав, сроки и чистая упаковка.",
    pitch:
      "Предложить клинике или медцентру 11 SKU Caloristika как безопасный пилот для персонала: без кухни, с контролем сроков и остатков.",
    kpi: "Повтор от администратора; продажи в смену; отсутствие претензий к упаковке и срокам."
  },
  "Банная fresh-витрина": {
    launch_format: "Fresh-витрина у ресепшена или буфета: легкая еда после отдыха и десерты к чаю.",
    pitch:
      "Дать банному комплексу тест 11 SKU Caloristika: салат, горячая позиция, сырники и десерты без расширения собственной кухни.",
    kpi: "Sell-through 60% за 4 дня; списания до 15%; решение о регулярной поставке после первой недели."
  },
  "Компьютерный клуб snack-витрина": {
    launch_format: "Snack-витрина у администратора или холодильника: сытный перекус плюс десерты для вечернего трафика.",
    pitch:
      "Запустить 11 SKU Caloristika для игровой точки: быстрый перекус, десерты и контролируемая первая партия перед выходными.",
    kpi: "Выкуп 70% за 4 дня; 18-22 покупки в день; повторная поставка перед пиком трафика."
  },
  "Вендинг-партнер": {
    launch_format: "Meal-layer в существующих холодильниках и микромаркетах: свежая еда с понятным сроком и контролем списаний.",
    pitch:
      "Предложить оператору 11 SKU Caloristika для 1-2 точек: весь активный каталог, телеметрия продаж и решение о маршруте по факту.",
    kpi: "Sell-through 65% до следующей загрузки; списания <=15%; 3 SKU-лидера для регулярной матрицы."
  },
  "Сытная смена": {
    launch_format: "Сменная матрица для объектов без стабильного питания рядом: сытная основа плюс сладкое к чаю.",
    pitch:
      "Поставить 11 SKU Caloristika как стартовый набор для смены: обеденная позиция, салат, завтрак и десертная линейка по графику.",
    kpi: "Регулярный заказ по сменам; понятная дневная потребность; минимальные остатки к следующей поставке."
  }
}

const fallbackCopy = {
  launch_format: "Короткая холодильная матрица из активного каталога: 11 SKU, малая глубина и решение о повторе по фактам продаж.",
  pitch:
    "Начать с полного активного каталога Caloristika на 11 SKU, чтобы увидеть реальные лидеры спроса и не спорить о широкой закупке до пилота.",
  kpi: "Продажи первой партии, остатки, 3 SKU-лидера и подтвержденный повторный заказ."
}

function copyForFormat(format: string) {
  return formatCopy[format] ?? fallbackCopy
}

function launchFieldForCategory(category: string): LaunchField {
  if (category === "Завтраки") return "breakfasts"
  if (category === "Салаты") return "salads"
  if (category === "Десерты") return "desserts"
  return "sandwiches"
}

function baseQuantity(item: SqliteSegmentMatrixItem, format: string) {
  const category = item.category
  const role = (item.role ?? "").toLowerCase()
  let quantity = role === "anchor" ? 3 : role === "test" ? 1 : 2

  if (format === "Еда к кофе") {
    if (category === "Десерты") quantity += 1
    if (category === "Горячие блюда" || category === "Салаты") quantity = Math.max(1, quantity - 1)
  }
  if (format === "Офисная витрина" || format === "Сытная смена") {
    if (category === "Горячие блюда" || category === "Салаты" || category === "Завтраки") quantity += 1
  }
  if (format === "Вендинг-партнер") {
    if (item.name.toLowerCase().includes("raw")) quantity += 1
    if (category === "Салаты") quantity = Math.max(1, quantity - 1)
  }
  if (format === "Медицинский персонал" || format === "Банная fresh-витрина") {
    if (category === "Салаты" || item.name.toLowerCase().includes("raw")) quantity += 1
  }

  return Math.max(1, quantity)
}

function normalizeItems(items: SqliteSegmentMatrixItem[], products: SqliteLaunchProduct[]): SqliteSegmentMatrixItem[] {
  if (items.length) {
    return [...items].sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || a.name.localeCompare(b.name, "ru"))
  }

  return products.map((product, index) => ({
    ...product,
    segment: "__default__",
    role: index < 3 ? "anchor" : index > products.length - 3 ? "test" : "support",
    priority: 100 - index
  }))
}

function pricedItems(items: SqliteSegmentMatrixItem[], products: SqliteLaunchProduct[], format: string, minimumOrderAmount: number) {
  const normalized = normalizeItems(items, products)
  let priced = normalized.map((item) => {
    const quantity = baseQuantity(item, format)
    return {
      ...item,
      quantity,
      line_total: quantity * Number(item.wholesale_price ?? 0)
    }
  })

  const total = priced.reduce((sum, item) => sum + item.line_total, 0)
  if (total > 0 && minimumOrderAmount > 0 && total < minimumOrderAmount) {
    const scale = Math.ceil(minimumOrderAmount / total)
    priced = priced.map((item) => ({
      ...item,
      quantity: item.quantity * scale,
      line_total: item.quantity * scale * Number(item.wholesale_price ?? 0)
    }))
  }

  return priced
}

function categoryText(items: PricedMatrixItem[], field: LaunchField) {
  return items
    .filter((item) => launchFieldForCategory(item.category) === field)
    .map((item) => `${item.name} x${item.quantity}`)
    .join("; ")
}

function buildSegmentLaunch(format: string, items: SqliteSegmentMatrixItem[], products: SqliteLaunchProduct[], minimumOrderAmount: number): SegmentLaunch {
  const priced = pricedItems(items, products, format, minimumOrderAmount)
  const copy = copyForFormat(format)
  return {
    format,
    lead_count: 0,
    avg_start_amount: Math.round(priced.reduce((sum, item) => sum + item.line_total, 0)),
    breakfasts: categoryText(priced, "breakfasts"),
    salads: categoryText(priced, "salads"),
    sandwiches: categoryText(priced, "sandwiches"),
    desserts: categoryText(priced, "desserts"),
    pitch: copy.pitch,
    kpi: copy.kpi
  }
}

function matrixBySegment(matrixItems: SqliteSegmentMatrixItem[]) {
  const map = new Map<string, SqliteSegmentMatrixItem[]>()
  for (const item of matrixItems) {
    const current = map.get(item.segment) ?? []
    current.push(item)
    map.set(item.segment, current)
  }
  return map
}

function itemsForFormat(format: string, crmSegments: CrmSegment[], bySegment: Map<string, SqliteSegmentMatrixItem[]>) {
  const segment = crmSegments.find((item) => item.launch_format === format && bySegment.has(item.code))
  return segment ? bySegment.get(segment.code) ?? [] : []
}

export function adaptSegmentLaunchesToSqliteCatalog(input: {
  segmentLaunches: SegmentLaunch[]
  crmSegments: CrmSegment[]
  products: SqliteLaunchProduct[]
  matrixItems: SqliteSegmentMatrixItem[]
  minimumOrderAmount: number
}) {
  const bySegment = matrixBySegment(input.matrixItems)
  const existingByFormat = new Map(input.segmentLaunches.map((item) => [item.format, item]))
  const formats = Array.from(
    new Set([
      ...input.crmSegments.map((segment) => segment.launch_format),
      ...input.segmentLaunches.map((segment) => segment.format)
    ])
  ).filter(Boolean)

  return formats.map((format) => {
    const existing = existingByFormat.get(format)
    const built = buildSegmentLaunch(format, itemsForFormat(format, input.crmSegments, bySegment), input.products, input.minimumOrderAmount)
    return {
      ...built,
      lead_count: existing?.lead_count ?? 0
    }
  })
}

export function adaptLaunchMatrixToSqliteCatalog(input: {
  launchMatrix: LaunchMatrixRow[]
  segmentLaunches: SegmentLaunch[]
  minimumOrderAmount: number
}) {
  const launchByFormat = new Map(input.segmentLaunches.map((item) => [item.format, item]))
  const conditions = `Минимальный заказ ${input.minimumOrderAmount.toLocaleString("ru-RU")} ₽; пилот 7-14 дней; доставка по Санкт-Петербургу; после первой поставки оставляем SKU-лидеры.`

  return input.launchMatrix.map((row) => {
    const launch = launchByFormat.get(row.package_name) ?? launchByFormat.get(row.launch_format)
    if (!launch) {
      return {
        ...row,
        conditions
      }
    }
    const copy = copyForFormat(launch.format)
    return {
      ...row,
      launch_format: copy.launch_format,
      breakfasts: launch.breakfasts,
      salads: launch.salads,
      sandwiches: launch.sandwiches,
      desserts: launch.desserts,
      sku_count: 11,
      start_amount: launch.avg_start_amount,
      conditions,
      offer: `${launch.format}: ${copy.pitch}`,
      kpi: copy.kpi,
      risk: row.risk
        .replace(/Lunch[- ]?UP/gi, "Caloristika")
        .replace(/Lunch Up/gi, "Caloristika")
    }
  })
}

export function adaptLaunchSummaryToSqliteCatalog(input: {
  summary: LaunchSummary
  skuCount: number
  minimumOrderAmount: number
}) {
  if (!input.summary) return input.summary
  return {
    ...input.summary,
    catalog_sku_count: input.skuCount,
    min_order_rub: input.minimumOrderAmount,
    order_terms: {
      ...input.summary.order_terms,
      minimum_order: `${input.minimumOrderAmount.toLocaleString("ru-RU")} руб. на одну торговую точку`,
      free_delivery: "Санкт-Петербург: условия доставки подтверждаются с менеджером при запуске пилота."
    }
  }
}
