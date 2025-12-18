"use client"

import React, { useCallback, useEffect } from 'react'
import { SWRConfig, Cache, useSWRConfig } from 'swr'
import { App } from '@capacitor/app'

// 1. Define a global fetcher that prevents aggressive WebView caching
// This mirrors the logic you added to the dashboard's fetchWithRetry
const mobileCacheBusterFetcher = async (resource: string | Request, init?: RequestInit) => {
  let url = resource.toString()
  
  // Only append timestamp for GET requests (or if method is undefined, which implies GET)
  if (!init?.method || init.method.toUpperCase() === 'GET') {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}_t=${Date.now()}`
  }

  const res = await fetch(url, init)

  if (!res.ok) {
    const error: any = new Error('An error occurred while fetching the data.')
    error.info = await res.json().catch(() => ({}))
    error.status = res.status
    throw error
  }

  return res.json()
}

// Cache provider that handles both memory and session storage
const createCacheProvider = (): Cache<any> => {
  const map = new Map<string, any>()
  
  if (typeof window !== 'undefined') {
    try {
      const cacheKey = 'mdrrmo-swr-cache-v2'
      const cacheData = sessionStorage.getItem(cacheKey)
      if (cacheData) {
        const parsed = JSON.parse(cacheData) as Record<string, any>
        for (const [key, value] of Object.entries(parsed)) {
          map.set(key, value)
        }
      }
      
      const saveCache = () => {
        const cache: Record<string, any> = {}
        map.forEach((value, key) => {
          cache[key] = value
        })
        sessionStorage.setItem(cacheKey, JSON.stringify(cache))
      }
      
      window.addEventListener('beforeunload', saveCache)
    } catch (error) {
      console.warn('Failed to initialize SWR cache from sessionStorage', error)
    }
  }
  
  return map as unknown as Cache<any>
}

// Component to handle global Capacitor events
function CapacitorSWRListener() {
  const { mutate } = useSWRConfig()

  useEffect(() => {
    // 2. Listen for Native App Resume (Background -> Foreground)
    const listenerPromise = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('📱 App resumed: Triggering SWR global revalidation')
        
        // Option A: Dispatch a window focus event (SWR listens to this automatically)
        window.dispatchEvent(new Event('focus'))
        
        // Option B: Force revalidate all keys (more aggressive)
        // mutate(() => true, undefined, { revalidate: true })
      }
    })

    return () => {
      listenerPromise.then(handle => handle.remove())
    }
  }, [mutate])

  return null
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  const provider = useCallback(() => {
    const cache = createCacheProvider()
    
    const clearCache = () => {
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('mdrrmo-swr-cache-v2')
        } catch (error) {
          console.warn('Failed to clear SWR cache', error)
        }
      }
      return cache
    }
    
    return Object.assign(cache, { clear: clearCache })
  }, [])

  return (
    <SWRConfig
      value={{
        // Use the cache-busting fetcher by default
        fetcher: mobileCacheBusterFetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        revalidateOnMount: true,
        refreshInterval: 30000, 
        dedupingInterval: 5000, // Reduced from 10000 to 5000 for snappier mobile feel
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        provider,
        onError: (error: any, key: string) => {
          // Suppress 404s or known expected errors from cluttering console
          if (error.status !== 404) {
            console.error('SWR Error:', { key, error })
          }
        },
        // Custom window focus event for Capacitor
        initFocus(callback) {
          let appStateListener: any = null
          
          if (typeof window !== 'undefined') {
            window.addEventListener('focus', callback)
            window.addEventListener('visibilitychange', callback)
            
            // Register Capacitor listener specifically for SWR focus handling
            App.addListener('appStateChange', ({ isActive }) => {
              if (isActive) callback()
            }).then(h => { appStateListener = h })
          }

          return () => {
            if (typeof window !== 'undefined') {
              window.removeEventListener('focus', callback)
              window.removeEventListener('visibilitychange', callback)
              if (appStateListener) appStateListener.remove()
            }
          }
        }
      }}
    >
      <CapacitorSWRListener />
      {children}
    </SWRConfig>
  )
}