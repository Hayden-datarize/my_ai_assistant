// v3.20 T5 (B1): RSS retry telemetry — DEV log + 24h rolling counter (v3.18.1 H2 carry).
import { recordRetry } from '../utils/rssTelemetry';

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image?: string;  // v3.3.3 added
}

export interface FeedResult {
  items: FeedItem[];
  sourceTitle: string;
}

/** rss2json response shape (partial, for items[]) */
export interface RawFeedItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  enclosure?: { link?: string; type?: string };
  thumbnail?: string;
  // v3.20.1 H2: rss2json는 풍부 HTML body를 `content` 필드로 제공 (description은 plain text 또는 짧은 요약).
  // Substack/WordPress 계열에서 hero image가 content 안에만 있는 경우가 있음.
  content?: string;
}

function sanitizeHttpsUrl(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'https:') return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export function extractImage(raw: RawFeedItem): string | undefined {
  // Tier 1: enclosure (image/* type only)
  if (raw.enclosure?.type?.startsWith('image/')) {
    const url = sanitizeHttpsUrl(raw.enclosure.link);
    if (url) return url;
  }
  // Tier 2: thumbnail field
  const thumb = sanitizeHttpsUrl(raw.thumbnail);
  if (thumb) return thumb;
  // Tier 3 (v3.20.1 H2): DOMParser on `content` (HTML body, 풍부) — 우선
  // Tier 4 (v3.20.1 H2): DOMParser on `description` (text 또는 짧은 HTML) — fallback
  // 각 source에서 lazy-load image (data-src) + 일반 src 둘 다 시도.
  for (const html of [raw.content, raw.description]) {
    if (!html) continue;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      for (const img of Array.from(doc.querySelectorAll('img'))) {
        const candidate =
          img.getAttribute('data-src') ??
          img.getAttribute('src') ??
          undefined;
        const url = sanitizeHttpsUrl(candidate ?? undefined);
        if (url) return url;
      }
    } catch {
      // DOMParser errors are swallowed — fallback to next tier
    }
  }
  return undefined;
}

// v3.18.1 H2 (#9): rss2json rate limit (429) 대응
// translate.ts isRetryable 패턴 차용 — 429/503만 retry, max 2회 exponential backoff.
// v3.20 T6 (B2): 보수적 시드 [200, 800] → [500, 1500] + jitter ±20%.
// 외부 API(rss2json) 부담 ↓ + 429/503 회복력 ↑. timeout 5s 내 3 attempt 허용.
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 2;
const BACKOFF_MS = [500, 1500];
const JITTER_RATIO = 0.2;

/** @internal — exposed for unit test (Math.random mock + delay 범위 검증) */
export function computeBackoffDelay(attempt: number, randomFn: () => number = Math.random): number {
  const base = BACKOFF_MS[attempt] ?? 1500;
  const jitter = base * JITTER_RATIO * (randomFn() * 2 - 1); // [-20%, +20%]
  return Math.max(0, base + jitter);
}

export async function fetchFeed(
  feedUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<FeedResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const r = await fetch(url, { signal: controller.signal });
      if (r.ok) {
        const data = (await r.json()) as {
          items?: RawFeedItem[];
          feed?: { title?: string };
        };
        const items: FeedItem[] = Array.isArray(data.items)
          ? data.items.map((rawItem) => ({
              title: rawItem.title ?? '',
              link: rawItem.link ?? '',
              description: rawItem.description ?? '',
              pubDate: rawItem.pubDate ?? '',
              image: extractImage(rawItem),
            }))
          : [];
        return { items, sourceTitle: data.feed?.title ?? '' };
      }
      if (!RETRYABLE_STATUSES.has(r.status)) break;
      // v3.20 T5: telemetry — 24h rolling counter + DEV warn (production 1주 관측).
      recordRetry(r.status);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[dg.rss.retry]', { feedUrl, status: r.status, attempt });
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, computeBackoffDelay(attempt)));
      }
    }
    return { items: [], sourceTitle: '' };
  } catch {
    return { items: [], sourceTitle: '' };
  } finally {
    clearTimeout(timer);
  }
}
