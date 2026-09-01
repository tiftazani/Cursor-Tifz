const CACHE = 'kunci-shell-v1'

function isApi(url) {
  return url.pathname.startsWith('/api/') || url.pathname === '/kunci-status'
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || isApi(url)) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match('/')
        return cached || Response.error()
      }),
    )
    return
  }

  if (!url.pathname.startsWith('/assets/') && !url.pathname.endsWith('.png') && !url.pathname.endsWith('.svg') && url.pathname !== '/manifest.webmanifest') {
    return
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) await cache.put(req, res.clone())
      return res
    }),
  )
})
