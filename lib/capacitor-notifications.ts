import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export class CapacitorNotifications {
  private static permissionGranted = false
  private static permissionRequest: Promise<boolean> | null = null

  static async ensurePermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false // Web apps don't need local notifications for ER team alerts
    }

    if (typeof Capacitor.isPluginAvailable === 'function' && !Capacitor.isPluginAvailable('LocalNotifications')) {
      return false
    }

    if (this.permissionGranted) return true
    if (this.permissionRequest) return this.permissionRequest

    this.permissionRequest = (async () => {
      try {
        const checkResult = await LocalNotifications.checkPermissions()
        if (checkResult?.display === 'granted') {
          this.permissionGranted = true
          return true
        }

        const requestResult = await LocalNotifications.requestPermissions()
        if (requestResult?.display === 'granted') {
          this.permissionGranted = true
          return true
        }
        return false
      } catch (error) {
        console.warn('Local notification permission check failed', error)
        return false
      } finally {
        this.permissionRequest = null
      }
    })()

    return this.permissionRequest
  }

  static async showDispatchAlert(options: {
    title: string
    body: string
    id?: string
    sound?: boolean
    extra?: Record<string, any>
  }): Promise<void> {
    const hasPermission = await this.ensurePermission()
    if (!hasPermission) {
      console.warn('Local notification permission not granted, falling back to console log')
      console.log(`🚨 ER Team Alert: ${options.title} - ${options.body}`)
      return
    }

    try {
      const notificationId = options.id ? parseInt(options.id, 10) : Math.floor(Math.random() * 1000000)

      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: options.title,
          body: options.body,
          sound: options.sound !== false ? 'default' : undefined,
          extra: options.extra || {},
        }]
      })

      console.log('✅ ER Team alert notification scheduled:', options.title)
    } catch (error) {
      console.warn('Failed to schedule ER team alert notification:', error)
      // Fallback to console logging
      console.log(`🚨 ER Team Alert: ${options.title} - ${options.body}`)
    }
  }

  static async playAlertSound(): Promise<void> {
    // In Capacitor, the sound is handled by the LocalNotifications plugin
    // This method is kept for compatibility but doesn't need to do anything
    // as the sound is specified in the notification scheduling
  }
}
