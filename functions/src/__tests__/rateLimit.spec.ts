import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit } from '../rateLimit';

describe('rateLimit', () => {
  beforeEach(() => resetRateLimit());

  it('allows first call', () => {
    expect(checkRateLimit('me@datarize.ai', Date.now())).toBe('ok');
  });

  it('blocks burst — 4th call within 60s', () => {
    const now = 1_700_000_000_000;
    expect(checkRateLimit('me@datarize.ai', now)).toBe('ok');
    expect(checkRateLimit('me@datarize.ai', now + 100)).toBe('ok');
    expect(checkRateLimit('me@datarize.ai', now + 200)).toBe('ok');
    expect(checkRateLimit('me@datarize.ai', now + 300)).toBe('burst');
  });

  it('allows 4th call after 60s window', () => {
    const now = 1_700_000_000_000;
    checkRateLimit('me@datarize.ai', now);
    checkRateLimit('me@datarize.ai', now + 100);
    checkRateLimit('me@datarize.ai', now + 200);
    expect(checkRateLimit('me@datarize.ai', now + 60_001)).toBe('ok');
  });

  it('blocks 11th call within 24h', () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 10; i++) {
      // burst 회피 — 1분 간격
      expect(checkRateLimit('me@datarize.ai', now + i * 60_001)).toBe('ok');
    }
    expect(checkRateLimit('me@datarize.ai', now + 10 * 60_001)).toBe('daily');
  });

  it('isolates per-email counters', () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit('a@datarize.ai', now);
    expect(checkRateLimit('a@datarize.ai', now)).toBe('burst');
    expect(checkRateLimit('b@datarize.ai', now)).toBe('ok');
  });
});
