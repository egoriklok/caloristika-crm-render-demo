import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const root = process.cwd()
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const launchContentPath = join(root, "data", "launch-crm-content.json")
const breakfastNames = [
  "Сырники с творогом",
  "Запеканка творожная с изюмом",
  "Блинчики с ветчиной и сыром",
  "Блинчики кура с грибами"
]
const matrixSegmentProducts = {
  coffee_bakery: [
    "Сэндвич с ветчиной и сыром",
    "Сэндвич с курой на гриле",
    "Ролл «Цезарь»",
    "Ролл Оригинальный",
    "Сырники с творогом",
    "Запеканка творожная с изюмом",
    "Блинчики с ветчиной и сыром",
    "Блинчики кура с грибами",
    "Десерт «Морковный кекс»",
    "Десерт «Медовик»",
    "Десерт «Тирамису»"
  ],
  vending_micromarket: [
    "Шаверма «Классическая»",
    "Шаверма с говядиной",
    "Ролл «Цезарь»",
    "Пита с курицей",
    "Сэндвич с индейкой на гриле",
    "Салат «Боул с курицей»",
    "Салат «Греческий»",
    "Салат «Оливье с ветчиной»",
    "Сырники с творогом",
    "Запеканка творожная с изюмом",
    "Блинчики с ветчиной и сыром",
    "Блинчики кура с грибами",
    "Десерт «Наполеон»"
  ],
  gas_station: [
    "Шаверма «Классическая»",
    "Хот Дог «Датский»",
    "Сосиска в тесте Макси",
    "Сэндвич «Салями»",
    "Сэндвич с ветчиной и сыром",
    "Ролл «Цезарь»",
    "Сырники с творогом",
    "Запеканка творожная с изюмом",
    "Блинчики с ветчиной и сыром",
    "Десерт «Картошка классическая»",
    "Сочень с творогом"
  ],
  bath_spa: [
    "Сэндвич с индейкой на гриле",
    "Сэндвич пшеничный с курицей",
    "Ролл «Цезарь»",
    "Сосиска в тесте Макси",
    "Сырники с творогом",
    "Запеканка творожная с изюмом",
    "Блинчики с ветчиной и сыром",
    "Блинчики кура с грибами",
    "Салат «Винегрет»",
    "Салат «Витаминный»",
    "Десерт «Медовик»",
    "Десерт «Шарлотка с яблоком»",
    "Десерт «Картошка классическая»"
  ],
  computer_club: [
    "Сэндвич пшеничный с курицей",
    "Сэндвич с ветчиной и сыром гауда",
    "Сэндвич с пепперони",
    "Сэндвич салями",
    "Сосиска в тесте Макси",
    "Хот Дог «Датский»",
    "Ролл «Цезарь»",
    "Пита с курицей",
    "Сырники с творогом",
    "Запеканка творожная с изюмом",
    "Блинчики с ветчиной и сыром",
    "Блинчики кура с грибами",
    "Десерт «Морковный кекс»",
    "Десерт «Картошка классическая»",
    "Сочень с творогом"
  ]
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
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
        name: (match?.[1] ?? part).trim(),
        qty: match?.[2] ? Number(match[2]) : 1
      }
    })
}

function itemAmount(items, priceByName) {
  return items.reduce((sum, item) => {
    const price = priceByName.get(item.name)
    if (!Number.isFinite(price)) {
      throw new Error(`Missing price for SKU: ${item.name}`)
    }
    return sum + price * item.qty
  }, 0)
}

function distributeBreakfasts(totalQty) {
  if (!Number.isFinite(totalQty) || totalQty <= 0) return []
  const selected = breakfastNames.slice(0, Math.min(breakfastNames.length, Math.max(2, totalQty)))
  const base = Math.floor(totalQty / selected.length)
  let remainder = totalQty % selected.length
  return selected
    .map((name) => {
      const qty = base + (remainder > 0 ? 1 : 0)
      remainder -= 1
      return { name, qty }
    })
    .filter((item) => item.qty > 0)
}

function formatItems(items) {
  return items.map((item) => `${item.name} x${item.qty}`).join("; ")
}

function countSku(row) {
  const names = new Set()
  for (const field of ["breakfasts", "salads", "sandwiches", "desserts"]) {
    for (const item of parseItems(row[field])) names.add(item.name)
  }
  return names.size
}

function diversifyRowBreakfasts(row, priceByName) {
  const oldItems = parseItems(row.breakfasts)
  const totalQty = oldItems.reduce((sum, item) => sum + item.qty, 0)
  if (totalQty <= 0) return false
  const nextItems = distributeBreakfasts(totalQty)
  const oldText = formatItems(oldItems)
  const nextText = formatItems(nextItems)
  if (oldText === nextText) return false
  const oldAmount = itemAmount(oldItems, priceByName)
  const nextAmount = itemAmount(nextItems, priceByName)
  row.breakfasts = nextText
  if (Number.isFinite(Number(row.start_amount))) {
    row.start_amount = roundMoney(Number(row.start_amount) - oldAmount + nextAmount)
  }
  row.sku_count = countSku(row)
  return true
}

function updateSegmentLaunches(content, priceByName) {
  const rowsByFormat = new Map()
  for (const row of content.launch_matrix ?? []) {
    const format = row.package_name
    if (!format) continue
    const current = rowsByFormat.get(format) ?? []
    current.push(row)
    rowsByFormat.set(format, current)
  }
  for (const launch of content.segment_launches ?? []) {
    const rows = rowsByFormat.get(launch.format) ?? []
    if (rows.length) {
      const avgBreakfastQty = Math.round(
        rows.reduce((sum, row) => sum + parseItems(row.breakfasts).reduce((inner, item) => inner + item.qty, 0), 0) / rows.length
      )
      launch.lead_count = rows.length
      launch.avg_start_amount = roundMoney(rows.reduce((sum, row) => sum + Number(row.start_amount ?? 0), 0) / rows.length)
      launch.breakfasts = formatItems(distributeBreakfasts(avgBreakfastQty))
      continue
    }
    const oldItems = parseItems(launch.breakfasts)
    const totalQty = oldItems.reduce((sum, item) => sum + item.qty, 0)
    if (totalQty > 0) {
      launch.breakfasts = formatItems(distributeBreakfasts(totalQty))
      if (Number.isFinite(Number(launch.avg_start_amount))) {
        const oldAmount = itemAmount(oldItems, priceByName)
        const nextAmount = itemAmount(parseItems(launch.breakfasts), priceByName)
        launch.avg_start_amount = roundMoney(Number(launch.avg_start_amount) - oldAmount + nextAmount)
      }
    }
  }
}

function syncSegmentMatrices(db, productIdByName) {
  const deleteItems = db.prepare("DELETE FROM matrix_items WHERE matrix_id = ?")
  const selectMatrix = db.prepare("SELECT id FROM segment_matrices WHERE segment = ?")
  const insertItem = db.prepare("INSERT OR IGNORE INTO matrix_items(matrix_id, product_id, role, priority) VALUES (?, ?, ?, ?)")
  for (const [segment, productNames] of Object.entries(matrixSegmentProducts)) {
    const matrix = selectMatrix.get(segment)
    if (!matrix) continue
    deleteItems.run(matrix.id)
    productNames.forEach((name, index) => {
      const productId = productIdByName.get(name)
      if (!productId) throw new Error(`Missing product for segment matrix: ${name}`)
      insertItem.run(matrix.id, productId, index < 4 ? "anchor" : "support", 100 - index * 3)
    })
  }
}

if (!existsSync(dbPath)) throw new Error(`Missing SQLite DB: ${dbPath}`)
if (!existsSync(launchContentPath)) throw new Error(`Missing launch content: ${launchContentPath}`)

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)
copyFileSync(launchContentPath, join(root, "data", `launch-crm-content.backup-before-breakfast-diversity-${stamp}.json`))
copyFileSync(dbPath, join(root, "data", `lunch_up_crm.backup-before-breakfast-diversity-${stamp}.sqlite`))

const db = new DatabaseSync(dbPath)
const products = db.prepare("SELECT id, name, wholesale_price FROM products WHERE is_active = 1").all()
const priceByName = new Map(products.map((product) => [product.name, Number(product.wholesale_price)]))
const productIdByName = new Map(products.map((product) => [product.name, Number(product.id)]))

for (const name of breakfastNames) {
  if (!priceByName.has(name)) throw new Error(`Missing breakfast SKU in catalog: ${name}`)
}

const content = JSON.parse(readFileSync(launchContentPath, "utf-8"))
let changedRows = 0
for (const row of content.launch_matrix ?? []) {
  if (diversifyRowBreakfasts(row, priceByName)) changedRows += 1
}
updateSegmentLaunches(content, priceByName)

for (const script of content.sales_scripts ?? []) {
  if (script.crm_segment_code === "bath_spa" && script.launch_format === "Банная fresh-витрина") {
    script.offer =
      "Стартовая матрица: Сэндвич с индейкой на гриле x8; Сэндвич пшеничный с курицей x8; Ролл «Цезарь» x8; Сосиска в тесте Макси x8; Сырники с творогом x4; Запеканка творожная с изюмом x4; Блинчики с ветчиной и сыром x4; Блинчики кура с грибами x4; Десерт «Медовик» x6; Десерт «Шарлотка с яблоком» x6; Десерт «Картошка классическая» x6."
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

const singleRows = (content.launch_matrix ?? []).filter((row) => parseItems(row.breakfasts).length < 2)
const singleSegments = (content.segment_launches ?? []).filter((row) => parseItems(row.breakfasts).length < 2)
console.log(
  JSON.stringify(
    {
      changedRows,
      launchRows: content.launch_matrix?.length ?? 0,
      singleBreakfastRows: singleRows.length,
      singleSegmentBreakfasts: singleSegments.length
    },
    null,
    2
  )
)
