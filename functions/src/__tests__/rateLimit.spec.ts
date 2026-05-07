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

  // v3.20 T11 (D1 — P0-1 amendment): kind = 'burst' | 'daily' boundary 정확 검증
  // 사전 review 정정: 이전 plan은 'minute'/'daily' 픽션이었음.

  it('burst window boundary at exactly 59_999ms still blocks (within window)', () => {
    const now = 1_700_000_000_000;
    checkRateLimit('me@datarize.ai', now);
    checkRateLimit('me@datarize.ai', now + 1);
    checkRateLimit('me@datarize.ai', now + 2);
    // BURST_WINDOW_MS = 60_000. 첫 ts(now) 가 now + 59_999 시점에 59_999ms 경과 — 60_000 미만 → 윈도우 안 → block
    expect(checkRateLimit('me@datarize.ai', now + 59_999)).toBe('burst');
  });

  it('burst window boundary at exactly 60_000ms still blocks (filter is strict <)', () => {
    const now = 1_700_000_000_000;
    checkRateLimit('me@datarize.ai', now);
    checkRateLimit('me@datarize.ai', now + 1);
    checkRateLimit('me@datarize.ai', now + 2);
    // filter 조건 `now - t < BURST_WINDOW_MS` 이 strict less-than이므로 정확히 60_000ms 시점에는
    // 첫 ts(=now) 가 60_000 - 0 = 60_000 → not < 60_000 → 만료. 단 now+1, now+2가 남아있어도
    // burst length는 2건 (now+1, now+2) → BURST_MAX=3 미만 → ok가 아니라 신규 ts 추가 후 ok.
    expect(checkRateLimit('me@datarize.ai', now + 60_000)).toBe('ok');
  });

  it('burst window boundary at 60_001ms allows new call (well past window)', () => {
    const now = 1_700_000_000_000;
    checkRateLimit('me@datarize.ai', now);
    checkRateLimit('me@datarize.ai', now + 1);
    checkRateLimit('me@datarize.ai', now + 2);
    expect(checkRateLimit('me@datarize.ai', now + 60_001)).toBe('ok');
  });

  it('daily window boundary at exactly 86_400_000ms (24h) — first ts expires', () => {
    const now = 1_700_000_000_000;
    // 10 calls spaced 1분 간격 — burst 회피, daily 누적
    for (let i = 0; i < 10; i++) {
      checkRateLimit('me@datarize.ai', now + i * 60_001);
    }
    expect(checkRateLimit('me@datarize.ai', now + 10 * 60_001)).toBe('daily');
    // 정확히 24h 시점 — 첫 ts(now)가 86_400_000ms 경과 → not < 86_400_000 → 만료.
    // daily list 9건 남음 → DAILY_MAX=10 미만 → ok.
    expect(checkRateLimit('me@datarize.ai', now + 86_400_000)).toBe('ok');
  });

  it('daily window boundary at 86_400_001ms allows new call', () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 10; i++) {
      checkRateLimit('me@datarize.ai', now + i * 60_001);
    }
    expect(checkRateLimit('me@datarize.ai', now + 86_400_001)).toBe('ok');
  });

  it('kind = "burst" returned in rate_limited 응답 — sendAnswerDm.ts:42 분기 정합', () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit('me@datarize.ai', now);
    const result = checkRateLimit('me@datarize.ai', now);
    expect(result).toBe('burst');
    // sendAnswerDm.ts:42 `res.status(429).json({ error: 'rate_limited', kind: rl })` 분기
  });

  it('kind = "daily" returned when daily quota first exceeded (burst 미적용 timing)', () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 10; i++) {
      checkRateLimit('me@datarize.ai', now + i * 60_001); // burst 회피 spacing
    }
    expect(checkRateLimit('me@datarize.ai', now + 10 * 60_001)).toBe('daily');
  });
});
