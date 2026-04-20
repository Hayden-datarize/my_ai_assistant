// Service Worker for Daily Growth Assistant v1.2
const CACHE_NAME = 'daily-growth-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Pass-through: let the browser handle Google Fonts directly so they are
  // evaluated against CSP font-src (not connect-src via SW context).
  // Intercepting these here causes "violates connect-src" + "Failed to convert
  // value to 'Response'" TypeError when the fetch is blocked.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return;
  }

  // Network-first for API calls (Gemini, RSS) — cache successful responses
  if (url.hostname.includes('generativelanguage') ||
      url.hostname.includes('rss2json') ||
      url.hostname.includes('api.rss2json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful RSS responses for offline fallback
          if (response.ok && url.hostname.includes('rss2json')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(hit => hit || Response.error()))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || Response.error());

      return cached || fetchPromise;
    })
  );
});
