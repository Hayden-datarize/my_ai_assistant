import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isSeen, recordSeen, purgeExpiredSeen } from '../../src/state/seen';

const KEY = 'seenBriefings';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

describe('state/seen', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('isSeen returns false when localStorage empty', () => {
    expect(isSeen('https://example.com/a')).toBe(false);
  });

  it('isSeen returns false on malformed JSON', () => {
    localStorage.setItem(KEY, '{not valid json');
    expect(isSeen('https://example.com/a')).toBe(false);
  });

  it('recordSeen stores urls with current timestamp', () => {
    const now = Date.parse('2026-04-28T00:00:00Z');
    recordSeen(['https://x.com/1', 'https://x.com/2'], now);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored).toHaveLength(2);
    expect(stored.every((r: { firstSeenAt: number }) => r.firstSeenAt === now)).toBe(true);
  });

  it('recordSeen is idempotent for existing url (firstSeenAt unchanged)', () => {
    const t1 = Date.parse('2026-04-01T00:00:00Z');
    const t2 = Date.parse('2026-04-28T00:00:00Z');
    recordSeen(['https://x.com/1'], t1);
    recordSeen(['https://x.com/1'], t2);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].firstSeenAt).toBe(t1);
  });

  it('recordSeen LRU cap = 500 (drops oldest)', () => {
    const now = Date.parse('2026-04-28T00:00:00Z');
    const initial = Array.from({ length: 500 }, (_, i) => ({
      url: `https://x.com/${i}`,
      firstSeenAt: now - (500 - i) * 1000,
    }));
    localStorage.setItem(KEY, JSON.stringify(initial));
    recordSeen(['https://x.com/new'], now);
    const stored = JSON.parse(localStorage.getItem(KEY)!) as Array<{ url: string }>;
    expect(stored).toHaveLength(500);
    expect(stored.find((r) => r.url === 'https://x.com/new')).toBeDefined();
    expect(stored.find((r) => r.url === 'https://x.com/0')).toBeUndefined();
  });

  it('isSeen respects 30d retention', () => {
    const now = Date.parse('2026-04-28T00:00:00Z');
    const day29 = now - 29 * 24 * 60 * 60 * 1000;
    const day31 = now - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem(KEY, JSON.stringify([
      { url: 'https://recent.com', firstSeenAt: day29 },
      { url: 'https://old.com', firstSeenAt: day31 },
    ]));
    expect(isSeen('https://recent.com', now)).toBe(true);
    expect(isSeen('https://old.com', now)).toBe(false);
  });

  it('purgeExpiredSeen removes only expired records', () => {
    const now = Date.parse('2026-04-28T00:00:00Z');
    localStorage.setItem(KEY, JSON.stringify([
      { url: 'https://recent.com', firstSeenAt: now - 1000 },
      { url: 'https://old.com', firstSeenAt: now - TTL_MS - 1000 },
    ]));
    purgeExpiredSeen(now);
    const stored = JSON.parse(localStorage.getItem(KEY)!) as Array<{ url: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0]!.url).toBe('https://recent.com');
  });
});
