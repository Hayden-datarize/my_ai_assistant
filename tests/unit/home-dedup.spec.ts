import { describe, it, expect, beforeEach } from 'vitest';
import { pickBriefings } from '../../src/ui/handlers/home';
import { recordSeen, loadActiveSeenUrls } from '../../src/state/seen';
import type { FeedResult } from '../../src/services/rss';

const item = (link: string, title = 't') => ({
  title,
  link,
  description: '',
  pubDate: '',
  image: undefined as string | undefined,
});

describe('refreshBriefings dedup behavior', () => {
  beforeEach(() => localStorage.clear());

  it('filtered FeedResult removes seen urls before pickBriefings', () => {
    const now = Date.parse('2026-04-28T00:00:00Z');
    recordSeen(['https://a.com/1'], now);

    const feed: FeedResult = {
      sourceTitle: 'A',
      items: [item('https://a.com/1', 't1'), item('https://a.com/2', 't2')],
    };
    const activeSeen = loadActiveSeenUrls(now);
    const filtered: FeedResult = {
      ...feed,
      items: feed.items.filter((it) => !activeSeen.has(it.link)),
    };
    const picked = pickBriefings([filtered], 5);
    expect(picked.map((p) => p.item.link)).toEqual(['https://a.com/2']);
  });

  it('preserves newest-first ordering after filter', () => {
    const feed: FeedResult = {
      sourceTitle: 'A',
      items: [item('https://a.com/n', 'newest'), item('https://a.com/o', 'older')],
    };
    const picked = pickBriefings([feed], 5);
    expect(picked[0]?.item.link).toBe('https://a.com/n');
  });

  it('all-seen → filtered yields 0 picks → caller fallback to unfiltered feeds restores items', () => {
    const now = Date.parse('2026-04-28T00:00:00Z');
    recordSeen(['https://a.com/1', 'https://a.com/2'], now);

    const feed: FeedResult = {
      sourceTitle: 'A',
      items: [item('https://a.com/1'), item('https://a.com/2')],
    };
    const activeSeen = loadActiveSeenUrls(now);
    const filtered: FeedResult = { ...feed, items: feed.items.filter((it) => !activeSeen.has(it.link)) };
    expect(pickBriefings([filtered], 5)).toHaveLength(0);
    expect(pickBriefings([feed], 5)).toHaveLength(2);
  });

  it('recordSeen called with chosen urls makes them seen subsequently', () => {
    const now = Date.parse('2026-04-28T00:00:00Z');
    const urls = ['https://a.com/1', 'https://b.com/2'];
    recordSeen(urls, now);
    const active = loadActiveSeenUrls(now);
    expect(active.has('https://a.com/1')).toBe(true);
    expect(active.has('https://b.com/2')).toBe(true);
  });
});
