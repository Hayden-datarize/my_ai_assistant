import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFeed } from '../../src/services/rss';

afterEach(() => { vi.restoreAllMocks(); });

describe('services/rss', () => {
  it('returns items + sourceTitle on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        feed: { title: 'example blog' },
        // v3.41 T4 (Codex P1 F4): link은 isSafeUrl 통과 의무 → valid https로 갱신.
        items: [{ title: 't', link: 'https://example.com/post1', description: 'd', pubDate: '2026-04-19' }],
      }),
    }));
    const res = await fetchFeed('https://example.com/feed');
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.title).toBe('t');
    expect(res.sourceTitle).toBe('example blog');
  });

  // v3.41 T4 (Codex P1 F4): RSS link unsafe scheme item drop 회귀.
  it('drops items with unsafe link (javascript:/data:/empty)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        feed: { title: 'mixed feed' },
        items: [
          { title: 'safe', link: 'https://example.com/safe', description: 'd', pubDate: '' },
          { title: 'evil1', link: 'javascript:alert(1)', description: 'd', pubDate: '' },
          { title: 'evil2', link: 'data:text/html,<script>', description: 'd', pubDate: '' },
          { title: 'no-link', link: '', description: 'd', pubDate: '' },
          { title: 'http-ok', link: 'http://example.com/legacy', description: 'd', pubDate: '' },
        ],
      }),
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await fetchFeed('https://example.com/feed');
    expect(res.items).toHaveLength(2);
    expect(res.items.map((i) => i.title)).toEqual(['safe', 'http-ok']);
  });

  it('returns empty shape when fetch rejects (timeout / abort)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')));
    const res = await fetchFeed('https://example.com/feed', { timeoutMs: 5 });
    expect(res).toEqual({ items: [], sourceTitle: '' });
  });

  it('returns empty shape on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchFeed('x')).toEqual({ items: [], sourceTitle: '' });
  });

  it('encodes feedUrl query param', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    vi.stubGlobal('fetch', spy);
    await fetchFeed('https://example.com/rss?x=1&y=2');
    const calledUrl = spy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain(encodeURIComponent('https://example.com/rss?x=1&y=2'));
  });

  it('falls back to empty sourceTitle when feed.title missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    }));
    const res = await fetchFeed('x');
    expect(res.sourceTitle).toBe('');
  });
});

describe('v3.18.1 H2 (#9) — fetchFeed retry on 429', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('429 첫 호출 후 retry 시 200 회수', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 429, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ title: 't', link: 'https://example.com', description: 'd', pubDate: '' }],
          feed: { title: 's' },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const promise = fetchFeed('https://example.com/feed');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(callCount).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it('연속 3회 429 → 빈 배열 반환 (max retry 2)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const promise = fetchFeed('https://example.com/feed');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.items).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('non-retryable status (404) → 즉시 빈 배열 (retry 안 함)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const promise = fetchFeed('https://example.com/feed');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.items).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
