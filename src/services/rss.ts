export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

export async function fetchFeed(
  feedUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return [];
    const data = (await r.json()) as { items?: FeedItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
