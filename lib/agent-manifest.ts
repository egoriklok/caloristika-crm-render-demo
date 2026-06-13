import { DEFAULT_STRATEGY_TOKEN, getActiveStrategy } from "@/lib/active-strategy"
import { getDb } from "@/lib/db"

export function getAgentManifest() {
  const db = getDb()
  const activeStrategy = getActiveStrategy()
  const agents = db.prepare(`
    SELECT code, name, mission, trigger_rule, is_active
    FROM ai_agents
    ORDER BY id
  `).all() as Array<{
    code: string
    name: string
    mission: string
    trigger_rule: string
    is_active: number
  }>
  const queued = db.prepare(`
    SELECT a.code, COUNT(t.id) AS queued_count
    FROM ai_agents a
    LEFT JOIN ai_tasks t ON t.agent_id = a.id AND t.status = 'queued'
    GROUP BY a.id
    ORDER BY a.id
  `).all() as Array<{ code: string; queued_count: number }>
  const queuedByCode = new Map(queued.map((row) => [row.code, row.queued_count]))

  return {
    crm: "Lunch Up CRM",
    region_scope: "Санкт-Петербург и Ленинградская область",
    active_strategy: {
      token: DEFAULT_STRATEGY_TOKEN,
      package_slug: activeStrategy.package_slug,
      name: activeStrategy.name,
      geography: activeStrategy.geography,
      local_miniapp_path: activeStrategy.local_miniapp_path,
      miniapp_url: activeStrategy.miniapp_url,
      lo_delivery_terms: activeStrategy.lo_delivery_terms
    },
    runtime: "Next.js App Router + SQLite + Node route handlers + scripts/agent-worker.mjs",
    operating_model: {
      director_contract: "docs/CRM_AI_AGENT_OPERATING_MODEL.md",
      operator_runbook: "docs/OPERATOR_ONE_PAGE_RUNBOOK.md",
      prd: "docs/AI_AGENT_SYSTEM_PRD.md",
      technical_runbook: "docs/AI_AGENT_RUNBOOK.md"
    },
    source_of_truth: {
      database: "SQLite via data/lunch_up_crm.sqlite or LUNCH_UP_CRM_DB_PATH",
      catalog_table: "products",
      sales_tables: ["companies", "contacts", "deals", "orders", "order_items"],
      enrichment_tables: ["company_enrichment_profiles", "company_enrichment_sources"],
      agent_tables: ["ai_agents", "ai_tasks", "ai_task_runs", "ai_agent_memories"],
      rule:
        "CRM records are canonical after import. External sources and Google Sheets are evidence layers until reviewed and saved into SQLite."
    },
    provider_decision: [
      {
        provider: "offline",
        use_when: "Safe default, smoke tests, deterministic manager-reviewable recommendations."
      },
      {
        provider: "paperclip",
        use_when: "Workflow orchestration across multi-step sales, enrichment and handoff processes."
      },
      {
        provider: "hermes",
        use_when: "Persistent personal or gateway agent that should sit in front of CRM tasks."
      },
      {
        provider: "openclaw",
        use_when: "Local assistant or gateway controlled from this operator machine."
      },
      {
        provider: "openai",
        use_when: "Optional legacy Responses API mode when server-side OPENAI_API_KEY is configured."
      }
    ],
    sales_metrics_contract: [
      "lead_count_by_segment",
      "contact_coverage_phone_email_address_2gis",
      "time_to_first_contact",
      "stage_conversion",
      "pipeline_value",
      "first_orders",
      "repeat_orders",
      "order_revenue",
      "average_order_value",
      "blocked_minimum_order_cases",
      "sku_sell_through",
      "agent_queue_sla",
      "accepted_vs_rejected_agent_recommendations"
    ],
    manager_feedback_loop: {
      decision_values: ["accepted", "rejected_data_weak", "rejected_segment_mismatch", "rejected_timing", "accepted_after_edit", "needs_new_source"],
      rule:
        "Agent outputs are drafts with evidence_sources. Manager approval is required before business mutations, and only proven decisions become reusable memory."
    },
    agent_worker: {
      runbook: "docs/AI_AGENT_RUNBOOK.md",
      migration_command: "npm run agent:migrate",
      smoke_command: "npm run agent:worker-smoke",
      provider_smoke_command: "npm run agent:provider-smoke",
      offline_command: "npm run agent:worker -- --once --limit=3 --no-llm",
      production_command: "AGENT_LLM_PROVIDER=paperclip npm run agent:worker",
      queue_table: "ai_tasks",
      trace_table: "ai_task_runs",
      memory_table: "ai_agent_memories",
      llm_provider: "Configurable via AGENT_LLM_PROVIDER: offline, paperclip, hermes, openclaw or openai",
      supported_providers: [
        {
          provider: "offline",
          mode: "offline",
          setup: "No external runtime. Deterministic manager-reviewable recommendations."
        },
        {
          provider: "paperclip",
          mode: "paperclip_http or paperclip_command",
          setup: "PAPERCLIP_AGENT_ENDPOINT or PAPERCLIP_AGENT_COMMAND"
        },
        {
          provider: "hermes",
          mode: "hermes_http or hermes_command",
          setup: "HERMES_AGENT_ENDPOINT or HERMES_AGENT_COMMAND"
        },
        {
          provider: "openclaw",
          mode: "openclaw_http or openclaw_command",
          setup: "OPENCLAW_AGENT_ENDPOINT, OPENCLAW_GATEWAY_URL or OPENCLAW_AGENT_COMMAND"
        },
        {
          provider: "openai",
          mode: "openai_responses",
          setup: "OPENAI_API_KEY"
        }
      ],
      default_mode: "offline structured recommendation",
      human_in_the_loop:
        "Worker may write analysis, trace and bounded memory, but manager approval is required before mutating orders, inventory targets, contacts, deals, exports or Telegram customer messages.",
      limits: {
        provider_env: "AGENT_LLM_PROVIDER",
        max_tasks_per_run_env: "AGENT_MAX_TASKS_PER_RUN",
        max_attempts_env: "AGENT_MAX_ATTEMPTS",
        poll_interval_env: "AGENT_POLL_INTERVAL_MS",
        llm_timeout_env: "AGENT_LLM_TIMEOUT_MS"
      }
    },
    agents: agents.map((agent) => ({
      code: agent.code,
      name: agent.name,
      mission: agent.mission,
      trigger_rule: agent.trigger_rule,
      is_active: Boolean(agent.is_active),
      queued_count: queuedByCode.get(agent.code) ?? 0
    })),
    tools: [
      {
        name: "read_dashboard",
        method: "GET",
        path: "/api/dashboard",
        purpose: "Получить лиды, каталог, заказы, матрицы запуска, контакты и очередь задач."
      },
      {
        name: "create_agent_task",
        method: "POST",
        path: "/api/agent/tasks",
        purpose: "Поставить задачу одному из AI-агентов CRM."
      },
      {
        name: "list_agent_tasks",
        method: "GET",
        path: "/api/agent/tasks?status=queued&limit=20",
        purpose: "Получить очередь, running/needs_review/failed задачи и результаты агента."
      },
      {
        name: "claim_next_agent_task",
        method: "PATCH",
        path: "/api/agent/tasks",
        purpose: "Забрать следующую queued задачу, поставить lock и получить bounded CRM context для worker."
      },
      {
        name: "complete_agent_task",
        method: "PATCH",
        path: "/api/agent/tasks",
        purpose: "Вернуть структурированный JSON-результат, записать trace и перевести задачу в needs_review или done."
      },
      {
        name: "create_or_update_company_lead",
        method: "POST",
        path: "/api/companies",
        purpose: "Создать или обновить компанию, контакт и сделку, подтянуть 2ГИС/DaData/CRM enrichment и рассчитать стартовое КП."
      },
      {
        name: "read_bot_catalog",
        method: "GET",
        path: "/api/bot/catalog",
        purpose: "Отдать Telegram-боту актуальный каталог, цены, фото и условия заказа."
      },
      {
        name: "create_bot_order",
        method: "POST",
        path: "/api/bot/orders",
        purpose: "Создать B2B-заказ из Telegram-бота с проверкой минимального заказа."
      },
      {
        name: "telegram_webhook",
        method: "POST",
        path: "/api/telegram/webhook",
        purpose: "Принять Telegram update, записать событие и поставить задачу на разбор агенту."
      },
      {
        name: "read_miniapp_catalog",
        method: "GET",
        path: "/api/miniapp/catalog",
        purpose: "Отдать Telegram Mini App клиентский каталог, цены, фото и условия заказа."
      },
      {
        name: "upsert_miniapp_session",
        method: "POST",
        path: "/api/miniapp/session",
        purpose: "Проверить Telegram initData, связать клиента с компанией и сохранить кабинет."
      },
      {
        name: "enrich_company_for_proposal",
        method: "POST",
        path: "/api/miniapp/enrichment",
        purpose: "Подтянуть данные компании из 2ГИС/CRM/открытых источников, вернуть headcount_evidence и рассчитать людей в офисе для КП."
      },
      {
        name: "bulk_refresh_company_enrichment",
        method: "POST",
        path: "/api/companies/enrichment/bulk",
        purpose:
          "Пакетно обновить enrichment по CRM-компаниям с dry_run, лимитом, cache_ttl_hours и summary по источникам для подготовки КП без ручного клика по каждому лиду."
      },
      {
        name: "search_2gis_lead_candidates",
        method: "POST",
        path: "/api/integrations/2gis/search",
        purpose:
          "Найти новых B2B-кандидатов в 2ГИС по сегменту/району СПб/ЛО, вернуть suggested payload для /api/companies и импортировать только при confirm_import."
      },
      {
        name: "create_miniapp_order",
        method: "POST",
        path: "/api/miniapp/orders",
        purpose: "Создать заказ из Telegram Mini App с серверным пересчетом корзины."
      },
      {
        name: "run_apify_company_research",
        method: "POST",
        path: "/api/integrations/apify/research",
        purpose:
          "Подготовить или запустить Apify Actor для публичного B2B research по компании; dry_run показывает payload, confirm_run запускает Actor при APIFY_TOKEN."
      },
      {
        name: "read_integration_launch_guide",
        method: "GET",
        path: "/api/integrations/launch-guide",
        purpose: "Получить безопасный операторский handoff для BotFather, Telegram Mini App, ключей, ссылок и критериев запуска без значений секретов."
      },
      {
        name: "preview_telegram_setup",
        method: "GET",
        path: "/api/integrations/telegram/setup-preview",
        purpose: "Посмотреть planned payload для setWebhook, setChatMenuButton и setMyCommands без обращения к Telegram API и без раскрытия секретов."
      }
    ],
    external_integrations: [
      {
        name: "2GIS Places API",
        status: process.env.DGIS_API_KEY || process.env.TWO_GIS_API_KEY ? "server_key_configured" : "not_configured",
        auth_context: "Server-side API key only; key must not be exposed in Mini App or public links.",
        console_url: "https://docs.2gis.com/api/search/places/overview",
        purpose:
          "Источник карточек компаний для Mini App: адрес, контакты, сайт, рубрики, филиалы и дополнительные признаки для оценки офисного размера.",
        next_step:
          "Добавить DGIS_API_KEY в окружение production-сервера, затем проверять найденные карточки перед записью в сделки.",
        allowed_workflows: [
          "Поиск новых B2B-кандидатов по сегменту, району и запросу через защищенный /api/integrations/2gis/search.",
          "Поиск компании по названию, ИНН и адресу из кабинета Mini App.",
          "Сохранение источников в company_enrichment_sources.",
          "Расчет диапазона людей в офисе и стартового КП без утверждения ложного точного числа сотрудников."
        ],
        guardrails: [
          "Использовать официальный API и лимиты ключа.",
          "Не парсить закрытые данные и не обходить авторизацию.",
          "Писать в КП диапазон и confidence, а не точное число без доказанного источника."
        ]
      },
      {
        name: "Apify Store",
        status: "operator_connected",
        auth_context: "Оператор подключился к Apify Console через GitHub OAuth.",
        console_url: "https://console.apify.com/store",
        purpose:
          "Источник внешних инструментов для AI-агентов CRM: подбор Apify Actors для публичного lead research, проверки сайтов, сбора B2B-контактов, мониторинга каталогов и enrichment по локальным лидам.",
        next_step:
          "Для автоматических запусков добавить APIFY_TOKEN и APIFY_DEFAULT_RESEARCH_ACTOR_ID как server-side secrets, затем запускать /api/integrations/apify/research через dry_run и confirm_run.",
        allowed_workflows: [
          "Подбор actors из Apify Store под задачу агента и запись задачи в ai_tasks.",
          "Запуск защищенного research endpoint для одной компании после подтверждения менеджера.",
          "Сбор и проверка только публичных B2B-источников по СПб и Ленинградской области.",
          "Сначала сохранять результаты как черновики/enrichment, затем отдавать менеджеру на подтверждение."
        ],
        guardrails: [
          "Перед массовым запуском подтверждать actor, лимиты, стоимость и правовое основание.",
          "Не использовать личные аккаунты, закрытые данные, обход авторизации или неразрешенный сбор персональных данных.",
          "Не менять сделки, заказы и контакты автоматически без отдельного подтверждения менеджера."
        ]
      }
    ],
    guardrails: [
      "Продвижение и сегментация ограничены СПб и Ленинградской областью.",
      "Бесплатная доставка относится к Санкт-Петербургу; Ленинградская область подключается только через согласованный маршрут и индивидуальные условия.",
      "Публичные контакты использовать как B2B-каналы, не как личные данные сотрудников.",
      "Заказы ниже 7000 руб. оставлять в статусе blocked_minimum и предлагать добор SKU.",
      "One source of truth: если сущность уже существует в CRM, агент обязан использовать ее и не создавать дубль.",
      "Каталог Lunch Up является единой точкой истины для цен, фото, описаний, добавления и удаления SKU; CRM, Mini App, КП и экономика должны читать каталог из одного источника.",
      "Перед массовым outreach подтверждать актуальность контакта и правовое основание коммуникации."
    ]
  }
}
