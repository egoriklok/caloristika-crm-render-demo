import { getIntegrationStatus } from "@/lib/external-integrations"

export function getMcpManifest() {
  return {
    name: "Lunch Up CRM MCP Bridge",
    version: "0.1.0",
    transport: "https-json",
    scope: "Санкт-Петербург и Ленинградская область",
    auth: {
      crm_access_key_required: true,
      telegram_miniapp_init_data_required_for_customer_actions: true
    },
    resources: [
      {
        uri: "lunchup://dashboard",
        endpoint: "/api/dashboard",
        description: "CRM dashboard data: leads, contacts, catalog, orders, tasks, script matrix."
      },
      {
        uri: "lunchup://miniapp/catalog",
        endpoint: "/api/miniapp/catalog",
        description: "Mini App customer catalog with prices, photos and order terms."
      },
      {
        uri: "lunchup://agent/manifest",
        endpoint: "/api/agent/manifest",
        description: "Agent-readable API, integrations, guardrails and active strategy."
      },
      {
        uri: "lunchup://agent/tasks",
        endpoint: "/api/agent/tasks",
        description: "AI task queue, worker claim/complete contract, run trace and manager-review status."
      },
      {
        uri: "lunchup://integrations/preflight",
        endpoint: "/api/integrations/preflight",
        description: "Protected launch-readiness check for Telegram Mini App, 2GIS, DaData/FNS and outbound integrations."
      },
      {
        uri: "lunchup://integrations/launch-guide",
        endpoint: "/api/integrations/launch-guide",
        description: "Protected operator handoff for BotFather, Telegram Mini App links, env keys, launch steps and success criteria."
      },
      {
        uri: "lunchup://integrations/telegram/setup-preview",
        endpoint: "/api/integrations/telegram/setup-preview",
        description: "Protected no-mutation preview of Telegram setWebhook, setChatMenuButton and setMyCommands payloads with secrets redacted."
      }
    ],
    tools: [
      {
        name: "read_dashboard",
        method: "GET",
        endpoint: "/api/dashboard",
        input_schema: { type: "object", properties: {} }
      },
      {
        name: "read_miniapp_catalog",
        method: "GET",
        endpoint: "/api/miniapp/catalog",
        input_schema: { type: "object", properties: {} }
      },
      {
        name: "list_agent_tasks",
        method: "GET",
        endpoint: "/api/agent/tasks",
        input_schema: {
          type: "object",
          properties: {
            status: { type: "string" },
            limit: { type: "number" }
          }
        }
      },
      {
        name: "claim_next_agent_task",
        method: "PATCH",
        endpoint: "/api/agent/tasks",
        input_schema: {
          type: "object",
          required: ["action", "worker_id"],
          properties: {
            action: { type: "string", enum: ["claim_next"] },
            worker_id: { type: "string" },
            allowed_agent_codes: { type: "array", items: { type: "string" } },
            max_attempts: { type: "number" }
          }
        }
      },
      {
        name: "complete_agent_task",
        method: "PATCH",
        endpoint: "/api/agent/tasks",
        output_note: "Writes ai_tasks.result_json, ai_task_runs, optional ai_agent_memories, then moves the task to needs_review or done.",
        input_schema: {
          type: "object",
          required: ["action", "task_id", "worker_id", "result"],
          properties: {
            action: { type: "string", enum: ["complete"] },
            task_id: { type: "number" },
            worker_id: { type: "string" },
            mode: { type: "string" },
            model: { type: "string" },
            result: { type: "object" }
          }
        }
      },
      {
        name: "run_integration_preflight",
        method: "GET",
        endpoint: "/api/integrations/preflight",
        input_schema: { type: "object", properties: {} }
      },
      {
        name: "read_integration_launch_guide",
        method: "GET",
        endpoint: "/api/integrations/launch-guide",
        input_schema: { type: "object", properties: {} }
      },
      {
        name: "preview_telegram_setup",
        method: "GET",
        endpoint: "/api/integrations/telegram/setup-preview",
        input_schema: { type: "object", properties: {} }
      },
      {
        name: "create_or_update_company_lead",
        method: "POST",
        endpoint: "/api/companies",
        input_schema: {
          type: "object",
          required: ["company_name"],
          properties: {
            company_name: { type: "string" },
            inn: { type: "string" },
            segment: { type: "string" },
            website: { type: "string" },
            address: { type: "string" },
            telegram_url: { type: "string" },
            telegram_username: { type: "string" },
            telegram_channel_type: { type: "string" },
            telegram_contact_status: { type: "string" },
            telegram_source_url: { type: "string" },
            telegram_source_note: { type: "string" },
            agent_contact_policy: { type: "string" },
            agent_contact_readiness: { type: "string" },
            agent_contact_next_step: { type: "string" },
            lead_score: { type: "number" },
            contact: {
              type: "object",
              properties: {
                name: { type: "string" },
                role: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                telegram_handle: { type: "string" },
                preferred_channel: { type: "string" }
              }
            },
            dry_run: { type: "boolean" }
          }
        }
      },
      {
        name: "enrich_company_for_proposal",
        method: "POST",
        endpoint: "/api/miniapp/enrichment",
        output_note: "Returns profile, office_people, headcount_evidence, proposal, sources and cache metadata.",
        input_schema: {
          type: "object",
          required: ["company_name", "initData"],
          properties: {
            initData: { type: "string" },
            company_name: { type: "string" },
            inn: { type: "string" },
            website: { type: "string" },
            address: { type: "string" },
            segment: { type: "string" }
          }
        }
      },
      {
        name: "refresh_crm_company_enrichment",
        method: "POST",
        endpoint: "/api/companies/{company_id}/enrichment",
        output_note: "Returns enrichment, source_statuses, cache_hit and saved flags.",
        input_schema: {
          type: "object",
          required: ["company_id"],
          properties: {
            company_id: { type: "number" },
            force_refresh: { type: "boolean" },
            cache_ttl_hours: { type: "number" },
            dry_run: { type: "boolean" }
          }
        }
      },
      {
        name: "bulk_refresh_company_enrichment",
        method: "POST",
        endpoint: "/api/companies/enrichment/bulk",
        output_note:
          "Batch refreshes CRM company enrichment with dry_run, limit, cache_ttl_hours, source_statuses, cache_hit and saved flags. Demo 2GIS key runs are capped at 10 companies and should use cache by default.",
        input_schema: {
          type: "object",
          properties: {
            company_ids: { type: "array", items: { type: "number" } },
            only_missing: { type: "boolean" },
            segment: { type: "string" },
            limit: { type: "number" },
            force_refresh: { type: "boolean" },
            cache_ttl_hours: { type: "number" },
            dry_run: { type: "boolean" }
          }
        }
      },
      {
        name: "search_2gis_lead_candidates",
        method: "POST",
        endpoint: "/api/integrations/2gis/search",
        output_note:
          "Server-side 2GIS Places API lead search. Defaults to dry_run and returns candidates plus suggested /api/companies payloads; confirmed import uses lead-intake. Demo 2GIS key searches are capped at 10 candidates and must not be parallelized.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string" },
            segment: { type: "string" },
            city: { type: "string" },
            district: { type: "string" },
            limit: { type: "number" },
            dry_run: { type: "boolean" },
            confirm_import: { type: "boolean" },
            create_ai_task: { type: "boolean" }
          }
        }
      },
      {
        name: "create_miniapp_order",
        method: "POST",
        endpoint: "/api/miniapp/orders",
        input_schema: {
          type: "object",
          required: ["initData", "profile", "items"],
          properties: {
            initData: { type: "string" },
            profile: { type: "object" },
            delivery_address: { type: "string" },
            delivery_date: { type: "string" },
            payment_date: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["product_id", "quantity"],
                properties: {
                  product_id: { type: "number" },
                  quantity: { type: "number" }
                }
              }
            }
          }
        }
      },
      {
        name: "read_miniapp_order_history",
        method: "POST",
        endpoint: "/api/miniapp/orders/history",
        input_schema: {
          type: "object",
          required: ["initData"],
          properties: {
            initData: { type: "string" }
          }
        }
      },
      {
        name: "export_order_to_external_webhook",
        method: "POST",
        endpoint: "/api/integrations/orders/export",
        input_schema: {
          type: "object",
          required: ["order_id"],
          properties: {
            order_id: { type: "number" }
          }
        }
      },
      {
        name: "update_order_status",
        method: "POST",
        endpoint: "/api/orders/{order_id}/status",
        input_schema: {
          type: "object",
          required: ["order_id", "status"],
          properties: {
            order_id: { type: "number" },
            status: { type: "string", enum: ["draft", "manager_review", "confirmed", "in_delivery", "completed", "blocked_minimum", "cancelled"] },
            manager_comment: { type: "string" },
            notify_customer: { type: "boolean" }
          }
        }
      },
      {
        name: "run_apify_company_research",
        method: "POST",
        endpoint: "/api/integrations/apify/research",
        input_schema: {
          type: "object",
          properties: {
            company_id: { type: "number" },
            company_name: { type: "string" },
            inn: { type: "string" },
            website: { type: "string" },
            address: { type: "string" },
            segment: { type: "string" },
            actor_id: { type: "string" },
            actor_input: { type: "object" },
            dry_run: { type: "boolean" },
            confirm_run: { type: "boolean" },
            max_items: { type: "number" }
          }
        }
      }
    ],
    integrations: getIntegrationStatus(),
    dgis_demo_key_limits: {
      source: "2GIS Console screenshots captured by operator on 2026-06-13",
      human_reference: "docs/2GIS_DEMO_KEY_LIMITS.md",
      search_apis: {
        applies_to: ["Places API", "Geocoder API", "Suggest API", "Categories API", "Regions API", "Markers API"],
        per_minute_requests_stop: 600,
        per_month_requests_block: 1000
      },
      navigation_apis: {
        routing_directions_truck: {
          per_minute_objects_stop: 5,
          per_day_objects_stop: 50,
          per_month_objects_block: 1000
        },
        distance_matrix: {
          per_minute_requests_stop: 10,
          per_day_requests_stop: 200,
          per_minute_objects_stop: 1000,
          per_day_objects_stop: 7000,
          per_month_requests_block: 1000
        },
        tsp: {
          per_minute_requests_stop: 2,
          per_day_requests_stop: 20,
          per_minute_objects_stop: 50,
          per_day_objects_stop: 1200,
          per_month_requests_block: 1000
        },
        isochrone: {
          per_minute_requests_stop: 5,
          per_day_requests_stop: 30,
          per_month_requests_block: 1000
        },
        map_matching: {
          per_minute_requests_stop: 5,
          per_day_requests_stop: 50,
          per_month_requests_block: 1000
        }
      },
      agent_policy: [
        "Use demo 2GIS key only for targeted enrichment, not mass lead scraping.",
        "At most 10 CRM companies or 10 2GIS candidates per agent run.",
        "Default to dry_run and cache; force_refresh only for 1-3 selected companies.",
        "Do not parallelize 2GIS calls on a demo key.",
        "Do not bypass 429/403/monthly block by creating new demo keys.",
        "On quota or block errors, stop 2GIS calls and create a manager review task."
      ]
    },
    guardrails: [
      "Do not expose TELEGRAM_BOT_TOKEN, DGIS_API_KEY, DADATA_API_KEY, APIFY_TOKEN or EXTERNAL_ORDER_WEBHOOK_TOKEN to client UI.",
      "Customer-facing Mini App actions require Telegram initData validation unless explicit local demo mode is enabled.",
      "Office people estimates use 2GIS, DaData/FNS, company website and CRM evidence as ranges with confidence, not exact employee claims.",
      "Integration preflight reports readiness and error evidence only; it must never return secret values.",
      "New company intake must use /api/companies with dry_run for previews; agents must not write directly to SQLite.",
      "Company-level Telegram fields are public B2B channel evidence only; unknown or unverified channels must stay not_found/needs_verification.",
      "Do not use userbot outreach, personal accounts or mass Telegram messages unless the channel is a confirmed public B2B/company bot and a manager explicitly approves the first contact.",
      "2GIS lead search must default to dry_run; importing candidates requires confirm_import and goes through lead-intake.",
      "2GIS demo key use is capped at 10 companies or candidates per run, must use cache/dry_run first, and must stop on quota errors.",
      "Do not parallelize 2GIS calls on a demo key and do not bypass 429/403/monthly blocks by creating new demo keys.",
      "Apify research must start with dry_run and must use APIFY_TOKEN server-side only; actor results are queued for manager review before CRM mutation.",
      "External order export is outbound-only and records integration_events for audit.",
      "Order status updates are CRM-manager actions and may notify Telegram customers when a bot token is configured.",
      "Agent workers may write ai_task_runs, ai_tasks.result_json and ai_agent_memories; business mutations require manager approval."
    ]
  }
}
