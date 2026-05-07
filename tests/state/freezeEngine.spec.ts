import { describe, it, expect } from 'vitest';
import { regenerateFreeze } from '../../src/state/freezeEngine';
import type { User } from '../../src/state/user';

const baseUser = (overrides: Partial<User['streakFreeze']>): User => ({
  streakFreeze: { count: 0, lastEarnedAt: '2026-05-01', ...overrides },
} as User);

describe('regenerateFreeze', () => {
  it('gap 0d (now == lastEarnedAt) → no regen, lastEarnedAt 보존', () => {
    const u = baseUser({ count: 0, lastEarnedAt: '2026-05-01' });
    // KST 자정 기준 (Date.parse는 +09:00 anchored)
    regenerateFreeze(u, new Date(Date.parse('2026-05-01T00:00:00+09:00')));
    expect(u.streakFreeze.count).toBe(0);
    expect(u.streakFreeze.lastEarnedAt).toBe('2026-05-01');
  });

  it('gap 7d → +1 regen + lastEarnedAt += 7d', () => {
    const u = baseUser({ count: 0, lastEarnedAt: '2026-05-01' });
    regenerateFreeze(u, new Date(Date.parse('2026-05-08T00:00:00+09:00')));
    expect(u.streakFreeze.count).toBe(1);
    expect(u.streakFreeze.lastEarnedAt).toBe('2026-05-08');
  });

  it('gap 14d → +2 regen + lastEarnedAt += 14d', () => {
    const u = baseUser({ count: 0, lastEarnedAt: '2026-05-01' });
    regenerateFreeze(u, new Date(Date.parse('2026-05-15T00:00:00+09:00')));
    expect(u.streakFreeze.count).toBe(2);
    expect(u.streakFreeze.lastEarnedAt).toBe('2026-05-15');
  });

  it('gap 21d + count 0 → cap 2로 clamp + lastEarnedAt += 21d (시간은 진행)', () => {
    const u = baseUser({ count: 0, lastEarnedAt: '2026-05-01' });
    regenerateFreeze(u, new Date(Date.parse('2026-05-22T00:00:00+09:00')));
    expect(u.streakFreeze.count).toBe(2);
    expect(u.streakFreeze.lastEarnedAt).toBe('2026-05-22');
  });

  it('count 2 (cap) → no regen, lastEarnedAt 보존', () => {
    const u = baseUser({ count: 2, lastEarnedAt: '2026-05-01' });
    regenerateFreeze(u, new Date(Date.parse('2026-05-22T00:00:00+09:00')));
    expect(u.streakFreeze.count).toBe(2);
    expect(u.streakFreeze.lastEarnedAt).toBe('2026-05-01');
  });

  it('시계 역행 (now < lastEarnedAt) → no-op (count + lastEarnedAt 보존)', () => {
    const u = baseUser({ count: 1, lastEarnedAt: '2026-05-01' });
    regenerateFreeze(u, new Date(Date.parse('2026-04-20T00:00:00+09:00')));
    expect(u.streakFreeze.count).toBe(1);
    expect(u.streakFreeze.lastEarnedAt).toBe('2026-05-01');
  });

  it('write-side는 머신 TZ에 무관하게 KST 날짜 기록 (v3.14.5 Pattern D 회귀 가드)', () => {
    // 본 spec은 vite.config TZ='Asia/Seoul' 강제 가정.
    // getKstDateStr이 Intl.DateTimeFormat을 사용하므로 머신 TZ 무관.
    const u = baseUser({ count: 0, lastEarnedAt: '2026-05-01' });
    regenerateFreeze(u, new Date(Date.parse('2026-05-08T00:00:00+09:00')));
    expect(u.streakFreeze.lastEarnedAt).toBe('2026-05-08');
  });
});
