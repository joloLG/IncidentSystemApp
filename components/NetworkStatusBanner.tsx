"use client"

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { WifiOff, SignalLow } from 'lucide-react'
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus'

export function NetworkStatusBanner() {
  useNetworkStatus()
  const isOnline = useAppStore(state => state.isOnline)
  const connectionType = useAppStore(state => state.connectionType)
  const state = useMemo(() => {
    if (!isOnline) {
      return {
        variant: 'destructive' as const,
        icon: WifiOff,
        title: 'Offline mode',
        message: 'Reports will be queued and sent once connection is restored.'
      }
    }
    const degraded = connectionType && connectionType !== 'wifi' && connectionType !== 'ethernet'
    if (degraded) {
      return {
        variant: 'default' as const,
        icon: SignalLow,
        title: 'Limited connectivity',
        message: 'Submitting reports may take longer on the current connection.'
      }
    }
    return null
  }, [isOnline, connectionType])
  if (!state) return null
  const Icon = state.icon
  return (
    <Alert variant={state.variant} className="mb-4">
      <AlertTitle className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {state.title}
        <Badge variant="outline" className="uppercase tracking-wide text-xs">
          {isOnline ? connectionType || 'unknown' : 'offline'}
        </Badge>
      </AlertTitle>
      <AlertDescription>
        {state.message}
      </AlertDescription>
    </Alert>
  )
}
