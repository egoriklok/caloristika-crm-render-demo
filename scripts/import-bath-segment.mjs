import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const prospectsPath = join(root, "data", "bath-spa-prospects-2026-06-06.json")
const launchContentPath = join(root, "data", "launch-crm-content.json")
const publicContactsPath = join(root, "data", "public-contacts.json")

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"))
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
}

function backupSqlite() {
  if (!existsSync(dbPath)) return null
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
  const backupPath = join(root, "data", `lunch_up_crm.backup-before-bath-segment-${stamp}.sqlite`)
  copyFileSync(dbPath, backupPath)
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${dbPath}${suffix}`
    if (existsSync(sidecar)) copyFileSync(sidecar, `${backupPath}${suffix}`)
  }
  return backupPath
}

function dgisSearchUrl(prospect) {
  const query = `${prospect.name} ${prospect.city} ${prospect.address}`.trim()
  return `https://2gis.ru/spb/search/${encodeURIComponent(query)}`
}

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeProductName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[”]+$/g, "")
}

function money(value) {
  return Math.round(value * 100) / 100
}

function priorityFromScore(score) {
  if (score >= 85) return "A"
  if (score >= 78) return "B"
  return "C"
}

function stageCodeFromLeadStatus(status) {
  return ["lead", "qualified", "contacted", "tasting", "trial", "repeat", "contract", "won"].includes(status)
    ? status
    : "lead"
}

function buildSkuStrings(skuPlan) {
  const byCategory = new Map()
  for (const group of skuPlan) {
    byCategory.set(
      group.category,
      group.items.map((item) => `${item.name} x${item.quantity}`).join("; ")
    )
  }
  return {
    breakfasts: byCategory.get("Завтраки") ?? "",
    salads: byCategory.get("Салаты") ?? "",
    sandwiches: byCategory.get("Сэндвичи") ?? "",
    desserts: byCategory.get("Десерты") ?? ""
  }
}

function buildStartAmount(catalogItems, skuPlan) {
  const priceByName = new Map(catalogItems.map((item) => [normalizeProductName(item.name), Number(item.price ?? item.wholesale_price ?? 0)]))
  let total = 0
  for (const group of skuPlan) {
    for (const item of group.items) {
      const price = priceByName.get(normalizeProductName(item.name))
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`Missing catalog price for bath SKU: ${item.name}`)
      }
      total += price * Number(item.quantity ?? 0)
    }
  }
  return money(total)
}

function upsertByKey(list, key, value, row) {
  const index = list.findIndex((item) => item[key] === value)
  if (index >= 0) {
    list[index] = { ...list[index], ...row }
  } else {
    list.push(row)
  }
}

function updateLaunchContent(input) {
  const launchContent = readJson(launchContentPath)
  const skuStrings = buildSkuStrings(input.launch_sku_plan)
  const startAmount = buildStartAmount(launchContent.catalog_analysis ?? [], input.launch_sku_plan)
  const launchFormat = input.segment.launch_format
  const leadCount = input.prospects.length

  launchContent.summary = {
    ...(launchContent.summary ?? {}),
    bath_spa_lead_count: leadCount,
    bath_spa_launch_format: launchFormat,
    bath_spa_updated_at: input.generated_at
  }

  launchContent.segment_launches ??= []
  upsertByKey(launchContent.segment_launches, "format", launchFormat, {
    format: launchFormat,
    lead_count: leadCount,
    avg_start_amount: startAmount,
    breakfasts: skuStrings.breakfasts,
    salads: skuStrings.salads,
    sandwiches: skuStrings.sandwiches,
    desserts: skuStrings.desserts,
    pitch:
      "Запустить банную fresh-витрину у ресепшена или буфета: легкие сэндвичи, завтраки, нейтральные салаты и десерты для гостей после парения и персонала смены, без новой кухни и без широкой первой закупки.",
    kpi: "Sell-through 60% за 4 дня; списания не выше 15%; 3 SKU-лидера; решение по регулярной поставке после первой недели."
  })

  launchContent.launch_matrix = (launchContent.launch_matrix ?? []).filter((row) => row.segment !== input.segment.label)
  for (const prospect of input.prospects) {
    launchContent.launch_matrix.push({
      name: prospect.name,
      segment: input.segment.label,
      priority: priorityFromScore(prospect.lead_score),
      score: prospect.lead_score,
      walk_min: null,
      drive_minutes_from_production: prospect.drive_minutes_from_production,
      contact: [prospect.phone, prospect.email].filter(Boolean).join(" / "),
      package_name: launchFormat,
      launch_format: "Fresh-витрина у ресепшена, буфета или зоны отдыха: легкая еда после парения и перекус для персонала.",
      ...skuStrings,
      sku_count: input.launch_sku_plan.reduce((sum, group) => sum + group.items.length, 0),
      start_amount: startAmount,
      conditions:
        "Мин. заказ 7 000 ₽ на точку; заказ за 2 дня до 15:00; доставка по СПб бесплатно Пн-Чт; ЛО по согласованному маршруту; оплата по счету/договору.",
      offer: prospect.offer,
      next_action: prospect.next_action,
      kpi: "Sell-through 60% за 4 дня; списания <=15%; повтор по SKU-лидерам; решение по месту витрины.",
      risk: "Проверить место холодильника, действующий буфет/ресторан, ответственного администратора и актуальность контактного канала."
    })
  }

  launchContent.objection_map ??= []
  for (const stage of ["Квалификация бань", "Операции бань"]) {
    launchContent.objection_map = launchContent.objection_map.filter((item) => item.stage !== stage)
  }
  launchContent.objection_map.push(
    {
      stage: "Квалификация бань",
      objection: "У нас уже есть буфет или ресторан, готовая еда не нужна.",
      why_it_matters: "Управляющий защищает текущий F&B-процесс и не хочет конкуренции внутри своей площадки.",
      response:
        "Мы не заменяем буфет. Предлагаем маленькую витрину как быстрый grab-and-go слой: после парения гость берет легкий перекус или десерт без ожидания кухни, а буфет получает дополнительный чек.",
      proof_or_asset: "Матрица 'Банная fresh-витрина': 10-12 SKU без сильных запахов, старт от 7 000 ₽, KPI sell-through и списаний.",
      next_question: "Где сейчас гостю удобнее всего взять легкий перекус: ресепшен, буфет, зона отдыха или отдельный холодильник?"
    },
    {
      stage: "Операции бань",
      objection: "Свежая еда быстро испортится, а списания заберут маржу.",
      why_it_matters: "Банный комплекс не хочет брать на себя прогнозирование спроса по новой категории.",
      response:
        "Поэтому стартуем не с широкой витрины, а с малой глубины и SKU с понятными сроками. Через 4 дня оставляем лидеров, слабые позиции убираем, а короткие SKU расширяем только по фактическим продажам.",
      proof_or_asset: "Пилотная матрица, сроки годности из каталога, weekly-корректировка и отчет по SKU-лидерам.",
      next_question: "Какой уровень списаний для вас допустим на первом тесте, если он дает понятный дополнительный чек?"
    }
  )

  launchContent.sales_scripts = (launchContent.sales_scripts ?? []).filter((item) => item.crm_segment_code !== input.segment.code)
  launchContent.sales_scripts.push(
    {
      block: "Открытие",
      audience: "Управляющий банного комплекса",
      crm_segment_code: input.segment.code,
      launch_format: launchFormat,
      script:
        "Добрый день. Я отвечаю за развитие продуктов Lunch Up в Санкт-Петербурге и Ленинградской области. Для банных комплексов предлагаем не общий каталог, а маленькую fresh-витрину у ресепшена или буфета: легкий перекус после парения и еда для персонала смены.",
      offer: "Пилот 8-12 SKU на 4 дня: сэндвичи, сырники, нейтральные салаты и десерты без новой кухни.",
      closing_question: "Кто у вас отвечает за буфет, ресепшен или закупку готовой еды, чтобы согласовать место витрины?"
    },
    {
      block: "Квалификация",
      audience: "F&B/буфет банного комплекса",
      crm_segment_code: input.segment.code,
      launch_format: launchFormat,
      script:
        "Сначала уточню контур, чтобы не присылать лишнее: есть ли буфет или ресторан, где стоит холодильник, какие дни дают максимальный поток, сколько гостей остается дольше двух часов и кто списывает остатки.",
      offer: "Подберем 6-12 SKU под ваш поток: без сильных запахов, с понятным сроком, малой глубиной и отчетом по продажам.",
      closing_question: "Какие 2-3 дня недели стоит взять для первого замера продаж?"
    },
    {
      block: "Предложение",
      audience: "Администратор SPA/ресепшен",
      crm_segment_code: input.segment.code,
      launch_format: launchFormat,
      script:
        "Предлагаю поставить не витрину на постоянку сразу, а тестовую банную fresh-витрину. Логика простая: гость после парения видит понятный перекус, администратор продает без ожидания кухни, а через 4 дня мы видим лидеров и списания.",
      offer: `Стартовая матрица: ${skuStrings.sandwiches}; ${skuStrings.breakfasts}; ${skuStrings.desserts}.`,
      closing_question: "Кому отправить КП с матрицей, суммой запуска и требованиями к месту?"
    },
    {
      block: "Возражение",
      audience: "Управляющий банного комплекса",
      crm_segment_code: input.segment.code,
      launch_format: launchFormat,
      script:
        "Если есть сомнение по списаниям, не расширяем ассортимент. Ставим малую глубину, считаем sell-through, оставляем SKU-лидеры и фиксируем допустимый процент списаний до регулярного заказа.",
      offer: "KPI пилота: sell-through 60% за 4 дня, списания не выше 15%, 3 SKU-лидера и решение по регулярной поставке.",
      closing_question: "Если эти метрики сойдутся, вы готовы оставить регулярную поставку на один адрес?"
    },
    {
      block: "Письмо после звонка",
      audience: "F&B/администратор банного комплекса",
      crm_segment_code: input.segment.code,
      launch_format: launchFormat,
      script:
        "Добрый день. По итогам разговора отправляю вариант запуска Lunch Up для банного комплекса: маленькая fresh-витрина у ресепшена/буфета, 8-12 SKU, старт от 7 000 ₽, заказ за 2 дня до 15:00, проверка продаж и списаний через 4 дня.",
      offer: "В приложении к КП: SKU, цена, роль позиции, условия поставки, KPI пилота и вопросы по месту витрины.",
      closing_question: "Подскажите, пожалуйста, кто подтвердит место холодильника и дату тестовой поставки?"
    }
  )

  writeJson(launchContentPath, launchContent)
  return { startAmount, skuStrings, launchFormat }
}

function updatePublicContacts(input) {
  const currentNames = new Set(input.prospects.map((prospect) => prospect.name))
  const removedBathProspects = new Set(["Муринские бани"])
  const publicContacts = (existsSync(publicContactsPath) ? readJson(publicContactsPath) : []).filter(
    (contact) => currentNames.has(contact.company) || !removedBathProspects.has(contact.company)
  )
  for (const prospect of input.prospects) {
    const row = {
      company: prospect.name,
      phone: clean(prospect.phone),
      email: clean(prospect.email),
      preferred_channel: clean(prospect.email) ? "email" : "phone",
      source_url: prospect.source_url,
      notes: prospect.public_contact_note,
      address: `${prospect.city}, ${prospect.address}`,
      dgis_url: dgisSearchUrl(prospect),
      drive_minutes_from_production: prospect.drive_minutes_from_production,
      drive_minutes_source: "estimated_from_public_address",
      production_address: input.production_address
    }
    const index = publicContacts.findIndex((item) => item.company === prospect.name)
    if (index >= 0) {
      publicContacts[index] = { ...publicContacts[index], ...row }
    } else {
      publicContacts.push(row)
    }
  }
  writeJson(publicContactsPath, publicContacts)
}

function importDb(input, launchMeta) {
  const db = new DatabaseSync(dbPath)
  db.exec("PRAGMA foreign_keys = ON")
  db.exec("BEGIN")
  try {
    db.prepare(
      `
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
      `
    ).run(
      input.segment.code,
      input.segment.label,
      input.segment.direction_code,
      input.segment.direction_label,
      "Офисы, смены, кампусы, клиники и бани",
      2,
      50,
      input.segment.launch_format
    )

    const currentProspectNames = new Set(input.prospects.map((prospect) => prospect.name))
    const staleBathCompanies = db
      .prepare("SELECT id, name FROM companies WHERE segment = ? AND source = ?")
      .all(input.segment.code, "bath_spa_public_research")
      .filter((company) => !currentProspectNames.has(String(company.name)))
    const deleteActivities = db.prepare("DELETE FROM activities WHERE company_id = ?")
    const deleteContacts = db.prepare("DELETE FROM contacts WHERE company_id = ?")
    const deleteDeals = db.prepare("DELETE FROM deals WHERE company_id = ?")
    const deleteCompany = db.prepare("DELETE FROM companies WHERE id = ?")
    for (const company of staleBathCompanies) {
      const companyId = Number(company.id)
      deleteActivities.run(companyId)
      deleteContacts.run(companyId)
      deleteDeals.run(companyId)
      deleteCompany.run(companyId)
    }

    const insertCompany = db.prepare(
      `
      INSERT INTO companies(
        name, segment, region, city, district, website, public_contact_url, source,
        lead_status, lead_score, fit_reason, notes, address, dgis_url,
        drive_minutes_from_production, drive_minutes_source
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    const updateCompany = db.prepare(
      `
      UPDATE companies SET
        segment = ?, region = ?, city = ?, district = ?, website = ?, public_contact_url = ?, source = ?,
        lead_status = ?, lead_score = ?, fit_reason = ?, notes = ?, address = ?, dgis_url = ?,
        drive_minutes_from_production = ?, drive_minutes_source = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    )
    const selectCompany = db.prepare("SELECT id FROM companies WHERE name = ?")
    const selectStage = db.prepare("SELECT id FROM pipeline_stages WHERE code = ?")
    const selectContact = db.prepare("SELECT id FROM contacts WHERE company_id = ? AND role = ?")
    const insertContact = db.prepare(
      `
      INSERT INTO contacts(
        company_id, name, role, email, phone, preferred_channel, is_public, consent_basis, notes,
        address, dgis_url, drive_minutes_from_production, drive_minutes_source
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `
    )
    const updateContact = db.prepare(
      `
      UPDATE contacts SET
        email = ?, phone = ?, preferred_channel = ?, is_public = 1, consent_basis = ?, notes = ?,
        address = ?, dgis_url = ?, drive_minutes_from_production = ?, drive_minutes_source = ?
      WHERE id = ?
      `
    )
    const selectDeal = db.prepare("SELECT id FROM deals WHERE company_id = ? AND title = ?")
    const insertDeal = db.prepare(
      `
      INSERT INTO deals(
        company_id, stage_id, title, estimated_monthly_revenue, expected_close_date, priority,
        owner, next_action, next_action_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    const updateDeal = db.prepare(
      `
      UPDATE deals SET
        stage_id = ?, estimated_monthly_revenue = ?, expected_close_date = ?, priority = ?,
        owner = ?, next_action = ?, next_action_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    )
    const selectActivity = db.prepare("SELECT id FROM activities WHERE company_id = ? AND subject = ?")
    const insertActivity = db.prepare(
      "INSERT INTO activities(company_id, type, subject, notes, due_at, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    )

    for (const prospect of input.prospects) {
      const existing = selectCompany.get(prospect.name)
      const dgisUrl = dgisSearchUrl(prospect)
      const notes = [
        prospect.public_contact_note,
        `Оффер: ${prospect.offer}`,
        `Следующее действие: ${prospect.next_action}`,
        `Источник: ${prospect.source_url}`
      ].join("\n")
      const companyArgs = [
        input.segment.code,
        prospect.region,
        prospect.city,
        prospect.district,
        clean(prospect.website),
        prospect.source_url,
        "bath_spa_public_research",
        stageCodeFromLeadStatus(prospect.lead_status),
        prospect.lead_score,
        prospect.fit_reason,
        notes,
        prospect.address,
        dgisUrl,
        prospect.drive_minutes_from_production,
        "estimated_from_public_address"
      ]
      let companyId
      if (existing) {
        companyId = Number(existing.id)
        updateCompany.run(...companyArgs, companyId)
      } else {
        const result = insertCompany.run(prospect.name, ...companyArgs)
        companyId = Number(result.lastInsertRowid)
      }

      const role = prospect.contact_role
      const contactName = `${prospect.name}: публичный контакт`
      const preferredChannel = clean(prospect.email) ? "email" : "phone"
      const consentBasis = `Публичная страница контактов: ${prospect.source_url}`
      const contactNotes = `${prospect.public_contact_note}\n${prospect.next_action}`
      const existingContact = selectContact.get(companyId, role)
      if (existingContact) {
        updateContact.run(
          clean(prospect.email),
          clean(prospect.phone),
          preferredChannel,
          consentBasis,
          contactNotes,
          `${prospect.city}, ${prospect.address}`,
          dgisUrl,
          prospect.drive_minutes_from_production,
          "estimated_from_public_address",
          Number(existingContact.id)
        )
      } else {
        insertContact.run(
          companyId,
          contactName,
          role,
          clean(prospect.email),
          clean(prospect.phone),
          preferredChannel,
          consentBasis,
          contactNotes,
          `${prospect.city}, ${prospect.address}`,
          dgisUrl,
          prospect.drive_minutes_from_production,
          "estimated_from_public_address"
        )
      }

      const stageCode = stageCodeFromLeadStatus(prospect.lead_status)
      const stage = selectStage.get(stageCode) ?? selectStage.get("lead")
      const title = `${input.segment.launch_format}: ${prospect.name}`
      const monthlyRevenue = Math.round(launchMeta.startAmount * (prospect.lead_score >= 85 ? 9 : prospect.lead_score >= 78 ? 6 : 4))
      const dueAt = "2026-06-13 11:00:00"
      const expectedCloseDate = "2026-06-30"
      const existingDeal = selectDeal.get(companyId, title)
      if (existingDeal) {
        updateDeal.run(
          Number(stage.id),
          monthlyRevenue,
          expectedCloseDate,
          priorityFromScore(prospect.lead_score),
          "Директор по развитию продуктов",
          prospect.next_action,
          dueAt,
          Number(existingDeal.id)
        )
      } else {
        insertDeal.run(
          companyId,
          Number(stage.id),
          title,
          monthlyRevenue,
          expectedCloseDate,
          priorityFromScore(prospect.lead_score),
          "Директор по развитию продуктов",
          prospect.next_action,
          dueAt
        )
      }

      const subject = `Банный сегмент: первичный outreach ${prospect.name}`
      if (!selectActivity.get(companyId, subject)) {
        insertActivity.run(
          companyId,
          "outreach",
          subject,
          `${prospect.offer}\n\n${prospect.next_action}`,
          dueAt,
          "Директор по развитию продуктов"
        )
      }
    }

    db.prepare("DELETE FROM matrix_items WHERE matrix_id IN (SELECT id FROM segment_matrices WHERE segment = ?)").run(input.segment.code)
    db.prepare("DELETE FROM segment_matrices WHERE segment = ?").run(input.segment.code)
    const matrixResult = db
      .prepare("INSERT INTO segment_matrices(segment, name, target_sku_count, rationale) VALUES (?, ?, ?, ?)")
      .run(
        input.segment.code,
        "Бани/SPA: fresh-витрина у ресепшена",
        "10-12 SKU",
        "Легкая еда без сильных запахов для гостей после парения и персонала смены; старт малой глубиной, контроль sell-through и списаний через 4 дня."
      )
    const matrixId = Number(matrixResult.lastInsertRowid)
    const selectProduct = db.prepare("SELECT id FROM products WHERE name = ? AND is_active = 1")
    const insertMatrixItem = db.prepare("INSERT INTO matrix_items(matrix_id, product_id, role, priority) VALUES (?, ?, ?, ?)")
    let priority = 1
    for (const group of input.launch_sku_plan) {
      for (const item of group.items) {
        const product = selectProduct.get(item.name)
        if (!product) throw new Error(`Missing product for bath matrix: ${item.name}`)
        insertMatrixItem.run(matrixId, Number(product.id), item.role, priority)
        priority += 1
      }
    }

    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  } finally {
    db.close()
  }
}

if (!existsSync(prospectsPath)) throw new Error(`Missing bath prospects file: ${prospectsPath}`)
if (!existsSync(launchContentPath)) throw new Error(`Missing launch content: ${launchContentPath}`)
if (!existsSync(dbPath)) throw new Error(`Missing SQLite database: ${dbPath}`)

const input = readJson(prospectsPath)
const backupPath = backupSqlite()
const launchMeta = updateLaunchContent(input)
updatePublicContacts(input)
importDb(input, launchMeta)

console.log(
  JSON.stringify(
    {
      ok: true,
      segment: input.segment.code,
      prospects: input.prospects.length,
      launch_format: launchMeta.launchFormat,
      start_amount: launchMeta.startAmount,
      backup: backupPath
    },
    null,
    2
  )
)
