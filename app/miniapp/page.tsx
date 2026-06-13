import type { Metadata } from "next"
import Script from "next/script"

import { TelegramMiniappOrder } from "@/components/telegram-miniapp-order"
import { getBotCatalog } from "@/lib/bot-catalog"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "CRM web-каталог заказов",
  description: "Web-каталог для B2B-заказов, CRM и клиентского кабинета"
}

export default function MiniappPage() {
  const catalog = getBotCatalog()

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <TelegramMiniappOrder catalog={catalog} />
    </>
  )
}
