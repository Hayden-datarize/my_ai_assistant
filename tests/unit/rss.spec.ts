import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchFeed } from '../../src/services/rss';

afterEach(() => vi.restoreAllMocks());

describe('services/rss', () => {
  it('returns items on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        items: [{ title: 't', link: 'u', description: 'd', pubDate: '2026-04-19' }],
      }),
    }));
    const res = await fetchFeed('https://example.com/feed');
    expect(res).toHaveLength(1);
    expect(res[0]?.title).toBe('t');
  });

  it('returns [] when fetch rejects (timeout / abort)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')));
    const res = await fetchFeed('https://example.com/feed', { timeoutMs: 5 });
    expect(res).toEqual([]);
  });

  it('returns [] on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchFeed('x')).toEqual([]);
  });

  it('encodes feedUrl query param', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    vi.stubGlobal('fetch', spy);
    await fetchFeed('https://example.com/rss?x=1&y=2');
    const calledUrl = spy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain(encodeURIComponent('https://example.com/rss?x=1&y=2'));
  });
});
