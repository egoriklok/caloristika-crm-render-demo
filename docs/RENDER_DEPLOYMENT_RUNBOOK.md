# Render Deployment Runbook

Цель: получить постоянные публичные ссылки на CRM и клиентский каталог, которые
работают не с ноутбука.

## Что уже подготовлено

- Приватный GitHub-репозиторий: `https://github.com/egoriklok/caloristika-crm-render-demo`.
- Render Blueprint: `render.yaml`.
- Production-команды:
  - build: `npm ci && npm run build:render`
  - start: `npm run start:render`
- Демо-база Caloristika создается при сборке через `npm run db:demo:caloristika`.
- SQLite на Render запускается без WAL, чтобы файл базы стабильно работал на
  ephemeral-диске free web service.

## Шаблон для следующих проектов

Для нового клиента нельзя переиспользовать каталог Lunch Up, Caloristika или
другой прошлой компании как основу матрицы запуска. Сначала агент должен создать
новый источник товаров из сайта предполагаемой компании, публичного каталога,
прайса, PDF, spreadsheet или файла, который дал оператор.

Минимальная последовательность для нового проекта:

1. Зафиксировать название компании, регион продаж, публичный сайт и источник
   каталога.
2. Импортировать только SKU новой компании: название, категорию, цену, вес,
   срок годности, фото, ссылку на карточку и источник.
3. Если данных не хватает, записать `needs_confirmation`/source note и не
   использовать догадки в клиентском КП.
4. Пересобрать SQLite seed под отдельный файл, например
   `data/<client_slug>_demo_crm.sqlite`.
5. Построить `segment_matrices` и `matrix_items` только из активных SKU новой
   компании.
6. Проверить `/api/dashboard`, `/catalog`, `/miniapp` и `/api/health` локально.
7. Создать отдельный приватный GitHub repo и отдельный Render service.
8. На Render указать `LUNCH_UP_CRM_DB_PATH` на новый SQLite-файл и оставить
   `LUNCH_UP_SQLITE_WAL=0` для free web service.

Результат считается готовым только если публичный Render URL показывает в
`/api/dashboard` активное количество SKU нового каталога, а вкладка
`Матрица запуска` не содержит старых SKU, цен, фото и названий прошлой компании.

## Деплой через кнопку

1. Открыть:
   `https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fegoriklok%2Fcaloristika-crm-render-demo`
2. Войти в Render.
3. Если Render попросит доступ к GitHub, разрешить Render GitHub App доступ к
   репозиторию `egoriklok/caloristika-crm-render-demo`.
4. Подтвердить Blueprint.
5. Render попросит секреты из `sync: false`. Минимально заполнить
   `CRM_ACCESS_KEY`, чтобы CRM не была публичной. Остальные ключи можно оставить
   пустыми на первом запуске и добавить позже в Environment:
   `DGIS_API_KEY`, `DADATA_API_KEY`, `APIFY_TOKEN`, `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_WEBHOOK_SECRET`.
6. Дождаться статуса Live.

## Проверка после деплоя

Заменить `<render-service>` на фактический домен Render:

```text
https://<render-service>.onrender.com/
https://<render-service>.onrender.com/catalog
https://<render-service>.onrender.com/miniapp
https://<render-service>.onrender.com/api/health
```

Автоматическая проверка после появления URL:

```bash
npm run render:smoke -- https://<render-service>.onrender.com
```

Ожидаемый результат:

- CRM открывается с данными Caloristika.
- Клиентский каталог открывается по `/catalog`.
- Mini App демо открывается по `/miniapp`.
- `/api/health` отвечает `ok` без CRM key, потому что Render health check не
  передает приватный ключ. Остальные внутренние API остаются закрыты
  `CRM_ACCESS_KEY`.

## Если нужен CLI/API-деплой

Render API требует локальную переменную `RENDER_API_KEY`. Не отправляйте ключ в
чат: сохраните его в `.env.local` или переменных системы на ноутбуке.

Проверить готовность локальных repo и увидеть Dashboard deploy-ссылки:

```bash
npm run render:api -- preflight
```

`preflight` не требует Render key, не создает сервисы и показывает только статус
секретов как `<set>/<empty>`.

Безопасно сохранить ключи локально:

```bash
npm run render:env
```

Команда спросит `RENDER_API_KEY` и `CRM_ACCESS_KEY` скрытым вводом, запишет их
в `.env.local` и не выведет значения в терминал.

Проверить план без создания сервисов:

```bash
npm run render:api -- plan
```

Найти workspace/account id:

```bash
npm run render:api -- workspaces
```

После этого заполнить `RENDER_OWNER_ID` локально:

```bash
npm run render:env -- -OwnerId <tea_...>
```

Затем создать все три приложения:

```bash
npm run render:api -- create
```

Команда создает:

- `caloristika-crm-demo` как free Node Web Service из
  `egoriklok/caloristika-crm-render-demo`.
- `caloristika-b2b-crm-demo` как free Static Site из
  `egoriklok/caloristika-b2b-crm-demo`.
- `agentic-crm-product-blueprint` как free Static Site из
  `egoriklok/agentic-crm-product-blueprint`.

Если сервис уже есть в Render, команда его пропускает. Секреты
`CRM_ACCESS_KEY`, `DGIS_API_KEY`, `DADATA_API_KEY`, `APIFY_TOKEN`,
`TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET` не печатаются в plan-выводе.

После создания проверить список сервисов:

```bash
npm run render:api -- services
```

Render CLI как запасной путь требует интерактивный вход `render login` или ту
же переменную `RENDER_API_KEY`. После настройки CLI один web service можно
создать из того же репозитория и команд:

```bash
render services create \
  --name caloristika-crm-demo \
  --type web_service \
  --repo https://github.com/egoriklok/caloristika-crm-render-demo \
  --branch main \
  --runtime node \
  --build-command "npm ci && npm run build:render" \
  --start-command "npm run start:render" \
  --env-var NODE_VERSION=24.14.1 \
  --env-var NODE_ENV=production \
  --env-var NEXT_TELEMETRY_DISABLED=1 \
  --env-var CRM_NEXT_MODE=start \
  --env-var HOST=0.0.0.0 \
  --env-var LUNCH_UP_CRM_DB_PATH=/opt/render/project/src/data/caloristika_demo_crm.sqlite \
  --env-var LUNCH_UP_SQLITE_WAL=0 \
  --env-var LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS=5000 \
  --env-var LUNCH_UP_SQLITE_MMAP_SIZE=268435456
```

## Важное ограничение

Free web service на Render не является постоянным хранилищем заказов: SQLite-файл
может пересоздаваться при redeploy. Для настоящих заказов нужно вынести рабочие
таблицы в Render PostgreSQL или другой внешний managed storage.

## Static demo приложения

Дополнительные публичные страницы деплоятся как бесплатные Render static sites:

- Caloristika B2B CRM demo:
  `https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fegoriklok%2Fcaloristika-b2b-crm-demo`
- Agentic CRM Product Blueprint:
  `https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fegoriklok%2Fagentic-crm-product-blueprint`

Оба репозитория используют `render.yaml` с `runtime: static`,
`staticPublishPath: ./dist` и `VITE_BASE_PATH=/`, чтобы сборка открывалась с
корня домена Render, а GitHub Pages продолжал использовать свой subpath.
