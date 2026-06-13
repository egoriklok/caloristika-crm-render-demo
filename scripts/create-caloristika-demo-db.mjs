import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const sourcePath = join(root, "data", "lunch_up_crm.sqlite")
const targetPath = join(root, "data", "caloristika_demo_crm.sqlite")

if (!existsSync(sourcePath)) {
  throw new Error("Source CRM database is missing. Run npm run db:init first.")
}

mkdirSync(join(root, "data"), { recursive: true })

for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${targetPath}${suffix}`, { force: true })
}

const source = new DatabaseSync(sourcePath)
source.exec("PRAGMA wal_checkpoint(TRUNCATE);")
source.close()
copyFileSync(sourcePath, targetPath)

const db = new DatabaseSync(targetPath)
db.exec("PRAGMA foreign_keys = ON;")

const products = [
  {
    id: 1,
    category: "Горячие блюда",
    name: "Куриные котлеты с гречей и грибами",
    netWeight: "220 г",
    shelfLifeDays: 5,
    price: 155,
    composition:
      "Грудка куриная, бедро куриное, яйцо, греча, шампиньоны, лук, морковь, молоко, масло, зелень, специи.",
    nutrition: "Калорийность: 399 ккал",
    imageUrl: "https://static.tildacdn.com/tild3962-3038-4462-b839-613963376665/3.png",
    sourceUrl: "https://caloristikab2b.ru/"
  },
  {
    id: 2,
    category: "Салаты",
    name: "Салат цезарь с курицей",
    netWeight: "215 г",
    shelfLifeDays: 2,
    price: 165,
    composition: "Куриная грудка, айсберг, томаты черри, пармезан, гренки, соус.",
    nutrition: "Калорийность: 410 ккал",
    imageUrl: "https://static.tildacdn.com/tild3765-6230-4733-b532-623264613338/3.png",
    sourceUrl: "https://caloristikab2b.ru/"
  },
  {
    id: 3,
    category: "Завтраки",
    name: "Сырники с клубничным вареньем",
    netWeight: "220 г",
    shelfLifeDays: 5,
    price: 145,
    composition: "Творог, яйцо, рисовая мука, масло, ванилин, клубника, мед, вода.",
    nutrition: "Калорийность: 347 ккал",
    imageUrl: "https://static.tildacdn.com/tild3962-3038-4462-b839-613963376665/3.png",
    sourceUrl: "https://caloristikab2b.ru/"
  },
  {
    id: 4,
    category: "Десерты",
    name: "Трайфл Смородина-мята-шоколад",
    netWeight: "120 г",
    shelfLifeDays: 5,
    price: 135,
    composition: "Публичная карточка Caloristika: десерт без глютена и без добавленного белого сахара.",
    nutrition: "Демо: уточнить КБЖУ в рабочем прайсе",
    imageUrl: "https://static.tildacdn.com/tild6239-3838-4531-a665-336332313838/Facebook_post_-_4.png",
    sourceUrl: "https://caloristika.ru/"
  },
  {
    id: 5,
    category: "Десерты",
    name: "Трайфл Вишня-эстрагон-шоколад",
    netWeight: "110 г",
    shelfLifeDays: 5,
    price: 135,
    composition: "Публичная карточка Caloristika: десерт без глютена и без добавленного белого сахара.",
    nutrition: "Демо: уточнить КБЖУ в рабочем прайсе",
    imageUrl: "https://static.tildacdn.com/tild6161-3237-4162-b533-623663633537/Frame_1208.png",
    sourceUrl: "https://caloristika.ru/"
  },
  {
    id: 6,
    category: "Десерты",
    name: "Трайфл Клубника со сливками",
    netWeight: "140 г",
    shelfLifeDays: 5,
    price: 140,
    composition: "Публичная карточка Caloristika: десерт без глютена и без добавленного белого сахара.",
    nutrition: "Демо: уточнить КБЖУ в рабочем прайсе",
    imageUrl: "https://static.tildacdn.com/tild6634-3139-4736-b139-383938316535/Frame_1208.png",
    sourceUrl: "https://caloristika.ru/"
  },
  {
    id: 7,
    category: "Десерты",
    name: "Чизкейк Лимон-тимьян",
    netWeight: "115 г",
    shelfLifeDays: 5,
    price: 150,
    composition: "Публичная карточка Caloristika: десерт без глютена и без добавленного белого сахара.",
    nutrition: "Демо: уточнить КБЖУ в рабочем прайсе",
    imageUrl: "https://static.tildacdn.com/tild6238-3633-4632-a238-353838643966/Frame_1209_1.png",
    sourceUrl: "https://caloristika.ru/"
  },
  {
    id: 8,
    category: "Десерты",
    name: "Десерт Рикотта-черника-ежевика",
    netWeight: "145 г",
    shelfLifeDays: 5,
    price: 155,
    composition: "Публичная карточка Caloristika: десерт без глютена и без добавленного белого сахара.",
    nutrition: "Демо: уточнить КБЖУ в рабочем прайсе",
    imageUrl: "https://static.tildacdn.com/tild6238-3633-4632-a238-353838643966/Frame_1209_1.png",
    sourceUrl: "https://caloristika.ru/"
  },
  {
    id: 9,
    category: "Десерты",
    name: "Raw Черника-Кокос",
    netWeight: "70 г",
    shelfLifeDays: 7,
    price: 120,
    composition: "Публичная карточка Caloristika: без глютена, без добавленного белого сахара, без лактозы.",
    nutrition: "Демо: уточнить КБЖУ в рабочем прайсе",
    imageUrl: "https://static.tildacdn.com/tild6239-3838-4531-a665-336332313838/Facebook_post_-_4.png",
    sourceUrl: "https://caloristika.ru/"
  },
  {
    id: 10,
    category: "Десерты",
    name: "Бенто-торт Лайм-Спирулина",
    netWeight: "250 г",
    shelfLifeDays: 5,
    price: 240,
    composition: "Публичная карточка Caloristika: десерт без глютена и без добавленного белого сахара.",
    nutrition: "Демо: уточнить КБЖУ в рабочем прайсе",
    imageUrl: "https://static.tildacdn.com/tild6161-3237-4162-b533-623663633537/Frame_1208.png",
    sourceUrl: "https://caloristika.ru/"
  },
  {
    id: 11,
    category: "Десерты",
    name: "RAW Малина-Розовая матча",
    netWeight: "70 г",
    shelfLifeDays: 7,
    price: 120,
    composition: "Публичная карточка Caloristika: без глютена, без добавленного белого сахара, без лактозы.",
    nutrition: "Демо: уточнить КБЖУ в рабочем прайсе",
    imageUrl: "https://static.tildacdn.com/tild6239-3838-4531-a665-336332313838/Facebook_post_-_4.png",
    sourceUrl: "https://caloristika.ru/"
  }
]

const matrices = [
  {
    id: 1,
    segment: "coffee_bakery",
    name: "Кофейня: еда к кофе Caloristika",
    count: "8 SKU",
    rationale: "Сырники, десерты и салат как быстрый тест допродажи к кофе без кухни."
  },
  {
    id: 2,
    segment: "coffee_chain",
    name: "Сеть кофеен: централизованный пилот",
    count: "9 SKU",
    rationale: "Одинаковая матрица по 3-5 точкам, контроль списаний и повторный заказ через CRM."
  },
  {
    id: 3,
    segment: "vending_micromarket",
    name: "Микромаркет: полезная готовая еда",
    count: "7 SKU",
    rationale: "Сытные блюда, салат и десерты для холодильника самообслуживания."
  },
  {
    id: 4,
    segment: "office_cluster",
    name: "Офис/БЦ: холодильник заботы",
    count: "7 SKU",
    rationale: "Обеды и десерты для сотрудников без столовой и без ежедневной ручной закупки."
  },
  {
    id: 5,
    segment: "education_campus",
    name: "Кампус: быстрый день без очереди",
    count: "7 SKU",
    rationale: "Завтраки, салат и десерты для дневного студенческого потока."
  }
]

const matrixItems = {
  1: [3, 4, 5, 6, 7, 8, 9, 11],
  2: [1, 2, 3, 4, 5, 6, 7, 9, 11],
  3: [1, 2, 3, 4, 7, 9, 11],
  4: [1, 2, 3, 4, 5, 7, 8],
  5: [1, 2, 3, 4, 5, 9, 11]
}

function run(sql, ...params) {
  db.prepare(sql).run(...params)
}

function upsertSetting(key, value, description) {
  run(
    `INSERT INTO settings(key, value, description, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = excluded.description, updated_at = CURRENT_TIMESTAMP`,
    key,
    value,
    description
  )
}

db.exec("BEGIN")
try {
  for (const [key, value, description] of [
    ["demo_customer_name", "Caloristika B2B", "Клиент, под которого собрана demo CRM."],
    ["demo_customer_site", "https://caloristikab2b.ru/", "Публичный B2B-сайт клиента."],
    ["demo_customer_contact", "food.b2b@caloristika.ru / +7 (911) 134-30-00", "Публичные контакты с сайта Caloristika."],
    ["customer_type", "B2B-партнеры: кофейни, кафе, апарт-отели, фитнес-клубы, вендинг, досуговые центры", "Форматы клиентов Caloristika B2B."],
    ["free_delivery_city", "Санкт-Петербург", "Демо-фокус продаж."],
    ["launch_region", "Санкт-Петербург", "Для выездного demo фокус сужен до СПб."],
    ["min_order_amount", "3000", "Публично указанный минимум заказа по Санкт-Петербургу на сайте Caloristika B2B."],
    ["order_lead_time_days", "1", "Демо-допущение: подтвердить с операциями Caloristika."],
    ["order_cutoff_time", "16:00", "Демо-допущение для контрольных задач менеджера."],
    ["payment_terms", "Личный кабинет, партнерское соглашение, этапы оплаты по договоренности", "Формулировка из публичной партнерской воронки и demo-допущение."],
    ["active_strategy_token", "caloristika_b2b_spb_demo_20260613", "Demo strategy token."],
    ["active_strategy_package_slug", "caloristika_b2b_spb_demo", "Demo strategy package slug."],
    ["active_strategy_name", "Caloristika B2B: рост партнерской сети готовой еды в Санкт-Петербурге", "CRM demo strategy name."],
    [
      "active_strategy_description",
      "CRM для контроля B2B-партнеров Caloristika: лиды, дегустации, матрицы SKU, повторные заказы, Telegram-каталог и AI-задачи менеджеру.",
      "CRM demo strategy description."
    ],
    ["active_strategy_generated_at", "2026-06-13T12:00:00+03:00", "Demo generation timestamp."],
    ["active_strategy_geography", "Первый фокус demo - Санкт-Петербург: кофейни, вендинг/микромаркеты, офисы, кампусы и фитнес-локации.", "Demo geography."],
    ["active_strategy_stage", "Персональное demo для встречи с Caloristika B2B.", "Demo stage."],
    ["active_strategy_default_segment", "Кофейни, сети кофеен и вендинг/микромаркеты Санкт-Петербурга.", "Demo default segment."],
    [
      "active_strategy_first_offer",
      "14-дневный пилот CRM: 30-50 проверенных B2B-лидов, 5 дегустаций, стартовые матрицы SKU и контроль повторного заказа.",
      "Demo first offer."
    ],
    ["active_strategy_monthly_goal", "50 квалифицированных лидов, 10 встреч, 5 дегустаций, 3 пилотные точки и 2 повторных заказа.", "Demo monthly goal."],
    ["active_strategy_minimum_success", "2 партнера запустили повторяемые поставки и видят списания/повтор в CRM.", "Demo success floor."],
    [
      "active_strategy_spb_delivery_terms",
      "Санкт-Петербург: демо учитывает публичный минимум 3 000 руб.; точные окна доставки подтверждаются с операциями Caloristika.",
      "Demo delivery terms."
    ],
    ["active_strategy_lo_delivery_terms", "Ленинградская область не включена в первую demo-волну; подключается после подтвержденной экономики СПб.", "Demo LO terms."]
  ]) {
    upsertSetting(key, value, description)
  }

  db.exec(`
    UPDATE companies
    SET fit_reason = replace(replace(coalesce(fit_reason, ''), 'Lunch Up', 'Caloristika'), 'Lunch-UP', 'Caloristika'),
        notes = replace(replace(coalesce(notes, ''), 'Lunch Up', 'Caloristika'), 'Lunch-UP', 'Caloristika'),
        source = 'Lunch-Up CRM local lead base adapted for Caloristika demo',
        updated_at = CURRENT_TIMESTAMP;

    UPDATE deals
    SET title = replace(replace(title, 'Lunch Up', 'Caloristika'), 'Lunch-UP', 'Caloristika'),
        next_action = replace(replace(coalesce(next_action, ''), 'Lunch Up', 'Caloristika'), 'Lunch-UP', 'Caloristika'),
        owner = 'Caloristika demo sales lead',
        updated_at = CURRENT_TIMESTAMP;

    UPDATE activities
    SET notes = replace(replace(coalesce(notes, ''), 'Lunch Up', 'Caloristika'), 'Lunch-UP', 'Caloristika'),
        created_by = 'AI Sales Ops / Caloristika demo';

    UPDATE ai_tasks
    SET prompt = replace(replace(replace(coalesce(prompt, ''), 'Lunch Up', 'Caloristika'), 'Lunch-UP', 'Caloristika'), '7000 руб.', '3000 руб.'),
        status = 'queued',
        result_summary = NULL,
        result_json = NULL,
        last_error = NULL,
        locked_at = NULL,
        locked_by = NULL,
        attempts = 0,
        completed_at = NULL,
        updated_at = CURRENT_TIMESTAMP;
  `)

  const stagedCompanies = [
    [9, 4],
    [38, 5],
    [33, 3],
    [53, 2],
    [12, 4],
    [1, 3],
    [57, 2],
    [10, 3]
  ]
  for (const [companyId, stageId] of stagedCompanies) {
    run("UPDATE deals SET stage_id = ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?", stageId, companyId)
  }

  db.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM matrix_items;
    DELETE FROM segment_matrices;
    DELETE FROM inventory_movements;
    DELETE FROM inventory_positions;
    DELETE FROM products;
    DELETE FROM sqlite_sequence WHERE name IN ('products', 'segment_matrices', 'matrix_items', 'orders', 'order_items');
  `)

  for (const product of products) {
    run(
      `INSERT INTO products(
        id, category, name, barcode, net_weight, shelf_life_days, wholesale_price, composition, nutrition,
        image_url, product_url, image_source, image_match, image_note, site_title, is_active, source_file
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'public_demo', ?, ?, 1, ?)`,
      product.id,
      product.category,
      product.name,
      product.netWeight,
      product.shelfLifeDays,
      product.price,
      product.composition,
      product.nutrition,
      product.imageUrl,
      product.sourceUrl,
      product.sourceUrl,
      "Demo SKU and demo price. Actual B2B unit price must be loaded from Caloristika working catalog.",
      product.name,
      "caloristikab2b.ru + caloristika.ru public demo snapshot 2026-06-13"
    )
    run("INSERT INTO inventory_positions(product_id, on_hand_quantity, reserved_quantity, reorder_point, target_stock) VALUES (?, 36, 0, 12, 72)", product.id)
  }

  for (const matrix of matrices) {
    run(
      "INSERT INTO segment_matrices(id, segment, name, target_sku_count, rationale) VALUES (?, ?, ?, ?, ?)",
      matrix.id,
      matrix.segment,
      matrix.name,
      matrix.count,
      matrix.rationale
    )
    let priority = 100
    for (const productId of matrixItems[matrix.id] ?? []) {
      run("INSERT INTO matrix_items(matrix_id, product_id, role, priority) VALUES (?, ?, ?, ?)", matrix.id, productId, priority >= 92 ? "anchor" : "support", priority)
      priority -= 4
    }
  }

  const demoOrders = [
    {
      companyId: 9,
      dealId: 9,
      status: "confirmed",
      address: "Санкт-Петербург, Уральская ул., 13",
      date: "2026-06-18",
      comment: "Demo: пилот холодильника Uvenco на полезной готовой еде.",
      items: [
        [1, 10],
        [2, 8],
        [3, 8],
        [4, 8]
      ]
    },
    {
      companyId: 33,
      dealId: 33,
      status: "draft",
      address: "Санкт-Петербург, Уральская улица, 21 лит А",
      date: "2026-06-19",
      comment: "Demo: дегустация для сети кофеен, 8 SKU.",
      items: [
        [3, 12],
        [4, 10],
        [5, 10],
        [7, 8]
      ]
    },
    {
      companyId: 53,
      dealId: 53,
      status: "processing",
      address: "Санкт-Петербург, Университетская набережная, 7",
      date: "2026-06-20",
      comment: "Demo: кампусный тест быстрых завтраков и обедов.",
      items: [
        [1, 15],
        [2, 15],
        [3, 12],
        [9, 12]
      ]
    }
  ]

  for (const order of demoOrders) {
    const orderResult = db
      .prepare(
        `INSERT INTO orders(company_id, deal_id, channel, status, delivery_method, delivery_address, delivery_date, instructions, payment_method, manager_comment, total_amount)
         VALUES (?, ?, 'demo_crm', ?, 'delivery', ?, ?, 'Caloristika demo order', 'invoice', ?, 0)`
      )
      .run(order.companyId, order.dealId, order.status, order.address, order.date, order.comment)
    const orderId = Number(orderResult.lastInsertRowid)
    let total = 0
    for (const [productId, quantity] of order.items) {
      const product = products.find((item) => item.id === productId)
      if (!product) continue
      const lineTotal = product.price * quantity
      total += lineTotal
      run("INSERT INTO order_items(order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)", orderId, productId, quantity, product.price, lineTotal)
    }
    run("UPDATE orders SET total_amount = ? WHERE id = ?", total, orderId)
  }

  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
} finally {
  db.close()
}

console.log(`Caloristika demo CRM database created: ${targetPath}`)
