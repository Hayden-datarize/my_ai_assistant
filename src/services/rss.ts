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
  // Tier 3: DOMParser on description (safer than regex, browser-native)
  if (raw.description) {
    try {
      const doc = new DOMParser().parseFromString(raw.description, 'text/html');
      const img = doc.querySelector('img');
      const src = img?.getAttribute('src') ?? undefined;
      const url = sanitizeHttpsUrl(src);
      if (url) return url;
    } catch {
      // DOMParser errors are swallowed — fallback to no image
    }
  }
  return undefined;
}

// v3.18.1 H2 (#9): rss2json rate limit (429) 대응
// translate.ts isRetryable 패턴 차용 — 429/503만 retry, max 2회 exponential backoff.
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 2;
const BACKOFF_MS = [200, 800];

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
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt]));
      }
    }
    return { items: [], sourceTitle: '' };
  } catch {
    return { items: [], sourceTitle: '' };
  } finally {
    clearTimeout(timer);
  }
}
