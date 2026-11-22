const CACHE_PREFIX = 'masar-pwa-'
const CACHE_NAME = `${CACHE_PREFIX}v1`
const PRECACHE_URLS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']
const OFFLINE_PAGE = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#10B981">
    <title>مَسار. | غير متصل</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #0A0A0B; color: #f4f4f5; font: 16px/1.8 system-ui, sans-serif; text-align: center; }
      main { max-width: 420px; }
      h1 { color: #10B981; font-size: 1.5rem; }
      a { color: #10B981; }
    </style>
  </head>
  <body>
    <main>
      <h1>لا يوجد اتصال بالإنترنت</h1>
      <p>تعذّر تحميل الصفحة الآن. تحقق من اتصالك ثم أعد المحاولة.</p>
      <a href="/">إعادة المحاولة</a>
    </main>
  </body>
</html>`

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(PRECACHE_URLS)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => new Response(OFFLINE_PAGE, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })),
    )
    return
  }

  const isPrecachedAsset = PRECACHE_URLS.includes(url.pathname)
  const isHashedNextAsset = url.pathname.startsWith('/_next/static/')
  if (!isPrecachedAsset && !isHashedNextAsset) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cachedResponse = await cache.match(request)
    if (cachedResponse) return cachedResponse

    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  })())
})
