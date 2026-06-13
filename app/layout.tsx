import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "B2B Food CRM Demo",
  description: "CRM, catalog, Telegram orders and AI agent queue for B2B ready-food sales demos",
  icons: {
    icon: "/icon.svg"
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
