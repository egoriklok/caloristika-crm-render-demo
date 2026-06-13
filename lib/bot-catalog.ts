import { DEFAULT_STRATEGY_TOKEN, getActiveStrategy } from "@/lib/active-strategy"
import { getDb } from "@/lib/db"
import { attachProductPhotos } from "@/lib/product-photos"

export function getBotCatalog() {
  const db = getDb()
  const activeStrategy = getActiveStrategy()
  const products = attachProductPhotos(db.prepare(`
    SELECT
      id,
      category,
      name,
      barcode,
      net_weight,
      shelf_life_days,
      wholesale_price,
      image_url,
      product_url,
      image_source,
      image_match,
      image_note,
      site_title
    FROM products
    WHERE is_active = 1
    ORDER BY category, name
  `).all() as Array<{
    id: number
    category: string
    name: string
    barcode: string | null
    net_weight: string | null
    shelf_life_days: number | null
    wholesale_price: number
    image_url?: string | null
    product_url?: string | null
    image_source?: string | null
    image_match?: string | null
    image_note?: string | null
    site_title?: string | null
  }>)
  const settings = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>
  const terms = Object.fromEntries(settings.map((row) => [row.key, row.value]))

  const brandName = terms.demo_customer_name ?? (activeStrategy.token === DEFAULT_STRATEGY_TOKEN ? "Lunch Up" : activeStrategy.name.split(":")[0])
  const categories = products.reduce<Record<string, typeof products>>((acc, product) => {
    acc[product.category] ??= []
    acc[product.category].push(product)
    return acc
  }, {})

  return {
    source: `${brandName} CRM SQLite`,
    strategy_token: activeStrategy.token,
    active_strategy: {
      token: activeStrategy.token,
      name: activeStrategy.name,
      brand_name: brandName,
      local_miniapp_path: activeStrategy.local_miniapp_path,
      miniapp_url: activeStrategy.miniapp_url,
      lo_delivery_terms: activeStrategy.lo_delivery_terms
    },
    launch_region: terms.launch_region,
    order_terms: {
      minimum_order_amount: Number(terms.min_order_amount),
      free_delivery_city: terms.free_delivery_city,
      free_delivery_days: terms.free_delivery_days,
      lo_delivery_terms: terms.lo_delivery_terms ?? activeStrategy.lo_delivery_terms,
      order_lead_time_days: Number(terms.order_lead_time_days),
      order_cutoff_time: terms.order_cutoff_time,
      payment_terms: terms.payment_terms,
      customer_type: terms.customer_type
    },
    categories,
    products
  }
}
