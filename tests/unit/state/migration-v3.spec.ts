import { describe, it, expect } from 'vitest';
import { migrateUserToV3 } from '../../../src/state/migration';

describe('migrateUserToV3', () => {
  const v2 = {
    name: 'Hayden', interests: ['tech'], onboardedAt: 1, streak: 0,
    lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: false,
    schemaVersion: 2 as const,
  };

  it('v2 → v3: missions 필드 추가, schemaVersion 3', () => {
    const v3 = migrateUserToV3(v2);
    expect(v3.schemaVersion).toBe(3);
    expect(v3.missions.active).toEqual([]);
    expect(v3.missions.cumulative).toEqual({ dailyCount: 0, weeklyCount: 0, monthlyCount: 0 });
    expect(v3.missions.lastDailySeed).toBe('');
    expect(v3.missions.currentWeekIso).toBe('');
    expect(v3.missions.currentMonthIso).toBe('');
  });

  it('idempotent: 이미 v3면 그대로 반환', () => {
    const v3 = migrateUserToV3(v2);
    const v3again = migrateUserToV3(v3);
    expect(v3again).toEqual(v3);
  });

  it('shape guard: missions.active가 배열 아니면 [] 보강', () => {
    const broken = { ...migrateUserToV3(v2), missions: { ...migrateUserToV3(v2).missions, active: 'oops' as unknown } };
    const fixed = migrateUserToV3(broken as never);
    expect(Array.isArray(fixed.missions.active)).toBe(true);
  });
});
