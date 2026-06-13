# Portfolio demo share kit

Цель: demo CRM можно отправлять новым клиентам как Render-ссылку и размещать в
портфолио без раскрытия CRM key, API-токенов и внутренних операторских функций.

## Основная публичная ссылка

```text
https://caloristika-crm-demo.onrender.com/demo
```

Эту ссылку можно давать первой. Она открыта без ключа и показывает:

- что делает CRM;
- живые агрегаты demo-базы;
- безопасные ссылки на каталог и Mini App;
- разделение публичного demo и полного CRM-доступа по ключу.

## Дополнительные публичные ссылки

```text
https://caloristika-crm-demo.onrender.com/catalog
https://caloristika-crm-demo.onrender.com/miniapp
https://caloristika-crm-demo.onrender.com/api/health
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

Внутри можно посмотреть, как связаны CRM-воронка, каталог SKU, клиентский
Mini App, заказы и AI-задачи менеджеру. Это demo на примере компании и
открытом каталоге; полный demo dashboard показываю отдельно на созвоне.
```

## Текст для портфолио

```text
B2B Food CRM demo

Проект показывает, как для поставщика готовой еды собрать B2B sales operating
system: сегментированная база лидов, каталог с фото и ценами, матрицы запуска,
Telegram Mini App с корзиной, заказы в CRM и очередь AI-задач менеджеру.
Демо опубликовано на Render и разделяет публичную витрину от защищенной
операционной CRM.

Live demo: https://caloristika-crm-demo.onrender.com/demo
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
