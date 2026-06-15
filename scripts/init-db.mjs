import { DatabaseSync } from "node:sqlite"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dbPath = join(root, "data", "lunch_up_crm.sqlite")
const publicContactsPath = join(root, "data", "public-contacts.json")
const productDetailsPath = join(root, "data", "product-details-from-assortment.json")
const productPhotosPath = join(root, "data", "product-photos.json")
const publicContacts = existsSync(publicContactsPath)
  ? JSON.parse(readFileSync(publicContactsPath, "utf-8"))
  : []
const publicContactByCompany = new Map(publicContacts.map((item) => [item.company, item]))
const productDetails = existsSync(productDetailsPath)
  ? JSON.parse(readFileSync(productDetailsPath, "utf-8")).products ?? []
  : []

function normalizeProductPhotoKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»“”"]/g, "")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const productDetailsByBarcode = new Map(productDetails.map((item) => [String(item.barcode), item]))
const productDetailsByName = new Map(productDetails.map((item) => [String(item.name).trim().toLowerCase(), item]))
const productPhotos = existsSync(productPhotosPath)
  ? JSON.parse(readFileSync(productPhotosPath, "utf-8")).items ?? []
  : []
const productPhotosByName = new Map(productPhotos.map((item) => [normalizeProductPhotoKey(item.name), item]))

mkdirSync(join(root, "data"), { recursive: true })
rmSync(dbPath, { force: true })

const db = new DatabaseSync(dbPath)

db.exec(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crm_segments (
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

CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  segment TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  address TEXT,
  dgis_url TEXT,
  drive_minutes_from_production INTEGER,
  drive_minutes_source TEXT,
  website TEXT,
  public_contact_url TEXT,
  telegram_url TEXT,
  telegram_username TEXT,
  telegram_channel_type TEXT NOT NULL DEFAULT 'unknown',
  telegram_contact_status TEXT NOT NULL DEFAULT 'not_found',
  telegram_source_url TEXT,
  telegram_source_note TEXT,
  telegram_discovered_at TEXT,
  agent_contact_policy TEXT NOT NULL DEFAULT 'manual_review_required',
  agent_contact_readiness TEXT NOT NULL DEFAULT 'none',
  agent_contact_next_step TEXT,
  source TEXT NOT NULL,
  lead_status TEXT NOT NULL DEFAULT 'new',
  lead_score INTEGER NOT NULL DEFAULT 50,
  fit_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  dgis_url TEXT,
  drive_minutes_from_production INTEGER,
  drive_minutes_source TEXT,
  telegram_handle TEXT,
  preferred_channel TEXT NOT NULL DEFAULT 'site',
  is_public INTEGER NOT NULL DEFAULT 1,
  consent_basis TEXT NOT NULL DEFAULT 'public_business_channel',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL UNIQUE,
  probability INTEGER NOT NULL
);

CREATE TABLE deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  estimated_monthly_revenue REAL NOT NULL DEFAULT 0,
  expected_close_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  owner TEXT NOT NULL DEFAULT 'Директор по продажам',
  next_action TEXT,
  next_action_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  notes TEXT,
  due_at TEXT,
  completed_at TEXT,
  created_by TEXT NOT NULL DEFAULT 'AI Sales Ops',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  net_weight TEXT,
  shelf_life_days INTEGER,
  wholesale_price REAL NOT NULL,
  composition TEXT,
  nutrition TEXT,
  image_url TEXT,
  product_url TEXT,
  image_source TEXT,
  image_match TEXT,
  image_note TEXT,
  site_title TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_file TEXT NOT NULL DEFAULT 'Внешний Ассортимент Lunch-UP 2026.docx',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE segment_matrices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment TEXT NOT NULL,
  name TEXT NOT NULL,
  target_sku_count TEXT NOT NULL,
  rationale TEXT NOT NULL
);

CREATE TABLE matrix_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matrix_id INTEGER NOT NULL REFERENCES segment_matrices(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  UNIQUE(matrix_id, product_id)
);

CREATE TABLE bot_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT,
  telegram_chat_id TEXT UNIQUE,
  display_name TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'new',
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE miniapp_customer_profiles (
  telegram_chat_id TEXT PRIMARY KEY,
  company_name TEXT,
  inn TEXT,
  contact_name TEXT,
  role TEXT,
  phone TEXT,
  email TEXT,
  delivery_address TEXT,
  website TEXT,
  office_people INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_type TEXT NOT NULL,
  identity_key TEXT NOT NULL UNIQUE,
  bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  email TEXT,
  telegram_chat_id TEXT,
  verified_at TEXT,
  warnings_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE SET NULL,
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  delivery_method TEXT NOT NULL DEFAULT 'delivery',
  delivery_address TEXT,
  delivery_date TEXT,
  payment_date TEXT,
  instructions TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'invoice',
  manager_comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE inventory_positions (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  on_hand_quantity INTEGER NOT NULL DEFAULT 48,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 18,
  target_stock INTEGER NOT NULL DEFAULT 96,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  quantity_delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telegram_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telegram_copilot_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE SET NULL,
  telegram_event_id INTEGER UNIQUE REFERENCES telegram_events(id) ON DELETE SET NULL,
  telegram_chat_id TEXT NOT NULL,
  telegram_user_id TEXT,
  telegram_message_id TEXT,
  sender_display_name TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  message_kind TEXT NOT NULL DEFAULT 'text',
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_reply',
  ai_task_id INTEGER REFERENCES ai_tasks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telegram_copilot_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES telegram_copilot_messages(id) ON DELETE CASCADE,
  bot_customer_id INTEGER REFERENCES bot_customers(id) ON DELETE SET NULL,
  ai_task_id INTEGER REFERENCES ai_tasks(id) ON DELETE SET NULL,
  draft_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  safety_note TEXT NOT NULL DEFAULT 'Отправка только после подтверждения менеджером. Личный Telegram-аккаунт не используется.',
  reviewed_by TEXT,
  telegram_result_json TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mission TEXT NOT NULL,
  trigger_rule TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE ai_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  result_summary TEXT,
  result_json TEXT,
  locked_at TEXT,
  locked_by TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE ai_task_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  agent_code TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  error TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE ai_agent_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_code TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  content_json TEXT NOT NULL,
  source_task_id INTEGER REFERENCES ai_tasks(id) ON DELETE SET NULL,
  confidence TEXT NOT NULL DEFAULT 'medium',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_code, company_id, memory_type, memory_key)
);

CREATE TABLE cjm_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  customer_goal TEXT NOT NULL,
  lunch_up_action TEXT NOT NULL,
  metric TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_enrichment_profiles (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  dgis_id TEXT,
  dgis_url TEXT,
  inn TEXT,
  legal_name TEXT,
  address TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  employee_count_fns INTEGER,
  employee_count_2gis INTEGER,
  employee_count_website INTEGER,
  office_people_min INTEGER NOT NULL,
  office_people_max INTEGER NOT NULL,
  office_people_confidence TEXT NOT NULL,
  office_people_method TEXT NOT NULL,
  office_people_daily_present INTEGER,
  likely_buyers_min INTEGER,
  likely_buyers_max INTEGER,
  recommended_portions INTEGER NOT NULL,
  recommended_sku INTEGER NOT NULL,
  estimated_launch_budget REAL NOT NULL,
  drive_minutes_from_production INTEGER,
  drive_minutes_source TEXT,
  source_summary TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_enrichment_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE integration_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  endpoint TEXT,
  request_json TEXT NOT NULL,
  response_status INTEGER,
  response_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_segment_status ON companies(segment, lead_status, lead_score DESC);
CREATE INDEX idx_companies_geo ON companies(region, city, district);
CREATE INDEX idx_companies_telegram_status ON companies(telegram_contact_status, agent_contact_readiness);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_deals_stage_next ON deals(stage_id, next_action_at);
CREATE INDEX idx_deals_company ON deals(company_id);
CREATE INDEX idx_activities_due ON activities(due_at, completed_at);
CREATE INDEX idx_products_category_active ON products(category, is_active);
CREATE INDEX idx_orders_status_delivery ON orders(status, delivery_date);
CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_bot_customers_chat ON bot_customers(telegram_chat_id);
CREATE INDEX idx_customer_identities_bot_customer ON customer_identities(bot_customer_id);
CREATE INDEX idx_customer_identities_company ON customer_identities(company_id);
CREATE INDEX idx_telegram_copilot_messages_status ON telegram_copilot_messages(status, created_at DESC);
CREATE INDEX idx_telegram_copilot_messages_chat ON telegram_copilot_messages(telegram_chat_id, created_at DESC);
CREATE INDEX idx_telegram_copilot_drafts_status ON telegram_copilot_drafts(status, created_at DESC);
CREATE INDEX idx_inventory_positions_available ON inventory_positions(on_hand_quantity, reserved_quantity, reorder_point);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id, created_at);
CREATE INDEX idx_inventory_movements_order ON inventory_movements(order_id);
CREATE INDEX idx_ai_tasks_status_due ON ai_tasks(status, due_at, priority DESC);
CREATE INDEX idx_ai_tasks_company ON ai_tasks(company_id);
CREATE INDEX idx_ai_tasks_worker_claim ON ai_tasks(status, priority DESC, due_at, attempts);
CREATE INDEX idx_ai_task_runs_task ON ai_task_runs(task_id, started_at);
CREATE INDEX idx_ai_agent_memories_lookup ON ai_agent_memories(agent_code, company_id, memory_type);
CREATE INDEX idx_company_enrichment_sources_company ON company_enrichment_sources(company_id);
CREATE INDEX idx_integration_events_order ON integration_events(order_id);
CREATE INDEX idx_integration_events_provider_status ON integration_events(provider, status);
CREATE INDEX idx_crm_segments_direction ON crm_segments(direction_position, segment_position, direction_code);
`)

const insertSetting = db.prepare("INSERT INTO settings(key, value, description) VALUES (?, ?, ?)")
const settings = [
  ["min_order_amount", "7000", "Минимальный заказ на одну торговую точку, руб."],
  ["free_delivery_city", "Санкт-Петербург", "Бесплатная доставка действует по городу Санкт-Петербургу."],
  ["free_delivery_days", "Понедельник-четверг", "Дни бесплатной доставки по Санкт-Петербургу."],
  [
    "lo_delivery_terms",
    "Ленинградская область: подключение второй волной через якорных клиентов, согласованные маршруты и индивидуальные условия доставки.",
    "Условия запуска Ленинградской области не равны бесплатной городской доставке СПб."
  ],
  ["order_lead_time_days", "2", "Заказ оформляется за 2 дня."],
  ["order_cutoff_time", "15:00", "Заказ до 15:00 принимается на послезавтра."],
  ["payment_terms", "Счет; возможен договор с отсрочкой 5 дней и накладной", "Условия оплаты для юридических лиц."],
  ["customer_type", "Юридические лица", "Основной формат клиентов Lunch Up."],
  ["launch_region", "Санкт-Петербург и Ленинградская область", "География текущего продвижения."],
  ["active_strategy_token", "209498707_lunch_up_spb_lo_20260604", "Активная стратегия Mini App по умолчанию."],
  ["active_strategy_package", "lunch_up_spb_lo_20260604", "Подключенный пакет стратегии."]
]
settings.forEach((row) => insertSetting.run(...row))

const insertCrmSegment = db.prepare(`
  INSERT INTO crm_segments(
    code,
    label,
    direction_code,
    direction_label,
    direction_description,
    direction_position,
    segment_position,
    launch_format
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
const crmSegments = [
  ["coffee_bakery", "Кофейни/пекарни", "coffee_retail", "Кофе и локальный ритейл", "Кофе, АЗС, магазины и fresh-полка", 1, 10, "Еда к кофе"],
  ["coffee_chain", "Кофейные сети", "coffee_retail", "Кофе и локальный ритейл", "Кофе, АЗС, магазины и fresh-полка", 1, 20, "Еда к кофе"],
  ["gas_station", "АЗС", "coffee_retail", "Кофе и локальный ритейл", "Кофе, АЗС, магазины и fresh-полка", 1, 30, "Ритейл fresh-полка"],
  ["retail_store", "Магазины", "coffee_retail", "Кофе и локальный ритейл", "Кофе, АЗС, магазины и fresh-полка", 1, 40, "Ритейл fresh-полка"],
  ["retail_cluster", "Ритейл-кластеры", "coffee_retail", "Кофе и локальный ритейл", "Кофе, АЗС, магазины и fresh-полка", 1, 50, "Ритейл fresh-полка"],
  ["office_cluster", "Офисные кластеры", "workplace", "Рабочие и учебные локации", "Офисы, смены, кампусы, клиники, бани и компьютерные клубы", 2, 10, "Офисная витрина"],
  ["production_logistics", "Склады/производство", "workplace", "Рабочие и учебные локации", "Офисы, смены, кампусы, клиники, бани и компьютерные клубы", 2, 20, "Сытная смена"],
  ["education_campus", "Образовательные кампусы", "workplace", "Рабочие и учебные локации", "Офисы, смены, кампусы, клиники, бани и компьютерные клубы", 2, 30, "Коворкинг холодильник"],
  ["healthcare_clinic", "Клиники/медцентры", "workplace", "Рабочие и учебные локации", "Офисы, смены, кампусы, клиники, бани и компьютерные клубы", 2, 40, "Медицинский персонал"],
  ["bath_spa", "Бани/SPA-комплексы", "workplace", "Рабочие и учебные локации", "Офисы, смены, кампусы, клиники, бани и компьютерные клубы", 2, 50, "Банная fresh-витрина"],
  ["computer_club", "Компьютерные клубы", "workplace", "Рабочие и учебные локации", "Офисы, смены, кампусы, клиники, бани и компьютерные клубы", 2, 60, "Компьютерный клуб snack-витрина"],
  ["vending_micromarket", "Вендинг/микромаркеты", "operators", "Операторы и инфраструктура", "Вендинг, столовые, rail и якоря ЛО", 3, 10, "Вендинг-партнер"],
  ["foodservice_operator", "Операторы питания/столовые", "operators", "Операторы и инфраструктура", "Вендинг, столовые, rail и якоря ЛО", 3, 20, "Сытная смена"],
  ["rail_partner", "Rail-партнеры/Uvenco", "operators", "Операторы и инфраструктура", "Вендинг, столовые, rail и якоря ЛО", 3, 30, "Вендинг-партнер"],
  ["lo_anchor", "Якорные клиенты ЛО", "operators", "Операторы и инфраструктура", "Вендинг, столовые, rail и якоря ЛО", 3, 40, "Сытная смена"],
  ["horeca_cluster", "HoReCa-кластеры", "horeca", "HoReCa и готовая еда", "Площадки, отели, кейтеринг и F&B", 4, 10, "Сытная смена"],
  ["horeca_ready_food", "Готовая еда", "horeca", "HoReCa и готовая еда", "Площадки, отели, кейтеринг и F&B", 4, 20, "Сытная смена"],
  ["residential_apart", "ЖК/апарт-комплексы", "residential_transport", "ЖК и транспорт", "Дом, дорога и высокий поток", 5, 10, "Коворкинг холодильник"],
  ["transport_cluster", "Транспорт", "residential_transport", "ЖК и транспорт", "Дом, дорога и высокий поток", 5, 20, "Сытная смена"]
]
crmSegments.forEach((row) => insertCrmSegment.run(...row))

const insertStage = db.prepare("INSERT INTO pipeline_stages(code, name, position, probability) VALUES (?, ?, ?, ?)")
const stages = [
  ["lead", "Новый лид", 1, 5],
  ["qualified", "Квалифицирован", 2, 15],
  ["contacted", "Контакт установлен", 3, 25],
  ["tasting", "Дегустация", 4, 40],
  ["trial", "Пробная поставка", 5, 55],
  ["repeat", "Повторный заказ", 6, 75],
  ["contract", "Договор/сеть", 7, 90],
  ["won", "Активный клиент", 8, 100],
  ["lost", "Потерян", 9, 0]
]
stages.forEach((row) => insertStage.run(...row))

const products = [
  ["Завтраки", "Блинчики кура с грибами", "2102603000017", "150 г", 5, 99.75],
  ["Завтраки", "Блинчики с ветчиной и сыром", "2102486000012", "150 г", 5, 96.60],
  ["Завтраки", "Запеканка творожная с изюмом", "2102483000015", "150 г", 10, 99.02],
  ["Завтраки", "Сырники с творогом", "2102481000017", "120 г", 10, 89.25],
  ["Десерты", "Десерт «Тирамису»", "2102384000015", "110 г", 5, 120.75],
  ["Десерты", "Десерт «Морковный кекс»", "2106250000017", "120 г", 10, 85.00],
  ["Десерты", "Десерт «Наполеон»", "2102473000018", "120 г", 5, 105.00],
  ["Десерты", "Десерт «Чизкейк клубничный»", "2102803000015", "150 г", 5, 126.00],
  ["Десерты", "Десерт «Шарлотка с яблоком»", "2106252000015", "120 г", 5, 83.00],
  ["Десерты", "Десерт Чизкейк «Персик»", "2127540000012", "170 г", 5, 122.00],
  ["Десерты", "Десерт «Медовик»", "2000032737422", "130 г", 10, 89.25],
  ["Десерты", "Десерт «Картошка классическая»", "2102387000012", "80 г", 10, 97.65],
  ["Десерты", "Десерт «Песочная полоска»", "2000032737415", "100 г", 10, 92.40],
  ["Десерты", "Десерт «Кофейный»", "2127427000012", "130 г", 10, 95.00],
  ["Десерты", "Сочень с творогом", "2000032737446", "100 г", 10, 82.95],
  ["Салаты", "Салат «Боул с курицей»", "2127301000015", "280 г", 3, 205.00],
  ["Салаты", "Салат «Греческий»", "2000032737378", "150 г", 5, 157.00],
  ["Салаты", "Салат «Винегрет»", "2102459000018", "150 г", 5, 78.75],
  ["Салаты", "Салат «Витаминный»", "4607105667952", "150 г", 5, 69.30],
  ["Салаты", "Салат «Крабовый»", "2100080000018", "150 г", 5, 98.15],
  ["Салаты", "Салат «Фунчоза с овощами»", "2127579000014", "150 г", 5, 93.00],
  ["Салаты", "Салат «Сельдь под шубой»", "2102457000010", "150 г", 5, 87.15],
  ["Салаты", "Салат «Оливье с ветчиной»", "2000032737521", "150 г", 5, 93.45],
  ["Салаты", "Салат «Столичный»", "2102451000016", "150 г", 5, 101.85],
  ["Салаты", "Салат «Петровский»", "2102564000019", "150 г", 5, 102.90],
  ["Сэндвичи", "Шаверма «Классическая»", "2127328000012", "200 г", 5, 144.44],
  ["Сэндвичи", "Шаверма с говядиной", "2127582000018", "200 г", 5, 145.00],
  ["Сэндвичи", "Ролл «Цезарь»", "2102623000011", "150 г", 5, 126.00],
  ["Сэндвичи", "Ролл Оригинальный", "2127306000010", "180 г", 5, 125.50],
  ["Сэндвичи", "Хот Дог «Датский»", "2127347000017", "170 г", 5, 130.00],
  ["Сэндвичи", "Ролл тунец в нежном соусе", "2127580000010", "150 г", 5, 125.00],
  ["Сэндвичи", "Ролл «Итальянский с курицей в соусе песто»", "2127560000016", "190 г", 5, 126.00],
  ["Сэндвичи", "Сосиска в тесте Макси", "2127358000013", "100 г", 10, 89.00],
  ["Сэндвичи", "Пита с курицей", "2127404000011", "150 г", 5, 129.20],
  ["Сэндвичи", "Сэндвич с индейкой на гриле", "2102236000019", "150 г", 5, 126.00],
  ["Сэндвичи", "Сэндвич с бужениной", "2102243000019", "150 г", 5, 126.00],
  ["Сэндвичи", "Сэндвич с курой на гриле", "2102254000015", "150 г", 5, 126.00],
  ["Сэндвичи", "Сэндвич с ветчиной и сыром", "2102186000015", "150 г", 5, 105.00],
  ["Сэндвичи", "Сэндвич «Салями»", "2102244000018", "150 г", 5, 105.00],
  ["Сэндвичи", "Сэндвич с говядиной", "2127297000013", "150 г", 5, 126.00],
  ["Сэндвичи", "Сэндвич пшеничный с курицей", "2127293000017", "130 г", 10, 91.15],
  ["Сэндвичи", "Сэндвич с ветчиной и сыром гауда", "2127292000018", "130 г", 10, 92.20],
  ["Сэндвичи", "Сэндвич с индейкой и моцареллой", "2127291000019", "130 г", 10, 94.25],
  ["Сэндвичи", "Сэндвич с бужениной и салатом", "2127294000016", "130 г", 10, 92.20],
  ["Сэндвичи", "Сэндвич салями", "2127435000011", "130 г", 10, 97.10],
  ["Сэндвичи", "Сэндвич с пепперони", "2127436000010", "130 г", 10, 97.10]
]

const insertProduct = db.prepare(`
  INSERT INTO products(
    category,
    name,
    barcode,
    net_weight,
    shelf_life_days,
    wholesale_price,
    composition,
    nutrition,
    image_url,
    product_url,
    image_source,
    image_match,
    image_note,
    site_title
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
products.forEach((p) => {
  const detail = productDetailsByBarcode.get(String(p[2])) ?? productDetailsByName.get(String(p[1]).trim().toLowerCase())
  const photo = productPhotosByName.get(normalizeProductPhotoKey(p[1]))
  insertProduct.run(
    ...p,
    detail?.composition ?? "Состав уточняется по ассортиментному файлу.",
    detail?.nutrition ?? "Б/Ж/У порция уточняется по ассортиментному файлу.",
    photo?.image_url ?? null,
    photo?.product_url ?? null,
    photo?.product_url ?? "https://lunch-up.ru/",
    photo?.image_match ?? null,
    photo?.image_note ?? null,
    photo?.site_title ?? null
  )
})
db.exec(`
  INSERT INTO inventory_positions(product_id, on_hand_quantity, reserved_quantity, reorder_point, target_stock)
  SELECT id, 48, 0, 18, 96
  FROM products
  WHERE is_active = 1;
`)

const companies = [
  ["Цех85", "coffee_bakery", "Санкт-Петербург", "Санкт-Петербург", "городская сеть", "https://www.tseh85.ru/", "https://www.tseh85.ru/", "public_web", "qualified", 91, "Сеть кафе-пекарен: готовая еда может расширить витрину к кофе.", "Начать с предложения десертов и сэндвичей для точек без кухни."],
  ["Буше", "coffee_bakery", "Санкт-Петербург", "Санкт-Петербург", "городская сеть", "https://bushe.ru/", "https://bushe.ru/", "public_web", "qualified", 88, "Кофейно-пекарный формат с высоким городским трафиком.", "Проверить интерес к дополнительной упакованной линейке для части точек."],
  ["Британские пекарни", "coffee_bakery", "Санкт-Петербург", "Санкт-Петербург", "городская сеть", "https://british-bakery.ru/", "https://british-bakery.ru/", "public_web", "lead", 82, "Кофейни и пекарни в СПб: релевантны десерты и перекусы.", "Нужна квалификация: есть ли внешние поставщики fresh food."],
  ["Пироговый дворик", "coffee_bakery", "Санкт-Петербург", "Санкт-Петербург", "городская сеть", "https://pirogi.spb.ru/", "https://pirogi.spb.ru/", "public_web", "lead", 74, "Локальная сеть питания, потенциальный партнер по готовой упаковке.", "Проверить формат закупок и потребность в сэндвичах/салатах."],
  ["Coffee Like Санкт-Петербург", "coffee_chain", "Санкт-Петербург", "Санкт-Петербург", "франчайзинговая сеть", "https://coffee-like.com/", "https://coffee-like.com/", "public_web", "contacted", 86, "Кофейный формат без полноценной кухни; высокий fit для еды к кофе.", "Оффер: увеличить средний чек без кухни."],
  ["One Price Coffee Санкт-Петербург", "coffee_chain", "Санкт-Петербург", "Санкт-Петербург", "городская сеть", "https://onepricecoffee.com/", "https://onepricecoffee.com/", "public_web", "lead", 78, "Кофейни с потоком; возможна матрица недорогих сэндвичей и десертов.", "Квалифицировать локального управляющего."],
  ["Greenbox", "horeca_ready_food", "Санкт-Петербург", "Санкт-Петербург", "городская сеть", "https://greenbox.ru/", "https://greenbox.ru/", "public_web", "lead", 68, "Сегмент готовой еды; возможны партнерства или конкурентная разведка.", "Не первый приоритет, но полезен для анализа матриц."],
  ["Solo Group БЦ Санкт-Петербург", "office_cluster", "Санкт-Петербург", "Санкт-Петербург", "сеть бизнес-центров", "https://solo-group.ru/", "https://solo-group.ru/", "public_web", "lead", 72, "Сеть БЦ и коммерческих объектов в СПб; релевантно для офисных витрин и микромаркетов.", "Выход через отдел аренды/продаж, далее квалифицировать управляющего объекта."],
  ["Uvenco Санкт-Петербург", "vending_micromarket", "Санкт-Петербург", "Санкт-Петербург", "СЗФО", "https://uvenco.ru/spb/", "https://uvenco.ru/spb/", "public_web", "qualified", 95, "Крупный вендинг/микромаркеты; канал к офисам и перекусам.", "Предложить линейку сытных SKU и салатов для микромаркетов."],
  ["ВЕНДЭКС РИТЭЙЛ", "vending_micromarket", "Санкт-Петербург", "Санкт-Петербург", "СЗФО", "https://vendexretail.ru/about/", "https://vendexretail.ru/about/", "public_web", "qualified", 92, "Вендинг-оператор СПб/ЛО; релевантен ассортимент перекусов.", "КП под микромаркеты и офисы."],
  ["ПетроСервис", "vending_micromarket", "Санкт-Петербург", "Санкт-Петербург", "Московский район", "https://www.petroservis.com/", "https://www.petroservis.com/", "public_web", "contacted", 90, "Вендинг и офисное питание; адрес в СПб.", "Запросить встречу по готовой еде для автоматизированной торговли."],
  ["Мегас Вендинг", "vending_micromarket", "Санкт-Петербург", "Санкт-Петербург", "Парголово", "https://megasvending.ru/mikromarket/", "https://megasvending.ru/mikromarket/", "public_web", "qualified", 93, "Микромаркеты в СПб и ЛО; прямой fit для каталога Lunch Up.", "Оффер: регулярная матрица с контролем списаний."],
  ["Self Kiosk", "vending_micromarket", "Санкт-Петербург", "Санкт-Петербург", "офисы/коворкинги", "https://selfkiosk.ru/", "https://selfkiosk.ru/", "public_web", "lead", 84, "Микромаркеты самообслуживания; нужен готовый ассортимент.", "Проверить географию и формат закупок."],
  ["ОФ ПТК / Петербургская топливная компания", "gas_station", "Санкт-Петербург", "Санкт-Петербург", "город/область", "https://lk.ofptk.ru/contacts", "https://lk.ofptk.ru/contacts", "public_web", "lead", 76, "Локальный топливный оператор СПб/ЛО; АЗС как канал импульсных перекусов.", "B2B-вход через публичные контакты ОФ ПТК, категорию food нужно квалифицировать отдельно."],
  ["Газпромнефть АЗС", "gas_station", "Санкт-Петербург", "Санкт-Петербург", "город/область", "https://azs.gazprom-neft.ru/", "https://azs.gazprom-neft.ru/", "public_web", "lead", 79, "Сеть АЗС с кофе и перекусами; потенциально крупный канал.", "Выход через категорийного менеджера."],
  ["Татнефть АЗС СЗФО", "gas_station", "Ленинградская область", "Ленинградская область", "трассовые точки", "https://azs.tatneft.ru/", "https://azs.tatneft.ru/", "public_web", "lead", 73, "АЗС на маршрутах СПб/ЛО; возможно кластерное подключение.", "Считать логистику и минимум заказа по маршрутам."],
  ["Роснефть АЗС", "gas_station", "Санкт-Петербург", "Санкт-Петербург", "город/область", "https://www.rosneft-azs.ru/", "https://www.rosneft-azs.ru/", "public_web", "lead", 71, "АЗС с магазином и кофе: релевантны сэндвичи и хот-доги.", "Начать с B2B-запроса о поставщиках."],
  ["ВкусВилл Санкт-Петербург", "retail_store", "Санкт-Петербург", "Санкт-Петербург", "городская сеть", "https://vkusvill.ru/", "https://vkusvill.ru/", "public_web", "lead", 70, "Розничная сеть с готовой едой; скорее конкурент/канал для анализа.", "Проверить возможность локальных поставщиков."],
  ["Семишагофф", "retail_store", "Санкт-Петербург", "Санкт-Петербург", "СПб/ЛО", "https://www.google.com/search?q=Семишагофф+официальный+сайт", "https://www.google.com/search?q=Семишагофф+официальный+сайт", "manual_research", "lead", 75, "Дискаунтер в СПб/ЛО; возможна полка доступных перекусов.", "Найти официальный закупочный канал перед контактом."],
  ["Реалъ", "retail_store", "Санкт-Петербург", "Санкт-Петербург", "городская сеть", "https://www.google.com/search?q=Реалъ+магазин+Санкт-Петербург+официальный+сайт", "https://www.google.com/search?q=Реалъ+магазин+Санкт-Петербург+официальный+сайт", "manual_research", "lead", 67, "Магазины у дома; релевантен compact fresh ассортимент.", "Проверить закупочный контур."],
  ["БЦ Сенатор", "office_cluster", "Санкт-Петербург", "Санкт-Петербург", "несколько районов", "https://senator.spb.ru/", "https://senator.spb.ru/", "public_web", "lead", 80, "Сеть бизнес-центров: может дать доступ к офисному спросу.", "Искать операторов питания/микромаркетов внутри БЦ."],
  ["БЦ Обводный двор", "office_cluster", "Санкт-Петербург", "Санкт-Петербург", "Адмиралтейский район", "https://obvodny-dvor.ru/", "https://obvodny-dvor.ru/", "public_web", "lead", 69, "Бизнес-центр как потенциальная локация микромаркета.", "Контакт через управляющую компанию."],
  ["Ленполиграфмаш", "office_cluster", "Санкт-Петербург", "Санкт-Петербург", "Петроградский район", "https://poligraphmash.ru/", "https://poligraphmash.ru/", "public_web", "lead", 77, "Кластер офисов/ивентов; спрос на быстрые перекусы.", "Проверить внутренние кафе и арендаторов."],
  ["Новая Голландия", "horeca_cluster", "Санкт-Петербург", "Санкт-Петербург", "Адмиралтейский район", "https://www.newhollandsp.ru/", "https://www.newhollandsp.ru/", "public_web", "lead", 62, "Городской кластер еды и прогулочного трафика; больше для партнерств.", "Не стартовый лид, использовать для гипотез pop-up/событий."],
  ["Лофт Проект Этажи", "horeca_cluster", "Санкт-Петербург", "Санкт-Петербург", "Лиговский проспект", "https://www.loftprojectetagi.ru/", "https://www.loftprojectetagi.ru/", "public_web", "lead", 66, "Высокий молодежный трафик и арендаторы; релевантны перекусы.", "Проверить каналы арендаторов."],
  ["Охта Молл", "retail_cluster", "Санкт-Петербург", "Санкт-Петербург", "Красногвардейский район", "https://www.ohtamall.ru/", "https://www.ohtamall.ru/", "public_web", "lead", 65, "ТЦ как кластер точек, где есть кофейни и магазины.", "Использовать для обхода арендаторов."],
  ["Пулково", "transport_cluster", "Санкт-Петербург", "Санкт-Петербург", "аэропорт", "https://pulkovoairport.ru/", "https://pulkovoairport.ru/", "public_web", "lead", 58, "Транспортный кластер с перекусами, но высокий барьер входа.", "Не первый этап, оставить для стратегического канала."],
  ["Автополе Кудрово", "retail_cluster", "Ленинградская область", "Кудрово", "Всеволожский район", "https://autopole.ru/contacts", "https://autopole.ru/contacts", "public_web", "lead", 64, "Крупный авто- и ритейл-кластер в Кудрово; подходит для маршрутной проверки ЛО.", "Выход через отдел развития, аренды или корпоративный канал; дальше квалифицировать food-точки."],
  ["Икра и Рыба Мурино", "retail_store", "Ленинградская область", "Мурино", "Всеволожский район", "https://ikra.market/kontakty", "https://ikra.market/kontakty", "public_web", "lead", 63, "Розничная сеть с точкой в Мурино; релевантна для локального retail-outreach.", "Есть публичный отдел закупки, начать с короткого письма по матрице ready-food."],
  ["Концепт / БЦ Парнас", "office_cluster", "Санкт-Петербург", "Санкт-Петербург", "Выборгский район", "https://www.koncepts.ru/contacts/", "https://www.koncepts.ru/contacts/", "public_web", "lead", 61, "Офисно-производственный B2B-якорь в БЦ Парнас; потенциал микромаркетов и офисного питания.", "Проверить интерес как у арендатора/якоря и использовать как вход в кластер Парнас."]
]

const insertCompany = db.prepare(`
  INSERT INTO companies(name, segment, region, city, district, website, public_contact_url, source, lead_status, lead_score, fit_reason, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const insertContact = db.prepare(`
  INSERT INTO contacts(company_id, name, role, email, phone, preferred_channel, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const updateCompanyContactUrl = db.prepare("UPDATE companies SET public_contact_url = ? WHERE id = ?")
const insertDeal = db.prepare(`
  INSERT INTO deals(company_id, stage_id, title, estimated_monthly_revenue, expected_close_date, priority, next_action, next_action_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
const insertActivity = db.prepare(`
  INSERT INTO activities(company_id, deal_id, type, subject, notes, due_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const stageIdByCode = Object.fromEntries(
  db.prepare("SELECT id, code FROM pipeline_stages").all().map((row) => [row.code, row.id])
)

function datePlus(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function dgisSearchUrl(name, city, address) {
  return `https://2gis.ru/spb/search/${encodeURIComponent([name, address, city].filter(Boolean).join(" "))}`
}

function addressFromNotes(notes) {
  const value = String(notes ?? "")
  const match = value.match(/(?:офис|адрес)[^:]*:\s*([^.;]+)/i) ?? value.match(/(?:ул\.|улица|проспект|наб\.|набережная|шоссе)\s*[^.;]+/i)
  return match?.[1]?.trim() ?? match?.[0]?.trim() ?? null
}

function estimateDriveMinutes(address, district, city, segment) {
  const text = [address, district, city, segment].filter(Boolean).join(" ").toLowerCase()
  if (/уральск[^0-9]{0,30}13\b/.test(text)) return 3
  if (/уральск/.test(text)) return 6
  if (/василеостров|в\.о\.|линия в\.о|средний проспект|малый в\.о|большой проспект в\.о|университетская/.test(text)) return 18
  if (/кронверк|петроград|профессора попова|аптекар/.test(text)) return 28
  if (/централь|адмиралтей|мойк|грибоедов|морская|красноармейск|московский проспект|правды|фонтанк|моховая|соляной|дворцовая/.test(text)) return 35
  if (/киров|балтийск|двинская|декабристов|лоцманская|черниговская/.test(text)) return 42
  if (/калинин|политехническ|литовская|выборг|кудров|мурино|парнас|парголов|всеволож|ленинградская область/.test(text)) return 55
  if (/невск|большевиков|красногвард|малоохтинск|охта/.test(text)) return 50
  if (/аэропорт|пулково/.test(text)) return 60
  if (/городская сеть|сеть|несколько адресов|город\/область|спб\/ло/.test(text)) return 45
  return 40
}

function seedLocation(company, publicContact) {
  const name = company[0]
  const city = company[3]
  const district = company[4]
  const address =
    publicContact?.address ??
    addressFromNotes(publicContact?.notes) ??
    (district && !/городская сеть|сеть|город\/область|спб\/ло/i.test(String(district))
      ? `${city}, ${district}`
      : `${city}, сеть/несколько адресов; пилотная точка уточняется`)
  const dgisUrl = publicContact?.dgis_url ?? dgisSearchUrl(name, city, address)
  const driveMinutes = publicContact?.drive_minutes_from_production ?? estimateDriveMinutes(address, district, city, company[1])
  return {
    address,
    dgisUrl,
    driveMinutes,
    source: publicContact?.drive_minutes_from_production ? "public_contacts" : "estimated_from_seed_location"
  }
}

for (const company of companies) {
  const result = insertCompany.run(...company)
  const companyId = Number(result.lastInsertRowid)
  const publicContact = publicContactByCompany.get(company[0])
  if (publicContact?.source_url) {
    updateCompanyContactUrl.run(publicContact.source_url, companyId)
  }
  const contactNotes = [
    publicContact?.notes ?? "Использовать только публичную форму, сайт или общий B2B-канал компании.",
    publicContact?.source_url ? `Источник: ${publicContact.source_url}` : null
  ].filter(Boolean).join(" ")
  const location = seedLocation(company, publicContact)
  db.prepare(`
    UPDATE companies
    SET address = ?, dgis_url = ?, drive_minutes_from_production = ?, drive_minutes_source = ?
    WHERE id = ?
  `).run(location.address, location.dgisUrl, location.driveMinutes, location.source, companyId)
  insertContact.run(
    companyId,
    "Публичный B2B-канал",
    "Коммерческий отдел / закупки / общий контакт",
    publicContact?.email ?? null,
    publicContact?.phone ?? null,
    publicContact?.preferred_channel ?? "site",
    contactNotes
  )
  db.prepare(`
    UPDATE contacts
    SET address = ?, dgis_url = ?, drive_minutes_from_production = ?, drive_minutes_source = ?
    WHERE company_id = ?
  `).run(location.address, location.dgisUrl, location.driveMinutes, location.source, companyId)
  const status = company[8]
  const stageCode = status === "qualified" ? "qualified" : status === "contacted" ? "contacted" : "lead"
  const score = company[9]
  const deal = insertDeal.run(
    companyId,
    stageIdByCode[stageCode],
    `Запуск Lunch Up: ${company[0]}`,
    score * 2600,
    datePlus(score > 85 ? 21 : 35),
    score > 85 ? "high" : score > 72 ? "medium" : "low",
    score > 85 ? "Назначить дегустацию и отправить матрицу под сегмент" : "Квалифицировать закупочный канал и формат точки",
    datePlus(score > 85 ? 2 : 5)
  )
  insertActivity.run(
    companyId,
    Number(deal.lastInsertRowid),
    "next_step",
    score > 85 ? "Подготовить персональное КП и дегустацию" : "Проверить закупочный контакт и актуальность сегмента",
    company[11],
    datePlus(score > 85 ? 2 : 5)
  )
}

const insertMatrix = db.prepare("INSERT INTO segment_matrices(segment, name, target_sku_count, rationale) VALUES (?, ?, ?, ?)")
const insertMatrixItem = db.prepare("INSERT INTO matrix_items(matrix_id, product_id, role, priority) VALUES (?, ?, ?, ?)")
const productIdByName = Object.fromEntries(db.prepare("SELECT id, name FROM products").all().map((row) => [row.name, row.id]))
const matrices = [
  ["coffee_bakery", "Кофейня: еда к кофе", "14-16 SKU", "Сделать допродажу к напитку без кухни и не собирать минимум одной позицией внутри категории.", ["Сэндвич с ветчиной и сыром", "Сэндвич с курой на гриле", "Ролл «Цезарь»", "Ролл Оригинальный", "Сэндвич пшеничный с курицей", "Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами", "Десерт «Морковный кекс»", "Десерт «Медовик»", "Десерт «Тирамису»", "Десерт «Шарлотка с яблоком»", "Сочень с творогом"]],
  ["vending_micromarket", "Микромаркет/офис", "16-18 SKU", "Закрыть офисный спрос на сытную еду и перекусы с разнообразной матрицей по категориям.", ["Сэндвич пшеничный с курицей", "Сэндвич с ветчиной и сыром гауда", "Сэндвич с индейкой и моцареллой", "Сэндвич с бужениной и салатом", "Сэндвич салями", "Сэндвич с пепперони", "Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами", "Десерт «Медовик»", "Десерт «Морковный кекс»", "Сочень с творогом", "Десерт «Кофейный»"]],
  ["gas_station", "АЗС: импульсная fresh-полка", "16-18 SKU", "Дать понятную импульсную полку с низким барьером выбора и несколькими SKU внутри каждой категории.", ["Шаверма «Классическая»", "Хот Дог «Датский»", "Сосиска в тесте Макси", "Сэндвич «Салями»", "Сэндвич с ветчиной и сыром", "Ролл «Цезарь»", "Пита с курицей", "Сэндвич пшеничный с курицей", "Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами", "Салат «Греческий»", "Салат «Винегрет»", "Салат «Витаминный»", "Десерт «Картошка классическая»", "Сочень с творогом", "Десерт «Морковный кекс»"]],
  ["computer_club", "Компьютерный клуб: snack-витрина", "16 SKU", "Закрыть вечерний и ночной игровой поток едой одной рукой без кухни и ожидания доставки; объем распределен по широкому набору SKU.", ["Сэндвич пшеничный с курицей", "Сэндвич с ветчиной и сыром гауда", "Сэндвич с пепперони", "Сэндвич салями", "Сосиска в тесте Макси", "Хот Дог «Датский»", "Ролл «Цезарь»", "Пита с курицей", "Сырники с творогом", "Запеканка творожная с изюмом", "Блинчики с ветчиной и сыром", "Блинчики кура с грибами", "Десерт «Морковный кекс»", "Десерт «Картошка классическая»", "Сочень с творогом", "Десерт «Медовик»"]]
]
for (const matrix of matrices) {
  const result = insertMatrix.run(matrix[0], matrix[1], matrix[2], matrix[3])
  const matrixId = Number(result.lastInsertRowid)
  matrix[4].forEach((name, idx) => {
    if (productIdByName[name]) {
      insertMatrixItem.run(matrixId, productIdByName[name], idx < 3 ? "anchor" : "support", 100 - idx * 5)
    }
  })
}

const insertAgent = db.prepare("INSERT INTO ai_agents(code, name, mission, trigger_rule) VALUES (?, ?, ?, ?)")
const agents = [
  ["lead_research", "AI Lead Research", "Проверяет компанию, сегмент, географию, публичный канал и готовит карточку для менеджера.", "Новый лид или низкая уверенность в контакте"],
  ["outreach_writer", "AI Outreach Writer", "Пишет короткое B2B-письмо и скрипт звонка под сегмент клиента.", "Лид квалифицирован или score >= 75"],
  ["followup_scheduler", "AI Follow-up Scheduler", "Создает следующий шаг и напоминает о дегустации/повторном заказе.", "Есть сделка без активности ближе 5 дней"],
  ["sku_matrix_analyst", "AI SKU Matrix Analyst", "Подбирает стартовую продуктовую матрицу по формату точки и риску списаний.", "Перед дегустацией или пробной поставкой"],
  ["telegram_order_validator", "AI Telegram Order Validator", "Проверяет заказы из Telegram-бота: минимум, сроки, адрес, юридическое лицо, состав заказа.", "Новый заказ из bot API"],
  ["telegram_reply_copilot", "AI Telegram Reply Copilot", "Готовит черновики ответов клиентам Telegram по каталогу, заказам, условиям и статусам. Отправка только после подтверждения менеджером через официальный Bot API.", "В Telegram webhook пришло клиентское сообщение, не являющееся сервисной командой Mini App"],
  ["apify_actor_researcher", "AI Apify Actor Researcher", "Подбирает Apify Actors и готовит безопасные задачи на публичный B2B research, site check и enrichment для лидов СПб/ЛО.", "Менеджер запросил внешний сбор данных или проверку источников через Apify Store"],
  ["company_telegram_channel_researcher", "AI Company Telegram Channel Researcher", "Ищет и проверяет публичные Telegram, боты, website chat и agent-ready каналы компании, сохраняя источник и политику контакта.", "Компания создана без подтвержденного Telegram/AI-канала или 2ГИС/сайт дал новый публичный канал"],
  ["customer_order_concierge", "AI Customer Order Concierge", "Ведет заказ со стороны клиента: проверяет профиль, дату, состав корзины, статус и следующий шаг.", "Клиент вошел в web-каталог, оформил заказ или запросил сопровождение"],
  ["inventory_replenishment_agent", "AI Inventory Replenishment Agent", "Следит за остатками, резервами и точками пополнения после клиентских заказов.", "SKU ушел ниже точки пополнения или заказ резко увеличил резерв"],
  ["sales_demand_analyst", "AI Sales Demand Analyst", "Анализирует продажи по SKU, клиентам и повторным заказам для поддержания остатков.", "Появился новый заказ, повторный заказ или накопилась недельная статистика"]
]
agents.forEach((agent) => insertAgent.run(...agent))

const agentIdByCode = Object.fromEntries(db.prepare("SELECT id, code FROM ai_agents").all().map((row) => [row.code, row.id]))
const insertTask = db.prepare(`
  INSERT INTO ai_tasks(agent_id, company_id, deal_id, task_type, priority, prompt, due_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const topDeals = db.prepare(`
  SELECT d.id AS deal_id, c.id AS company_id, c.name, c.segment, c.lead_score, d.title
  FROM deals d
  JOIN companies c ON c.id = d.company_id
  ORDER BY c.lead_score DESC
  LIMIT 18
`).all()
for (const row of topDeals) {
  insertTask.run(
    agentIdByCode.outreach_writer,
    row.company_id,
    row.deal_id,
    "outreach",
    row.lead_score,
    `Подготовь письмо и скрипт звонка для ${row.name}. Сегмент: ${row.segment}. Оффер: готовая еда Lunch Up без кухни, запуск в СПб/ЛО, пробная матрица и дегустация.`,
    datePlus(1)
  )
  insertTask.run(
    agentIdByCode.sku_matrix_analyst,
    row.company_id,
    row.deal_id,
    "matrix",
    Math.max(60, row.lead_score - 5),
    `Подбери стартовую матрицу Lunch Up для ${row.name}; учти канал, списания, срок годности и минимальный заказ 7000 руб.`,
    datePlus(2)
  )
  insertTask.run(
    agentIdByCode.company_telegram_channel_researcher,
    row.company_id,
    row.deal_id,
    "telegram_channel_research",
    Math.max(55, row.lead_score - 8),
    `Проверить публичные Telegram, боты, сайт-чат и agent-ready каналы компании ${row.name}. Не использовать userbot и не писать первым без подтвержденного публичного B2B-канала; сохранить источник, статус и следующий шаг.`,
    datePlus(2)
  )
}

const insertCjm = db.prepare("INSERT INTO cjm_events(company_id, stage, customer_goal, lunch_up_action, metric) VALUES (?, ?, ?, ?, ?)")
for (const row of db.prepare("SELECT id FROM companies ORDER BY lead_score DESC LIMIT 8").all()) {
  insertCjm.run(row.id, "Осознание", "Увеличить чек без кухни", "Показать готовую полку и экономику", "Ответ на контакт")
  insertCjm.run(row.id, "Оценка", "Снизить риск списаний", "Предложить дегустацию и пилотную матрицу", "Дегустация")
  insertCjm.run(row.id, "Повтор", "Оставить ходовые SKU", "Анализировать продажи и списания", "Повторный заказ")
}

db.close()
console.log(`SQLite CRM created: ${dbPath}`)
console.log(`Seeded: ${companies.length} companies, ${products.length} products, ${topDeals.length * 2} AI tasks`)
