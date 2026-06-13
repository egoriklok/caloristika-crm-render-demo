# Caloristika B2B demo runbook

Короткая инструкция для выездной демонстрации CRM под Caloristika B2B.

## Что подготовлено

- Локальная demo-база: `data/caloristika_demo_crm.sqlite`.
- Фокус: Санкт-Петербург.
- Данные: 98 B2B-компаний, 11 активных demo-SKU Caloristika, 3 demo-заказа, 55 AI-задач менеджеру.
- Публичная продажная страница: https://egoriklok.github.io/caloristika-b2b-crm-demo/
- GitHub repo страницы: https://github.com/egoriklok/caloristika-b2b-crm-demo

## Как запустить на ноутбуке

Открыть:

```text
START_CALORISTIKA_CRM_DEMO.cmd
```

После запуска:

```text
http://localhost:3012
```

Проверка, что открыта правильная база:

```text
http://localhost:3012/api/health
```

В ответе должно быть:

- `activePath` содержит `caloristika_demo_crm.sqlite`;
- `companies`: 98;
- `active_products`: 11;
- `queued_ai_tasks`: 55.

## Что показывать на встрече

1. `http://localhost:3012`
   Главная CRM: воронка, единая база, локальные лиды, заказы, AI-задачи.

2. В CRM нажать `Каталог demo`
   Внутренний каталог CRM показывает 11 SKU из SQLite и фото продукции.

3. `http://localhost:3012/catalog`
   Клиентский A4-каталог demo: Caloristika, Санкт-Петербург, минимум 3 000 руб., без старого Lunch-Up контента.

4. `http://localhost:3012/miniapp?strategy=caloristika_b2b_spb_demo_20260613`
   Mini App: каталог, кабинет, корзина, отправка заказа в CRM.

5. Вкладка `ИИ-агенты`
   Показать очередь задач: что агент должен сделать для менеджера после лида, заказа или обогащения компании.

## Что говорить клиенту

CRM не продается как "еще одна CRM". Демо показывает готовый рабочий контур для B2B-роста Caloristika:

- база локальных B2B-лидов по сегментам;
- связка сегмент -> стартовая SKU-матрица -> предложение менеджера;
- клиентский каталог и Telegram Mini App из той же SQLite-базы;
- заказы, история, повторный заказ и контроль минимума;
- AI-задачи менеджеру без автоматической записи в CRM без подтверждения.

## Важные ограничения

- Цены в demo-каталоге являются demo-срезом. Рабочий B2B-прайс нужно загрузить после доступа от клиента.
- Фото и SKU взяты из публичных карточек Caloristika/Caloristika B2B и demo-структуры CRM.
- Telegram-бот физически включается только после BotFather token и публичного URL.
- Полная миграция всей CRM на официальный shadcn/ui еще не завершена. Сейчас в проекте есть shadcn-style база и установлены `badge`, `button`, `card`, `input`, `table`, `tabs`.
