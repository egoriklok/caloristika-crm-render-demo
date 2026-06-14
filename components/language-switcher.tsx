"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

type Locale = "ru" | "en"

const storageKey = "caloristika_crm_locale"

const translationPairs: Array<[string, string]> = [
  ["CRM для B2B-продаж готовой еды: от первого интереса до повторного заказа", "CRM for B2B ready-meal sales: from first interest to repeat order"],
  [
    "Когда поставщик готовой еды запускает B2B-продажи, команде нужно быстро понять, какие компании подходят, что предложить каждому сегменту, как провести дегустацию, принять первый заказ и закрепить повтор. Demo собирает этот путь в одном рабочем месте: локальные лиды, сегменты, SKU-матрицы, клиентский каталог, Telegram Mini App, заказы и AI-задачи менеджеру.",
    "When a ready-meal supplier launches B2B sales, the team needs to quickly understand which companies fit, what to offer each segment, how to run a tasting, take the first order and secure the repeat. The demo keeps that path in one workspace: local leads, segments, SKU matrices, client catalog, Telegram Mini App, orders and AI tasks for the manager."
  ],
  ["Данные собраны на примере компании и открытого каталога. Это demo-кейс для показа логики продукта. Для первого просмотра используйте публичный вход в CRM без ключа.", "The data is assembled around one company and an open catalog. This is a demo case for showing product logic. For a first look, use the public CRM entry without a key."],
  ["Маршрут роста B2B-продаж", "B2B sales growth route"],
  ["На примере ", "Using "],
  [": как выбрать точки, собрать предложение, принять заказ и вернуться за повтором.", ": how to choose points, assemble the offer, take the order and return for the repeat."],
  ["B2B-локаций", "B2B locations"],
  ["SKU в demo", "Demo SKUs"],
  ["Матриц запуска", "Launch matrices"],
  ["Repo слоя", "Repo layers"],
  ["Что посмотреть в CRM:", "What to inspect in CRM:"],
  ["воронка, сегмент, товарная матрица, каталог, заказ и задача менеджеру.", "pipeline, segment, product matrix, catalog, order and manager task."],
  ["Задача клиента", "Client task"],
  ["Проверить B2B-канал и довести первые сделки до повтора", "Validate the B2B channel and move first deals to repeat orders"],
  ["Команде нужен понятный маршрут: найти подходящие компании, подобрать стартовый набор, провести дегустацию, принять первый заказ и вовремя вернуться к клиенту за повтором.", "The team needs a clear route: find suitable companies, assemble a starter set, run a tasting, take the first order and return to the client on time for the repeat."],
  ["Локальные B2B-сегменты", "Local B2B segments"],
  ["Кофейни, микромаркеты, офисы, кампусы, фитнес и другие точки с регулярным спросом.", "Coffee shops, micromarkets, offices, campuses, fitness venues and other points with recurring demand."],
  ["Предложение под формат точки", "Offer by point format"],
  ["Короткая стартовая матрица объясняет, какие позиции подходят точке и с какой глубиной запускать тест.", "A short starter matrix explains which items fit the point and how deep to run the test."],
  ["Повтор как главный KPI", "Repeat order as the main KPI"],
  ["CRM держит менеджера на следующем действии после дегустации, пилота и первой поставки.", "CRM keeps the manager focused on the next action after tasting, pilot and first delivery."],
  ["Единая demobase", "Unified demobase"],
  ["Одна история продукта: CRM, каталог и операционная модель", "One product story: CRM, catalog and operating model"],
  ["Внешнему клиенту показываем одну цепочку: сначала открываем CRM Caloristika, затем смотрим клиентский каталог и Mini App, затем объясняем CRM OS как модель запуска для следующей компании.", "Show an external client one chain: first open Caloristika CRM, then inspect the client catalog and Mini App, then explain CRM OS as a launch model for the next company."],
  ["Публичный вход в demo CRM без ключа: можно открыть воронку, единую базу, матрицу запуска и клиентские разделы.", "Public entry into demo CRM without a key: open the pipeline, unified base, launch matrix and client sections."],
  ["Каталог и Mini App показывают, как клиент видит ассортимент, выбирает позиции и переходит к заказу.", "The catalog and Mini App show how the client sees assortment, selects items and moves to an order."],
  ["Архитектурная витрина: как повторять запуск под новую компанию, подключать агентов, источники данных, Telegram и внешние API.", "Architecture showcase: how to repeat the launch for a new company and connect agents, data sources, Telegram and external APIs."],
  ["Что открыть в CRM", "What to open in CRM"],
  ["Путь от первой точки до повторного заказа", "Path from first point to repeat order"],
  ["На странице можно открыть CRM Caloristika без ключа, пройти воронку, посмотреть товарные матрицы, каталог, Mini App и задачи менеджеру. На созвоне этот сценарий занимает 12-15 минут.", "The page lets you open Caloristika CRM without a key, walk through the pipeline, product matrices, catalog, Mini App and manager tasks. In a call, this scenario takes 12-15 minutes."],
  ["Формулировка для первого разговора", "First-call wording"],
  ["Процесс продажи", "Sales process"],
  ["Маршрут от базы до денег", "Route from base to revenue"],
  ["Коммерческий оффер", "Commercial offer"],
  ["Что предлагать после просмотра CRM", "What to offer after the CRM walkthrough"],
  ["Начать с короткого знакомства с продуктом, затем предложить платный пилот на одном сегменте. Внедрение CRM повторных заказов обсуждать после сигнала по лидам, дегустациям и первым заказам.", "Start with a short product walkthrough, then offer a paid pilot on one segment. Discuss repeat-order CRM implementation after signals from leads, tastings and first orders."],
  ["Работа с возражениями", "Objection handling"],
  ["Ответы на вопросы клиента", "Answers to client questions"],
  ["Страница должна звучать как рабочий инструмент для роста B2B-продаж: понятные сегменты, предложения, действия менеджера и контроль повтора.", "The page should feel like a working instrument for B2B sales growth: clear segments, offers, manager actions and repeat-order control."],
  ["Ссылка для первого просмотра", "First-view link"],
  ["Эту ссылку можно отправлять для просмотра CRM без ключа. Человек сразу попадает внутрь панели Caloristika и видит воронку, базу, каталог, заказы и AI-задачи.", "Send this link for CRM review without a key. The viewer lands inside the Caloristika panel and sees the pipeline, base, catalog, orders and AI tasks."],
  ["Демо построено на примере компании и открытых каталогах. Формат страницы: demo-кейс продукта на данных", "The demo is built around one company and open catalogs. Page format: a product demo case based on"],
  ["Открыть CRM Caloristika", "Open Caloristika CRM"],
  ["Открыть CRM", "Open CRM"],
  ["Открыть каталог", "Open catalog"],
  ["Открыть Mini App", "Open Mini App"],
  ["Открыть сделки на стадиях: новый лид, квалификация, контакт, дегустация, пробная поставка.", "Open deals by stage: new lead, qualification, contact, tasting, trial delivery."],
  ["Посмотреть компании, сегменты, score, адрес, источники и следующий шаг менеджера.", "Inspect companies, segments, score, address, sources and the manager's next step."],
  ["Понять, что предлагать конкретному сегменту и с какой глубиной запускать тест.", "Understand what to offer a specific segment and how deep to launch the test."],
  ["Посмотреть задачи: письмо, follow-up, товарная рекомендация, enrichment и проверка источников.", "Inspect tasks: email, follow-up, product recommendation, enrichment and source checks."],
  ["Закупка", "Purchase"],
  ["Фото SKU", "SKU photo"],
  ["Результат", "Result"],
  ["Что показать", "What to show"],
  ["Процесс", "Process"],
  ["Оффер", "Offer"],
  ["Сегменты", "Segments"],
  ["CRM-экраны", "CRM screens"],
  ["Товары", "Products"],
  ["Скрипт", "Script"],
  ["Каталог", "Catalog"],
  ["Единая база", "Unified base"],
  ["Матрица запуска", "Launch matrix"],
  ["Клиентская сторона", "Client side"],
  ["Кофейни и пекарни", "Coffee shops and bakeries"],
  ["Кофейные сети", "Coffee chains"],
  ["Вендинг и микромаркеты", "Vending and micromarkets"],
  ["Офисы и БЦ", "Offices and business centers"],
  ["Фитнес и кампусы", "Fitness and campuses"],
  ["Знакомство с продуктом", "Product introduction"],
  ["Пилот одного сегмента", "One-segment pilot"],
  ["CRM повторных заказов", "Repeat-order CRM"],
  ["Ежемесячный рост", "Monthly growth"],
  ["15-30 минут", "15-30 minutes"],
  ["Публичный вход в CRM", "Public CRM entry"],
  ["Клиентский каталог и Mini App", "Client catalog and Mini App"],
  ["CRM OS как модель повторяемого запуска", "CRM OS as a repeatable launch model"],
  ["100-150 B2B-компаний", "100-150 B2B companies"],
  ["Воронка, КП и первые касания", "Pipeline, proposal and first touches"],
  ["Каталог, Mini App и отчет по сигналам", "Catalog, Mini App and signal report"],
  ["Роли менеджера и руководителя", "Manager and leader roles"],
  ["Заказы и история клиента", "Orders and client history"],
  ["AI-задачи, интеграции, backup/restore", "AI tasks, integrations, backup/restore"],
  ["Новые лиды и enrichment", "New leads and enrichment"],
  ["Разбор просроченных задач", "Overdue task review"],
  ["Новые КП, офферы и агентские workflow", "New proposals, offers and agent workflows"],
  ["CRM уже есть", "We already have CRM"],
  ["Есть сайт и личный кабинет", "We have a website and account area"],
  ["Нужен простой старт", "We need a simple start"],

  ["Активная стратегия", "Active strategy"],
  ["Демо-стратегия", "Demo strategy"],
  ["Demo strategy", "Demo strategy"],
  ["Клиентский каталог", "Client catalog"],
  ["Админ-каталог", "Admin catalog"],
  ["Каталог CRM", "CRM catalog"],
  ["Печать", "Print"],
  ["CRM demo / печать", "CRM demo / print"],
  ["Продажи", "Sales"],
  ["Клиенты", "Clients"],
  ["Операции", "Operations"],
  ["Воронка", "Pipeline"],
  ["Локальные лиды", "Local leads"],
  ["О компании", "About company"],
  ["Карта возражений", "Objection map"],
  ["Компании", "Companies"],
  ["Контакты", "Contacts"],
  ["Заказы", "Orders"],
  ["Оборудование", "Equipment"],
  ["ИИ-агенты", "AI agents"],
  ["Telegram API", "Telegram API"],
  ["Воронка продаж", "Sales pipeline"],
  ["Стадии спроектированы под путь от лида до повторного заказа.", "Stages are designed around the path from lead to repeat order."],
  ["Фокус недели", "Weekly focus"],
  ["Следующие действия для директора по продажам.", "Next actions for the sales director."],
  ["Статус", "Status"],
  ["Готово к работе", "Ready to work"],
  ["Последнее действие CRM показывается здесь.", "The latest CRM action appears here."],
  ["Потенциал воронки", "Pipeline potential"],
  ["оценка месячной выручки", "estimated monthly revenue"],
  ["SKU из ассортимента Lunch Up", "SKUs from the Lunch Up assortment"],
  ["web + Telegram pipeline", "web + Telegram pipeline"],
  ["Открыть", "Open"],
  ["сделок", "deals"],
  ["сделки", "deals"],
  ["лиды", "leads"],
  ["Лиды", "Leads"],
  ["Новый лид", "New lead"],
  ["Квалификация", "Qualification"],
  ["Контакт", "Contact"],
  ["Дегустация", "Tasting"],
  ["Пробная поставка", "Trial delivery"],
  ["Повтор", "Repeat"],
  ["Контракт", "Contract"],
  ["Выиграно", "Won"],
  ["Проиграно", "Lost"],
  ["Загрузка единой базы, заказов, каталога и AI-задач.", "Loading the unified base, orders, catalog and AI tasks."],
  ["Обновить", "Refresh"],
  ["CRM временно недоступна", "CRM is temporarily unavailable"],
  ["Подготавливаем рабочее пространство", "Preparing the workspace"],
  ["Первый экран открывается отдельно от тяжёлой CRM-выгрузки, чтобы приложение быстрее стартовало на сервере.", "The first screen opens separately from the heavy CRM export so the app starts faster on the server."],
  ["CRM API вернул", "CRM API returned"],
  ["Не удалось загрузить CRM", "Failed to load CRM"],
  ["нет даты", "no date"],
  ["не указана", "not specified"],
  ["Черновик", "Draft"],
  ["На проверке", "In review"],
  ["Подтвержден", "Confirmed"],
  ["В доставке", "In delivery"],
  ["Выполнен", "Completed"],
  ["Ниже минимума", "Below minimum"],
  ["Отменен", "Cancelled"],
  ["Все сегменты", "All segments"],
  ["публичный найден", "public found"],
  ["проверить", "check"],
  ["можно писать", "allowed to contact"],
  ["не писать", "do not contact"],
  ["не найден", "not found"],
  ["нет AI-канала", "no AI channel"],
  ["публичный канал", "public channel"],
  ["оператор", "operator"],
  ["похоже на бот", "looks like a bot"],
  ["Показаны сделки стадии:", "Showing deals in stage:"],
  ["Показаны сделки:", "Showing deals:"],
  ["Каталог:", "Catalog:"],
  ["Скрипт:", "Script:"],
  ["Импортировано из 2ГИС:", "Imported from 2GIS:"],
  ["офис", "office"],
  ["человек", "people"],
  ["сделка", "deal"],
  ["обновлена", "updated"],
  ["Не удалось импортировать кандидата 2ГИС", "Failed to import 2GIS candidate"],
  ["Ставлю задачу ИИ-агенту", "Queuing an AI-agent task"],
  ["Задача добавлена в очередь", "Task added to queue"],
  ["Не удалось добавить задачу", "Failed to add task"],
  ["Обновляю заказ", "Updating order"],
  ["клиент уведомлен", "client notified"],
  ["уведомление клиенту не отправлено", "client notification was not sent"],
  ["Не удалось обновить заказ", "Failed to update order"],
  ["Проверяю запуск Telegram Mini App и интеграций", "Checking Telegram Mini App and integrations launch"],
  ["Preflight: блокеров нет", "Preflight: no blockers"],
  ["блокеров", "blockers"],
  ["предупреждений", "warnings"],
  ["Не удалось выполнить preflight", "Failed to run preflight"],
  ["Собираю server-side preview настройки Telegram", "Building server-side Telegram setup preview"],
  ["Telegram setup preview: все обязательные значения заданы", "Telegram setup preview: all required values are set"],
  ["Telegram setup preview: не хватает", "Telegram setup preview: missing"],
  ["Не удалось получить Telegram setup preview", "Failed to get Telegram setup preview"],

  ["Caloristika B2B: рост партнерской сети готовой еды в Санкт-Петербурге", "Caloristika B2B: ready-meal partner network growth in Saint Petersburg"],
  ["CRM для контроля B2B-партнеров Caloristika: leads, дегустации, матрицы SKU, повторные заказы, Telegram-каталог и AI-задачи менеджеру.", "CRM for Caloristika B2B partner control: leads, tastings, SKU matrices, repeat orders, Telegram catalog and AI tasks for the manager."],
  ["CRM для контроля B2B-партнеров Caloristika", "CRM for Caloristika B2B partner control"],
  ["дегустации", "tastings"],
  ["матрицы SKU", "SKU matrices"],
  ["повторные заказы", "repeat orders"],
  ["Telegram-каталог", "Telegram catalog"],
  ["Telegram catalog и AI tasks for the manager", "Telegram catalog and AI tasks for the manager"],
  ["Telegram catalog и AI tasks", "Telegram catalog and AI tasks"],
  ["AI-задачи менеджеру", "AI tasks for the manager"],
  ["B2B-лиды", "B2B leads"],
  ["стартовая база СПб/ЛО", "starter base in SPb/LO"],
  ["ИИ-задачи", "AI tasks"],
  ["очередь для агентов продаж", "queue for sales agents"],
  ["Квалифицирован", "Qualified"],
  ["Контакт установлен", "Contact made"],
  ["Повторный заказ", "Repeat order"],
  ["Договор/сеть", "Contract/network"],
  ["Активный клиент", "Active client"],
  ["Следующий этап:", "Next stage:"],
  ["1. Квалифицировать топ-18", "1. Qualify the top 18"],
  ["2. Назначить дегустации", "2. Schedule tastings"],
  ["3. Закрыть Telegram-процесс", "3. Close the Telegram process"],
  ["Сначала вендинг/микромаркеты и кофейни, где score выше 80.", "Start with vending/micromarkets and coffee shops where the score is above 80."],
  ["Цель: 30-50 дегустаций за 90 дней, затем пробные поставки.", "Target: 30-50 tastings in 90 days, then trial deliveries."],
  ["Бот принимает заказ, CRM проверяет минимум 3 000 руб. и передает менеджеру.", "The bot takes the order, CRM checks the 3,000 RUB minimum and hands it to the manager."],
  ["Бот принимает заказ, CRM проверяет минимум 3 000 руб. и передает менеджеру.", "The bot takes the order, CRM checks the 3,000 RUB minimum and hands it to the manager."],
  ["Pipeline по сегментам", "Pipeline by segment"],
  ["Сегмент x этап продаж с рекомендуемым запуском из матрицы.", "Segment x sales stage with a recommended launch from the matrix."],
  ["НАПРАВЛЕНИЕ", "DIRECTION"],
  ["СЕГМЕНТ", "SEGMENT"],
  ["Направление", "Direction"],
  ["Сегмент", "Segment"],
  ["Показано", "Shown"],
  ["Сегментов в виде", "Segments visible as"],
  ["Сделок", "Deals"],
  ["Потенциал", "Potential"],
  ["Средний score", "Average score"],
  ["Все направления", "All directions"],
  ["Кофе и локальный ритейл", "Coffee and local retail"],
  ["Рабочие и учебные локации", "Work and education locations"],
  ["Операторы и инфраструктура", "Operators and infrastructure"],
  ["HoReCa и готовая еда", "HoReCa and ready meals"],
  ["ЖК и транспорт", "Residential and transport"],
  ["Образовательные кампусы", "Educational campuses"],
  ["Коворкинг холодильник", "Coworking fridge"],
  ["Кофейни/пекарни", "Coffee shops/bakeries"],
  ["АЗС", "Gas stations"],
  ["Магазины", "Stores"],
  ["Ритейл-кластеры", "Retail clusters"],
  ["Офисные кластеры", "Office clusters"],
  ["Склады/производство", "Warehouses/production"],
  ["Учебные кампусы", "Education campuses"],
  ["Клиники/медцентры", "Clinics/medical centers"],
  ["Бани/SPA-комплексы", "Bathhouse/SPA complexes"],
  ["Компьютерные клубы", "Gaming clubs"],
  ["Вендинг/микромаркеты", "Vending/micromarkets"],
  ["Vending/микромаркеты", "Vending/micromarkets"],
  ["Операторы питания/столовые", "Food operators/canteens"],
  ["Rail-партнеры/Uvenco", "Rail partners/Uvenco"],
  ["Якорные клиенты ЛО", "Anchor clients in Leningrad Oblast"],
  ["HoReCa-кластеры", "HoReCa clusters"],
  ["Готовая еда", "Ready meals"],
  ["ЖК/апарт-комплексы", "Residential/apartment complexes"],
  ["Residential complexes/апарт-комплексы", "Residential/apartment complexes"],
  ["Транспорт", "Transport"],
  ["Фитнес-клубы", "Fitness clubs"],
  ["Коворкинги", "Coworkings"],
  ["Микромаркеты", "Micromarkets"],
  ["Вендинг", "Vending"],
  ["Кейтеринг", "Catering"],
  ["Рестораны", "Restaurants"],
  ["ЖК", "Residential complexes"],
  ["Транспортные узлы", "Transport hubs"]
]

const sortedTranslationPairs = [...translationPairs].sort((a, b) => Math.max(b[0].length, b[1].length) - Math.max(a[0].length, a[1].length))
const skippedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE"])

function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "en" || normalized.startsWith("en-")) return "en"
  if (normalized === "ru" || normalized.startsWith("ru-")) return "ru"
  return null
}

function localeFromBrowser(): Locale {
  const params = new URLSearchParams(window.location.search)
  return normalizeLocale(params.get("lang")) ?? normalizeLocale(window.localStorage.getItem(storageKey)) ?? "ru"
}

function replaceAll(value: string, from: string, to: string) {
  return value.split(from).join(to)
}

function translateText(value: string, locale: Locale) {
  let next = value
  for (const [ru, en] of sortedTranslationPairs) {
    next = locale === "en" ? replaceAll(next, ru, en) : replaceAll(next, en, ru)
  }
  return next
}

function shouldSkipTextNode(node: Node) {
  const parent = node.parentElement
  if (!parent) return true
  return skippedTags.has(parent.tagName)
}

function applyLocaleToText(root: ParentNode, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (!shouldSkipTextNode(node)) {
      const current = node.textContent ?? ""
      const next = translateText(current, locale)
      if (next !== current) node.textContent = next
    }
    node = walker.nextNode()
  }
}

function withLocaleHref(rawHref: string, locale: Locale) {
  try {
    const url = new URL(rawHref, window.location.origin)
    if (url.origin !== window.location.origin) return rawHref
    if (locale === "en") {
      url.searchParams.set("lang", "en")
    } else {
      url.searchParams.delete("lang")
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return rawHref
  }
}

function applyLocaleToLinks(locale: Locale) {
  for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='/']"))) {
    const href = anchor.getAttribute("href")
    if (!href) continue
    const next = withLocaleHref(href, locale)
    if (next !== href) anchor.setAttribute("href", next)
  }
}

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale
  applyLocaleToText(document.body, locale)
  applyLocaleToLinks(locale)
}

function persistLocale(locale: Locale, updateUrl: boolean) {
  window.localStorage.setItem(storageKey, locale)

  if (updateUrl) {
    const url = new URL(window.location.href)
    if (locale === "en") {
      url.searchParams.set("lang", "en")
    } else {
      url.searchParams.delete("lang")
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }

  window.dispatchEvent(new CustomEvent("caloristika-locale-change", { detail: locale }))
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const [locale, setLocale] = React.useState<Locale>("ru")

  React.useEffect(() => {
    const initialLocale = localeFromBrowser()
    setLocale(initialLocale)
    persistLocale(initialLocale, false)
    applyDocumentLocale(initialLocale)

    let applying = false
    const observer = new MutationObserver(() => {
      if (applying) return
      applying = true
      window.requestAnimationFrame(() => {
        applyDocumentLocale(localeFromBrowser())
        applying = false
      })
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const handleLocaleChange = (event: Event) => {
      const nextLocale = normalizeLocale((event as CustomEvent<Locale>).detail) ?? localeFromBrowser()
      setLocale(nextLocale)
      applyDocumentLocale(nextLocale)
    }
    window.addEventListener("caloristika-locale-change", handleLocaleChange)

    return () => {
      observer.disconnect()
      window.removeEventListener("caloristika-locale-change", handleLocaleChange)
    }
  }, [])

  function switchLocale(nextLocale: Locale) {
    setLocale(nextLocale)
    persistLocale(nextLocale, true)
    applyDocumentLocale(nextLocale)
  }

  return (
    <div className={`inline-flex rounded-md border bg-background p-0.5 shadow-sm ${className}`} aria-label="Language">
      {(["ru", "en"] as const).map((item) => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant={locale === item ? "default" : "ghost"}
          className="h-8 min-w-10 px-2 text-xs font-semibold"
          aria-pressed={locale === item}
          onClick={() => switchLocale(item)}
        >
          {item.toUpperCase()}
        </Button>
      ))}
    </div>
  )
}
