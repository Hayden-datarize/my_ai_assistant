import { describe, it, expect, beforeEach } from 'vitest';
import { migrateUserToV3, migrateUserToV4 } from '../../../src/state/migration';

describe('migrateUserToV4', () => {
  it('v3 user를 v4로 변환 — 빈 정원 + flag 0', () => {
    const v3 = {
      name: 'Hayden', interests: ['recruiting'], onboardedAt: '2026-04-30', streak: 5,
      lastActiveDate: '2026-05-01', xp: 100, earnedBadges: {},
      gamificationMigrated: true, schemaVersion: 3,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 }, lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    };
    const v4 = migrateUserToV4(v3);
    expect(v4.schemaVersion).toBe(4);
    expect(v4.plantStateByInterest).toEqual({});
    expect(v4.gardenIntroduced).toBe(false);
    expect(v4.gardenBackfilled).toBe(false);
    expect(v4.streak).toBe(5);  // 기존 필드 보존
  });

  it('v4 user는 그대로 통과 (idempotent)', () => {
    const v4 = {
      schemaVersion: 4,
      plantStateByInterest: { ai_ml: { stage: 3, cumulativeActivity: 30 } },
      gardenIntroduced: true, gardenBackfilled: true,
    };
    const out = migrateUserToV4(v4);
    expect(out).toBe(v4);  // 같은 reference
  });

  it('손상 plantStateByInterest는 빈 객체로 fallback', () => {
    const broken = { schemaVersion: 3, plantStateByInterest: 'NOT_OBJECT' };
    const out = migrateUserToV4(broken);
    expect(out.plantStateByInterest).toEqual({});
  });
});

describe('migrateUserToV3 v4 early return (Codex S5 / P0-1 fix)', () => {
  it('v4 user → migrateUserToV3 통과 시 missions / plant 보존 (이전엔 reset 됐음)', () => {
    const v4 = {
      name: 'h', interests: ['recruiting'], onboardedAt: '', streak: 5,
      lastActiveDate: '', xp: 100, earnedBadges: {}, gamificationMigrated: true,
      schemaVersion: 4,
      missions: { active: [{ defId: 'daily-1', period: 'daily' }], cumulative: { dailyCount: 7, weeklyCount: 2, monthlyCount: 1 }, lastDailySeed: '2026-05-03', currentWeekIso: '2026-W18', currentMonthIso: '2026-05' },
      plantStateByInterest: { recruiting: { stage: 3, cumulativeActivity: 25 } },
      gardenIntroduced: true, gardenBackfilled: true,
    };
    const out = migrateUserToV3(v4);
    expect(out.schemaVersion).toBe(4);
    expect(out.missions.cumulative.dailyCount).toBe(7);  // reset 안 됨
    expect((out as any).plantStateByInterest.recruiting.stage).toBe(3);
  });

  it('v3 user는 기존 logic대로 처리 (regression 방지)', () => {
    const v3 = {
      name: 'h', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '',
      xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 3,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 }, lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    };
    const out = migrateUserToV3(v3);
    expect(out.schemaVersion).toBe(3);
  });

  // v3.15 T16.1 P0-1 fix: v4 early return도 mission normalization 적용 검증
  it('v4 user with malformed missions.active (non-string defId) → active 항목 차단', () => {
    const v4 = {
      name: 'h', interests: ['recruiting'], onboardedAt: '', streak: 0,
      lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: true,
      schemaVersion: 4,
      missions: {
        active: [
          { defId: 'daily-1', period: 'daily', windowStart: 0, progress: 0, progressDates: [] },
          { defId: 123, period: 'daily' },           // non-string defId — invalid
          { period: 'weekly' },                       // missing defId — invalid
        ],
        cumulative: { dailyCount: 3, weeklyCount: 1, monthlyCount: 0 },
        lastDailySeed: '2026-05-04', currentWeekIso: '2026-W18', currentMonthIso: '2026-05',
      },
      plantStateByInterest: { recruiting: { stage: 2, cumulativeActivity: 10 } },
      gardenIntroduced: true, gardenBackfilled: true,
    };
    const out = migrateUserToV3(v4);
    // valid defId를 가진 항목만 통과
    expect(out.missions.active).toHaveLength(1);
    expect(out.missions.active[0]?.defId).toBe('daily-1');
    // plant 필드는 보존
    expect((out as any).plantStateByInterest.recruiting.stage).toBe(2);
  });

  it('v4 user with non-finite cumulative.dailyCount → 0 fallback', () => {
    const v4 = {
      name: 'h', interests: [], onboardedAt: '', streak: 0,
      lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: true,
      schemaVersion: 4,
      missions: {
        active: [],
        cumulative: { dailyCount: NaN, weeklyCount: Infinity, monthlyCount: -Infinity },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
      plantStateByInterest: {},
      gardenIntroduced: false, gardenBackfilled: false,
    };
    const out = migrateUserToV3(v4);
    expect(out.missions.cumulative.dailyCount).toBe(0);
    expect(out.missions.cumulative.weeklyCount).toBe(0);
    expect(out.missions.cumulative.monthlyCount).toBe(0);
  });
});

describe('isValidUserShape v4 nested guard (Codex S8 / P1-2 fix)', () => {
  // isValidUserShape는 user.ts 내부 함수 — 직접 export X.
  // getCachedUser path를 통해 invalidation 검증 (notifyCorruption + null 반환)

  beforeEach(() => { localStorage.clear(); });

  it('plantStateByInterest 손상 (non-object) → corruption + null', async () => {
    const { getCachedUser } = await import('../../../src/state/user');
    localStorage.setItem('user', JSON.stringify({
      name: 'h', interests: [], streak: 0, lastActiveDate: '', xp: 0, schemaVersion: 4,
      plantStateByInterest: 'BROKEN',
      gardenIntroduced: false, gardenBackfilled: false,
    }));
    const u = getCachedUser();
    expect(u).toBeNull();
  });

  it('plant entry stage NaN → corruption + null', async () => {
    const { getCachedUser } = await import('../../../src/state/user');
    localStorage.setItem('user', JSON.stringify({
      name: 'h', interests: [], streak: 0, lastActiveDate: '', xp: 0, schemaVersion: 4,
      plantStateByInterest: { recruiting: { stage: null, cumulativeActivity: 10 } },
      gardenIntroduced: false, gardenBackfilled: false,
    }));
    const u = getCachedUser();
    expect(u).toBeNull();
  });

  it('plant entry stage out-of-range (6) → corruption + null', async () => {
    const { getCachedUser } = await import('../../../src/state/user');
    localStorage.setItem('user', JSON.stringify({
      name: 'h', interests: [], streak: 0, lastActiveDate: '', xp: 0, schemaVersion: 4,
      plantStateByInterest: { recruiting: { stage: 6, cumulativeActivity: 10 } },
      gardenIntroduced: false, gardenBackfilled: false,
    }));
    expect(getCachedUser()).toBeNull();
  });

  it('정상 v4 user → 통과', async () => {
    const { getCachedUser } = await import('../../../src/state/user');
    localStorage.setItem('user', JSON.stringify({
      name: 'h', interests: ['recruiting'], onboardedAt: '', streak: 0,
      lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: true,
      schemaVersion: 4,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 }, lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
      plantStateByInterest: { recruiting: { stage: 3, cumulativeActivity: 30 } },
      gardenIntroduced: true, gardenBackfilled: true,
    }));
    expect(getCachedUser()?.plantStateByInterest['recruiting']?.stage).toBe(3);
  });
});
