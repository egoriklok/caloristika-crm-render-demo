import { spawn } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createServer } from "node:net"
import { DatabaseSync } from "node:sqlite"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const sourceDbPath = join(root, "data", "lunch_up_crm.sqlite")

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === "object" && address?.port) resolve(String(address.port))
        else reject(new Error("Could not allocate a free local port"))
      })
    })
  })
}

function copyTempDb() {
  if (!existsSync(sourceDbPath)) {
    throw new Error("Source SQLite database is missing. Run npm run db:init first.")
  }
  const dir = mkdtempSync(join(tmpdir(), "lunch-up-miniapp-order-smoke-"))
  const target = join(dir, basename(sourceDbPath))
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${sourceDbPath}${suffix}`
    if (existsSync(source)) copyFileSync(source, `${target}${suffix}`)
  }
  return target
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stopChild(child) {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000)
  ])
  if (child.exitCode === null) {
    child.kill("SIGKILL")
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(5000)
    ])
  }
  await delay(500)
}

async function waitForReady(baseUrl, child) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 180_000) {
    if (child.exitCode !== null) {
      throw new Error(`Temporary CRM server exited with code ${child.exitCode}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/miniapp/catalog`)
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await delay(750)
  }
  throw new Error("Temporary CRM server did not become ready in time")
}

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, payload }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function productRowsFromCatalog(payload) {
  if (Array.isArray(payload?.products)) return payload.products
  if (Array.isArray(payload?.categories)) {
    return payload.categories.flatMap((category) => category.products ?? category.items ?? [])
  }
  return []
}

function buildSmokeBasket(products, minOrderAmount) {
  const sorted = products
    .filter((item) => Number.isInteger(item.id) && Number(item.wholesale_price ?? item.price) > 0)
    .sort((left, right) => Number(right.wholesale_price ?? right.price) - Number(left.wholesale_price ?? left.price))
  assert(sorted.length > 0, "Mini App catalog returned no priced products")
  const basket = []
  let total = 0
  for (const product of sorted.slice(0, 3)) {
    const price = Number(product.wholesale_price ?? product.price)
    const quantity = Math.max(1, Math.ceil((minOrderAmount / 3) / price))
    basket.push({ product_id: product.id, quantity })
    total += price * quantity
    if (total >= minOrderAmount + 500) break
  }
  if (total < minOrderAmount) {
    const product = sorted[0]
    const price = Number(product.wholesale_price ?? product.price)
    basket.push({ product_id: product.id, quantity: Math.ceil((minOrderAmount - total + 500) / price) })
  }
  return basket
}

function countRows(dbPath, table, where = "1 = 1") {
  const db = new DatabaseSync(dbPath)
  try {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get()
    return Number(row.count)
  } finally {
    db.close()
  }
}

const tempDbPath = copyTempDb()
const beforeOrders = countRows(tempDbPath, "orders")
const port = await freePort()
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const useProductionBuild = process.env.MINIAPP_ORDER_SMOKE_NEXT_MODE !== "dev" && existsSync(join(root, ".next", "BUILD_ID"))
const args = useProductionBuild
  ? [nextBin, "start", "-H", "127.0.0.1", "-p", port]
  : [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", port]
const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    LUNCH_UP_CRM_DB_PATH: tempDbPath,
    MINIAPP_DEMO_MODE: "1",
    CRM_ACCESS_KEY: "miniapp-order-smoke-crm-key",
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_MANAGER_CHAT_ID: "",
    EXTERNAL_ORDER_WEBHOOK_URL: "",
    PORT: port,
    HOST: "127.0.0.1"
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
})

let output = ""
child.stdout.on("data", (chunk) => {
  output += chunk.toString()
})
child.stderr.on("data", (chunk) => {
  output += chunk.toString()
})

const baseUrl = `http://127.0.0.1:${port}`
try {
  await waitForReady(baseUrl, child)

  const catalog = await jsonRequest(`${baseUrl}/api/miniapp/catalog`)
  assert(catalog.response.ok, `Mini App catalog failed: HTTP ${catalog.response.status}`)
  const products = productRowsFromCatalog(catalog.payload)
  assert(products.length >= 40, `Expected at least 40 catalog products, got ${products.length}`)
  const minOrderAmount = Number(catalog.payload?.settings?.min_order_amount ?? 7000)
  const items = buildSmokeBasket(products, minOrderAmount)

  const profile = {
    company_name: "Mini App Smoke Temporary Company",
    contact_name: "Mini App Smoke Buyer",
    role: "Оператор теста",
    phone: "+7 900 000-00-00",
    email: "miniapp-smoke@example.com",
    delivery_address: "Санкт-Петербург, Невский проспект, 1",
    office_people: 80
  }
  const order = await jsonRequest(`${baseUrl}/api/miniapp/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: null,
      profile,
      delivery_method: "delivery",
      delivery_address: profile.delivery_address,
      delivery_date: "2035-01-10",
      payment_date: "2035-01-15",
      instructions: "Mini App order smoke on temporary database",
      items
    })
  })

  assert(order.response.status === 201, `Expected Mini App order HTTP 201, got ${order.response.status}: ${JSON.stringify(order.payload)}`)
  assert(order.payload?.ok === true, "Mini App order payload must be ok=true")
  assert(order.payload?.status === "manager_review", `Expected manager_review order, got ${order.payload?.status}`)
  assert(order.payload?.total_amount >= minOrderAmount, `Order total must be >= ${minOrderAmount}`)
  assert(order.payload?.enrichment_proposal?.proposal_summary?.includes("Для КП используем диапазон"), "Order response must include proposal guidance from enrichment")
  assert(order.payload?.orders?.some((item) => item.id === order.payload.order_id && item.payment_date === "2035-01-15"), "Order response history must include payment_date")
  assert(order.payload?.enrichment_proposal?.what_to_offer?.length >= 3, "Order response proposal must include what_to_offer guidance")
  assert(Array.isArray(order.payload?.orders) && order.payload.orders.length > 0, "Order response must include customer order history")
  const createdOrder = order.payload.orders.find((item) => item.id === order.payload.order_id)
  assert(createdOrder?.items?.length > 0, "Created order must include order_items in history")
  assert(order.payload?.manager_notification?.skipped === true, "Manager notification should be skipped in smoke without TELEGRAM_MANAGER_CHAT_ID")
  assert(order.payload?.customer_order_confirmation?.skipped === true, "Customer confirmation should be skipped in smoke without TELEGRAM_BOT_TOKEN")

  const afterOrders = countRows(tempDbPath, "orders")
  assert(afterOrders === beforeOrders + 1, `Temporary DB should contain exactly one new order, before=${beforeOrders}, after=${afterOrders}`)
  const smokeOrders = countRows(tempDbPath, "orders", "instructions LIKE '%Mini App order smoke on temporary database%'")
  assert(smokeOrders === 1, `Temporary DB should contain exactly one smoke order, got ${smokeOrders}`)
  const proposalOrders = countRows(tempDbPath, "orders", "instructions LIKE '%Для КП используем диапазон%'")
  assert(proposalOrders === 1, `Temporary DB should contain exactly one order with proposal guidance, got ${proposalOrders}`)

  console.log("Mini App order smoke passed")
  console.log("Mode: no-write/temp-db/temp-server")
  console.log(`Temporary DB: ${tempDbPath}`)
  console.log(`Temporary URL: ${baseUrl}`)
  console.log(`Order: #${order.payload.order_id}; total=${order.payload.total_amount}; status=${order.payload.status}`)
  console.log(`Items: ${items.map((item) => `${item.product_id}x${item.quantity}`).join(", ")}`)
} catch (error) {
  console.error("Mini App order smoke failed")
  if (output.trim()) {
    console.error(output.trim().slice(-5000))
  }
  throw error
} finally {
  await stopChild(child)
}
