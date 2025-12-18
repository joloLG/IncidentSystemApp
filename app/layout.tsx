import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SupabaseListener } from "@/components/supabase-listener"
import { SWRProvider } from "@/components/providers/SWRProvider"
import { PushNotificationsProvider } from '@/components/providers/PushNotificationsProvider'
import { PwaRegistry } from "@/components/PwaRegistry"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MDRRMO Mobile App",
  description: "Emergency Reporting System",
  manifest: "/manifest.json",
  themeColor: "#ea580c",
  icons: {
    icon: '/images/logo.png?v=2',
    apple: '/images/logo.png?v=2',
  },
  appleWebApp: {
    capable: true,
    title: "MDRRMO Mobile App",
    statusBarStyle: "default",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseListener />
        <PwaRegistry />
        <SWRProvider>
          <PushNotificationsProvider>
            {children}
          </PushNotificationsProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
