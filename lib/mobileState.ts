import { BehaviorSubject } from 'rxjs'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { LocalNotificationActionPerformed } from '@capacitor/local-notifications'
import { supabase } from '@/lib/supabase'

export interface MobileNotification {
  id: string
  emergency_report_id: string
  message: string
  is_read: boolean
  created_at: string
}

export interface MobileReport {
  id: string
  emergency_type: string
  status: string
  admin_response?: string
  resolved_at?: string
  created_at: string
}

const makeKey = (userId: string, suffix: string) => `mdrrmo_${userId}_${suffix}`

export const notifications$ = new BehaviorSubject<MobileNotification[]>([])
export const userReports$ = new BehaviorSubject<MobileReport[]>([])

let initializedFor: string | null = null
let teardown: (() => void) | null = null
let lastResumeAt = 0
const RESUME_COOLDOWN_MS = 1000
let notificationActionHandle: PluginListenerHandle | null = null
let networkListenerHandle: PluginListenerHandle | { remove: () => Promise<void> } | null = null

let notificationPermissionGranted = false
let permissionRequest: Promise<boolean> | null = null
const lastDeliveredNotificationTs: Record<string, number> = {}

const readPersistedTimestamp = (storageKey: string): number => {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return 0
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

const persistTimestamp = (storageKey: string, value: number) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, `${value}`)
  } catch {}
}

const ensureLocalNotificationPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false
  if (typeof Capacitor.isPluginAvailable === 'function' && !Capacitor.isPluginAvailable('LocalNotifications')) {
    return false
  }
  if (notificationPermissionGranted) return true
  if (permissionRequest) return permissionRequest

  permissionRequest = (async () => {
    try {
      const checkResult = await LocalNotifications.checkPermissions()
      if (checkResult?.display === 'granted') {
        notificationPermissionGranted = true
        return true
      }

      const requestResult = await LocalNotifications.requestPermissions()
      if (requestResult?.display === 'granted') {
        notificationPermissionGranted = true
        return true
      }
      return false
    } catch (error) {
      console.warn('Local notification permission check failed', error)
      return false
    } finally {
      permissionRequest = null
    }
  })()

  return permissionRequest
}

const bootstrapNotificationTimestamp = (userId: string, notifications: MobileNotification[]) => {
  if (!notifications.length) return
  const newest = notifications.reduce((latest, item) => {
    const ts = new Date(item.created_at).getTime()
    return Number.isFinite(ts) && ts > latest ? ts : latest
  }, 0)
  if (newest <= 0) return
  lastDeliveredNotificationTs[userId] = newest
  persistTimestamp(makeKey(userId, 'lastNotificationTs'), newest)
}

const maybeTriggerLocalNotifications = async (userId: string, notifications: MobileNotification[]) => {
  if (!notifications.length) return
  if (typeof Capacitor.isPluginAvailable === 'function' && !Capacitor.isPluginAvailable('LocalNotifications')) {
    return
  }

  const permissionGranted = await ensureLocalNotificationPermission()
  if (!permissionGranted) return

  const storageKey = makeKey(userId, 'lastNotificationTs')
  let lastTs = lastDeliveredNotificationTs[userId]
  if (!Number.isFinite(lastTs)) {
    lastTs = readPersistedTimestamp(storageKey)
  }

  if (!Number.isFinite(lastTs) || lastTs === 0) {
    bootstrapNotificationTimestamp(userId, notifications)
    return
  }

  const fresh = notifications
    .map(item => ({ item, ts: new Date(item.created_at).getTime() }))
    .filter(entry => Number.isFinite(entry.ts) && entry.ts > lastTs && !entry.item.is_read)

  if (!fresh.length) return

  fresh.sort((a, b) => a.ts - b.ts)
  const baseId = Math.floor(Date.now() % 1000000000)
  const payload = fresh.slice(-3).map((entry, index) => ({
    id: baseId + index,
    title: 'MDRRMO Alert',
    body: entry.item.message,
    extra: {
      emergency_report_id: entry.item.emergency_report_id,
      notification_id: entry.item.id,
    },
  }))

  try {
    await LocalNotifications.schedule({ notifications: payload })
  } catch (error) {
    console.warn('Local notification scheduling failed', error)
  }

  const newestTs = fresh.reduce((latest, entry) => (entry.ts > latest ? entry.ts : latest), lastTs)
  if (Number.isFinite(newestTs) && newestTs > lastTs) {
    lastDeliveredNotificationTs[userId] = newestTs
    persistTimestamp(storageKey, newestTs)
  }
}

const handleNotificationAction = async (event: LocalNotificationActionPerformed) => {
  const userId = initializedFor
  if (!userId) return

  const extra = event.notification?.extra as Record<string, unknown> | undefined
  const notificationId = typeof extra?.notification_id === 'string' ? extra.notification_id : null
  const reportId = typeof extra?.emergency_report_id === 'string' ? extra.emergency_report_id : null

  try {
    if (notificationId) {
      await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
    }
  } catch (error) {
    console.warn('Failed to mark notification as read from tap', error)
  }

  try {
    await fetchNotifications(userId)
  } catch (error) {
    console.warn('Failed to refresh notifications after tap', error)
  }

  if (reportId) {
    const storageKey = makeKey(userId, 'notificationIntent')
    const payload = {
      type: 'notification',
      notificationId,
      emergencyReportId: reportId,
      timestamp: Date.now(),
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {}
  }
}

async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id, emergency_report_id, message, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (!error && Array.isArray(data)) {
    notifications$.next(data as any)
    try { localStorage.setItem(makeKey(userId, 'notifications'), JSON.stringify(data)) } catch {}
    void maybeTriggerLocalNotifications(userId, data as any)
  }
}

async function fetchUserReports(userId: string) {
  const { data, error } = await supabase
    .from('emergency_reports')
    .select('id, emergency_type, status, admin_response, resolved_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (!error && Array.isArray(data)) {
    userReports$.next(data as any)
    try { localStorage.setItem(makeKey(userId, 'userReports'), JSON.stringify(data)) } catch {}
  }
}

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

const getNetworkPlugin = (): NetworkPlugin | null => {
  const capAny = Capacitor as any
  if (capAny?.Network) return capAny.Network as NetworkPlugin
  if (capAny?.Plugins?.Network) return capAny.Plugins.Network as NetworkPlugin
  return null
}

const supportsNetworkPlugin = () => {
  const plugin = getNetworkPlugin()
  return !!plugin?.getStatus
}

const refreshOnReconnect = async (userId: string) => {
  await Promise.allSettled([
    fetchNotifications(userId),
    fetchUserReports(userId),
  ])
}

export function initMobileState(userId: string) {
  if (!Capacitor.isNativePlatform()) return
  if (initializedFor === userId && teardown) return
  initializedFor = userId

  // Request notification permission on initialization
  void ensureLocalNotificationPermission();

  if (!notificationActionHandle) {
    LocalNotifications.addListener('localNotificationActionPerformed', (event: LocalNotificationActionPerformed) => {
      void handleNotificationAction(event)
    }).then((handle: PluginListenerHandle) => {
      notificationActionHandle = handle
    }).catch((error: unknown) => {
      console.warn('Failed to attach notification action listener', error)
    })
  }

  // Load cached data first for instant UI
  try {
    const cachedN = localStorage.getItem(makeKey(userId, 'notifications'))
    if (cachedN) notifications$.next(JSON.parse(cachedN))
  } catch {}
  try {
    const cachedR = localStorage.getItem(makeKey(userId, 'userReports'))
    if (cachedR) userReports$.next(JSON.parse(cachedR))
  } catch {}

  // Initial fetch
  void fetchNotifications(userId)
  void fetchUserReports(userId)

  // Realtime channels
  const notifsCh = supabase
    .channel(`mobile_user_notifications_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` }, () => {
      void fetchNotifications(userId)
    })
    .subscribe()

  const reportsCh = supabase
    .channel(`mobile_user_reports_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports', filter: `user_id=eq.${userId}` }, () => {
      void fetchUserReports(userId)
    })
    .subscribe()

  // App resume: throttle to 1s
  const resume = async () => {
    const now = Date.now()
    if (now - lastResumeAt < RESUME_COOLDOWN_MS) return
    lastResumeAt = now
    await Promise.allSettled([
      fetchNotifications(userId),
      fetchUserReports(userId),
    ])
  }
  let resumeHandle: any
  App.addListener('resume', () => { void resume() }).then(h => { resumeHandle = h }).catch(() => {})

  if (supportsNetworkPlugin()) {
    const plugin = getNetworkPlugin()
    plugin?.getStatus?.().then((status: ConnectionStatus) => {
      if (status.connected) {
        void refreshOnReconnect(userId)
      }
    }).catch(() => {})
    plugin?.addListener?.('networkStatusChange', (status: ConnectionStatus) => {
      if (status.connected) {
        void refreshOnReconnect(userId)
      }
    }).then(handle => {
      if (handle && typeof (handle as PluginListenerHandle).remove === 'function') {
        networkListenerHandle = handle as PluginListenerHandle
      } else if (handle && typeof (handle as { remove: () => Promise<void> }).remove === 'function') {
        networkListenerHandle = handle as { remove: () => Promise<void> }
      }
    }).catch(() => {})
  }

  teardown = () => {
    try { supabase.removeChannel(notifsCh) } catch {}
    try { supabase.removeChannel(reportsCh) } catch {}
    try { resumeHandle?.remove?.() } catch {}
    try { notificationActionHandle?.remove?.() } catch {}
    try {
      if (networkListenerHandle && typeof networkListenerHandle.remove === 'function') {
        networkListenerHandle.remove().catch(() => {})
      }
    } catch {}
    notificationActionHandle = null
    networkListenerHandle = null
  }
}

export function destroyMobileState() {
  try { teardown?.() } catch {}
  teardown = null
  initializedFor = null
}
