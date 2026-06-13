import type { DatabaseSync } from "node:sqlite"

export type CrmSegmentSeed = {
  code: string
  label: string
  direction_code: string
  direction_label: string
  direction_description: string
  direction_position: number
  segment_position: number
  launch_format: string
}

export const crmSegmentSeeds: CrmSegmentSeed[] = [
  {
    code: "coffee_bakery",
    label: "Кофейни/пекарни",
    direction_code: "coffee_retail",
    direction_label: "Кофе и локальный ритейл",
    direction_description: "Кофе, АЗС, магазины и fresh-полка",
    direction_position: 1,
    segment_position: 10,
    launch_format: "Еда к кофе"
  },
  {
    code: "coffee_chain",
    label: "Кофейные сети",
    direction_code: "coffee_retail",
    direction_label: "Кофе и локальный ритейл",
    direction_description: "Кофе, АЗС, магазины и fresh-полка",
    direction_position: 1,
    segment_position: 20,
    launch_format: "Еда к кофе"
  },
  {
    code: "gas_station",
    label: "АЗС",
    direction_code: "coffee_retail",
    direction_label: "Кофе и локальный ритейл",
    direction_description: "Кофе, АЗС, магазины и fresh-полка",
    direction_position: 1,
    segment_position: 30,
    launch_format: "Ритейл fresh-полка"
  },
  {
    code: "retail_store",
    label: "Магазины",
    direction_code: "coffee_retail",
    direction_label: "Кофе и локальный ритейл",
    direction_description: "Кофе, АЗС, магазины и fresh-полка",
    direction_position: 1,
    segment_position: 40,
    launch_format: "Ритейл fresh-полка"
  },
  {
    code: "retail_cluster",
    label: "Ритейл-кластеры",
    direction_code: "coffee_retail",
    direction_label: "Кофе и локальный ритейл",
    direction_description: "Кофе, АЗС, магазины и fresh-полка",
    direction_position: 1,
    segment_position: 50,
    launch_format: "Ритейл fresh-полка"
  },
  {
    code: "office_cluster",
    label: "Офисные кластеры",
    direction_code: "workplace",
    direction_label: "Рабочие и учебные локации",
    direction_description: "Офисы, смены, кампусы, клиники, бани и компьютерные клубы",
    direction_position: 2,
    segment_position: 10,
    launch_format: "Офисная витрина"
  },
  {
    code: "production_logistics",
    label: "Склады/производство",
    direction_code: "workplace",
    direction_label: "Рабочие и учебные локации",
    direction_description: "Офисы, смены, кампусы, клиники, бани и компьютерные клубы",
    direction_position: 2,
    segment_position: 20,
    launch_format: "Сытная смена"
  },
  {
    code: "education_campus",
    label: "Образовательные кампусы",
    direction_code: "workplace",
    direction_label: "Рабочие и учебные локации",
    direction_description: "Офисы, смены, кампусы, клиники, бани и компьютерные клубы",
    direction_position: 2,
    segment_position: 30,
    launch_format: "Коворкинг холодильник"
  },
  {
    code: "healthcare_clinic",
    label: "Клиники/медцентры",
    direction_code: "workplace",
    direction_label: "Рабочие и учебные локации",
    direction_description: "Офисы, смены, кампусы, клиники, бани и компьютерные клубы",
    direction_position: 2,
    segment_position: 40,
    launch_format: "Медицинский персонал"
  },
  {
    code: "bath_spa",
    label: "Бани/SPA-комплексы",
    direction_code: "workplace",
    direction_label: "Рабочие и учебные локации",
    direction_description: "Офисы, смены, кампусы, клиники, бани и компьютерные клубы",
    direction_position: 2,
    segment_position: 50,
    launch_format: "Банная fresh-витрина"
  },
  {
    code: "computer_club",
    label: "Компьютерные клубы",
    direction_code: "workplace",
    direction_label: "Рабочие и учебные локации",
    direction_description: "Офисы, смены, кампусы, клиники, бани и компьютерные клубы",
    direction_position: 2,
    segment_position: 60,
    launch_format: "Компьютерный клуб snack-витрина"
  },
  {
    code: "vending_micromarket",
    label: "Вендинг/микромаркеты",
    direction_code: "operators",
    direction_label: "Операторы и инфраструктура",
    direction_description: "Вендинг, столовые, rail и якоря ЛО",
    direction_position: 3,
    segment_position: 10,
    launch_format: "Вендинг-партнер"
  },
  {
    code: "foodservice_operator",
    label: "Операторы питания/столовые",
    direction_code: "operators",
    direction_label: "Операторы и инфраструктура",
    direction_description: "Вендинг, столовые, rail и якоря ЛО",
    direction_position: 3,
    segment_position: 20,
    launch_format: "Сытная смена"
  },
  {
    code: "rail_partner",
    label: "Rail-партнеры/Uvenco",
    direction_code: "operators",
    direction_label: "Операторы и инфраструктура",
    direction_description: "Вендинг, столовые, rail и якоря ЛО",
    direction_position: 3,
    segment_position: 30,
    launch_format: "Вендинг-партнер"
  },
  {
    code: "lo_anchor",
    label: "Якорные клиенты ЛО",
    direction_code: "operators",
    direction_label: "Операторы и инфраструктура",
    direction_description: "Вендинг, столовые, rail и якоря ЛО",
    direction_position: 3,
    segment_position: 40,
    launch_format: "Сытная смена"
  },
  {
    code: "horeca_cluster",
    label: "HoReCa-кластеры",
    direction_code: "horeca",
    direction_label: "HoReCa и готовая еда",
    direction_description: "Площадки, отели, кейтеринг и F&B",
    direction_position: 4,
    segment_position: 10,
    launch_format: "Сытная смена"
  },
  {
    code: "horeca_ready_food",
    label: "Готовая еда",
    direction_code: "horeca",
    direction_label: "HoReCa и готовая еда",
    direction_description: "Площадки, отели, кейтеринг и F&B",
    direction_position: 4,
    segment_position: 20,
    launch_format: "Сытная смена"
  },
  {
    code: "residential_apart",
    label: "ЖК/апарт-комплексы",
    direction_code: "residential_transport",
    direction_label: "ЖК и транспорт",
    direction_description: "Дом, дорога и высокий поток",
    direction_position: 5,
    segment_position: 10,
    launch_format: "Коворкинг холодильник"
  },
  {
    code: "transport_cluster",
    label: "Транспорт",
    direction_code: "residential_transport",
    direction_label: "ЖК и транспорт",
    direction_description: "Дом, дорога и высокий поток",
    direction_position: 5,
    segment_position: 20,
    launch_format: "Сытная смена"
  },
]

export const crmSegmentsTableSql = `
CREATE TABLE IF NOT EXISTS crm_segments (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  direction_code TEXT NOT NULL,
  direction_label TEXT NOT NULL,
  direction_description TEXT NOT NULL,
  direction_position INTEGER NOT NULL,
  segment_position INTEGER NOT NULL,
  launch_format TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`

export function syncCrmSegments(db: DatabaseSync) {
  db.exec(crmSegmentsTableSql)
  db.exec("CREATE INDEX IF NOT EXISTS idx_crm_segments_direction ON crm_segments(direction_position, segment_position, direction_code)")
  const upsert = db.prepare(`
    INSERT INTO crm_segments(
      code,
      label,
      direction_code,
      direction_label,
      direction_description,
      direction_position,
      segment_position,
      launch_format,
      is_active,
      updated_at
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
  `)
  const knownCodes = new Set(crmSegmentSeeds.map((segment) => segment.code))
  db.exec("BEGIN")
  try {
    for (const segment of crmSegmentSeeds) {
      upsert.run(
        segment.code,
        segment.label,
        segment.direction_code,
        segment.direction_label,
        segment.direction_description,
        segment.direction_position,
        segment.segment_position,
        segment.launch_format
      )
    }
    const existing = db.prepare("SELECT code FROM crm_segments").all() as Array<{ code: string }>
    const deactivate = db.prepare("UPDATE crm_segments SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE code = ?")
    for (const row of existing) {
      if (!knownCodes.has(row.code)) deactivate.run(row.code)
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}
