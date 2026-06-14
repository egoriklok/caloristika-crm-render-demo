# Portfolio demo share kit

Цель: demo CRM можно отправлять новым клиентам как единую demobase на Render и
размещать в портфолио без раскрытия CRM key, API-токенов и внутренних
операторских функций. `/crm` открывает Caloristika CRM без ключа для первого
просмотра, а `/demo` объясняет JTBD продукта, офферы и сценарий показа.

## Основная публичная ссылка

```text
https://caloristika-crm-demo.onrender.com/crm
```

Эту ссылку можно давать первой. Она открыта без ключа и показывает:

- воронку, единую базу, компании, контакты, каталог, заказы и AI-задачи;
- путь от выбора сегмента до пилота и повторного заказа;
- данные demo-кейса на примере компании и открытого каталога.

## Три слоя demobase

```text
CRM Caloristika без ключа:
https://caloristika-crm-demo.onrender.com/crm

CRM OS / RouteOps blueprint:
https://egoriklok.github.io/agentic-crm-product-blueprint/
https://agentic-crm-product-blueprint.onrender.com

JTBD-страница с оффером и сценарием:
https://caloristika-crm-demo.onrender.com/demo
```

## Дополнительные публичные ссылки

```text
https://caloristika-crm-demo.onrender.com/catalog
https://caloristika-crm-demo.onrender.com/miniapp
```

`/catalog` и `/miniapp` можно отправлять клиенту после `/crm`, если он хочет
сразу посмотреть клиентскую сторону продукта.

## Защищенный операторский вход

Защищенный операторский вход остается доступен по ключу:

```text
https://caloristika-crm-demo.onrender.com/?key=<CRM_ACCESS_KEY>
```

Такую ссылку отправлять только выбранному человеку. Публичная ссылка для
первого просмотра: `https://caloristika-crm-demo.onrender.com/crm`.

## Текст для отправки клиенту

```text
Добрый день. Ниже публичный demo-кейс B2B Food CRM:
https://caloristika-crm-demo.onrender.com/crm

Внутри можно посмотреть, как CRM помогает B2B-поставщику готовой еды выбрать
сегмент, собрать товарную матрицу, провести пилот, принять заказ и вернуться
за повтором. Это demo-кейс на примере компании и открытого каталога.

Описание продукта и офферы: https://caloristika-crm-demo.onrender.com/demo
```

## Текст для портфолио

```text
B2B Food CRM demo

Проект показывает, как для поставщика готовой еды собрать B2B CRM:
сегментированная база лидов, каталог с фото и ценами, товарные матрицы,
Telegram Mini App с корзиной, заказы в CRM и очередь AI-задач менеджеру.
Демо опубликовано на Render; публичный вход открывает Caloristika CRM без
ключа для первого просмотра.

Live CRM: https://caloristika-crm-demo.onrender.com/crm
Product page: https://caloristika-crm-demo.onrender.com/demo

Офферы после показа: знакомство с продуктом, пилот одного сегмента, CRM
повторных заказов, ежемесячное развитие B2B-канала.
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

Smoke обязан проверить `/demo`, `/crm`, `/catalog`, `/miniapp`, `/api/health`
и, если локально задан `CRM_ACCESS_KEY`, защищенный вход без печати ключа.
