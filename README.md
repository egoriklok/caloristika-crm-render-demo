# Lunch Up CRM

CRM для запуска продаж Lunch Up в Санкт-Петербурге и Ленинградской области: лиды, каталог, матрицы запуска, скрипты, Telegram-заказы и очередь AI-агентов.

## Текущий стек

- Next.js App Router 16 + React 19.
- TypeScript 6, Tailwind CSS 4, shadcn-style UI components.
- SQLite: `data/lunch_up_crm.sqlite`.
- Route Handlers для API: `app/api/**/route.ts`.
- Канонический UI: `app/page.tsx` + `components/crm-dashboard.tsx`.
- Старый HTML runtime удален: `scripts/server.mjs` теперь только совместимый launcher для Next.

На этой Windows-машине Next 16 запускается через Webpack: `next dev/build --webpack`. Это нужно из-за ошибки нативного SWC/Turbopack binding на текущей платформе; сборка использует WASM fallback.

## Быстрый запуск

```bash
npm run db:init
npm run verify
npm run web
```

Для выездной демонстрации CRM под Caloristika B2B используйте отдельную инструкцию:
`docs/CALORISTIKA_DEMO_RUNBOOK.md`.

## Render

Код подготовлен для Render как приватный GitHub-репозиторий:
`https://github.com/egoriklok/caloristika-crm-render-demo`.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fegoriklok%2Fcaloristika-crm-render-demo)

Render читает `render.yaml` из корня проекта и создает Node Web Service
`caloristika-crm-demo`. Для приватного репозитория в Render нужно войти через
GitHub и разрешить Render GitHub App доступ к этому репозиторию.

После деплоя проверить:

```text
https://<render-service>.onrender.com/
https://<render-service>.onrender.com/catalog
https://<render-service>.onrender.com/miniapp
https://<render-service>.onrender.com/api/health
```

Подробная инструкция: `docs/RENDER_DEPLOYMENT_RUNBOOK.md`.

Для следующего клиента Render-развертывание делается как отдельный проект:
отдельный приватный GitHub repo, отдельный Render service, отдельный SQLite-файл
и отдельный strategy token. Агент должен сначала собрать каталог новой компании
из ее сайта, публичного каталога, прайса, PDF, spreadsheet или файла оператора,
а затем строить `products`, `segment_matrices`, клиентский каталог, Mini App,
скрипты и КП только из этого источника. Нельзя переносить SKU, цены, фото,
описания или матрицу запуска из Lunch Up, Caloristika или другого демо без
прямого разрешения и записи provenance.

Открыть:

```text
http://localhost:3011
```

Mini App со стратегией по умолчанию:

```text
http://localhost:3011/miniapp
```

Это уже не витрина стратегии, а рабочий Telegram Mini App: кабинет клиента, подтягивание данных компании, мобильный каталог, корзина и оформление заказа в CRM.

Активный пакет стратегии: `lunch_up_spb_lo_20260604`, токен `209498707_lunch_up_spb_lo_20260604`.
СПб остается зоной бесплатной доставки с понедельника по четверг; Ленинградская область подключается через якорных клиентов, согласованные маршруты и индивидуальные условия.

Для доступа из локальной сети CRM слушает `0.0.0.0:3011`. Другому человеку в той же сети можно дать:

```text
http://<IP-адрес-ноутбука>:3011
```

Если задан `CRM_ACCESS_KEY`, ссылка должна быть полной:

```text
http://<IP-адрес-ноутбука>:3011/?key=<ключ>
```

## Скрипты

```bash
npm run web          # Next dev server на 0.0.0.0:3011 через scripts/server.mjs
npm run dev          # прямой Next dev server
npm run build        # production build через Webpack
npm run start        # production start после build
npm run db:init      # пересоздать SQLite seed
npm run verify       # проверить таблицы, данные, отсутствие demo-заказов
npm run agent:migrate # подготовить SQLite-схему для agent worker, trace и памяти
npm run agent:worker # запустить worker очереди ai_tasks рядом с CRM
npm run agent:worker-smoke # проверить worker на временной SQLite-копии без LLM/сети
npm run agent:provider-smoke # проверить Paperclip/Hermes/OpenClaw HTTP-подключение на временной SQLite-копии
npm run gstack:check # проверить WSL-установку gstack для Codex-workflow
npm run telegram:env-bootstrap # dry-run подготовки .env.local без вывода секретов
npm run telegram:check # безопасно проверить готовность бота, Mini App, 2ГИС и DaData
npm run dgis:set-key # безопасно записать demo key 2ГИС в локальный .env.local
npm run dgis:check # проверить demo key 2ГИС без вывода секрета
npm run telegram:launch-check-smoke # проверить telegram:check, BotFather handoff и отсутствие секретов без сети
npm run telegram:setup-dry-run-smoke # проверить payload настройки webhook/menu/commands без обращения к Telegram
npm run telegram:setup-preview-smoke # проверить protected setup-preview API для CRM/MCP-агента
npm run telegram:webhook-smoke # проверить маршрутизацию /order, /cart, /cabinet, /orders и Mini App intent без Telegram-токена
npm run telegram:webhook-access-smoke # проверить, что webhook проходит по Telegram secret header без CRM key
npm run telegram:webhook-post-smoke # проверить реальный POST webhook, CRM-события и ai_tasks на временной SQLite-копии
npm run launch-guide:smoke # проверить operator_handoff, BotFather /newapp, ссылки запуска и отсутствие секретов в launch-guide
npm run integration:preflight-mock-smoke # проверить protected preflight с mock 2ГИС/DaData proxy без реальных внешних ключей
npm run miniapp:auth-smoke # проверить подписанный Telegram initData, кабинет, заказ и историю без demo mode
npm run miniapp:enrichment-smoke # проверить кнопку автозаполнения Mini App через mock 2ГИС/DaData и signed initData
npm run miniapp:order-smoke # проверить корзину и создание заказа на временной SQLite-копии
npm run company:enrichment-smoke # проверить 2ГИС/DaData/сайт enrichment на mock-источниках и временной SQLite-копии
npm run project-sheet:import # поставить AI-задачи по Google Sheet "Шаблон проекта" без дублей
npm run telegram:launch # проверить, настроить Telegram и выполнить protected preflight
npm run telegram:setup # настроить webhook, меню и Mini App кнопку после создания бота
```

## API

### CRM dashboard

```http
GET /api/dashboard
GET /api/health
GET /miniapp
```

### AI agents

```http
GET  /api/agent/manifest
GET  /api/agent/tasks
POST /api/agent/tasks
PATCH /api/agent/tasks
GET  /api/mcp/manifest
```

AI agent runtime состоит из CRM API, SQLite-очереди `ai_tasks` и отдельного worker-процесса. Сначала подготовить схему:

```bash
npm run agent:migrate
```

Операционная модель по 12 ключевым вопросам для директора по развитию и AI-агентов описана в `docs/CRM_AI_AGENT_OPERATING_MODEL.md`. Короткая инструкция для оператора без технических деталей: `docs/OPERATOR_ONE_PAGE_RUNBOOK.md`.

Проверить без внешнего LLM и без изменения рабочей базы:

```bash
npm run agent:worker-smoke
```

Запустить один offline-проход по текущей базе:

```bash
npm run agent:worker -- --once --limit=3 --no-llm
```

Выбрать внешний движок можно через server-side env:

```bash
AGENT_LLM_PROVIDER=paperclip npm run agent:worker
```

Поддерживаемые режимы: `offline`, `paperclip`, `hermes`, `openclaw`, `openai`. Для Paperclip, Hermes и OpenClaw CRM использует HTTP endpoint или локальную command-настройку, а не прямую оплату токенов OpenAI. Worker берет queued задачи, ставит lock, строит ограниченный CRM-контекст, возвращает структурированный JSON, пишет `ai_task_runs`, `ai_tasks.result_json` и `ai_agent_memories`. Он не меняет заказы, цены, контакты, статусы, внешние экспорты или Telegram-уведомления без решения менеджера. Подробные правила: `docs/AI_AGENT_RUNBOOK.md`.

### Telegram/bot

```http
GET /api/bot/catalog
POST /api/bot/orders
POST /api/telegram/webhook
```

`/api/bot/orders` создает заказ транзакционно, проверяет минимум 7 000 руб. и ставит задачу агенту `telegram_order_validator`.

### Telegram Mini App

```http
GET  /miniapp
GET  /api/miniapp/catalog
POST /api/miniapp/session
POST /api/miniapp/enrichment
POST /api/miniapp/orders
POST /api/miniapp/orders/history
```

Mini App проверяет Telegram `initData` на сервере через `TELEGRAM_BOT_TOKEN`, связывает Telegram-пользователя с `bot_customers`, создает или обновляет компанию, сохраняет контакт, хранит профиль кабинета в `miniapp_customer_profiles` и отправляет заказ в `orders + order_items`.

Кабинет клиента поддерживает профиль компании, ИНН, контакт, email, телефон, адрес доставки, дату доставки, комментарий к заказу, оценку людей в офисе, расчет стартового КП, историю заказов с составом SKU и повтор заказа в корзину. При повторном входе Mini App подтягивает сохраненный server-side профиль из CRM и заполняет пустые поля, не затирая локальный черновик клиента. История заказов показывает клиентские статусы `На проверке`, `Подтвержден`, `В доставке`, комментарий менеджера и пояснение следующего шага, а не внутренние CRM-коды. Telegram-команда `/order` ведет в каталог и корзину, `/cart` открывает оформление, `/cabinet` открывает профиль компании и расчет КП, а `/orders` открывает Mini App с `tg_view=cabinet&tg_intent=orders`, чтобы клиент сразу видел личный кабинет и историю. После 2ГИС/ФНС-расчета Mini App сразу сохраняет обогащенный профиль в CRM, чтобы компания, контакт, адрес, email, телефон, сайт и оценка офиса были доступны менеджеру еще до оформления заказа. Mini App также показывает блок `Что предложить`: источник численности, размер офиса, сценарий запуска, список предложений для КП и следующую задачу менеджера; эти же формулировки сохраняются в заказе. Mini App может одной кнопкой собрать стартовый заказ из каталога по рекомендованным порциям и SKU. Mini App сохраняет локальный черновик профиля, корзины, даты доставки, комментария и расчета КП, чтобы клиент не потерял заказ при закрытии Telegram; при заполненном черновике включается Telegram closing confirmation, а в корзине/кабинете работает native BackButton. Корзина пересчитывается на сервере по актуальным ценам CRM; сервер также проверяет адрес доставки, дату доставки, минимальный срок и cutoff 15:00. Если сумма ниже 7 000 руб., Mini App показывает быстрые рекомендации `Добрать минимум`, а отправленный заказ ниже минимума сохраняется как `blocked_minimum`. Если `TELEGRAM_BOT_TOKEN` подключен, клиент получает Telegram-подтверждение с номером, статусом, суммой заказа и кнопкой `Мои заказы и повтор`, которая возвращает в историю Mini App.

Вкладка CRM **Заказы** показывает не только статус и сумму, но и адрес доставки, количество позиций, первые SKU из `order_items`, количество и цену по строке. Это нужно менеджеру для быстрой проверки перед подтверждением и уведомлением клиента.

Чтобы создать нового Telegram-бота:

1. В Telegram открыть `@BotFather`.
2. Создать бота командой `/newbot`.
3. Сохранить токен в `TELEGRAM_BOT_TOKEN`.
4. Задать `TELEGRAM_WEBHOOK_SECRET`, чтобы защищенная CRM принимала webhook от Telegram.
5. Задать публичный адрес CRM в `PUBLIC_BASE_URL` или использовать сохраненную ссылку из `logs/public_crm_url.txt`.
6. Запустить `npm run telegram:env-bootstrap`, чтобы увидеть dry-run подготовки `.env.local` без вывода секретов.
7. После проверки выполнить `npm run telegram:env-bootstrap -- --write`, затем заполнить внешние ключи `TELEGRAM_BOT_TOKEN`, `DGIS_API_KEY`, `DADATA_API_KEY`.
8. Запустить `npm run telegram:check`, чтобы увидеть готовность, ссылку BotFather, подсказку username будущего бота, Mini App entrypoints `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami` и следующие действия без вывода токенов.
9. Запустить `npm run telegram:launch`.

`npm run telegram:launch` — основной операторский запуск. Он сначала выполняет безопасный `telegram:check`, затем при наличии всех ключей запускает `telegram:setup`, проверяет Telegram webhook и вызывает protected preflight CRM. Значения секретов не печатаются. Для проверки без записи в Telegram используйте `npm run telegram:launch -- --dry-run --no-network`; когда все ключи заполнены, dry-run дополнительно покажет planned payload для `setWebhook`, `setChatMenuButton` и `setMyCommands` с замаскированным webhook secret.

`npm run telegram:env-bootstrap` — безопасная подготовка `.env.local`. По умолчанию это dry-run: команда показывает, какие ключи будут заполнены, переиспользует `logs/public_crm_url.txt` и `logs/public_access_key.txt`, генерирует новый `TELEGRAM_WEBHOOK_SECRET` только в памяти и не печатает значения секретов. Запись выполняется только с явным `npm run telegram:env-bootstrap -- --write`; существующие заполненные значения не перезаписываются без флага `--force`.

`npm run telegram:setup` не создает бота вместо BotFather, но перед настройкой Telegram проверяет, что публичные `/miniapp` и `/api/miniapp/catalog` доступны и каталог отдает товары. После этого он проверяет бота через Telegram API, настраивает описание, короткое описание, webhook, меню, команды `/start`, `/order`, `/cart`, `/cabinet`, `/orders`, `/help`, `/whoami` и кнопку открытия Mini App. Webhook отправляет разные deep-link intents: `/order` открывает каталог/корзину, `/cart` открывает оформление, `/cabinet` открывает профиль компании и расчет КП, `/orders` открывает кабинет с историей заказов. Если `PUBLIC_BASE_URL` не задан, скрипт попробует взять публичную ссылку из `logs/public_crm_url.txt`. Для контролируемого внутреннего теста preflight можно пропустить флагом `--skip-url-preflight`. Для безопасного просмотра payload без мутаций Telegram можно запустить `node scripts/setup-telegram-bot.mjs --dry-run --json --skip-url-preflight`: будут показаны `setWebhook`, `setChatMenuButton`, `setMyCommands`, но `TELEGRAM_WEBHOOK_SECRET` останется скрытым.

`npm run telegram:check` читает `.env.local`, публичную ссылку из env или `logs/public_crm_url.txt`, проверяет Telegram `getMe/getWebhookInfo`, показывает Mini App/webhook URL, BotFather URL, подсказку будущей ссылки бота, клиентские entrypoints `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami`, недостающие ключи и следующие действия. Значения `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DGIS_API_KEY`, `DADATA_API_KEY` и других секретов не печатаются.

`npm run telegram:launch-check-smoke` запускает `telegram:check` с фиктивными ключами в `--no-network` режиме, проверяет JSON и текстовый вывод, BotFather handoff, entrypoints `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami` и подтверждает, что значения секретов не попадают в вывод.

`npm run telegram:setup-dry-run-smoke` запускает `setup-telegram-bot.mjs --dry-run --json --skip-url-preflight` с фиктивными ключами, проверяет payload для `setWebhook`, `setChatMenuButton`, `setMyCommands`, команды `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami` и подтверждает, что значения секретов не попадают в вывод.

`npm run telegram:setup-preview-smoke` поднимает временный CRM-процесс и вызывает защищенный `/api/integrations/telegram/setup-preview`. Проверка подтверждает, что без CRM key endpoint закрыт, с ключом отдает server-side preview для `setWebhook`, `setChatMenuButton`, `setMyCommands`, entrypoints `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami` и не раскрывает `TELEGRAM_BOT_TOKEN` или `TELEGRAM_WEBHOOK_SECRET`.

`npm run telegram:webhook-smoke` не обращается к Telegram и не пишет в SQLite. Он проверяет локальную intent-матрицу webhook: `/order` открывает каталог, `/cart` открывает оформление с `tg_view=cart&tg_intent=cart`, `/cabinet` открывает кабинет с `tg_view=cabinet&tg_intent=cabinet`, `/orders` открывает кабинет с `tg_view=cabinet&tg_intent=orders`, `/help` не запускает заказной intent.

`npm run telegram:webhook-access-smoke` поднимает временный локальный CRM-процесс с тестовыми `CRM_ACCESS_KEY` и `TELEGRAM_WEBHOOK_SECRET`, делает только GET-запросы и завершает процесс. Проверка подтверждает: без ключей webhook закрыт, с неверным Telegram secret закрыт, с CRM key доступен оператору, с корректным `X-Telegram-Bot-Api-Secret-Token` доступен без CRM key для Telegram.

`npm run telegram:webhook-post-smoke` поднимает временный CRM-процесс с тестовым `TELEGRAM_WEBHOOK_SECRET` и временной копией SQLite через `LUNCH_UP_CRM_DB_PATH`. Он отправляет POST-обновления `/order`, `/cart`, `/cabinet`, `/orders`, `/help`, `/whoami` в `/api/telegram/webhook`, проверяет защиту secret-header, создание `telegram_events`, `bot_customers`, `ai_tasks`, Mini App intents и подтверждает, что команды webhook не создают заказы. Рабочая база `data/lunch_up_crm.sqlite` не меняется.

`npm run launch-guide:smoke` поднимает временный CRM-процесс с тестовыми секретами, вызывает `/api/integrations/launch-guide`, проверяет `operator_handoff`, BotFather-команды, `miniapp_setup` для `/newapp`, прямую ссылку `https://t.me/BotFather`, подсказку URL будущего бота, Telegram-native `startapp` ссылки, клиентские входы `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami`, ссылки для клиента/Telegram/оператора, `share_assets` с готовым текстом сообщения, Telegram share URL, QR payload и `qr_image_url`, публичный SVG endpoint `/api/integrations/share-qr`, критерии успешного запуска и подтверждает, что значения `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DGIS_API_KEY`, `DADATA_API_KEY` и `APIFY_TOKEN` не попадают в JSON-ответ.

`npm run integration:preflight-mock-smoke` поднимает временный CRM-процесс и mock 2ГИС/DaData server, задает `DGIS_API_BASE_URL` и `DADATA_API_BASE_URL`, затем вызывает protected `/api/integrations/preflight`. Проверка подтверждает публичные `/miniapp`, `/api/miniapp/catalog`, Telegram webhook по secret header, 2ГИС и DaData через proxy/mock, не раскрывает секреты и оставляет запуск заблокированным без `TELEGRAM_BOT_TOKEN`.

`npm run miniapp:auth-smoke` поднимает временный CRM-процесс с тестовым `TELEGRAM_BOT_TOKEN`, подписывает Telegram Web App `initData`, проверяет отказ без initData и с неверной подписью, затем создает кабинет, сохраняет server-side профиль клиента, проверяет восстановление профиля без локального черновика, создает заказ и историю заказов через `/api/miniapp/session`, `/api/miniapp/orders`, `/api/miniapp/orders/history` без `MINIAPP_DEMO_MODE`. Для smoke используется `TELEGRAM_OUTBOUND_DISABLED=1`, поэтому исходящие сообщения в Telegram не отправляются, а рабочая база не меняется.

`npm run miniapp:enrichment-smoke` поднимает временный CRM-процесс, mock-сервер 2ГИС/DaData/сайта компании и временную копию SQLite. Он подписывает Telegram Web App `initData`, проверяет защиту `/api/miniapp/enrichment` без initData, подтягивает ИНН, телефон, email, сайт, адрес, численность ФНС/DaData, 2ГИС и сайта, считает диапазон людей в офисе, возвращает `headcount_evidence` по источникам, затем сохраняет обогащенный кабинет через `/api/miniapp/session`. Рабочая база `data/lunch_up_crm.sqlite` не меняется.

`npm run miniapp:order-smoke` поднимает временный CRM-процесс с `MINIAPP_DEMO_MODE=1` и временной копией SQLite через `LUNCH_UP_CRM_DB_PATH`. Он читает Mini App catalog, собирает корзину выше 7 000 руб., создает заказ через `/api/miniapp/orders`, проверяет `orders + order_items`, историю заказов и сохранение guidance для КП в `orders.instructions`, затем завершает процесс. Рабочая база `data/lunch_up_crm.sqlite` не меняется.

`npm run company:enrichment-smoke` поднимает временный CRM-процесс, mock-сервер 2ГИС/DaData/сайта компании и временную копию SQLite через `LUNCH_UP_CRM_DB_PATH`. Он проверяет `dry_run` без записи, создание лида во временной базе, сохранение `company_enrichment_profiles`, `company_enrichment_sources`, численности ФНС/DaData, 2ГИС, сайта компании, `headcount_evidence`, `proposal_summary` для КП, а также поиск кандидатов через `POST /api/integrations/2gis/search` с dry-run и подтвержденным импортом. Рабочая база `data/lunch_up_crm.sqlite` не меняется.

Чтобы включить уведомления менеджеру, после настройки webhook откройте бота в Telegram, отправьте `/whoami`, скопируйте полученный `Telegram chat id` в `TELEGRAM_MANAGER_CHAT_ID` внутри `.env.local` и перезапустите CRM.

### Company enrichment

```http
POST /api/companies
POST /api/miniapp/enrichment
POST /api/companies/{company_id}/enrichment
```

`POST /api/companies` — защищенная точка входа для бота, Apify, AI-агентов и внешних интеграций. Достаточно передать `company_name`, опционально ИНН, сайт, адрес, сегмент и контакт. CRM создает или обновляет компанию без дублей, создает контакт и сделку, подтягивает 2ГИС/DaData/сайт/CRM enrichment, сохраняет `company_enrichment_profiles`, считает людей в офисе, порции, SKU и бюджет запуска. Для предварительного расчета без записи в SQLite используйте `dry_run: true`.

Обогащение компании использует:

- официальный 2ГИС Places API, если задан `DGIS_API_KEY`;
- DaData/FНС по ИНН или названию, если задан `DADATA_API_KEY`;
- сайт компании из 2ГИС, CRM или входных данных: публичные email/телефон и фразы о численности команды;
- текущую CRM и локальные лиды;
- будущий Apify worker, если задан `APIFY_TOKEN`;
- эвристику по сегменту для оценки `office_people`.

Результат сохраняется в `company_enrichment_profiles` и `company_enrichment_sources`. Для КП используется диапазон людей в офисе, дневная посещаемость, вероятные покупатели, рекомендованные порции, SKU и бюджет запуска. Ответ enrichment также содержит `headcount_evidence`: ФНС/DaData, 2ГИС, сайт компании и CRM-сегмент с отметкой, какой источник реально использован в расчете. Ответ enrichment также содержит `proposal`: источник численности, размер офиса, сценарий запуска, `what_to_offer`, `proposal_summary`, следующий шаг менеджера и допущения, чтобы AI-агент и менеджер не превращали оценку в ложное точное число.

Для QA, proxy или тестов без внешней сети можно задать `DGIS_API_BASE_URL` и `DADATA_API_BASE_URL`. Если они пустые, CRM использует официальные endpoint-ы 2ГИС и DaData. Эти переменные не заменяют ключи, а только позволяют направить server-side запросы в проверенный proxy/mock-контур.

Demo key 2ГИС зафиксирован как ограниченный ключ для точечной проверки, а не
для массового сбора лидов. AI-агенты должны соблюдать лимиты из
`docs/2GIS_DEMO_KEY_LIMITS.md`: по умолчанию не больше 10 компаний или
кандидатов за один запуск, без параллельных 2ГИС-запросов, без nightly/bulk
enrichment и без обхода 429/403/месячной блокировки созданием новых demo keys.

`POST /api/companies/{company_id}/enrichment` поддерживает безопасный cache: сохраненный профиль используется до 72 часов, если не передать `force_refresh: true`. Для массовых сценариев AI-агента можно передать `cache_ttl_hours`, чтобы управлять сроком свежести и не расходовать лимиты 2ГИС/DaData на повторные запросы. При cache-hit новые записи в `company_enrichment_sources` не создаются.

В CRM это доступно во вкладке **Компании**:

- блок `Новый лид и КП` делает `dry_run`-расчет по названию/ИНН/адресу, затем создает компанию, контакт и сделку;
- кнопка `2ГИС/ФНС` принудительно обновляет одну компанию из внешних источников;
- кнопка `Заполнить видимые` обновляет текущий отфильтрованный список, до 10 компаний за запуск, и использует свежий cache для контроля quota;
- телефон, email, сайт, ИНН, адрес, оценка офиса и источники численности показываются прямо в таблице компаний и в предпросмотре `Новый лид и КП`.

Для КП не использовать оценку как точное юридическое число сотрудников. Формат для менеджера: `80-120 человек в офисе`, `уверенность: high/medium/low`, `источники: ФНС/DaData, 2ГИС, сайт компании, CRM-сегмент`; если ФНС/DaData пустые, менеджер должен подтвердить фактическую посещаемость офиса до финального КП.

### External integrations and MCP

```http
GET  /api/integrations/status
GET  /api/integrations/preflight
GET  /api/integrations/launch-guide
GET  /api/integrations/share-qr
GET  /api/integrations/telegram/setup-preview
POST /api/integrations/orders/export
POST /api/integrations/apify/research
POST /api/integrations/2gis/search
POST /api/companies/enrichment/bulk
POST /api/orders/{order_id}/status
GET  /api/mcp/manifest
```

`/api/integrations/status` показывает готовность Telegram, Mini App, 2ГИС, DaData/ФНС, Apify, внешнего order webhook и MCP manifest.

`/api/integrations/preflight` выполняет защищенную проверку запуска: публичная ссылка CRM, фактическая доступность `/miniapp` и `/api/miniapp/catalog`, публичная доступность `/api/telegram/webhook` с Telegram secret header без CRM key, webhook secret, Telegram `getMe/getWebhookInfo`, 2ГИС Places API, DaData/ФНС, уведомления менеджеру и внешний export. Для 2ГИС/DaData проверка использует `DGIS_API_BASE_URL` и `DADATA_API_BASE_URL`, если задан QA/proxy/mock-контур; иначе обращается к официальным endpoint-ам. Секреты не возвращаются в ответ.

`/api/integrations/launch-guide` отдает безопасный пакет запуска для оператора: публичные Mini App/webhook ссылки, команду настройки Telegram, список нужных env-ключей без значений секретов и шаги подключения BotFather, 2ГИС, DaData и уведомлений менеджеру. В пакете есть `operator_handoff`: предложенное имя и username бота, ссылка на BotFather, подсказка URL будущего бота, Telegram-native `startapp` ссылки, BotFather-команды, `miniapp_setup` с `/newapp`, `TELEGRAM_MINIAPP_SHORT_NAME`, named/fallback `startapp` ссылками, инструкция хранения токена, env-шаблон с подсказкой где взять каждый ключ, `connection_checklist` с official URL для Telegram/2ГИС/DaData/Apify, ссылки для клиента/оператора/Telegram, `share_assets` для отправки клиенту с готовым текстом, Telegram share URL, QR payload и `qr_image_url`, клиентские входы `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami` и критерии успешного запуска.

`/api/integrations/share-qr?url=...` генерирует SVG QR-код для http/https ссылки из `share_assets`. Endpoint не читает SQLite, не принимает токены и не кодирует CRM key; он нужен только для клиентских QR входов в Mini App, каталог или будущего Telegram-бота.

Во вкладке **Telegram API** блок `Панель подключений` показывает, что уже готово, что обязательно осталось подключить и где это используется в CRM: Telegram BotFather token, публичный Mini App/webhook, 2ГИС Places API, DaData/ФНС, Apify research и внешний export заказов. Блок `Готовые ссылки для отправки` показывает клиентские входы в Mini App, каталог и бота с текстом сообщения, web URL, Telegram `startapp` URL, Telegram share URL, QR payload и SVG QR-картинкой. Блок `Mini App в BotFather` показывает `/newapp`, short name, named/fallback ссылки и URL, который нужно указать в BotFather. Значения ключей не выводятся.

`/api/integrations/telegram/setup-preview` отдает защищенный no-mutation preview для Telegram setup: planned payload `setWebhook`, `setChatMenuButton`, `setMyCommands`, публичные Mini App/webhook ссылки и entrypoints `/order`, `/cart`, `/cabinet`, `/orders`, `/whoami`. Endpoint нужен CRM и AI/MCP-агенту, чтобы проверить запуск до реальной мутации Telegram API. `secret_token` всегда возвращается как `[secret hidden]` или `[not configured]`.

В CRM во вкладке **Telegram API** этот preview показывается как операторский блок `Server-side preview настройки Telegram`: методы Telegram API, Mini App/webhook ссылки, недостающие ключи и клиентские команды видны без раскрытия токенов.

`/api/companies/enrichment/bulk` выполняет защищенное пакетное автозаполнение компаний для менеджера или AI/MCP-агента. Параметры: `company_ids`, `only_missing`, `segment`, `limit`, `force_refresh`, `cache_ttl_hours`, `dry_run`. По умолчанию batch берет только компании без enrichment, ограничивает объем за один запуск и использует cache; `dry_run: true` возвращает `source_statuses`, `headcount_evidence`, расчет людей в офисе и КП без записи в SQLite. Cache-hit не создает дублирующие записи в `company_enrichment_sources`.

`POST /api/integrations/2gis/search` выполняет защищенный server-side поиск новых B2B-кандидатов в 2ГИС по СПб/ЛО, сегменту, району и текстовому запросу. По умолчанию endpoint работает как `dry_run`: возвращает `candidates`, публичные контакты, адрес, ИНН, `employees_org_count` при наличии и `suggested_payload` для карточки компании без записи в SQLite. Импорт требует `dry_run: false` и `confirm_import: true`; после подтверждения CRM передает payload в `/api/companies`, поэтому агент не пишет напрямую в базу и получает тот же enrichment с оценкой людей в офисе, источниками численности и КП.

Правило заполнения локации для всех лидов, контактов и AI-workflows закреплено в `docs/CRM_DATA_COLLECTION_RULES.md`: адрес, ссылка 2ГИС и минуты на авто от производства на Уральской улице, 13 обязательны для каждой карточки CRM. Для сетевых компаний без выбранной точки используется временная запись о сети и 2ГИС-поиск, а следующим действием ставится уточнение пилотного адреса.

`/api/integrations/orders/export` отправляет заказ во внешний webhook, если задан `EXTERNAL_ORDER_WEBHOOK_URL`. Payload содержит заказ, компанию, контакт, enrichment и позиции заказа. Каждый экспорт записывается в `integration_events`.

`/api/integrations/apify/research` готовит или запускает Apify Actor для публичного B2B research по компании. По умолчанию используйте `dry_run: true`, чтобы увидеть actor payload без записи и запуска. Реальный запуск требует `APIFY_TOKEN`, `actor_id` или `APIFY_DEFAULT_RESEARCH_ACTOR_ID`, `dry_run: false` и `confirm_run: true`. Запуск записывается в `integration_events`, а результат ставит задачу агенту `apify_actor_researcher` на проверку источников перед любыми изменениями CRM.

`/api/orders/{order_id}/status` меняет статус заказа из CRM и отправляет клиенту Telegram-уведомление, если бот уже подключен. В уведомлении есть кнопка `Мои заказы и повтор`, чтобы клиент сразу открыл историю и мог повторить заказ.

`/api/mcp/manifest` отдает машинный контракт для AI/MCP-агентов: ресурсы CRM, Mini App catalog, launch preflight, launch guide, Telegram setup preview, enrichment, поиск кандидатов 2ГИС, создание заказа и экспорт заказа во внешнюю систему.

### AI agents

```http
GET /api/agent/manifest
POST /api/agent/tasks
```

`/api/agent/manifest` отдает машинную карту CRM: доступные агенты, API tools, guardrails и региональный scope.

Для AI-агентов действует правило one source of truth: если сущность уже есть в CRM, агент использует ее и не создает дубль. Каталог Lunch Up является единой точкой истины для SKU, цен, фото, описаний, добавления и удаления позиций; CRM, Mini App, клиентские КП, бот-каталог и экономика с Самокатом должны читать эти данные из каталога, чтобы любое изменение обновлялось во всех местах.

Для клонированного проекта “Каталог Lunch Up” заменяется на каталог новой
компании. Агент обязан использовать только SKU новой компании из подтвержденного
источника и строить матрицу запуска из активных строк SQLite `products` через
`segment_matrices` / `matrix_items`; старые SKU прошлых демо не являются
допустимым fallback.

### Google Sheet enrichment

CRM подключает Google Sheet `Шаблон проекта` как business-analysis слой: https://docs.google.com/spreadsheets/d/1YGxYn6OP8lB7H33-1sNCqS8sUmdE0-ing90x9P0w71w/edit.

Из него в CRM подтягиваются JTBD-сегменты, боли, решения, 30 тем контент-плана и рекомендации SKU: `стартовая матрица`, `городская матрица с прогнозом спроса`, `только после проверки спроса`. Это обогащает вкладки **Каталог**, **Скрипт** и **Карта возражений** без ручной правки JSON-файла запуска. Команда `npm run project-sheet:import` дополнительно ставит AI-задачи для sales/outreach/SKU/follow-up агентов и не создает дубли при повторном запуске.

### Apify Store для AI-агентов

Apify Store зафиксирован как внешний источник инструментов для AI-workflows CRM: https://console.apify.com/store.
Оператор подключился к Apify Console через GitHub OAuth. Это дает возможность подбирать Apify Actors для публичного lead research, проверки сайтов, сбора B2B-контактов, мониторинга каталогов и enrichment по локальным лидам СПб/ЛО.

Токены не хранятся в CRM, SQLite, клиентском UI или публичной ссылке. Для автоматических запусков нужен отдельный server-side secret `APIFY_TOKEN` и `APIFY_DEFAULT_RESEARCH_ACTOR_ID` или `actor_id` в защищенном запросе. Route `/api/integrations/apify/research` сначала работает как dry-run payload preview, а реальный запуск требует `confirm_run: true`; результаты идут в `ai_tasks`, а не напрямую меняют сделки, заказы и контакты.

Перед массовыми actor-запусками менеджер подтверждает источник, лимиты, стоимость и правовое основание коммуникации.

## Переменные окружения

Для постоянного запуска на этом ноутбуке скопируйте `.env.example` в `.env.local` и заполните значения. `npm run web`, `npm run telegram:check`, `npm run telegram:launch` и `npm run telegram:setup` читают `.env.local` автоматически; уже заданные системные переменные имеют приоритет. `.env.local` не должен отправляться клиентам, в публичные ссылки или в GitHub.

```bash
set CRM_ACCESS_KEY=strong-key
set TELEGRAM_BOT_TOKEN=telegram-bot-token
set TELEGRAM_WEBHOOK_SECRET=telegram-secret
set TELEGRAM_MANAGER_CHAT_ID=manager-chat-id
set TELEGRAM_BOT_DISPLAY_NAME=Lunch Up заказы
set TELEGRAM_BOT_DESCRIPTION=Каталог Lunch Up для юридических лиц
set TELEGRAM_BOT_SHORT_DESCRIPTION=Каталог, корзина и B2B-заказы Lunch Up
set TELEGRAM_MENU_BUTTON_TEXT=Lunch Up заказ
set TELEGRAM_MINIAPP_SHORT_NAME=lunchup
set PUBLIC_BASE_URL=https://example.trycloudflare.com
set DGIS_API_KEY=2gis-api-key
set DADATA_API_KEY=dadata-api-key
set DGIS_API_BASE_URL=http://127.0.0.1:9999/2gis/3.0/items
set DADATA_API_BASE_URL=http://127.0.0.1:9999
set APIFY_TOKEN=apify-secret
set APIFY_DEFAULT_RESEARCH_ACTOR_ID=apify-actor-id
set AGENT_LLM_PROVIDER=paperclip
set PAPERCLIP_AGENT_ENDPOINT=http://127.0.0.1:3100/api/agents/lunch-up
set HERMES_AGENT_ENDPOINT=http://127.0.0.1:9119/lunch-up-agent
set OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
set EXTERNAL_ORDER_WEBHOOK_URL=https://external-system.example/orders
set EXTERNAL_ORDER_WEBHOOK_TOKEN=external-secret
set EXTERNAL_ORDER_WEBHOOK_PROVIDER=moisklad-or-1c
set MINIAPP_DEMO_MODE=1
set PORT=3011
set HOST=0.0.0.0
set CRM_NEXT_MODE=start
set LUNCH_UP_CRM_DB_PATH=/app/data/lunch_up_crm.sqlite
set LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS=5000
set LUNCH_UP_SQLITE_MMAP_SIZE=268435456
set LUNCH_UP_SQLITE_WAL=1
set PERF_BASE_URL=http://127.0.0.1:3011
```

- `CRM_ACCESS_KEY` защищает UI и внутренние API через `proxy.ts`, `?key=...` и httpOnly-cookie. `/api/telegram/webhook` не должен требовать CRM key от Telegram; он пропускается только при корректном `X-Telegram-Bot-Api-Secret-Token`.
- `TELEGRAM_BOT_TOKEN` нужен для проверки Mini App `initData` и отправки кнопки Mini App из webhook.
- `TELEGRAM_WEBHOOK_SECRET` разрешает Telegram webhook по заголовку `X-Telegram-Bot-Api-Secret-Token`; этот secret передается в `setWebhook`, клиентам и в CRM-ссылках не отправляется.
- `TELEGRAM_MANAGER_CHAT_ID` включает Telegram-уведомления менеджеру о новых Mini App заказах. Уведомление содержит сумму, дату доставки, адрес, комментарий клиента и первые SKU заказа.
- `TELEGRAM_BOT_DISPLAY_NAME`, `TELEGRAM_BOT_DESCRIPTION`, `TELEGRAM_BOT_SHORT_DESCRIPTION`, `TELEGRAM_MENU_BUTTON_TEXT` задают клиентскую карточку и кнопку бота при `npm run telegram:setup`.
- `TELEGRAM_MINIAPP_SHORT_NAME` опционален: если через BotFather `/newapp` создан short name Mini App, CRM строит ссылки `https://t.me/<bot>/<short>?startapp=order`; без него используется fallback `https://t.me/<bot>?startapp=order`.
- `TELEGRAM_OUTBOUND_DISABLED=1` использовать только для smoke/QA: Mini App auth продолжает проверять подпись `initData`, но исходящие Telegram API сообщения не отправляются.
- `PUBLIC_BASE_URL` нужен для webhook и публичной ссылки Mini App.
- `DGIS_API_KEY` включает server-side поиск компаний через 2ГИС Places API. Для demo key обязательно соблюдать `docs/2GIS_DEMO_KEY_LIMITS.md`.
- `DADATA_API_KEY` включает поиск организации по ИНН/названию и поле `employee_count` для расчета КП.
- `DGIS_API_BASE_URL` и `DADATA_API_BASE_URL` использовать только для QA/proxy/mock; если они пустые, CRM обращается к официальным endpoint-ам.

После получения demo key 2ГИС добавьте его только в `.env.local` или server-side
переменные Render:

```bash
npm run dgis:set-key
npm run dgis:check
```

Команда `dgis:set-key` спросит ключ скрытым вводом и запишет `DGIS_API_KEY` в
локальный `.env.local`, который не отправляется в GitHub. Альтернативно можно
вписать строку вручную:

```bash
DGIS_API_KEY=...
npm run dgis:check
```

Команда `dgis:check` делает один короткий запрос к официальному 2ГИС Places API,
проверяет доступность полей, которые нужны CRM для карточек компаний, и не
печатает значение ключа.
- `APIFY_TOKEN` нужен только server-side API для запуска Apify Actors; не передавать его в клиентский UI.
- `APIFY_DEFAULT_RESEARCH_ACTOR_ID` задает Actor по умолчанию для `/api/integrations/apify/research`; можно переопределять через `actor_id` в защищенном запросе.
- `AGENT_LLM_PROVIDER` выбирает движок worker: `offline`, `paperclip`, `hermes`, `openclaw` или `openai`. Для отказа от OpenAI используйте `paperclip`, `hermes` или `openclaw`.
- `PAPERCLIP_AGENT_ENDPOINT` или `PAPERCLIP_AGENT_COMMAND` подключает Paperclip как внешний orchestrator или локальный процесс.
- `HERMES_AGENT_ENDPOINT` или `HERMES_AGENT_COMMAND` подключает Hermes Agent как gateway/API или локальный процесс.
- `OPENCLAW_AGENT_ENDPOINT`, `OPENCLAW_GATEWAY_URL` или `OPENCLAW_AGENT_COMMAND` подключает OpenClaw gateway или локальный процесс.
- `EXTERNAL_ORDER_WEBHOOK_URL` включает outbound-экспорт заказов во внешнюю систему.
- `EXTERNAL_ORDER_WEBHOOK_TOKEN` передается как `Bearer` только server-side.
- `EXTERNAL_ORDER_WEBHOOK_PROVIDER` задает имя внешней системы в `integration_events`.
- `MINIAPP_DEMO_MODE=1` разрешает локальный тест Mini App без Telegram `initData`; на публичном доступе лучше не включать.
- `LUNCH_UP_CRM_DB_PATH` задает путь к SQLite. Для ноутбука можно оставить пустым, для сервера/контейнера указывать путь к persistent volume.
- `LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS`, `LUNCH_UP_SQLITE_MMAP_SIZE`, `LUNCH_UP_SQLITE_WAL` управляют SQLite-настройками для конкурентных запросов и серверного диска.
- `PORT` и `HOST` меняют адрес launcher-скрипта `npm run web`.
- `CRM_NEXT_MODE=start` включает production `next start`, если перед этим выполнен `npm run build`.
- `PERF_BASE_URL` задает адрес для `npm run perf:baseline`.

## Перенос на сервер и performance baseline

Подробная инструкция: [`docs/DEPLOYMENT_AND_SCALING.md`](docs/DEPLOYMENT_AND_SCALING.md).

Минимальный production-путь:

```bash
npm run build:server-stage
cd ~/.cache/lunch-up-crm-build
npm ci
npm run verify
npm run db:migrate-customer-portal
npm run admin:catalog-export
npm run build
CRM_NEXT_MODE=start npm run web
```

Проверка здоровья и baseline:

```bash
curl http://127.0.0.1:3011/api/health
npm run perf:baseline
npm run perf:load-smoke
```

Корневая CRM-страница загружает тяжелую dashboard-выгрузку через `/api/dashboard`, а не встраивает ее в первый HTML. Это уменьшает первый ответ и упрощает перенос приложения за reverse proxy/CDN. Для горизонтального масштабирования не запускайте несколько write-capable реплик на одном SQLite-файле; сначала вынесите operational tables в PostgreSQL.

## Основные таблицы

- `companies`, `contacts`, `deals`, `pipeline_stages`, `activities`.
- `products`, `segment_matrices`, `matrix_items`.
- `bot_customers`, `orders`, `order_items`, `telegram_events`.
- `ai_agents`, `ai_tasks`, `cjm_events`.
- `company_enrichment_profiles`, `company_enrichment_sources`.
- `integration_events`.

## Ограничение данных

Стартовая база использует компании, кластеры и публичные B2B-каналы, а не личные данные сотрудников. Перед массовым outreach нужно вручную подтвердить актуальные закупочные контакты и правовое основание коммуникации.
