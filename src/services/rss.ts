export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

export interface FeedResult {
  items: FeedItem[];
  sourceTitle: string;
}

export async function fetchFeed(
  feedUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<FeedResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return { items: [], sourceTitle: '' };
    const data = (await r.json()) as {
      items?: FeedItem[];
      feed?: { title?: string };
    };
    return {
      items: Array.isArray(data.items) ? data.items : [],
      sourceTitle: data.feed?.title ?? '',
    };
  } catch {
    return { items: [], sourceTitle: '' };
  } finally {
    clearTimeout(timer);
  }
}
