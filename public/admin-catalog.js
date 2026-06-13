(async function () {
  const money = (value) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0
    }).format(Number(value || 0))

  const date = (value) => {
    if (!value) return "не указана"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return String(value)
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(parsed)
  }

  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")

  const statusLabel = (value) =>
    ({
      draft: "Черновик",
      manager_review: "На проверке",
      blocked_minimum: "Ниже минимума",
      confirmed: "Подтвержден",
      in_delivery: "В доставке",
      completed: "Выполнен",
      cancelled: "Отменен"
    })[value] || value

  const params = new URLSearchParams(window.location.search)
  const key = params.get("key") || ""
  const dashboardUrl = key ? `/admin-catalog-data.json?key=${encodeURIComponent(key)}` : "/admin-catalog-data.json"
  const status = document.getElementById("status")

  document.querySelectorAll("a[data-preserve-key]").forEach((link) => {
    if (!key) return
    const url = new URL(link.getAttribute("href"), window.location.origin)
    url.searchParams.set("key", key)
    link.setAttribute("href", `${url.pathname}${url.search}`)
  })

  function setStatus(message, tone = "info") {
    status.textContent = message
    status.style.borderColor = tone === "error" ? "#fecaca" : "#e2e8f0"
    status.style.background = tone === "error" ? "#fef2f2" : "#ffffff"
  }

  try {
    const response = await fetch(dashboardUrl, { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`)
    }

    const orders = Array.isArray(data.orders) ? data.orders : []
    const clients = Array.isArray(data.clients) ? data.clients : []

    const stats = [
      ["Клиенты", data.stats?.clients ?? clients.length],
      ["С заказами", data.stats?.clients_with_orders ?? clients.filter((client) => client.orders_count > 0).length],
      ["Заказы", data.stats?.orders ?? orders.length],
      ["Выручка", money(data.stats?.total_revenue ?? orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))],
      ["Без даты оплаты", data.stats?.unpaid_orders ?? orders.filter((order) => !order.payment_date).length],
      ["Будущие доставки", data.stats?.upcoming_deliveries ?? orders.filter((order) => order.delivery_date && order.delivery_date >= new Date().toISOString().slice(0, 10)).length]
    ]

    document.getElementById("stats").innerHTML = stats
      .map(([label, value]) => `<div class="panel stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`)
      .join("")

    document.getElementById("clients").innerHTML = clients.length
      ? clients
          .map(
            (client) => `
          <tr>
            <td><b>${esc(client.company_name)}</b><div class="small">${esc(client.lead_status || "")}</div></td>
            <td>
              <div>${esc(client.contact_name || "Контакт не указан")}</div>
              <div class="small">${esc(client.contact_email || "email не указан")}</div>
              <div class="small">${esc(client.contact_phone || "телефон не указан")}</div>
            </td>
            <td>${esc(client.segment || "")}</td>
            <td>${esc(client.orders_count || 0)}</td>
            <td>${money(client.total_revenue || 0)}</td>
            <td>${date(client.last_order_at)}</td>
            <td>${date(client.next_delivery_date)}</td>
            <td>${esc(client.unpaid_orders || 0)}</td>
          </tr>
        `
          )
          .join("")
      : '<tr><td colspan="8" class="small">Клиентов в CRM пока нет.</td></tr>'

    document.getElementById("orders").innerHTML = orders.length
      ? orders
          .slice(0, 250)
          .map(
            (order) => `
          <tr>
            <td><b>#${esc(order.id)}</b></td>
            <td><b>${esc(order.company_name || "Не привязан")}</b></td>
            <td>${esc(order.channel)}</td>
            <td><span class="status">${esc(statusLabel(order.status))}</span></td>
            <td>${date(order.created_at)}</td>
            <td>${date(order.delivery_date)}</td>
            <td>${date(order.payment_date)}</td>
            <td>${money(order.total_amount)}</td>
            <td>
              <div class="small">${esc(order.item_count || 0)} шт. / ${esc(order.sku_count || 0)} SKU</div>
              <div>${esc(order.items_summary || "Состав не указан")}</div>
            </td>
            <td class="small">${esc(order.delivery_address || "не указан")}</td>
          </tr>
        `
          )
          .join("")
      : '<tr><td colspan="10" class="small">Заказов пока нет. Новые заказы появятся после обновления выгрузки CRM.</td></tr>'

    const generatedAt = data.generated_at ? date(data.generated_at) : null
    setStatus(
      generatedAt
        ? `Снимок CRM от ${generatedAt}. Для обновления данных запустите экспорт админ-каталога.`
        : `Данные обновлены: ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`
    )
  } catch (error) {
    setStatus(`Не удалось загрузить данные: ${error.message}`, "error")
  }
})()
