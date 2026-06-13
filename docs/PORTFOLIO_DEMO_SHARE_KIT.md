# Portfolio demo share kit

Цель: demo CRM можно отправлять новым клиентам как единую demobase на Render и
размещать в портфолио без раскрытия CRM key, API-токенов и внутренних
операторских функций. `/demo` объединяет три публичных слоя продукта:
GitHub sales page, живую Render CRM и CRM OS / RouteOps blueprint.

## Основная публичная ссылка

```text
https://caloristika-crm-demo.onrender.com/demo
```

Эту ссылку можно давать первой. Она открыта без ключа и продает:

- бизнес-результат: путь от лида до повторного заказа;
- сегменты, SKU-матрицы, каталог, Mini App и AI-задачи;
- единую demobase из трех repo;
- сценарий demo-показа и офферы: платный пилот, CRM повторных заказов,
  ежемесячный рост;
- честную оговорку, что компания используется как пример данных, а не как
  подтвержденный партнер.

## Три слоя demobase

```text
GitHub sales page:
https://egoriklok.github.io/caloristika-b2b-crm-demo/
https://caloristika-b2b-crm-demo.onrender.com

Живая demo CRM:
https://caloristika-crm-demo.onrender.com/demo

CRM OS / RouteOps blueprint:
https://egoriklok.github.io/agentic-crm-product-blueprint/
https://agentic-crm-product-blueprint.onrender.com
```

## Дополнительные публичные ссылки

```text
https://caloristika-crm-demo.onrender.com/catalog
https://caloristika-crm-demo.onrender.com/miniapp
```

`/catalog` и `/miniapp` можно отправлять клиенту после `/demo`, если он хочет
сразу посмотреть клиентскую сторону продукта.

## Полный demo dashboard CRM

Полный dashboard этой demo CRM остается закрытым:

```text
https://caloristika-crm-demo.onrender.com/?key=<CRM_ACCESS_KEY>
```

Такую ссылку отправлять только выбранному человеку. Это все еще demo CRM, но
публиковать ее в портфолио, соцсетях, README, презентациях или скриншотах
нельзя из-за ключа доступа и внутренних operator routes.

## Текст для отправки клиенту

```text
Добрый день. Ниже публичный demo-кейс B2B Food CRM:
https://caloristika-crm-demo.onrender.com/demo

Внутри можно посмотреть, как CRM ведет B2B-поставщика готовой еды от первого
лида до повторного заказа: сегменты, SKU-матрицы, каталог, Mini App, заказы и
AI-задачи менеджеру. Там же собрана demobase из трех слоев: sales page, живая
CRM и CRM OS blueprint. Это demo на примере компании и открытом каталоге;
полный demo dashboard показываю отдельно на созвоне.
```

## Текст для портфолио

```text
B2B Food CRM demo

Проект показывает, как для поставщика готовой еды собрать B2B sales system:
сегментированная база лидов, каталог с фото и ценами, матрицы запуска,
Telegram Mini App с корзиной, заказы в CRM и очередь AI-задач менеджеру.
Демо опубликовано на Render; полный demo dashboard доступен по ключу, чтобы
база и контакты не индексировались публично.

Live demo: https://caloristika-crm-demo.onrender.com/demo

Офферы после показа: demo-показ, пилот одного сегмента, CRM повторных заказов,
ежемесячное развитие B2B-канала.
```

## Что нельзя публиковать

- `CRM_ACCESS_KEY`, Render API key, Telegram token, 2GIS key, DaData key,
  Apify token.
- Полную ссылку вида `/?key=...`.
- `.env.local`, Render dashboard screenshots с secrets, private deploy logs.
- Заявление, что Caloristika/Lunch Up являются платящими клиентами, если это
  не подтверждено договором. Формулировка для портфолио: `demo-кейс` или
  `концепт на примере компании и открытом каталоге`.

## Проверка перед отправкой

```bash
npm run render:smoke -- https://caloristika-crm-demo.onrender.com
```

Smoke обязан проверить `/demo`, `/catalog`, `/miniapp`, `/api/health` и, если
локально задан `CRM_ACCESS_KEY`, защищенный dashboard без печати ключа.
