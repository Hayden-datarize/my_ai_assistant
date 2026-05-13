/**
 * v3.25 T2: schema v6 → v7 lazy migration spec.
 *
 * - Insight.interestId 필드 추가 (default 'unknown')
 * - id/text 누락 entry 자동 제거 (silent drop, spec §3 P0-A2)
 * - validateInterestId로 invalid id → 'unknown' 폴백
 * - idempotent: 이미 v7이면 그대로 반환
 */
import { describe, it, expect } from 'vitest';
import { migrateUserToV7 } from '../../src/state/migration';

describe('migrateUserToV7 (v3.25 T2)', () => {
  function makeV6Base(): Record<string, unknown> & { schemaVersion: 6 | 7; insights: unknown[] } {
    return {
      schemaVersion: 6,
      name: 'X', interests: [], onboardedAt: '2026-01-01',
      streak: 0, lastActiveDate: '2026-01-01',
      xp: 0, earnedBadges: {}, gamificationMigrated: true,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
                  lastDailySeed: '2026-01-01', currentWeekIso: '2026-W01', currentMonthIso: '2026-01' },
      plantStateByInterest: {}, gardenIntroduced: true, gardenBackfilled: true,
      streakFreeze: { count: 2, lastEarnedAt: '2026-01-01' },
      insights: [],
    };
  }

  it('v6 → v7 — insights에 interestId=unknown 채움 + schemaVersion 7', () => {
    const v6 = makeV6Base();
    v6.insights = [
      { id: 'i1', text: 'ok', createdAt: '2026-01-01' },  // interestId 누락
      { id: 'i2', text: 'ok2', createdAt: '2026-01-02' },
    ];
    const v7 = migrateUserToV7(v6);
    expect(v7.schemaVersion).toBe(7);
    expect(v7.insights).toHaveLength(2);
    expect(v7.insights[0]!.interestId).toBe('unknown');
    expect(v7.insights[1]!.interestId).toBe('unknown');
  });

  it('v7 idempotent — 같은 reference 반환', () => {
    const v7 = makeV6Base();
    v7.schemaVersion = 7;
    v7.insights = [{ id: 'i1', text: 'ok', createdAt: '2026-01-01', interestId: 'recruiting' }];
    const result = migrateUserToV7(v7);
    expect(result.schemaVersion).toBe(7);
    expect(result.insights[0]!.interestId).toBe('recruiting');
  });

  it('corrupted entry 제거 — id 또는 text 누락', () => {
    const v6 = makeV6Base();
    v6.insights = [
      { id: 'i1', text: 'ok', createdAt: '2026-01-01', interestId: 'recruiting' },
      { id: 'i2', text: '', createdAt: '2026-01-02' },     // text empty → drop
      { id: '', text: 'orphan', createdAt: '2026-01-03' }, // id empty → drop
      { text: 'no-id', createdAt: '2026-01-04' },          // id 누락 → drop
    ];
    const v7 = migrateUserToV7(v6);
    expect(v7.insights).toHaveLength(1);
    expect(v7.insights[0]!.id).toBe('i1');
  });

  it('interestId invalid string — validateInterestId 폴백 (unknown)', () => {
    const v6 = makeV6Base();
    v6.insights = [
      { id: 'i1', text: 'ok', createdAt: '2026-01-01', interestId: 'hallucinated' },
    ];
    const v7 = migrateUserToV7(v6);
    expect(v7.insights[0]!.interestId).toBe('unknown');
  });
});
