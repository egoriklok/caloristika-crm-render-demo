export type Stat = {
  label: string
  value: string
  hint: string
}

export type Stage = {
  id: number
  code: string
  name: string
  position: number
  probability: number
  deal_count: number
  revenue: number
}

export type Lead = {
  company_id: number
  company_name: string
  legal_name: string | null
  enrichment_inn: string | null
  enrichment_address: string | null
  enrichment_phone: string | null
  enrichment_email: string | null
  enrichment_website: string | null
  employee_count_fns: number | null
  employee_count_2gis: number | null
  employee_count_website: number | null
  office_people_min: number | null
  office_people_max: number | null
  office_people_confidence: "high" | "medium" | "low" | null
  office_people_method: string | null
  recommended_portions: number | null
  recommended_sku: number | null
  estimated_launch_budget: number | null
  enrichment_updated_at: string | null
  segment: string
  region: string
  city: string
  district: string | null
  address: string | null
  dgis_url: string | null
  drive_minutes_from_production: number | null
  drive_minutes_source: string | null
  website: string | null
  public_contact_url: string | null
  telegram_url: string | null
  telegram_username: string | null
  telegram_channel_type: string
  telegram_contact_status: string
  telegram_source_url: string | null
  telegram_source_note: string | null
  telegram_discovered_at: string | null
  agent_contact_policy: string
  agent_contact_readiness: string
  agent_contact_next_step: string | null
  lead_status: string
  lead_score: number
  fit_reason: string | null
  company_notes: string | null
  contact_name: string | null
  contact_role: string | null
  contact_email: string | null
  contact_phone: string | null
  preferred_channel: string | null
  contact_notes: string | null
  deal_id: number
  stage_id: number
  stage_code: string
  stage_name: string
  estimated_monthly_revenue: number
  next_action: string | null
  next_action_at: string | null
}

export type Product = {
  id: number
  category: string
  name: string
  barcode: string | null
  net_weight: string | null
  shelf_life_days: number | null
  wholesale_price: number
  image_url?: string | null
  product_url?: string | null
  image_source?: string | null
  image_match?: string | null
  image_note?: string | null
  site_title?: string | null
}

export type Order = {
  id: number
  company_name: string | null
  company_segment: string | null
  channel: string
  status: string
  delivery_method: string
  delivery_address: string | null
  delivery_date: string | null
  payment_date: string | null
  total_amount: number
  payment_method: string
  manager_comment: string | null
  created_at: string
  updated_at: string | null
  item_count: number
  items: OrderItem[]
}

export type OrderItem = {
  product_id: number
  name: string
  category: string
  quantity: number
  unit_price: number
  line_total: number
}

export type AiTask = {
  id: number
  agent_name: string
  company_name: string | null
  task_type: string
  priority: number
  prompt: string
  status: string
  due_at: string | null
}

export type TelegramCopilotItem = {
  message_id: number
  draft_id: number | null
  bot_customer_id: number | null
  telegram_chat_id: string
  telegram_user_id: string | null
  telegram_message_id: string | null
  sender_display_name: string | null
  company_name: string | null
  inbound_text: string
  message_kind: string
  message_status: string
  draft_text: string | null
  draft_status: string | null
  safety_note: string | null
  ai_task_id: number | null
  ai_task_status: string | null
  ai_result_summary: string | null
  telegram_result_json: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type Matrix = {
  id: number
  segment: string
  name: string
  target_sku_count: string
  rationale: string
  products: string
}

export type LocalProspect = {
  id: number
  name: string
  segment: string
  address: string
  drive_minutes_from_production?: number | null
  dgis_url?: string | null
  walk_min: number | null
  distance_band: string | null
  priority: string
  score: number
  fit_reason: string | null
  offer: string | null
  next_action: string | null
  phone: string | null
  email: string | null
  website: string | null
  source_2gis: string | null
  source_yandex: string | null
  pb_nalog_url: string | null
  fns_status: string | null
  legal_name: string | null
  inn: string | null
  ogrn: string | null
  fns_notes: string | null
  notes: string | null
}

export type LaunchSummary = {
  lead_count: number
  local_lead_count?: number
  vending_company_count?: number
  objection_count?: number
  catalog_sku_count: number
  phone_count: number
  email_count: number
  min_order_rub: number
  order_terms: Record<string, string>
} | null

export type LaunchMatrixRow = {
  name: string
  segment: string
  priority: string
  score: number
  walk_min: number | null
  contact: string
  package_name: string
  launch_format: string
  breakfasts: string
  salads: string
  sandwiches: string
  desserts: string
  sku_count: number
  start_amount: number
  conditions: string
  offer: string
  next_action: string | null
  kpi: string
  risk: string
}

export type SegmentLaunch = {
  format: string
  lead_count: number
  avg_start_amount: number
  breakfasts: string
  salads: string
  sandwiches: string
  desserts: string
  pitch: string
  kpi: string
}

export type CatalogAnalysisItem = {
  category: string
  name: string
  net_weight: string | null
  shelf_life_days: string | null
  price: number
  composition?: string | null
  nutrition?: string | null
  launch_role: string
  best_segments: string
  sheet_role?: string | null
  launch_recommendation?: string | null
  source_sheet_url?: string | null
  image_url?: string | null
  product_url?: string | null
  image_source?: string | null
  image_match?: string | null
  image_note?: string | null
  site_title?: string | null
}

export type SalesScript = {
  block: string
  audience: string
  script: string
  offer: string
  closing_question: string
  crm_segment_code?: string | null
  launch_format?: string | null
  jtbd?: string | null
  source_sheet_url?: string | null
}

export type ProjectSheetSegment = {
  segment: string
  jtbd: string
  pain: string
  need: string
  solution: string
  content_topic: string
  psychographic: string
  behavioral: string
  crm_segment_code: string
  crm_segment_label: string
  launch_format: string
  priority: "core" | "expansion" | "partner"
  route_logic: string
  manager_focus: string
  source_sheet_url: string
}

export type CrmSegment = {
  code: string
  label: string
  direction_code: string
  direction_label: string
  direction_description: string
  direction_position: number
  segment_position: number
  launch_format: string
  is_active: boolean
}

export type VendingCompany = {
  name: string
  segment: string
  address: string
  coverage: string
  priority: string
  score: number
  phone: string
  email: string
  website: string
  source_2gis: string
  source_yandex: string
  source_public: string
  source_note: string
  fit_reason: string
  recommended_offer: string
  next_action: string
  risk: string
  confidence: string
}

export type ObjectionMapItem = {
  stage: string
  objection: string
  why_it_matters: string
  response: string
  proof_or_asset: string
  next_question: string
}

export type ActiveStrategy = {
  token: string
  package_slug: string
  name: string
  description: string
  generated_at: string
  geography: string
  stage: string
  default_segment: string
  first_offer: string
  monthly_goal: string
  minimum_success: string
  spb_delivery_terms: string
  lo_delivery_terms: string
  min_order_amount: number
  miniapp_url: string
  local_miniapp_path: string
  workbook_path: string
  html_path: string
  source_package_path: string
  kpis: Array<{ label: string; value: string }>
  overview: Array<{ title: string; text: string }>
  risks: Array<{ title: string; severity: string; text: string }>
  action_plan: Array<{ period: string; title: string; details: string[]; proof: string }>
}

export type CrossLink = {
  label: string
  tab: string
  query: string
}

export type SourceLink = {
  label: string
  url: string
}

export type AccountCompany = {
  id: string
  display_name: string
  original_names: string[]
  sources: string[]
  source_count: number
  primary_segment: string
  region: string
  city: string
  address: string | null
  dgis_url: string | null
  drive_minutes_from_production: number | null
  drive_minutes_source: string | null
  priority: string
  score: number
  status: string
  phone: string | null
  email: string | null
  website: string | null
  telegram_url: string | null
  telegram_username: string | null
  telegram_channel_type: string
  telegram_contact_status: string
  telegram_source_url: string | null
  telegram_source_note: string | null
  telegram_discovered_at: string | null
  agent_contact_policy: string
  agent_contact_readiness: string
  agent_contact_next_step: string | null
  fit_reason: string | null
  offer: string | null
  next_action: string | null
  company_id: number | null
  deal_id: number | null
  local_prospect_id: number | null
  vending_name: string | null
  people_count: number
  source_links: SourceLink[]
  cross_links: CrossLink[]
}

export type CompanyPersonContact = {
  id: string
  account_id: string
  company_display_name: string
  source: string
  source_record_id: string
  person_name: string
  role: string
  address: string | null
  dgis_url: string | null
  drive_minutes_from_production: number | null
  drive_minutes_source: string | null
  email: string | null
  phone: string | null
  telegram_handle: string | null
  preferred_channel: string
  is_public: boolean
  consent_basis: string
  notes: string | null
  source_links: SourceLink[]
  cross_links: CrossLink[]
}

export type DashboardData = {
  activeStrategy: ActiveStrategy
  stats: Stat[]
  stages: Stage[]
  leads: Lead[]
  products: Product[]
  orders: Order[]
  tasks: AiTask[]
  telegramCopilot: TelegramCopilotItem[]
  matrices: Matrix[]
  localProspects: LocalProspect[]
  catalogAnalysis: CatalogAnalysisItem[]
  launchSummary: LaunchSummary
  launchMatrix: LaunchMatrixRow[]
  segmentLaunches: SegmentLaunch[]
  crmSegments: CrmSegment[]
  projectSheetSegments: ProjectSheetSegment[]
  salesScripts: SalesScript[]
  vendingCompanies: VendingCompany[]
  objectionMap: ObjectionMapItem[]
  accountCompanies: AccountCompany[]
  companyPeople: CompanyPersonContact[]
  dbPath: string
}
