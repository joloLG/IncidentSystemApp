"use client"

import React, { useEffect, useRef, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { CheckCircle } from "lucide-react"

interface AdminNotificationRow {
  id: string
  type: string
  message: string
}

export default function UserNotificationOverlay() {
  const supabase = createClientComponentClient()
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState("")
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel("user-notification-overlay")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload: any) => {
          const row = payload?.new as AdminNotificationRow
          if (row?.type === "user_unbanned") {
            showOverlay(row.message || "User has been unbanned successfully.")
          }
        }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [])

  const showOverlay = (msg: string) => {
    setMessage(msg)
    setVisible(true)
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => {
      setVisible(false)
    }, 10000) // Auto-dismiss after 10 seconds
  }

  if (!visible) return null

  return (
    <div className="fixed top-5 right-5 z-[9999] flex items-center justify-center">
      <div className="max-w-sm w-full bg-white rounded-lg shadow-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-green-400" aria-hidden="true" />
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-gray-900">Success</p>
              <p className="mt-1 text-sm text-gray-500">{message}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
