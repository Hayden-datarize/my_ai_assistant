// Service Worker for Daily Growth Assistant v1.3 (v3.20 H3: cross-origin image pass-through)
const CACHE_NAME = 'daily-growth-v9';
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

  // v3.20 H3 (F3): cross-origin image pass-through.
  // SW가 fetch()로 처리하면 SW context의 connect-src CSP rule이 적용되어 medium 등
  // 외부 이미지 도메인이 차단됨 (production 발견 root cause).
  // pass-through 시 브라우저가 직접 처리 → <img> request는 SW 밖에서 img-src rule로 평가되어 통과.
  if (event.request.destination === 'image') {
    return;
  }

  // Network-first for API calls (Gemini, RSS) — cache successful responses
  if (url.hostname.includes('generativelanguage') ||
      url.hostname.includes('rss2json') ||
      url.hostname.includes('api.rss2json')) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok && url.hostname.includes('rss2json')) {
            // v3.19 T8: image-bearing 응답만 캐싱 (#3 파란 화면 가설 fix)
            // 첫 1건만 검증 (전체 items 순회 비용 회피, 첫 paint 지연 최소화).
            // production parser src/services/rss.ts:35 extractImage 3-tier 정합:
            // enclosure.link / thumbnail / description <img>
            const peek = response.clone();
            let shouldCache = false;
            try {
              const data = await peek.json();
              const first = Array.isArray(data?.items) ? data.items[0] : null;
              // T8 quality review I1: production extractImage(rss.ts:35)와 strictness 정합 —
              // 빈 문자열/non-image type false positive 차단.
              shouldCache = !!first && (
                (typeof first?.enclosure?.link === 'string' &&
                  first.enclosure.link.length > 0 &&
                  typeof first?.enclosure?.type === 'string' &&
                  first.enclosure.type.startsWith('image/')) ||
                (typeof first?.thumbnail === 'string' && first.thumbnail.length > 0) ||
                (typeof first?.description === 'string' && /<img\s/i.test(first.description))
              );
            } catch { shouldCache = false; }
            if (shouldCache) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || Response.error()))
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
