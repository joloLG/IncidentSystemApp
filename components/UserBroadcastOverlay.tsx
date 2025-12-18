"use client"

import React from "react"
import { AlertTriangle, Waves, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BroadcastAlertData {
  type: "earthquake" | "tsunami"
  title: string
  body: string
  createdAt?: string | null
}

interface UserBroadcastOverlayProps {
  alert: BroadcastAlertData
  onDismiss: () => void
  onPlaySound: () => void
}

const typeStyles: Record<BroadcastAlertData["type"], { gradient: string; icon: React.ReactNode; label: string; emphasis: string }> = {
  earthquake: {
    gradient: "from-red-600 via-red-500 to-orange-400",
    icon: <AlertTriangle className="h-9 w-9 text-white" />,
    label: "Earthquake Alert!",
    emphasis: "text-red-600",
  },
  tsunami: {
    gradient: "from-blue-600 via-sky-500 to-cyan-400",
    icon: <Waves className="h-9 w-9 text-white" />,
    label: "Tsunami Alert!",
    emphasis: "text-blue-600",
  },
}

export function UserBroadcastOverlay({ alert, onDismiss, onPlaySound }: UserBroadcastOverlayProps) {
  const style = typeStyles[alert.type]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-10">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className={`bg-gradient-to-r ${style.gradient} px-6 py-5 text-white`}> 
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/25">
              {style.icon}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.32em] opacity-80">Emergency Broadcast</p>
              <h2 className="text-2xl font-semibold leading-tight">{style.label}</h2>
            </div>
          </div>
        </div>
        <div className="space-y-6 px-6 py-7 text-gray-900">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold leading-snug">
              {alert.title || style.label}
            </h3>
            {alert.createdAt && (
              <p className="text-sm font-medium text-gray-500">
                {new Date(alert.createdAt).toLocaleString()}
              </p>
            )}
            {alert.body && (
              <p className="text-base leading-relaxed text-gray-700">
                {alert.body}
              </p>
            )}
          </div>
          <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
            Stay alert and follow official MDRRMO guidance for this event. Check your surroundings and prepare necessary actions.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onPlaySound} className="w-full sm:w-auto gap-2">
              <Volume2 className={`h-4 w-4 ${style.emphasis}`} />
              Replay alert sound
            </Button>
            <Button onClick={onDismiss} className="w-full sm:w-auto">
              Dismiss alert
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
