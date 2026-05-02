import { describe, it, expect } from 'vitest';
import { migrateUserToV3 } from '../../../src/state/migration';

describe('migrateUserToV3 — numeric guards Number.isFinite (v3.13.2 P2-2)', () => {
  it('rejects NaN cumulative.dailyCount → 0 default', () => {
    const raw = {
      name: 'T', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '',
      xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 3,
      missions: {
        active: [],
        cumulative: { dailyCount: NaN, weeklyCount: 5, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.cumulative.dailyCount).toBe(0); // NaN rejected
    expect(u.missions.cumulative.weeklyCount).toBe(5); // valid 유지
  });

  it('rejects Infinity cumulative.weeklyCount → 0 default', () => {
    const raw = {
      missions: {
        active: [],
        cumulative: { dailyCount: 1, weeklyCount: Infinity, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
      schemaVersion: 3, name: 'T', interests: [], onboardedAt: '', streak: 0,
      lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: true,
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.cumulative.weeklyCount).toBe(0);
  });

  it('preserves valid finite numbers', () => {
    const raw = {
      missions: {
        active: [],
        cumulative: { dailyCount: 3, weeklyCount: 2, monthlyCount: 1 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
      schemaVersion: 3, name: 'T', interests: [], onboardedAt: '', streak: 0,
      lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: true,
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.cumulative).toEqual({ dailyCount: 3, weeklyCount: 2, monthlyCount: 1 });
  });
});
