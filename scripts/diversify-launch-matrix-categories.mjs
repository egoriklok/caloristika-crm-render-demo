import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const root = process.cwd()
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const launchContentPath = join(root, "data", "launch-crm-content.json")

const categoryFields = [
  { field: "breakfasts", label: "Завтраки", maxSku: 4 },
  { field: "salads", label: "Салаты", maxSku: 4 },
  { field: "sandwiches", label: "Сэндвичи", maxSku: 6 },
  { field: "desserts", label: "Десерты", maxSku: 4 }
]

const launchFormatCategoryPools = {
  "Офисная витрина": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: ["Салат «Боул с курицей»", "Салат «Греческий»", "Салат «Винегрет»", "Салат «Витаминный»"],
    sandwiches: [
      "Пита с курицей",
      "Ролл «Цезарь»",
      "Сэндвич с индейкой на гриле",
      "Сэндвич с курой на гриле",
      "Сэндвич пшеничный с курицей",
      "Сэндвич с ветчиной и сыром гауда"
    ],
    desserts: ["Десерт «Медовик»", "Десерт «Морковный кекс»", "Десерт «Наполеон»", "Десерт «Картошка классическая»"]
  },
  "Ритейл fresh-полка": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: ["Салат «Греческий»", "Салат «Оливье с ветчиной»", "Салат «Столичный»", "Салат «Винегрет»", "Салат «Витаминный»"],
    sandwiches: [
      "Шаверма «Классическая»",
      "Ролл «Цезарь»",
      "Сэндвич пшеничный с курицей",
      "Сэндвич с ветчиной и сыром",
      "Пита с курицей",
      "Сэндвич салями"
    ],
    desserts: ["Десерт «Медовик»", "Десерт «Наполеон»", "Десерт «Морковный кекс»", "Десерт «Картошка классическая»"]
  },
  "Еда к кофе": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: [],
    sandwiches: [
      "Сэндвич пшеничный с курицей",
      "Сэндвич с ветчиной и сыром гауда",
      "Сэндвич с индейкой и моцареллой",
      "Ролл Оригинальный",
      "Сэндвич с ветчиной и сыром"
    ],
    desserts: ["Десерт «Медовик»", "Десерт «Морковный кекс»", "Десерт «Шарлотка с яблоком»", "Сочень с творогом", "Десерт «Тирамису»"]
  },
  "Вендинг-партнер": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: [],
    sandwiches: [
      "Сэндвич пшеничный с курицей",
      "Сэндвич с ветчиной и сыром гауда",
      "Сэндвич с индейкой и моцареллой",
      "Сэндвич с бужениной и салатом",
      "Сэндвич салями",
      "Сэндвич с пепперони"
    ],
    desserts: ["Десерт «Медовик»", "Десерт «Морковный кекс»", "Сочень с творогом", "Десерт «Кофейный»"]
  },
  "Коворкинг холодильник": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: ["Салат «Боул с курицей»", "Салат «Греческий»", "Салат «Витаминный»", "Салат «Винегрет»"],
    sandwiches: ["Ролл «Цезарь»", "Сэндвич с индейкой на гриле", "Сэндвич с курой на гриле", "Пита с курицей", "Сэндвич пшеничный с курицей"],
    desserts: ["Десерт «Медовик»", "Десерт «Морковный кекс»", "Десерт «Шарлотка с яблоком»", "Десерт «Картошка классическая»"]
  },
  "Медицинский персонал": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: ["Салат «Греческий»", "Салат «Витаминный»", "Салат «Боул с курицей»", "Салат «Винегрет»"],
    sandwiches: ["Сэндвич с индейкой на гриле", "Сэндвич с курой на гриле", "Сэндвич пшеничный с курицей", "Ролл «Цезарь»"],
    desserts: ["Десерт «Шарлотка с яблоком»", "Десерт «Морковный кекс»", "Десерт «Медовик»", "Десерт «Картошка классическая»"]
  },
  "Отель grab&go": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: [],
    sandwiches: ["Сэндвич с ветчиной и сыром", "Сэндвич с индейкой на гриле", "Пита с курицей", "Ролл «Цезарь»", "Сэндвич пшеничный с курицей"],
    desserts: ["Десерт «Морковный кекс»", "Десерт «Шарлотка с яблоком»", "Сочень с творогом", "Десерт «Медовик»"]
  },
  "Сытная смена": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: ["Салат «Боул с курицей»", "Салат «Столичный»", "Салат «Оливье с ветчиной»", "Салат «Винегрет»"],
    sandwiches: ["Шаверма «Классическая»", "Шаверма с говядиной", "Хот Дог «Датский»", "Пита с курицей", "Ролл «Цезарь»", "Сосиска в тесте Макси"],
    desserts: ["Десерт «Медовик»", "Десерт «Картошка классическая»", "Десерт «Морковный кекс»", "Сочень с творогом"]
  },
  "Банная fresh-витрина": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: ["Салат «Винегрет»", "Салат «Витаминный»", "Салат «Греческий»", "Салат «Фунчоза с овощами»"],
    sandwiches: ["Сэндвич с индейкой на гриле", "Сэндвич пшеничный с курицей", "Ролл «Цезарь»", "Сосиска в тесте Макси", "Пита с курицей"],
    desserts: ["Десерт «Медовик»", "Десерт «Шарлотка с яблоком»", "Десерт «Картошка классическая»", "Десерт «Морковный кекс»"]
  },
  "Компьютерный клуб snack-витрина": {
    breakfasts: ["Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами"],
    salads: [],
    sandwiches: [
      "Сэндвич пшеничный с курицей",
      "Сэндвич с ветчиной и сыром гауда",
      "Сэндвич с пепперони",
      "Сэндвич салями",
      "Сосиска в тесте Макси",
      "Хот Дог «Датский»",
      "Ролл «Цезарь»",
      "Пита с курицей"
    ],
    desserts: ["Десерт «Морковный кекс»", "Десерт «Картошка классическая»", "Сочень с творогом", "Десерт «Медовик»"]
  }
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function cleanName(value) {
  return String(value ?? "").trim().replace(/”/g, "»").replace(/»{2,}/g, "»")
}

function parseItems(text) {
  if (!text) return []
  return String(text)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)\s+x(\d+)$/i)
      return {
        name: cleanName(match?.[1] ?? part),
        qty: match?.[2] ? Number(match[2]) : 1
      }
    })
}

function formatItems(items) {
  return items.map((item) => `${item.name} x${item.qty}`).join("; ")
}

function itemAmount(items, priceByName) {
  return items.reduce((sum, item) => {
    const price = priceByName.get(item.name)
    if (!Number.isFinite(price)) throw new Error(`Missing catalog price: ${item.name}`)
    return sum + price * item.qty
  }, 0)
}

function distribute(totalQty, pool, desiredMaxSku) {
  if (!Number.isFinite(totalQty) || totalQty <= 0) return []
  const skuCount = Math.min(pool.length, totalQty, desiredMaxSku)
  const selected = pool.slice(0, Math.max(1, skuCount))
  const base = Math.floor(totalQty / selected.length)
  let remainder = totalQty % selected.length
  return selected.map((name) => {
    const qty = base + (remainder > 0 ? 1 : 0)
    remainder -= 1
    return { name, qty }
  })
}

function desiredSkuCount(field, currentItems, pool, totalQty) {
  if (totalQty <= 0 || pool.length === 0) return 0
  const rule = categoryFields.find((item) => item.field === field)
  const maxSku = rule?.maxSku ?? 4
  const minSku = field === "sandwiches" ? 4 : 3
  return Math.min(pool.length, totalQty, Math.max(currentItems.length, Math.min(maxSku, totalQty), Math.min(minSku, totalQty)))
}

function uniqueNames(items) {
  return Array.from(new Set(items.map((item) => item.name).filter(Boolean)))
}

function countSku(row) {
  const names = new Set()
  for (const { field } of categoryFields) {
    for (const item of parseItems(row[field])) names.add(item.name)
  }
  return names.size
}

function diversifyField(row, field, priceByName) {
  const pools = launchFormatCategoryPools[row.package_name]
  const pool = pools?.[field] ?? []
  const oldItems = parseItems(row[field])
  const totalQty = oldItems.reduce((sum, item) => sum + item.qty, 0)
  if (totalQty <= 0 || pool.length === 0) return false

  const currentNames = uniqueNames(oldItems)
  const selectedPool = [
    ...currentNames.filter((name) => pool.includes(name)),
    ...pool.filter((name) => !currentNames.includes(name))
  ]
  const nextItems = distribute(totalQty, selectedPool, desiredSkuCount(field, oldItems, pool, totalQty))
  const oldText = formatItems(oldItems)
  const nextText = formatItems(nextItems)
  if (oldText === nextText) return false

  row[field] = nextText
  if (Number.isFinite(Number(row.start_amount))) {
    row.start_amount = roundMoney(Number(row.start_amount) - itemAmount(oldItems, priceByName) + itemAmount(nextItems, priceByName))
  }
  row.sku_count = countSku(row)
  return true
}

function updateLaunchRows(content, priceByName) {
  const changedByField = Object.fromEntries(categoryFields.map(({ field }) => [field, 0]))
  for (const row of content.launch_matrix ?? []) {
    for (const { field } of categoryFields) {
      if (diversifyField(row, field, priceByName)) changedByField[field] += 1
    }
  }
  return changedByField
}

function updateSegmentLaunches(content) {
  const rowsByFormat = new Map()
  for (const row of content.launch_matrix ?? []) {
    const rows = rowsByFormat.get(row.package_name) ?? []
    rows.push(row)
    rowsByFormat.set(row.package_name, rows)
  }

  for (const launch of content.segment_launches ?? []) {
    const rows = rowsByFormat.get(launch.format) ?? []
    if (!rows.length) continue
    launch.lead_count = rows.length
    launch.avg_start_amount = roundMoney(rows.reduce((sum, row) => sum + Number(row.start_amount ?? 0), 0) / rows.length)
    for (const { field } of categoryFields) {
      const totals = rows.map((row) => parseItems(row[field]).reduce((sum, item) => sum + item.qty, 0))
      const avgTotal = Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length)
      const pool = launchFormatCategoryPools[launch.format]?.[field] ?? []
      launch[field] = avgTotal > 0 && pool.length ? formatItems(distribute(avgTotal, pool, desiredSkuCount(field, [], pool, avgTotal))) : ""
    }
  }
}

function syncSegmentMatrices(db, productIdByName) {
  const segments = db.prepare("SELECT code, launch_format FROM crm_segments WHERE is_active = 1").all()
  const launchFormatBySegment = new Map(segments.map((row) => [row.code, row.launch_format]))
  const matrices = db.prepare("SELECT id, segment FROM segment_matrices").all()
  const deleteItems = db.prepare("DELETE FROM matrix_items WHERE matrix_id = ?")
  const insertItem = db.prepare("INSERT OR IGNORE INTO matrix_items(matrix_id, product_id, role, priority) VALUES (?, ?, ?, ?)")
  const updateMatrix = db.prepare("UPDATE segment_matrices SET target_sku_count = ?, rationale = ? WHERE id = ?")
  for (const matrix of matrices) {
    const launchFormat = launchFormatBySegment.get(matrix.segment)
    const pools = launchFormatCategoryPools[launchFormat]
    if (!pools) continue
    const productNames = categoryFields.flatMap(({ field }) => pools[field] ?? [])
    deleteItems.run(matrix.id)
    productNames.forEach((name, index) => {
      const productId = productIdByName.get(name)
      if (!productId) throw new Error(`Missing product for segment matrix: ${name}`)
      insertItem.run(matrix.id, productId, index < 4 ? "anchor" : "support", 100 - index * 2)
    })
    updateMatrix.run(
      `${productNames.length} SKU`,
      "Стартовая матрица пересчитана на разнообразие SKU внутри категорий, без концентрации объема в одной-двух позициях.",
      matrix.id
    )
  }
}

function categoryStats(content) {
  const stats = {}
  for (const { field, label } of categoryFields) {
    const rows = (content.launch_matrix ?? []).filter((row) => parseItems(row[field]).length > 0)
    const concentrated = rows.filter((row) => {
      const items = parseItems(row[field])
      const total = items.reduce((sum, item) => sum + item.qty, 0)
      const minSku = field === "sandwiches" ? Math.min(4, total) : Math.min(3, total)
      const maxShare = Math.max(...items.map((item) => item.qty)) / total
      return items.length < minSku || maxShare > 0.45
    })
    stats[label] = { rows: rows.length, concentrated: concentrated.length }
  }
  return stats
}

if (!existsSync(dbPath)) throw new Error(`Missing SQLite DB: ${dbPath}`)
if (!existsSync(launchContentPath)) throw new Error(`Missing launch content: ${launchContentPath}`)

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)
copyFileSync(launchContentPath, join(root, "data", `launch-crm-content.backup-before-category-diversity-${stamp}.json`))
copyFileSync(dbPath, join(root, "data", `lunch_up_crm.backup-before-category-diversity-${stamp}.sqlite`))

const db = new DatabaseSync(dbPath)
const products = db.prepare("SELECT id, name, wholesale_price FROM products WHERE is_active = 1").all()
const priceByName = new Map(products.map((row) => [row.name, Number(row.wholesale_price)]))
const productIdByName = new Map(products.map((row) => [row.name, Number(row.id)]))

for (const [format, pools] of Object.entries(launchFormatCategoryPools)) {
  for (const [field, names] of Object.entries(pools)) {
    for (const name of names) {
      if (!priceByName.has(name)) throw new Error(`Missing ${field} SKU for ${format}: ${name}`)
    }
  }
}

const content = JSON.parse(readFileSync(launchContentPath, "utf-8"))
const before = categoryStats(content)
const changedByField = updateLaunchRows(content, priceByName)
updateSegmentLaunches(content)

for (const script of content.sales_scripts ?? []) {
  if (script.crm_segment_code === "bath_spa" && script.launch_format === "Банная fresh-витрина") {
    script.offer =
      "Стартовая матрица: Сэндвич с индейкой на гриле x7; Сэндвич пшеничный с курицей x7; Ролл «Цезарь» x6; Сосиска в тесте Макси x6; Пита с курицей x6; Сырники с творогом x4; Запеканка творожная с изюмом x4; Блинчики с ветчиной и сыром x4; Блинчики кура с грибами x4; Салат «Винегрет» x4; Салат «Витаминный» x4; Салат «Греческий» x4; Салат «Фунчоза с овощами» x4; Десерт «Медовик» x5; Десерт «Шарлотка с яблоком» x5; Десерт «Картошка классическая» x4; Десерт «Морковный кекс» x4."
  }
}

content.generated_at = new Date().toISOString()
writeFileSync(launchContentPath, `${JSON.stringify(content, null, 2)}\n`, "utf-8")

db.exec("BEGIN")
try {
  syncSegmentMatrices(db, productIdByName)
  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
} finally {
  db.close()
}

const after = categoryStats(content)
console.log(JSON.stringify({ changedByField, before, after }, null, 2))
