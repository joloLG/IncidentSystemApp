import React from "react"
import AdminRealtimeOverlay from "@/components/admin/AdminRealtimeOverlay"
import UserNotificationOverlay from "@/components/admin/UserNotificationOverlay"
import NotificationService from "@/components/admin/NotificationService"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminRealtimeOverlay />
      <UserNotificationOverlay />
      <NotificationService />
      <div id="toast-container" className="fixed top-4 right-4 z-[9999] space-y-2" />
    </>
  )
}
