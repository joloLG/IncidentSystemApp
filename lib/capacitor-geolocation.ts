import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export interface LocationCoords {
  lat: number
  lng: number
}

export interface LocationError {
  code: number
  message: string
}

export class CapacitorGeolocation {
  static async getCurrentPosition(options?: {
    enableHighAccuracy?: boolean
    timeout?: number
    maximumAge?: number
  }): Promise<LocationCoords> {
    if (!Capacitor.isNativePlatform()) {
      // Fallback to browser geolocation
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported'))
          return
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            })
          },
          (error) => {
            reject({
              code: error.code,
              message: CapacitorGeolocation.getErrorMessage(error.code),
            })
          },
          {
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            timeout: options?.timeout ?? 10000,
            maximumAge: options?.maximumAge ?? 300000, // 5 minutes
          }
        )
      })
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 10000,
        maximumAge: options?.maximumAge ?? 300000,
      })

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
    } catch (error: any) {
      throw {
        code: error.code || -1,
        message: CapacitorGeolocation.getErrorMessage(error.code) || error.message || 'Unknown location error',
      }
    }
  }

  static async watchPosition(
    callback: (position: LocationCoords) => void,
    errorCallback?: (error: LocationError) => void,
    options?: {
      enableHighAccuracy?: boolean
      timeout?: number
      maximumAge?: number
    }
  ): Promise<string> {
    if (!Capacitor.isNativePlatform()) {
      // Fallback to browser geolocation watch
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          callback({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          errorCallback?.({
            code: error.code,
            message: CapacitorGeolocation.getErrorMessage(error.code),
          })
        },
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 300000,
        }
      )
      return watchId.toString()
    }

    try {
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
        },
        (position, error) => {
          if (position) {
            callback({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            })
          } else if (error && errorCallback) {
            errorCallback({
              code: error.code || -1,
              message: CapacitorGeolocation.getErrorMessage(error.code) || error.message || 'Unknown location error',
            })
          }
        }
      )
      return watchId.toString()
    } catch (error: any) {
      throw {
        code: error.code || -1,
        message: CapacitorGeolocation.getErrorMessage(error.code) || error.message || 'Failed to start location watch',
      }
    }
  }

  static async clearWatch(watchId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      navigator.geolocation.clearWatch(parseInt(watchId))
      return
    }

    try {
      await Geolocation.clearWatch({ id: watchId })
    } catch (error) {
      console.warn('Failed to clear location watch:', error)
    }
  }

  static async checkPermissions(): Promise<{ location: 'granted' | 'denied' | 'prompt' | string }> {
    if (!Capacitor.isNativePlatform()) {
      // Browser doesn't have a direct permission check, assume granted if geolocation is available
      return { location: navigator.geolocation ? 'granted' : 'denied' }
    }

    try {
      const result = await Geolocation.checkPermissions()
      return { location: result.location }
    } catch (error) {
      console.warn('Failed to check location permissions:', error)
      return { location: 'denied' }
    }
  }

  static async requestPermissions(): Promise<{ location: 'granted' | 'denied' | 'prompt' | string }> {
    if (!Capacitor.isNativePlatform()) {
      // Browser permissions are requested automatically
      return { location: 'granted' }
    }

    try {
      const result = await Geolocation.requestPermissions()
      return { location: result.location }
    } catch (error) {
      console.warn('Failed to request location permissions:', error)
      return { location: 'denied' }
    }
  }

  private static getErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return 'Location permission denied. Please enable location access.'
      case 2:
        return 'Location information is unavailable'
      case 3:
        return 'Location request timed out'
      default:
        return 'Failed to get your location'
    }
  }
}
