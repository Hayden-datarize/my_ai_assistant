import { describe, it, expect, afterEach, vi } from 'vitest';
import { migrateUserToV5 } from '../../src/state/migration';

describe('migrateUserToV5', () => {
  it('v4 user → v5 with default streakFreeze {count: 2, lastEarnedAt: today}', () => {
    const v4 = { schemaVersion: 4, streak: 5, lastActiveDate: '2026-05-06' };
    const v5 = migrateUserToV5(v4);
    expect(v5.schemaVersion).toBe(5);
    expect(v5.streakFreeze.count).toBe(2);
    expect(v5.streakFreeze.lastEarnedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('v5 user → v5 idempotent', () => {
    const v5In = { schemaVersion: 5, streakFreeze: { count: 1, lastEarnedAt: '2026-05-01' } };
    const v5Out = migrateUserToV5(v5In);
    expect(v5Out).toEqual(v5In);
  });

  it('손상된 streakFreeze (count NaN) → default 복구', () => {
    const corrupt = { schemaVersion: 4, streakFreeze: { count: NaN, lastEarnedAt: '' } };
    const fixed = migrateUserToV5(corrupt);
    expect(fixed.streakFreeze.count).toBe(2);
    expect(fixed.streakFreeze.lastEarnedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('count 음수 → 전체 default 복구 (count=2 + lastEarnedAt=today)', () => {
    const neg = { schemaVersion: 4, streakFreeze: { count: -1, lastEarnedAt: '2026-05-01' } };
    const fixed = migrateUserToV5(neg);
    expect(fixed.streakFreeze.count).toBe(2);
    expect(fixed.streakFreeze.lastEarnedAt).not.toBe('2026-05-01');
    expect(fixed.streakFreeze.lastEarnedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('count > 2 → 전체 default 복구 (count=2 + lastEarnedAt=today)', () => {
    const over = { schemaVersion: 4, streakFreeze: { count: 5, lastEarnedAt: '2026-05-01' } };
    const fixed = migrateUserToV5(over);
    expect(fixed.streakFreeze.count).toBe(2);
    expect(fixed.streakFreeze.lastEarnedAt).not.toBe('2026-05-01');
    expect(fixed.streakFreeze.lastEarnedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // v3.23 T1 (P0-1 fix): v6 user → migrateUserToV5 early return (chain superset)
  it('v6 user → migrateUserToV5 통과 시 streakFreeze / insights 보존 (same reference)', () => {
    const v6 = {
      schemaVersion: 6,
      streakFreeze: { count: 1, lastEarnedAt: '2026-05-08' },
      insights: [{ id: 'i1', text: '통찰', createdAt: '2026-05-08T09:00:00Z' }],
    };
    const out = migrateUserToV5(v6);
    expect(out).toBe(v6);  // same reference — early return
    expect(out).toHaveProperty('insights', v6.insights);
  });

  describe('v3.22 T2 — KST anchor (P0-2 boundary fixture)', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('KST 자정 직후 instant — 머신 TZ 무관하게 KST date 반환', () => {
      vi.useFakeTimers();
      // KST 2026-05-08T00:30 = NY 2026-05-07T11:30 → 머신이 NY여도 KST 기준 2026-05-08
      vi.setSystemTime(new Date('2026-05-08T00:30:00+09:00'));
      const v4 = { schemaVersion: 4, streak: 5, lastActiveDate: '2026-05-06' };
      const v5 = migrateUserToV5(v4);
      expect(v5.streakFreeze.lastEarnedAt).toBe('2026-05-08');
    });
  });
});
