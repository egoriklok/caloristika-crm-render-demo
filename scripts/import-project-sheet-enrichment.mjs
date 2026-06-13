import { DatabaseSync } from "node:sqlite"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const dbPath = process.env.LUNCH_UP_CRM_DB_PATH ?? join(root, "data", "lunch_up_crm.sqlite")

function datePlus(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const tasks = [
  {
    agentCode: "lead_research",
    taskType: "project_sheet_enrichment",
    priority: 91,
    dueAt: datePlus(1),
    prompt:
      "project_sheet_enrichment: На базе Google Sheet 'Шаблон проекта' проверить 12 JTBD-сегментов Lunch Up, разметить текущие компании CRM по сегментам и выделить 20 приоритетных лидов СПб/ЛО для пилота 20-25 SKU."
  },
  {
    agentCode: "sku_matrix_analyst",
    taskType: "project_sheet_sku_guidance",
    priority: 89,
    dueAt: datePlus(1),
    prompt:
      "project_sheet_enrichment: Использовать роли SKU из вкладки 'Гайд и продуктовая линейка': стартовая матрица/ниже риск списаний, городская матрица с прогнозом спроса, только после проверки спроса. Подготовить рекомендации для КП и Mini App."
  },
  {
    agentCode: "outreach_writer",
    taskType: "project_sheet_outreach",
    priority: 86,
    dueAt: datePlus(2),
    prompt:
      "project_sheet_enrichment: Превратить 30 тем контент-плана из Google Sheet в короткие B2B-сообщения для Telegram/email: боль сегмента, оффер пилота, доказательство, вопрос на следующий шаг."
  },
  {
    agentCode: "followup_scheduler",
    taskType: "project_sheet_pilot_followup",
    priority: 84,
    dueAt: datePlus(3),
    prompt:
      "project_sheet_enrichment: Настроить сценарий follow-up для 14-дневного пилота: день 0 дегустация, день 5-7 weekly review, топ-10 SKU, повторный заказ, второй адрес или маршрутный запуск."
  }
]

const db = new DatabaseSync(dbPath)
let inserted = 0
try {
  for (const task of tasks) {
    const agent = db.prepare("SELECT id FROM ai_agents WHERE code = ? AND is_active = 1").get(task.agentCode)
    if (!agent) {
      throw new Error(`Missing active AI agent: ${task.agentCode}`)
    }
    const exists = db.prepare("SELECT id FROM ai_tasks WHERE task_type = ? AND prompt = ? LIMIT 1").get(task.taskType, task.prompt)
    if (exists) continue
    db.prepare(`
      INSERT INTO ai_tasks(agent_id, task_type, priority, prompt, due_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(agent.id, task.taskType, task.priority, task.prompt, task.dueAt)
    inserted += 1
  }
} finally {
  db.close()
}

console.log(`Project sheet enrichment tasks inserted: ${inserted}`)
