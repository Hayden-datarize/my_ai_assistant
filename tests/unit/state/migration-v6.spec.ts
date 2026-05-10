import { describe, it, expect } from 'vitest';
import { migrateUserToV3, migrateUserToV4, migrateUserToV5, migrateUserToV6 } from '../../../src/state/migration';

// v3.26 T5: chain superset assertion helper — V2/V3/V4 type 시그니처 너머의 superset 필드 검증용.
// `as any` 대신 explicit ChainSupersetView interface로 ESLint warning 0건 + chainable assertion.
interface ChainSupersetView {
  plantStateByInterest?: Record<string, { stage: number; cumulativeActivity: number; unlockedAt?: string }>;
  streakFreeze?: { count: number; lastEarnedAt: string };
  insights?: Array<{ id: string; text: string; createdAt: string; interestId?: string }>;
}
const lifted = (u: unknown): ChainSupersetView => u as ChainSupersetView;

// v6 user 공통 픽스처 builder
function mkV5(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Hayden',
    interests: ['recruiting'],
    onboardedAt: '2026-04-30',
    streak: 5,
    lastActiveDate: '2026-05-08',
    xp: 200,
    earnedBadges: {},
    gamificationMigrated: true,
    schemaVersion: 5,
    missions: {
      active: [],
      cumulative: { dailyCount: 3, weeklyCount: 1, monthlyCount: 0 },
      lastDailySeed: '2026-05-08',
      currentWeekIso: '2026-W19',
      currentMonthIso: '2026-05',
    },
    plantStateByInterest: { recruiting: { stage: 2, cumulativeActivity: 15 } },
    gardenIntroduced: true,
    gardenBackfilled: true,
    streakFreeze: { count: 1, lastEarnedAt: '2026-05-07' },
    ...over,
  };
}

describe('migrateUserToV6', () => {
  it('v5 → v6: insights default [], schemaVersion 6', () => {
    const v5 = mkV5();
    const v6 = migrateUserToV6(v5);
    expect(v6.schemaVersion).toBe(6);
    expect(v6.insights).toEqual([]);
    // 기존 필드 보존
    expect(v6.streak).toBe(5);
    expect(v6.xp).toBe(200);
    expect(v6.streakFreeze).toEqual({ count: 1, lastEarnedAt: '2026-05-07' });
  });

  it('v6 pass-through (idempotent — same reference)', () => {
    const v6 = migrateUserToV6(mkV5());
    const v6again = migrateUserToV6(v6);
    expect(v6again).toBe(v6);
  });

  it('v4 → v6 chain: streakFreeze 보존 + insights default []', () => {
    const v4 = {
      ...mkV5(),
      schemaVersion: 4,
      streakFreeze: undefined,  // v4는 streakFreeze 미존재
    };
    const v6 = migrateUserToV6(v4);
    expect(v6.schemaVersion).toBe(6);
    expect(v6.insights).toEqual([]);
    // streakFreeze는 V5에서 추가됨
    expect(v6.streakFreeze).toBeDefined();
    expect(typeof v6.streakFreeze.count).toBe('number');
    // plantStateByInterest 보존
    expect(lifted(v6).plantStateByInterest?.recruiting?.stage).toBe(2);
  });

  it('손상된 insights (string) → default [] 복구', () => {
    const broken = { ...mkV5({ insights: 'corrupt' }) };
    const v6 = migrateUserToV6(broken);
    expect(v6.insights).toEqual([]);
  });

  it('손상된 insights (NaN) → default [] 복구', () => {
    const broken = { ...mkV5({ insights: NaN }) };
    const v6 = migrateUserToV6(broken);
    expect(v6.insights).toEqual([]);
  });

  it('기존 insights 배열이 있으면 보존 (비파괴적 migrate)', () => {
    const existing = [{ id: 'i1', text: '통찰 내용', createdAt: '2026-05-08T10:00:00Z' }];
    const v5WithInsights = { ...mkV5({ insights: existing }) };
    // V5로 처리된 후 V6로 올릴 경우
    const v6 = migrateUserToV6(v5WithInsights);
    expect(v6.insights).toEqual(existing);
    expect(v6.insights).toBe(existing);  // 동일 배열 참조 (copy 안 함)
  });
});

// P0-1 fix: chain superset early-return 검증
describe('chain superset — v6 user → 하위 chain 통과 시 필드 보존', () => {
  const v6User = {
    name: 'Hayden',
    interests: ['recruiting'],
    onboardedAt: '2026-04-30',
    streak: 10,
    lastActiveDate: '2026-05-08',
    xp: 500,
    earnedBadges: { 'streak-7': 1746000000000 },
    gamificationMigrated: true,
    schemaVersion: 6 as const,
    missions: {
      active: [{ defId: 'daily-1', period: 'daily', windowStart: 0, progress: 1, progressDates: ['2026-05-08'] }],
      cumulative: { dailyCount: 9, weeklyCount: 3, monthlyCount: 1 },
      lastDailySeed: '2026-05-08',
      currentWeekIso: '2026-W19',
      currentMonthIso: '2026-05',
    },
    plantStateByInterest: { recruiting: { stage: 3, cumulativeActivity: 25 } },
    gardenIntroduced: true,
    gardenBackfilled: true,
    streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
    insights: [{ id: 'i1', text: '중요한 통찰', createdAt: '2026-05-08T09:00:00Z' }],
  };

  it('v6 user → migrateUserToV3 통과 시 missions / streakFreeze / plantStateByInterest / insights 보존', () => {
    const out = migrateUserToV3(v6User);
    // schemaVersion 보존
    expect(out.schemaVersion).toBe(6);
    // missions 보존 (reset 안 됨)
    expect(out.missions.cumulative.dailyCount).toBe(9);
    // streakFreeze 보존
    expect(lifted(out).streakFreeze).toEqual({ count: 2, lastEarnedAt: '2026-05-07' });
    // plantStateByInterest 보존
    expect(lifted(out).plantStateByInterest?.recruiting?.stage).toBe(3);
    // insights 보존
    expect(lifted(out).insights).toEqual(v6User.insights);
  });

  it('v6 user → migrateUserToV4 통과 시 plantStateByInterest / streakFreeze / insights 보존 (early return)', () => {
    const out = migrateUserToV4(v6User);
    expect(out.schemaVersion).toBe(6);
    expect(lifted(out).plantStateByInterest?.recruiting?.stage).toBe(3);
    expect(lifted(out).streakFreeze).toEqual({ count: 2, lastEarnedAt: '2026-05-07' });
    expect(lifted(out).insights).toEqual(v6User.insights);
  });

  it('v6 user → migrateUserToV5 통과 시 streakFreeze / insights 보존 (early return)', () => {
    const out = migrateUserToV5(v6User);
    expect(out.schemaVersion).toBe(6);
    expect(lifted(out).streakFreeze).toEqual({ count: 2, lastEarnedAt: '2026-05-07' });
    expect(lifted(out).insights).toEqual(v6User.insights);
  });

  it('v6 user → migrateUserToV6 통과 시 idempotent (same reference)', () => {
    const out = migrateUserToV6(v6User);
    expect(out).toBe(v6User);
  });
});
