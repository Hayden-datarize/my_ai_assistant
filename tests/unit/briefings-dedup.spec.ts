import { describe, it, expect } from 'vitest';
import { pickBriefings } from '../../src/ui/handlers/home';
import type { FeedResult } from '../../src/services/rss';

const feed = (sourceTitle: string, links: string[]): FeedResult => ({
  sourceTitle,
  items: links.map((link, i) => ({
    title: `${sourceTitle}-${i}`,
    link,
    description: 'd',
    pubDate: '',
  })),
});

describe('pickBriefings (v3.2b-ui dedup)', () => {
  it('returns [] for empty feeds', () => {
    expect(pickBriefings([], 3)).toEqual([]);
  });

  it('picks up to target from a single feed in order', () => {
    const f = feed('A', ['a1', 'a2', 'a3', 'a4']);
    const out = pickBriefings([f], 3);
    expect(out.map((p) => p.item.link)).toEqual(['a1', 'a2', 'a3']);
    expect(out.every((p) => p.sourceTitle === 'A')).toBe(true);
  });

  it('round-robins across two feeds', () => {
    const a = feed('A', ['a1', 'a2']);
    const b = feed('B', ['b1', 'b2']);
    const out = pickBriefings([a, b], 3);
    expect(out.map((p) => p.item.link)).toEqual(['a1', 'b1', 'a2']);
    expect(out.map((p) => p.sourceTitle)).toEqual(['A', 'B', 'A']);
  });

  it('skips duplicate links across feeds', () => {
    const a = feed('A', ['shared', 'a2']);
    const b = feed('B', ['shared', 'b2']);
    const out = pickBriefings([a, b], 3);
    expect(out.map((p) => p.item.link)).toEqual(['shared', 'a2', 'b2']);
  });

  it('returns fewer than target when all feeds exhausted or fully duplicated', () => {
    const a = feed('A', ['x', 'x']);
    expect(pickBriefings([a], 3)).toHaveLength(1);
    expect(pickBriefings([], 3)).toHaveLength(0);
  });

  it('handles a feed with empty items array', () => {
    const a = feed('A', []);
    const b = feed('B', ['b1']);
    const out = pickBriefings([a, b], 3);
    expect(out.map((p) => p.item.link)).toEqual(['b1']);
  });
});
