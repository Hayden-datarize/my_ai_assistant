import { describe, it, expect } from 'vitest';
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

  it('count 음수 → cap 0으로 clamp 또는 default 복구', () => {
    const neg = { schemaVersion: 4, streakFreeze: { count: -1, lastEarnedAt: '2026-05-01' } };
    const fixed = migrateUserToV5(neg);
    expect(fixed.streakFreeze.count).toBeGreaterThanOrEqual(0);
    expect(fixed.streakFreeze.count).toBeLessThanOrEqual(2);
  });

  it('count > 2 → cap 2로 clamp', () => {
    const over = { schemaVersion: 4, streakFreeze: { count: 5, lastEarnedAt: '2026-05-01' } };
    const fixed = migrateUserToV5(over);
    expect(fixed.streakFreeze.count).toBe(2);
  });
});
