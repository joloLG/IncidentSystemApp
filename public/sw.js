const STATIC_CACHE = 'mdrrmo-static-v1'
const RUNTIME_CACHE = 'mdrrmo-runtime-v1'
const DB_NAME = 'mdrrmo-sw'
const STORE_NAME = 'request-queue'
const SYNC_TAG = 'mdrrmo-offline-sync'
const NOTIFICATION_ICON = '/icons/icon-192x192.png'
const assetsToCache = [
  '/',
  '/manifest.json',
  '/sounds/alert.mp3',
  NOTIFICATION_ICON
]

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(STATIC_CACHE)
      await cache.addAll(assetsToCache)
    } catch (error) {
      console.error('Error during service worker installation:', error)
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    const removals = keys.filter(key => key.startsWith('mdrrmo-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE).map(key => caches.delete(key))
    await Promise.all(removals)
    await self.clients.claim()
    await flushQueue()
  })())
})

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getQueuedRequests() {
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
    tx.onabort = () => db.close()
  })
}

async function removeRequest(id) {
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
    tx.onabort = () => db.close()
  })
}

async function saveRequest(request) {
  const clone = request.clone()
  const headers = {}
  clone.headers.forEach((value, key) => {
    headers[key] = value
  })
  const body = clone.method === 'GET' || clone.method === 'HEAD' ? null : await clone.arrayBuffer()
  const queueTimestamp = Date.now()
  const queueId = typeof self.crypto?.randomUUID === 'function'
    ? self.crypto.randomUUID()
    : `queued-${queueTimestamp}-${Math.random().toString(36).slice(2, 8)}`
  const entry = {
    url: clone.url,
    method: clone.method,
    headers,
    body,
    timestamp: Date.now(),
    credentials: clone.credentials,
    queueId,
    queueTimestamp
  }
  const db = await openQueueDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const addReq = store.add(entry)
    addReq.onsuccess = () => resolve({ queueId, queueTimestamp })
    addReq.onerror = () => reject(addReq.error)
    tx.oncomplete = () => db.close()
    tx.onabort = () => db.close()
  })
}

async function flushQueue() {
  const entries = await getQueuedRequests()
  if (!entries.length) return
  const sorted = entries.sort((a, b) => a.timestamp - b.timestamp)
  const completed = []
  for (const entry of sorted) {
    try {
      const headers = new Headers(entry.headers || {})
      const init = {
        method: entry.method,
        headers,
        credentials: entry.credentials || 'same-origin'
      }
      if (entry.body) {
        init.body = entry.body
      }
      const response = await fetch(entry.url, init)
      if (response.ok) {
        await removeRequest(entry.id)
        completed.push({
          queueId: entry.queueId || null,
          queueTimestamp: entry.queueTimestamp || entry.timestamp || null
        })
      }
    } catch {}
  }
  if (completed.length) {
    try {
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientList) {
        try {
          client.postMessage({
            type: 'QUEUE_FLUSHED',
            entries: completed,
            timestamps: completed.map(item => item.queueTimestamp).filter(Boolean)
          })
        } catch {}
      }
    } catch {}
  }
}

async function scheduleSync() {
  if (self.registration && 'sync' in self.registration) {
    try {
      await self.registration.sync.register(SYNC_TAG)
    } catch {}
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    const fallback = await caches.match('/')
    if (fallback) return fallback
    return new Response('', { status: 503 })
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 503 })
  }
}

async function handleApiRequest(request) {
  try {
    const response = await fetch(request.clone())
    return response
  } catch {
    const meta = await saveRequest(request)
    await scheduleSync()
    return new Response(JSON.stringify({ queued: true, ...meta }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Handle push notifications
self.addEventListener('push', event => {
  if (!event.data) return

  const data = event.data.json()
  const { title, body, icon, data: payload } = data
  
  event.waitUntil(
    self.registration.showNotification(title || 'New Notification', {
      body: body || '',
      icon: icon || NOTIFICATION_ICON,
      data: payload,
      vibrate: [200, 100, 200],
      requireInteraction: true
    })
  )
})

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close()
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})

// Handle background sync
self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue())
  }
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return
  }
  if (request.method === 'GET') {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request))
      return
    }
    if (request.url.startsWith(self.location.origin)) {
      event.respondWith(cacheFirst(request))
      return
    }
  }
  if (request.method === 'POST' && request.url.startsWith(self.location.origin + '/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }
})

self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue())
  }
})

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'FLUSH_QUEUE') {
    event.waitUntil(flushQueue())
  }
})

self.addEventListener('push', event => {
  try {
    const data = (() => {
      try {
        return event.data ? event.data.json() : {}
      } catch {
        return {}
      }
    })()
    const title = data.title || 'MDRRMO Alert'
    const body = data.body || 'An important alert has been issued.'
    const type = data.type || 'general'
    const url = data.url || '/'
    const options = {
      body,
      tag: 'mdrrmo-broadcast',
      renotify: true,
      data: { url, type },
      icon: data.icon || '/images/logo.png',
      badge: data.badge || '/globe.svg',
      vibrate: data.vibrate || [100, 50, 100, 50, 200],
      requireInteraction: true
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    event.waitUntil(self.registration.showNotification('MDRRMO Alert', { body: 'Open app for details.' }))
  }
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url)
          if (url.origin === self.location.origin) {
            return client.focus()
          }
        } catch {}
      }
      return clients.openWindow(targetUrl)
    })
  )
})
