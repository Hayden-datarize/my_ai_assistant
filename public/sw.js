// Service Worker for Daily Growth Assistant v1.4
// v3.20 H3: cross-origin image pass-through
// v3.41 T3 (Codex P1 F3): CACHE_NAME bump v9→v10, GET-only intercept, navigation network-first,
//   /api/ pass-through (Slack DM relay 등 functions 호출 차단 surface 제거)
const CACHE_NAME = 'daily-growth-v10';
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
  const req = event.request;
  const url = new URL(req.url);

  // v3.41 T3 (Codex P1 F3): Non-GET (POST/PUT/DELETE/PATCH) pass-through.
  // Slack DM relay POST 등이 stale-while-revalidate에 진입하면 cache.put이
  // 'Request method POST is not supported' reject (silent telemetry noise).
  if (req.method !== 'GET') {
    return;
  }

  // v3.41 T3 (Codex P1 F3): /api/ pass-through — Firebase Functions rewrite는
  // SW가 intercept하지 않음 (App Check token header / 인증 / 응답 stream 정합).
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // v3.41 T3 (Codex P1 F3): Navigation network-first with cached /index.html fallback.
  // 기존 stale-while-revalidate가 old hashed chunk 참조하는 stale html을 navigation에
  // 반환할 수 있어 404 cascade 발생. 새 SW (v10) activate 이후 reload부터 보장.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((hit) => hit || Response.error()))
    );
    return;
  }

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
