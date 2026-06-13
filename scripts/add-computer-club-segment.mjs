import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const dbPath = join(process.cwd(), "data", "lunch_up_crm.sqlite")
const launchContentPath = join(process.cwd(), "data", "launch-crm-content.json")
const publicContactsPath = join(process.cwd(), "data", "public-contacts.json")
const nowIso = new Date().toISOString()
const dateStamp = nowIso.replace(/[-:T.Z]/g, "").slice(0, 14)
const backupPath = join(process.cwd(), "data", `lunch_up_crm.backup-before-computer-club-segment-${dateStamp}.sqlite`)

const matrixQuantities = [
  ["Сэндвич пшеничный с курицей", 8],
  ["Сэндвич с ветчиной и сыром гауда", 8],
  ["Сэндвич с пепперони", 8],
  ["Сэндвич салями", 8],
  ["Сосиска в тесте Макси", 8],
  ["Хот Дог «Датский»", 8],
  ["Ролл «Цезарь»", 7],
  ["Пита с курицей", 7],
  ["Сырники с творогом", 2],
  ["Запеканка творожная с изюмом", 2],
  ["Блинчики с ветчиной и сыром", 1],
  ["Блинчики кура с грибами", 1],
  ["Десерт «Морковный кекс»", 5],
  ["Десерт «Картошка классическая»", 5],
  ["Сочень с творогом", 5],
  ["Десерт «Медовик»", 5]
]

const matrixText = {
  breakfasts: "Сырники с творогом x2; Запеканка творожная с изюмом x2; Блинчики с ветчиной и сыром x1; Блинчики кура с грибами x1",
  salads: "",
  sandwiches:
    "Сэндвич пшеничный с курицей x8; Сэндвич с ветчиной и сыром гауда x8; Сэндвич с пепперони x8; Сэндвич салями x8; Сосиска в тесте Макси x8; Хот Дог «Датский» x8; Ролл «Цезарь» x7; Пита с курицей x7",
  desserts: "Десерт «Морковный кекс» x5; Десерт «Картошка классическая» x5; Сочень с творогом x5; Десерт «Медовик» x5"
}

const segmentSeed = {
  code: "computer_club",
  label: "Компьютерные клубы",
  direction_code: "workplace",
  direction_label: "Рабочие и учебные локации",
  direction_description: "Офисы, смены, кампусы, клиники, бани и компьютерные клубы",
  direction_position: 2,
  segment_position: 60,
  launch_format: "Компьютерный клуб snack-витрина"
}

const conditions =
  "Мин. заказ 7 000 ₽ на точку; заказ за 2 дня до 15:00; доставка по СПб бесплатно Пн-Чт; оплата по счету/договору. Для ЛО - только по согласованному маршруту."

const offer =
  `Поставить компактную snack-витрину Lunch Up на 4 дня: ${matrixQuantities.length} SKU / ${matrixQuantities.reduce((sum, [, qty]) => sum + qty, 0)} порций, упор на сэндвичи, хот-дог, сосиску в тесте, разнообразные завтраки и десерты; приемка через администратора клуба.`

const nextAction =
  "Позвонить администратору или управляющему, проверить холодильник/место выдачи и предложить пилот snack-витрины на 4 дня."

const kpi = "Выкуп 70% за 4 дня; 18-22 покупки в день; 3 SKU-лидера; повторная поставка перед выходными."
const risk = "Проверить наличие холодильника/витрины и правила продажи еды; если витрины нет, начать с выдачи через администратора."
const launchFormat =
  "Snack-витрина у администратора или в холодильнике клуба: сытные позиции без приборов + десерты для вечернего и ночного игрового потока."

const computerClubLeads = [
  {
    name: "CyberX Карпинского",
    address: "Санкт-Петербург, улица Карпинского, 38 к1, 2 этаж",
    district: "Калининский район",
    website: "https://cyberxcommunity.ru/kluby/rossiya/sankt-peterburg/karp.html",
    public_contact_url: "https://langame.ru/799454576_computerniy_club_cyberx-karpinskogo_sankt-peterburg",
    dgis_url: "https://2gis.ru/spb/firm/70000001093729048",
    dgis_id: "70000001093729048",
    phone: "+7 (981) 178-38-38",
    email: "cyberxkarpinskogo@yandex.ru",
    legal_name: "ИП Лукашев Дмитрий Игоревич",
    inn: "780532966892",
    priority: "A",
    score: 88,
    drive: 35,
    weeklyFrequency: 2,
    peopleMin: 30,
    peopleMax: 45,
    dailyPresent: 34,
    buyersMin: 8,
    buyersMax: 14,
    sourceNote:
      "LANGAME указывает 28 компьютеров, продажу через администратора, адрес, телефон и email; официальный сайт CyberX подтверждает адрес и телефон."
  },
  {
    name: "Colizeum СПб ТРК Континент",
    address: "Санкт-Петербург, Бухарестская улица, 32",
    district: "Фрунзенский район",
    website: "https://colizeumarena.com/blog/club/colizeum-spb-trk-kontinent/",
    public_contact_url: "https://colizeumarena.com/blog/club/colizeum-spb-trk-kontinent/",
    dgis_url: "https://2gis.ru/spb/search/Colizeum%20%D0%A1%D0%9F%D0%B1%20%D0%A2%D0%A0%D0%9A%20%D0%9A%D0%BE%D0%BD%D1%82%D0%B8%D0%BD%D0%B5%D0%BD%D1%82%20%D0%91%D1%83%D1%85%D0%B0%D1%80%D0%B5%D1%81%D1%82%D1%81%D0%BA%D0%B0%D1%8F%2032",
    dgis_id: null,
    phone: "+7 (993) 980-88-00",
    email: "info@colizeum.ru",
    legal_name: "ООО УК КОЛИЗЕУМ",
    inn: "9713021000",
    priority: "A",
    score: 87,
    drive: 32,
    weeklyFrequency: 2,
    peopleMin: 35,
    peopleMax: 65,
    dailyPresent: 45,
    buyersMin: 10,
    buyersMax: 18,
    sourceNote: "Официальная карточка Colizeum указывает адрес в ТРК Континент, телефон, email и ссылку на 2ГИС."
  },
  {
    name: "True Gamers Ленинский",
    address: "Санкт-Петербург, Ленинский проспект, 122 к2",
    district: "Кировский район",
    website: "https://truegamers.ru/",
    public_contact_url: "https://rubrikator.org/russia/saint-petersburg/true-gamers-day",
    dgis_url: "https://2gis.ru/spb/firm/70000001053725694",
    dgis_id: "70000001053725694",
    phone: "+7 (921) 376-77-74",
    email: "info@truegamers.ru",
    legal_name: null,
    inn: null,
    priority: "B",
    score: 84,
    drive: 38,
    weeklyFrequency: 1.5,
    peopleMin: 25,
    peopleMax: 45,
    dailyPresent: 32,
    buyersMin: 7,
    buyersMax: 13,
    sourceNote: "Rubrikator указывает адрес, круглосуточный режим, телефон, сайт и Telegram клуба; сайт True Gamers указывает info@truegamers.ru для управляющей компании."
  },
  {
    name: "ProSkill Московский",
    address: "Санкт-Петербург, Московский проспект, 73 к5, 1 этаж",
    district: "Московский район",
    website: "https://proskill-spb.orgs.biz/",
    public_contact_url: "https://proskill-spb.orgs.biz/",
    dgis_url: "https://2gis.ru/spb/search/ProSkill%20%D0%9C%D0%BE%D1%81%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%2073%20%D0%BA5",
    dgis_id: null,
    phone: "+7 (985) 974-77-06",
    email: "cyberclubproskillspb@gmail.com",
    legal_name: null,
    inn: null,
    priority: "B",
    score: 81,
    drive: 26,
    weeklyFrequency: 1.5,
    peopleMin: 25,
    peopleMax: 40,
    dailyPresent: 30,
    buyersMin: 7,
    buyersMax: 12,
    sourceNote: "Страница ProSkill указывает 25 ПК, круглосуточный режим, телефон и адрес; 2ГИС указывает email cyberclubproskillspb@gmail.com."
  },
  {
    name: "KiberWorld Байконурская",
    address: "Санкт-Петербург, Байконурская улица, 14",
    district: "Приморский район",
    website: "https://kiberworld.ru/",
    public_contact_url: "https://kiberworld.ru/",
    dgis_url: "https://2gis.ru/spb/search/KiberWorld%20%D0%91%D0%B0%D0%B9%D0%BA%D0%BE%D0%BD%D1%83%D1%80%D1%81%D0%BA%D0%B0%D1%8F%2014",
    dgis_id: null,
    phone: "+7 (904) 511-77-11",
    email: "Askerov-vd@mail.ru",
    legal_name: "ИП Аскеров Э.Г.",
    inn: null,
    priority: "B",
    score: 80,
    drive: 31,
    weeklyFrequency: 1.5,
    peopleMin: 25,
    peopleMax: 45,
    dailyPresent: 32,
    buyersMin: 7,
    buyersMax: 13,
    sourceNote: "Официальный сайт KiberWorld указывает клуб в ТК Континент на Байконурской, режим 24/7, телефон, email и наличие легкой еды и напитков."
  },
  {
    name: "Midas Cyber",
    address: "Санкт-Петербург, проспект Славы, 51",
    district: "Фрунзенский район",
    website: "https://spb.spravka.city/company/midas-cyber",
    public_contact_url: "https://spb.spravka.city/company/midas-cyber",
    dgis_url: "https://2gis.ru/spb/search/Midas%20Cyber%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%20%D0%A1%D0%BB%D0%B0%D0%B2%D1%8B%2051",
    dgis_id: null,
    phone: "+7 (812) 566-00-62",
    email: "info@midas-cyberlounge.ru",
    legal_name: null,
    inn: null,
    priority: "B",
    score: 79,
    drive: 36,
    weeklyFrequency: 1.5,
    peopleMin: 25,
    peopleMax: 45,
    dailyPresent: 32,
    buyersMin: 7,
    buyersMax: 13,
    sourceNote: "Spravka.City указывает адрес, круглосуточный режим, телефон и email Midas Cyber."
  }
]

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function yandexSearchUrl(lead) {
  return `https://yandex.ru/maps/2/saint-petersburg/search/${encodeURIComponent(`${lead.name} ${lead.address}`)}/`
}

function sourceSummaryFor(lead, startAmount) {
  return JSON.stringify({
    segment: segmentSeed.label,
    launch_format: segmentSeed.launch_format,
    address: lead.address,
    public_sources: [
      lead.public_contact_url,
      lead.website,
      lead.dgis_url
    ].filter(Boolean),
    people_estimate:
      "Оценка расчетная: число ПК/круглосуточный поток/публичное описание клуба. Использовать для первого КП, затем уточнять у администратора.",
    recommended_matrix: {
      sku: matrixQuantities.length,
      portions: matrixQuantities.reduce((sum, [, qty]) => sum + qty, 0),
      budget_rub: startAmount
    },
    note: lead.sourceNote
  })
}

function addOrUpdateJsonRecord(records, match, record) {
  const index = records.findIndex(match)
  if (index >= 0) records[index] = { ...records[index], ...record }
  else records.push(record)
}

if (!existsSync(dbPath)) throw new Error(`SQLite DB not found: ${dbPath}`)
copyFileSync(dbPath, backupPath)
for (const suffix of ["-wal", "-shm"]) {
  const sidecar = `${dbPath}${suffix}`
  if (existsSync(sidecar)) copyFileSync(sidecar, `${backupPath}${suffix}`)
}

const db = new DatabaseSync(dbPath)

const productRows = db
  .prepare(`SELECT id, name, category, wholesale_price FROM products WHERE name IN (${matrixQuantities.map(() => "?").join(", ")})`)
  .all(...matrixQuantities.map(([name]) => name))
const productByName = new Map(productRows.map((row) => [row.name, row]))
const missingProducts = matrixQuantities.map(([name]) => name).filter((name) => !productByName.has(name))
if (missingProducts.length) throw new Error(`Missing matrix products: ${missingProducts.join(", ")}`)

const totalUnits = matrixQuantities.reduce((sum, [, qty]) => sum + qty, 0)
const startAmount = roundMoney(
  matrixQuantities.reduce((sum, [name, qty]) => sum + Number(productByName.get(name).wholesale_price) * qty, 0)
)

const stageId = db.prepare("SELECT id FROM pipeline_stages WHERE code = 'lead'").get()?.id
if (!stageId) throw new Error("Pipeline stage 'lead' not found")
const agentIdByCode = new Map(db.prepare("SELECT id, code FROM ai_agents").all().map((row) => [row.code, row.id]))

db.exec("BEGIN")
try {
  db.prepare(`
    INSERT INTO crm_segments(
      code, label, direction_code, direction_label, direction_description,
      direction_position, segment_position, launch_format, is_active, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(code) DO UPDATE SET
      label = excluded.label,
      direction_code = excluded.direction_code,
      direction_label = excluded.direction_label,
      direction_description = excluded.direction_description,
      direction_position = excluded.direction_position,
      segment_position = excluded.segment_position,
      launch_format = excluded.launch_format,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    segmentSeed.code,
    segmentSeed.label,
    segmentSeed.direction_code,
    segmentSeed.direction_label,
    segmentSeed.direction_description,
    segmentSeed.direction_position,
    segmentSeed.segment_position,
    segmentSeed.launch_format
  )
  db.prepare("UPDATE crm_segments SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE code = 'telegram_order'").run()
  db.prepare(
    "UPDATE crm_segments SET direction_description = ?, updated_at = CURRENT_TIMESTAMP WHERE direction_code = 'workplace'"
  ).run(segmentSeed.direction_description)

  const oldMatrices = db.prepare("SELECT id FROM segment_matrices WHERE segment = ?").all(segmentSeed.code)
  for (const matrix of oldMatrices) db.prepare("DELETE FROM matrix_items WHERE matrix_id = ?").run(matrix.id)
  db.prepare("DELETE FROM segment_matrices WHERE segment = ?").run(segmentSeed.code)
  const matrixResult = db
    .prepare("INSERT INTO segment_matrices(segment, name, target_sku_count, rationale) VALUES (?, ?, ?, ?)")
    .run(
      segmentSeed.code,
      "Компьютерный клуб: snack-витрина",
      `${matrixQuantities.length} SKU / ${totalUnits} порций`,
      "Еда одной рукой для вечернего и ночного игрового потока: плотные сэндвичи, хот-дог, сосиска в тесте, роллы, разнообразные завтраки и десерты без запуска кухни; объем распределен без концентрации на одном SKU."
    )
  const matrixId = Number(matrixResult.lastInsertRowid)
  const insertMatrixItem = db.prepare("INSERT INTO matrix_items(matrix_id, product_id, role, priority) VALUES (?, ?, ?, ?)")
  matrixQuantities.forEach(([name], index) => {
    insertMatrixItem.run(matrixId, productByName.get(name).id, index < 4 ? "anchor" : "support", 100 - index * 4)
  })

  const selectCompany = db.prepare("SELECT id FROM companies WHERE name = ? AND segment = ? LIMIT 1")
  const insertCompany = db.prepare(`
    INSERT INTO companies(
      name, segment, region, city, district, website, public_contact_url, source, lead_status,
      lead_score, fit_reason, notes, address, dgis_url, drive_minutes_from_production, drive_minutes_source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const updateCompany = db.prepare(`
    UPDATE companies
    SET region = ?, city = ?, district = ?, website = ?, public_contact_url = ?, source = ?, lead_status = ?,
        lead_score = ?, fit_reason = ?, notes = ?, address = ?, dgis_url = ?, drive_minutes_from_production = ?,
        drive_minutes_source = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  const selectContact = db.prepare("SELECT id FROM contacts WHERE company_id = ? AND role = ? LIMIT 1")
  const insertContact = db.prepare(`
    INSERT INTO contacts(
      company_id, name, role, email, phone, telegram_handle, preferred_channel, is_public,
      consent_basis, notes, address, dgis_url, drive_minutes_from_production, drive_minutes_source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'public_business_channel', ?, ?, ?, ?, ?)
  `)
  const updateContact = db.prepare(`
    UPDATE contacts
    SET name = ?, email = ?, phone = ?, telegram_handle = ?, preferred_channel = ?, is_public = 1,
        consent_basis = 'public_business_channel', notes = ?, address = ?, dgis_url = ?,
        drive_minutes_from_production = ?, drive_minutes_source = ?
    WHERE id = ?
  `)
  const selectDeal = db.prepare("SELECT id FROM deals WHERE company_id = ? AND title = ? LIMIT 1")
  const insertDeal = db.prepare(`
    INSERT INTO deals(
      company_id, stage_id, title, estimated_monthly_revenue, expected_close_date, priority,
      owner, next_action, next_action_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'Директор по развитию продуктов', ?, ?)
  `)
  const updateDeal = db.prepare(`
    UPDATE deals
    SET stage_id = ?, estimated_monthly_revenue = ?, expected_close_date = ?, priority = ?,
        owner = 'Директор по развитию продуктов', next_action = ?, next_action_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  const selectLocal = db.prepare("SELECT id FROM local_prospects WHERE name = ? AND segment = ? LIMIT 1")
  const insertLocal = db.prepare(`
    INSERT INTO local_prospects(
      name, segment, address, walk_min, distance_band, priority, score, fit_reason, offer,
      next_action, phone, email, website, source_2gis, source_yandex, pb_nalog_url, nalog_query,
      fns_status, legal_name, inn, ogrn, fns_notes, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const updateLocal = db.prepare(`
    UPDATE local_prospects
    SET address = ?, walk_min = ?, distance_band = ?, priority = ?, score = ?, fit_reason = ?, offer = ?,
        next_action = ?, phone = ?, email = ?, website = ?, source_2gis = ?, source_yandex = ?,
        pb_nalog_url = ?, nalog_query = ?, fns_status = ?, legal_name = ?, inn = ?, ogrn = ?,
        fns_notes = ?, notes = ?
    WHERE id = ?
  `)
  const upsertProfile = db.prepare(`
    INSERT INTO company_enrichment_profiles(
      company_id, dgis_id, inn, legal_name, address, website, phone, email, employee_count_fns,
      employee_count_2gis, office_people_min, office_people_max, office_people_confidence,
      office_people_method, recommended_portions, recommended_sku, estimated_launch_budget,
      source_summary, employee_count_website, office_people_daily_present, likely_buyers_min,
      likely_buyers_max, dgis_url, drive_minutes_from_production, drive_minutes_source, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 'medium', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(company_id) DO UPDATE SET
      dgis_id = excluded.dgis_id,
      inn = excluded.inn,
      legal_name = excluded.legal_name,
      address = excluded.address,
      website = excluded.website,
      phone = excluded.phone,
      email = excluded.email,
      office_people_min = excluded.office_people_min,
      office_people_max = excluded.office_people_max,
      office_people_confidence = excluded.office_people_confidence,
      office_people_method = excluded.office_people_method,
      recommended_portions = excluded.recommended_portions,
      recommended_sku = excluded.recommended_sku,
      estimated_launch_budget = excluded.estimated_launch_budget,
      source_summary = excluded.source_summary,
      office_people_daily_present = excluded.office_people_daily_present,
      likely_buyers_min = excluded.likely_buyers_min,
      likely_buyers_max = excluded.likely_buyers_max,
      dgis_url = excluded.dgis_url,
      drive_minutes_from_production = excluded.drive_minutes_from_production,
      drive_minutes_source = excluded.drive_minutes_source,
      updated_at = CURRENT_TIMESTAMP
  `)
  const deleteSources = db.prepare("DELETE FROM company_enrichment_sources WHERE company_id = ?")
  const insertSource = db.prepare(`
    INSERT INTO company_enrichment_sources(company_id, source, status, title, source_url, note)
    VALUES (?, ?, 'found', ?, ?, ?)
  `)
  const insertTask = db.prepare(`
    INSERT INTO ai_tasks(agent_id, company_id, deal_id, task_type, priority, prompt, status, due_at)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
  `)
  const existingTask = db.prepare(`
    SELECT id FROM ai_tasks WHERE company_id = ? AND deal_id = ? AND task_type = ? AND status IN ('queued', 'running') LIMIT 1
  `)

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + 2)
  const nextActionAt = nextDate.toISOString().slice(0, 10)
  const closeDate = new Date()
  closeDate.setDate(closeDate.getDate() + 21)
  const expectedCloseDate = closeDate.toISOString().slice(0, 10)
  const companyIds = []

  for (const lead of computerClubLeads) {
    const fitReason =
      "Компьютерный клуб с вечерним/ночным потоком: игрокам нужна сытная еда без ухода с места, а клубу - допродажа без кухни."
    const monthlyRevenue = Math.round(startAmount * lead.weeklyFrequency * 4.33)
    const notes = [
      lead.sourceNote,
      `Стартовая матрица: ${matrixQuantities.length} SKU / ${totalUnits} порций / ${startAmount.toLocaleString("ru-RU")} ₽ закупки Lunch Up.`,
      `Оценка спроса: ${lead.buyersMin}-${lead.buyersMax} покупателей в день; ${lead.drive} мин на авто от производства.`,
      risk
    ].join(" ")
    const existingCompany = selectCompany.get(lead.name, segmentSeed.code)
    let companyId
    if (existingCompany) {
      companyId = Number(existingCompany.id)
      updateCompany.run(
        "Санкт-Петербург",
        "Санкт-Петербург",
        lead.district,
        lead.website,
        lead.public_contact_url,
        "open_sources_2gis_web",
        "lead",
        lead.score,
        fitReason,
        notes,
        lead.address,
        lead.dgis_url,
        lead.drive,
        "open_sources_route_estimate",
        companyId
      )
    } else {
      const result = insertCompany.run(
        lead.name,
        segmentSeed.code,
        "Санкт-Петербург",
        "Санкт-Петербург",
        lead.district,
        lead.website,
        lead.public_contact_url,
        "open_sources_2gis_web",
        "lead",
        lead.score,
        fitReason,
        notes,
        lead.address,
        lead.dgis_url,
        lead.drive,
        "open_sources_route_estimate"
      )
      companyId = Number(result.lastInsertRowid)
    }
    companyIds.push(companyId)

    const role = "Администратор / управляющий клубом"
    const contactNotes = `Публичный контакт из открытых источников. ${lead.sourceNote}`
    const existingContact = selectContact.get(companyId, role)
    if (existingContact) {
      updateContact.run(
        "Публичный контакт клуба",
        lead.email,
        lead.phone,
        null,
        lead.email ? "email" : "phone",
        contactNotes,
        lead.address,
        lead.dgis_url,
        lead.drive,
        "open_sources_route_estimate",
        existingContact.id
      )
    } else {
      insertContact.run(
        companyId,
        "Публичный контакт клуба",
        role,
        lead.email,
        lead.phone,
        null,
        lead.email ? "email" : "phone",
        contactNotes,
        lead.address,
        lead.dgis_url,
        lead.drive,
        "open_sources_route_estimate"
      )
    }

    const dealTitle = `${segmentSeed.launch_format}: ${lead.name}`
    let dealId
    const existingDeal = selectDeal.get(companyId, dealTitle)
    if (existingDeal) {
      dealId = Number(existingDeal.id)
      updateDeal.run(stageId, monthlyRevenue, expectedCloseDate, lead.priority === "A" ? "high" : "medium", nextAction, nextActionAt, dealId)
    } else {
      const result = insertDeal.run(
        companyId,
        stageId,
        dealTitle,
        monthlyRevenue,
        expectedCloseDate,
        lead.priority === "A" ? "high" : "medium",
        nextAction,
        nextActionAt
      )
      dealId = Number(result.lastInsertRowid)
    }

    const existingLocal = selectLocal.get(lead.name, segmentSeed.label)
    const distanceBand = `${lead.drive} мин авто`
    const localNotes = `${lead.sourceNote} В CRM минуты указаны как время на авто от производства, не пешком.`
    if (existingLocal) {
      updateLocal.run(
        lead.address,
        lead.drive,
        distanceBand,
        lead.priority,
        lead.score,
        fitReason,
        offer,
        nextAction,
        lead.phone,
        lead.email,
        lead.website,
        lead.dgis_url,
        yandexSearchUrl(lead),
        lead.public_contact_url,
        lead.name,
        lead.inn ? "manual_public_match" : "not_checked",
        lead.legal_name,
        lead.inn,
        null,
        lead.inn ? "Юрданные взяты из открытой карточки/сайта; перед КП проверить реквизиты." : "Юрданные не проверены.",
        localNotes,
        existingLocal.id
      )
    } else {
      insertLocal.run(
        lead.name,
        segmentSeed.label,
        lead.address,
        lead.drive,
        distanceBand,
        lead.priority,
        lead.score,
        fitReason,
        offer,
        nextAction,
        lead.phone,
        lead.email,
        lead.website,
        lead.dgis_url,
        yandexSearchUrl(lead),
        lead.public_contact_url,
        lead.name,
        lead.inn ? "manual_public_match" : "not_checked",
        lead.legal_name,
        lead.inn,
        null,
        lead.inn ? "Юрданные взяты из открытой карточки/сайта; перед КП проверить реквизиты." : "Юрданные не проверены.",
        localNotes
      )
    }

    upsertProfile.run(
      companyId,
      lead.dgis_id,
      lead.inn,
      lead.legal_name,
      lead.address,
      lead.website,
      lead.phone,
      lead.email,
      lead.peopleMin,
      lead.peopleMax,
      "heuristic_from_pc_count_and_24_7_traffic",
      totalUnits,
      matrixQuantities.length,
      startAmount,
      sourceSummaryFor(lead, startAmount),
      lead.dailyPresent,
      lead.buyersMin,
      lead.buyersMax,
      lead.dgis_url,
      lead.drive,
      "open_sources_route_estimate"
    )

    deleteSources.run(companyId)
    insertSource.run(companyId, "public_listing", `${lead.name}: публичная карточка`, lead.public_contact_url, lead.sourceNote)
    if (lead.website && lead.website !== lead.public_contact_url) {
      insertSource.run(companyId, "official_website", `${lead.name}: сайт`, lead.website, "Сайт использован для проверки адреса, телефона или формата клуба.")
    }
    insertSource.run(companyId, "2gis", `${lead.name}: 2ГИС`, lead.dgis_url, "Ссылка на 2ГИС или поисковую карточку 2ГИС для адреса.")

    const outreachAgentId = agentIdByCode.get("outreach_writer")
    const matrixAgentId = agentIdByCode.get("sku_matrix_analyst")
    if (outreachAgentId && !existingTask.get(companyId, dealId, "computer_club_outreach")) {
      insertTask.run(
        outreachAgentId,
        companyId,
        dealId,
        "computer_club_outreach",
        lead.score,
        `Подготовь письмо и короткий скрипт звонка для ${lead.name}: предложить ${segmentSeed.launch_format}, указать ${matrixQuantities.length} SKU / ${totalUnits} порций / ${startAmount} ₽, спросить про холодильник и ответственного администратора.`,
        nextActionAt
      )
    }
    if (matrixAgentId && !existingTask.get(companyId, dealId, "computer_club_matrix_review")) {
      insertTask.run(
        matrixAgentId,
        companyId,
        dealId,
        "computer_club_matrix_review",
        lead.score - 5,
        `Проверь стартовую матрицу для компьютерного клуба ${lead.name}: вечерний и ночной поток, еда одной рукой, минимальный заказ 7000 ₽, целевой выкуп 70% за 4 дня.`,
        nextActionAt
      )
    }
  }

  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
} finally {
  db.close()
}

const launchContent = JSON.parse(readFileSync(launchContentPath, "utf-8"))
launchContent.generated_at = nowIso
launchContent.summary = launchContent.summary ?? {}
launchContent.summary.computer_club_lead_count = computerClubLeads.length
launchContent.summary.computer_club_launch_format = segmentSeed.launch_format
launchContent.summary.computer_club_updated_at = nowIso.slice(0, 10)

const launchRows = launchContent.launch_matrix ?? []
for (const lead of computerClubLeads) {
  addOrUpdateJsonRecord(
    launchRows,
    (row) => row.name === lead.name && row.package_name === segmentSeed.launch_format,
    {
      name: lead.name,
      segment: segmentSeed.label,
      priority: lead.priority,
      score: lead.score,
      walk_min: lead.drive,
      contact: [lead.phone, lead.email].filter(Boolean).join(" / "),
      package_name: segmentSeed.launch_format,
      launch_format: launchFormat,
      breakfasts: matrixText.breakfasts,
      salads: matrixText.salads,
      sandwiches: matrixText.sandwiches,
      desserts: matrixText.desserts,
      sku_count: matrixQuantities.length,
      start_amount: startAmount,
      conditions,
      offer,
      next_action: nextAction,
      kpi,
      risk,
      address: lead.address,
      dgis_url: lead.dgis_url,
      drive_minutes_from_production: lead.drive,
      source: lead.public_contact_url
    }
  )
}
launchContent.launch_matrix = launchRows

const segmentLaunches = launchContent.segment_launches ?? []
addOrUpdateJsonRecord(
  segmentLaunches,
  (row) => row.format === segmentSeed.launch_format,
  {
    format: segmentSeed.launch_format,
    lead_count: computerClubLeads.length,
    avg_start_amount: startAmount,
    breakfasts: matrixText.breakfasts,
    salads: matrixText.salads,
    sandwiches: matrixText.sandwiches,
    desserts: matrixText.desserts,
    pitch: "Запустить snack-витрину для игроков и администраторов: еда одной рукой, без кухни и ожидания доставки, с акцентом на вечерний и ночной трафик.",
    kpi
  }
)
launchContent.segment_launches = segmentLaunches

const salesScripts = launchContent.sales_scripts ?? []
addOrUpdateJsonRecord(
  salesScripts,
  (row) => row.block === "Открытие" && row.audience === segmentSeed.label,
  {
    block: "Открытие",
    audience: segmentSeed.label,
    script:
      "Добрый день. Я отвечаю за развитие продуктов Lunch Up в Санкт-Петербурге. Для компьютерных клубов мы предлагаем компактную snack-витрину: сытные сэндвичи, роллы, хот-дог, сосиску в тесте и десерты, чтобы игроки могли купить еду у администратора без ожидания доставки.",
    offer: `${segmentSeed.launch_format}: ${matrixQuantities.length} SKU / ${totalUnits} порций / ${startAmount.toLocaleString("ru-RU")} ₽ закупки Lunch Up, пилот на 4 дня.`,
    closing_question: "Кто у вас отвечает за ассортимент у администратора и есть ли холодильник или место под небольшую витрину?"
  }
)
addOrUpdateJsonRecord(
  salesScripts,
  (row) => row.block === "Квалификация" && row.audience === segmentSeed.label,
  {
    block: "Квалификация",
    audience: segmentSeed.label,
    script:
      "Мне нужно понять поток: сколько игровых мест, какие пики по вечерам и ночам, можно ли продавать еду через администратора и как сейчас решается вопрос перекуса для гостей.",
    offer: "Если место есть, начинаем с короткой матрицы без кухни и смотрим продажи по SKU до повторной поставки.",
    closing_question: "Сколько гостей обычно проходит за вечер пятницы-субботы и какие позиции сейчас чаще спрашивают: сытные или сладкие?"
  }
)
launchContent.sales_scripts = salesScripts

launchContent.summary.lead_count = launchRows.length
launchContent.summary.local_lead_count = launchRows.filter((row) => row.segment !== "Вендинг-компания").length
launchContent.summary.phone_count = launchRows.filter((row) => String(row.contact ?? "").includes("+")).length
launchContent.summary.email_count = launchRows.filter((row) => String(row.contact ?? "").includes("@")).length

writeFileSync(launchContentPath, `${JSON.stringify(launchContent, null, 2)}\n`, "utf-8")

const publicContacts = existsSync(publicContactsPath)
  ? JSON.parse(readFileSync(publicContactsPath, "utf-8"))
  : []
for (const lead of computerClubLeads) {
  addOrUpdateJsonRecord(
    publicContacts,
    (row) => row.company === lead.name,
    {
      company: lead.name,
      phone: lead.phone,
      email: lead.email,
      preferred_channel: lead.email ? "email" : "phone",
      source_url: lead.public_contact_url,
      notes: `${lead.sourceNote} Сегмент CRM: ${segmentSeed.label}; запуск: ${segmentSeed.launch_format}.`,
      address: lead.address,
      dgis_url: lead.dgis_url,
      drive_minutes_from_production: lead.drive,
      drive_minutes_source: "open_sources_route_estimate",
      production_address: "Санкт-Петербург, Уральская улица, 13"
    }
  )
}
writeFileSync(publicContactsPath, `${JSON.stringify(publicContacts, null, 2)}\n`, "utf-8")

console.log(
  JSON.stringify(
    {
      backupPath,
      segment: segmentSeed.code,
      leads: computerClubLeads.length,
      matrixSku: matrixQuantities.length,
      matrixUnits: totalUnits,
      startAmount
    },
    null,
    2
  )
)
