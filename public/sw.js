/* eslint-disable */
// Service Worker: cache-first for static assets, stale-while-revalidate for
// navigations. Pages get an instant cached render while the next version
// updates the cache in the background.
const VERSION = 'v3'
const STATIC_CACHE = `static-${VERSION}`
const PAGES_CACHE = `pages-${VERSION}`
const OFFLINE_URL = '/'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== STATIC_CACHE && name !== PAGES_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

const ASSET_EXT_REGEX = /\.(?:css|js|woff2?|ttf|otf|png|jpg|jpeg|webp|avif|svg|gif|ico)(?:$|\?)/i
const CROSS_ORIGIN_ASSET_HOSTS = /(?:gstatic\.com|fonts\.googleapis\.com|wsrv\.nl|telesco\.pe)$/

function isStaticAsset(rawUrl) {
  const url = new URL(rawUrl)
  if (ASSET_EXT_REGEX.test(url.pathname)) return true
  if (url.origin === self.location.origin) return false
  // Known image / font CDNs without an explicit extension (e.g. wsrv.nl
  // returns ?url=... query, gstatic font CSS) — cache opaquely.
  if (CROSS_ORIGIN_ASSET_HOSTS.test(url.hostname)) return true
  return false
}

function isNavigation(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = event.request.url

  // Cache-first for static assets — fonts, CSS, JS, images.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached
          return fetch(event.request).then((response) => {
            if (response.ok || response.type === 'opaque') cache.put(event.request, response.clone())
            return response
          }).catch(() => cached)
        })
      )
    )
    return
  }

  // Stale-while-revalidate for HTML navigations.
  if (isNavigation(event.request)) {
    event.respondWith(
      caches.open(PAGES_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          }).catch(() => cached || caches.match(OFFLINE_URL))
          return cached || networkFetch
        })
      )
    )
    return
  }

  // Default: network with cache fallback (data files, RSS, etc.)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(PAGES_CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL)))
  )
})

// Push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'New post', body: 'A new post has been published!', url: '/' }

  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
