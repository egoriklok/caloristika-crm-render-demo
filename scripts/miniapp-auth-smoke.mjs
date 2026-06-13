import { spawn } from "node:child_process"
import { createHmac } from "node:crypto"
import { copyFileSync, existsSync, mkdtempSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const sourceDbPath = join(root, "data", "lunch_up_crm.sqlite")
const botToken = "123456:miniapp-auth-smoke-token"
const smokeChatId = 710001
const smokeCompanyName = "Mini App Auth Smoke Temporary Company"

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
  const dir = mkdtempSync(join(tmpdir(), "lunch-up-miniapp-auth-smoke-"))
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

function signedInitData(overrides = {}) {
  const fields = {
    query_id: "miniapp-auth-smoke-query",
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({
      id: smokeChatId,
      first_name: "Miniapp",
      last_name: "Auth Smoke",
      username: "miniapp_auth_smoke"
    }),
    chat: JSON.stringify({
      id: smokeChatId,
      type: "private"
    }),
    ...overrides
  }
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")
  return new URLSearchParams({ ...fields, hash }).toString()
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
const useProductionBuild = process.env.MINIAPP_AUTH_SMOKE_NEXT_MODE !== "dev" && existsSync(join(root, ".next", "BUILD_ID"))
const args = useProductionBuild
  ? [nextBin, "start", "-H", "127.0.0.1", "-p", port]
  : [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", port]
const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    LUNCH_UP_CRM_DB_PATH: tempDbPath,
    MINIAPP_DEMO_MODE: "",
    CRM_ACCESS_KEY: "miniapp-auth-smoke-crm-key",
    CUSTOMER_PORTAL_SHARED_ACCESS_CODE: "portal-smoke-code",
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_OUTBOUND_DISABLED: "1",
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

  const profile = {
    company_name: smokeCompanyName,
    contact_name: "Mini App Auth Smoke Buyer",
    role: "Оператор теста",
    phone: "+7 900 111-22-33",
    email: "miniapp-auth-smoke@example.com",
    delivery_address: "Санкт-Петербург, Невский проспект, 5",
    office_people: 90
  }
  const validInitData = signedInitData()
  const invalidInitData = validInitData.replace("miniapp_auth_smoke", "miniapp_auth_tampered")

  const missingEmailCode = await jsonRequest(`${baseUrl}/api/miniapp/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: null, profile })
  })
  assert(missingEmailCode.response.status === 403, `Email session without access code must be blocked, got ${missingEmailCode.response.status}`)

  const emailSession = await jsonRequest(`${baseUrl}/api/miniapp/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: null, email: profile.email, accessCode: "portal-smoke-code", profile })
  })
  assert(emailSession.response.ok && emailSession.payload?.ok === true, `Email portal session failed: HTTP ${emailSession.response.status}`)
  assert(emailSession.payload?.auth?.mode === "email", "Email portal session must use email auth mode")
  assert(emailSession.payload?.auth?.email === profile.email, "Email portal session must return normalized email")
  assert(emailSession.payload?.customer?.company_name === smokeCompanyName, "Email portal session must link customer to company")
  assert(emailSession.payload?.insights?.inventory?.sku_count >= 40, "Email portal session must expose inventory summary")

  const badInitData = await jsonRequest(`${baseUrl}/api/miniapp/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: invalidInitData, profile })
  })
  assert(badInitData.response.status === 401, `Mini App session with invalid initData must be blocked, got ${badInitData.response.status}`)

  const session = await jsonRequest(`${baseUrl}/api/miniapp/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: validInitData, profile })
  })
  assert(session.response.ok && session.payload?.ok === true, `Signed Mini App session failed: HTTP ${session.response.status}`)
  assert(session.payload?.auth?.mode === "telegram", "Signed Mini App session must use telegram auth mode")
  assert(session.payload?.auth?.init_data_valid === true, "Signed Mini App session must validate initData")
  assert(session.payload?.customer?.company_name === smokeCompanyName, "Signed Mini App session must link customer to company")
  assert(session.payload?.profile?.company_name === smokeCompanyName, "Signed Mini App session must return saved profile company")
  assert(session.payload?.profile?.delivery_address === profile.delivery_address, "Signed Mini App session must return saved delivery address")
  assert(session.payload?.profile?.office_people === profile.office_people, "Signed Mini App session must return saved office people")
  assert(session.payload?.enrichment?.proposal?.proposal_summary?.includes("Для КП используем диапазон"), "Signed Mini App session must return enrichment proposal")

  const returningSession = await jsonRequest(`${baseUrl}/api/miniapp/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: validInitData, profile: {} })
  })
  assert(returningSession.response.ok && returningSession.payload?.ok === true, `Returning Mini App session failed: HTTP ${returningSession.response.status}`)
  assert(returningSession.payload?.profile?.company_name === smokeCompanyName, "Returning Mini App session must hydrate company from CRM")
  assert(returningSession.payload?.profile?.contact_name === profile.contact_name, "Returning Mini App session must hydrate contact from CRM")
  assert(returningSession.payload?.profile?.email === profile.email, "Returning Mini App session must hydrate email from CRM")
  assert(returningSession.payload?.profile?.phone === profile.phone, "Returning Mini App session must hydrate phone from CRM")
  assert(returningSession.payload?.profile?.delivery_address === profile.delivery_address, "Returning Mini App session must hydrate delivery address from CRM")
  assert(returningSession.payload?.profile?.office_people === profile.office_people, "Returning Mini App session must hydrate office people from CRM")

  const catalog = await jsonRequest(`${baseUrl}/api/miniapp/catalog`)
  assert(catalog.response.ok, `Mini App catalog failed: HTTP ${catalog.response.status}`)
  const products = productRowsFromCatalog(catalog.payload)
  const minOrderAmount = Number(catalog.payload?.settings?.min_order_amount ?? 7000)
  const items = buildSmokeBasket(products, minOrderAmount)

  const order = await jsonRequest(`${baseUrl}/api/miniapp/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      initData: validInitData,
      profile,
      delivery_method: "delivery",
      delivery_address: profile.delivery_address,
      delivery_date: "2035-01-10",
      payment_date: "2035-01-15",
      instructions: "Mini App signed initData smoke on temporary database",
      items
    })
  })
  assert(order.response.status === 201, `Expected signed Mini App order HTTP 201, got ${order.response.status}: ${JSON.stringify(order.payload)}`)
  assert(order.payload?.ok === true, "Signed Mini App order payload must be ok=true")
  assert(order.payload?.enrichment_proposal?.what_to_offer?.length >= 3, "Signed Mini App order must include enrichment proposal")
  assert(order.payload?.orders?.some((item) => item.id === order.payload.order_id && item.payment_date === "2035-01-15"), "Signed Mini App order history must include payment_date")
  assert(order.payload?.customer_order_confirmation?.skipped === true, "Signed Mini App smoke must skip outbound Telegram through TELEGRAM_OUTBOUND_DISABLED")

  const history = await jsonRequest(`${baseUrl}/api/miniapp/orders/history`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: validInitData })
  })
  assert(history.response.ok && history.payload?.ok === true, `Signed Mini App order history failed: HTTP ${history.response.status}`)
  assert(history.payload?.auth?.mode === "telegram", "Signed Mini App order history must use telegram auth")
  assert(history.payload?.profile?.company_name === smokeCompanyName, "Signed Mini App order history must return saved customer profile")
  assert(Array.isArray(history.payload?.orders) && history.payload.orders.some((item) => item.id === order.payload.order_id), "Signed Mini App order history must include created order")

  const emailHistory = await jsonRequest(`${baseUrl}/api/miniapp/orders/history`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: profile.email, accessCode: "portal-smoke-code", profile: { email: profile.email } })
  })
  assert(emailHistory.response.ok && emailHistory.payload?.ok === true, `Email portal order history failed: HTTP ${emailHistory.response.status}`)
  assert(emailHistory.payload?.auth?.mode === "email", "Email portal order history must use email auth")
  assert(Array.isArray(emailHistory.payload?.orders) && emailHistory.payload.orders.some((item) => item.id === order.payload.order_id), "Email portal history must include company order created through messenger auth")
  assert(emailHistory.payload?.insights?.orders_count >= 1, "Email portal insights must include company order count")

  const afterOrders = countRows(tempDbPath, "orders")
  assert(afterOrders === beforeOrders + 1, `Temporary DB should contain exactly one new signed order, before=${beforeOrders}, after=${afterOrders}`)
  assert(countRows(tempDbPath, "orders", "instructions LIKE '%Mini App signed initData smoke on temporary database%'") === 1, "Temporary DB must contain signed smoke order")
  assert(countRows(tempDbPath, "orders", "instructions LIKE '%Для КП используем диапазон%'") === 1, "Temporary DB signed order must contain proposal guidance")
  assert(countRows(tempDbPath, "bot_customers", `telegram_chat_id = '${smokeChatId}' AND state IN ('verified_profile', 'order_started')`) === 1, "Temporary DB must upsert Telegram bot customer")
  assert(countRows(tempDbPath, "miniapp_customer_profiles", `telegram_chat_id = '${smokeChatId}' AND company_name = '${smokeCompanyName.replaceAll("'", "''")}' AND delivery_address = '${profile.delivery_address.replaceAll("'", "''")}'`) === 1, "Temporary DB must persist Mini App customer profile")
  assert(countRows(tempDbPath, "companies", `name = '${smokeCompanyName.replaceAll("'", "''")}'`) === 1, "Temporary DB must create signed auth smoke company")
  assert(countRows(tempDbPath, "contacts", "email = 'miniapp-auth-smoke@example.com'") >= 1, "Temporary DB must create signed auth smoke contact")
  assert(countRows(tempDbPath, "customer_identities", "identity_type IN ('email', 'telegram')") >= 2, "Temporary DB must persist email and messenger identities")
  assert(countRows(tempDbPath, "inventory_movements", "reason = 'order_created'") >= 1, "Temporary DB must persist inventory movement for order")
  assert(countRows(tempDbPath, "ai_tasks", "task_type IN ('sales_demand_update', 'inventory_replenishment')") >= 1, "Temporary DB must queue sales or inventory AI task")
  assert(countRows(tempDbPath, "bot_customers", "telegram_chat_id LIKE 'local-demo-%'") === 0, "Signed auth smoke must not use local demo customer")

  console.log("Mini App signed auth smoke passed")
  console.log("Mode: no-write/temp-db/temp-server/signed-initData")
  console.log(`Temporary DB: ${tempDbPath}`)
  console.log(`Temporary URL: ${baseUrl}`)
  console.log(`Order: #${order.payload.order_id}; total=${order.payload.total_amount}; auth=telegram`)
  console.log(`Items: ${items.map((item) => `${item.product_id}x${item.quantity}`).join(", ")}`)
} catch (error) {
  console.error("Mini App signed auth smoke failed")
  if (output.trim()) {
    console.error(output.trim().slice(-5000))
  }
  throw error
} finally {
  await stopChild(child)
}
