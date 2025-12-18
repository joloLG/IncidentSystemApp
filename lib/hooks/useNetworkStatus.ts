"use client"

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { useAppStore } from '@/lib/store'

interface ConnectionStatus {
  connected: boolean
  connectionType?: string
}

type NetworkPlugin = {
  getStatus?: () => Promise<ConnectionStatus>
  addListener?: (
    eventName: 'networkStatusChange',
    listenerFunc: (status: ConnectionStatus) => void
  ) => Promise<PluginListenerHandle | { remove: () => Promise<void> } | void>
}

const supportsNetworkPlugin = () => {
  const plugin = getNetworkPlugin()
  return !!plugin?.getStatus
}

const readNavigatorStatus = (): ConnectionStatus => {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true
  const connection = typeof navigator !== 'undefined' && (navigator as any).connection
  const type = connection && typeof connection.type === 'string' ? connection.type : 'unknown'
  return { connected: online, connectionType: type }
}

const getNetworkPlugin = (): NetworkPlugin | null => {
  const capAny = Capacitor as any
  if (capAny?.Network) return capAny.Network as NetworkPlugin
  if (capAny?.Plugins?.Network) return capAny.Plugins.Network as NetworkPlugin
  return null
}

export function useNetworkStatus() {
  const setIsOnline = useAppStore(state => state.setIsOnline)
  const setConnectionType = useAppStore(state => state.setConnectionType)
  useEffect(() => {
    let removeListener: (() => void) | null = null
    let onlineHandler: (() => void) | null = null
    let offlineHandler: (() => void) | null = null
    const applyStatus = (status: ConnectionStatus) => {
      setIsOnline(status.connected)
      setConnectionType(status.connectionType || 'unknown')
      if (status.connected && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.active?.postMessage({ type: 'FLUSH_QUEUE' })
        }).catch(() => {})
      }
    }
    const init = async () => {
      if (supportsNetworkPlugin()) {
        try {
          const plugin = getNetworkPlugin()
          const status = await plugin!.getStatus!()
          applyStatus(status)
        } catch {
          applyStatus(readNavigatorStatus())
        }
        const plugin = getNetworkPlugin()
        plugin?.addListener?.('networkStatusChange', (status: ConnectionStatus) => {
          applyStatus(status)
        }).then((listener) => {
          if (listener && typeof (listener as PluginListenerHandle).remove === 'function') {
            const handle = listener as PluginListenerHandle
            removeListener = () => {
              handle.remove().catch(() => {})
            }
          }
        }).catch(() => {})
      } else {
        const status = readNavigatorStatus()
        applyStatus(status)
        onlineHandler = () => applyStatus({ connected: true, connectionType: readNavigatorStatus().connectionType })
        offlineHandler = () => applyStatus({ connected: false, connectionType: readNavigatorStatus().connectionType })
        if (typeof window !== 'undefined') {
          window.addEventListener('online', onlineHandler)
          window.addEventListener('offline', offlineHandler)
        }
      }
    }
    void init()
    return () => {
      if (removeListener) removeListener()
      if (typeof window !== 'undefined') {
        if (onlineHandler) window.removeEventListener('online', onlineHandler)
        if (offlineHandler) window.removeEventListener('offline', offlineHandler)
      }
    }
  }, [setIsOnline, setConnectionType])
}
