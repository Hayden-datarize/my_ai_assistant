import { describe, it, expect } from 'vitest';
import { migrateUserToV3 } from '../../../src/state/migration';

describe('migrateUserToV3 — mission instance numeric guard (v3.14.4 T2)', () => {
  const baseUser = {
    schemaVersion: 3 as const,
    name: 'tester',
    interests: ['ai_ml'] as readonly string[],
    onboardedAt: '2026-04-01',
    streak: 0,
    lastActiveDate: '',
    xp: 0,
    earnedBadges: {},
    gamificationMigrated: true,
  };

  it('windowStart NaN → 0으로 normalize, mission 보존', () => {
    const raw = {
      ...baseUser,
      missions: {
        active: [
          { defId: 'daily-answer-1', period: 'daily', windowStart: Number.NaN, progress: 0, completed: false },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.active[0]!.windowStart).toBe(0);
    expect(u.missions.active[0]!.defId).toBe('daily-answer-1');
  });

  it('progress Infinity → 0으로 normalize, completed flag 보존', () => {
    const raw = {
      ...baseUser,
      missions: {
        active: [
          { defId: 'daily-answer-2', period: 'daily', windowStart: 1700000000000, progress: Number.POSITIVE_INFINITY, completed: false },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.active[0]!.progress).toBe(0);
    expect(u.missions.active[0]!.completed).toBe(false);
  });

  it('정상 mission instance 보존 (round-trip)', () => {
    const raw = {
      ...baseUser,
      missions: {
        active: [
          { defId: 'weekly-scrap-3', period: 'weekly', windowStart: 1700000000000, progress: 2, completed: false },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.active[0]!.windowStart).toBe(1700000000000);
    expect(u.missions.active[0]!.progress).toBe(2);
  });

  it('progressDates 내부 null element → string filter', () => {
    const raw = {
      ...baseUser,
      missions: {
        active: [
          { defId: 'daily-answer-1', period: 'daily', windowStart: 1700000000000, progress: 1, completed: false, progressDates: ['2026-05-01', null, '2026-05-02'] },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.active[0]!.progressDates).toEqual(['2026-05-01', '2026-05-02']);
  });

  it('progressDates 내부 non-string element → filter', () => {
    const raw = {
      ...baseUser,
      missions: {
        active: [
          { defId: 'daily-answer-2', period: 'daily', windowStart: 1700000000000, progress: 1, completed: false, progressDates: ['2026-05-01', 42 as unknown as string, '2026-05-02'] },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.active[0]!.progressDates).toEqual(['2026-05-01', '2026-05-02']);
  });

  it('progressDates undefined → 보존 (optional 필드)', () => {
    const raw = {
      ...baseUser,
      missions: {
        active: [
          { defId: 'daily-answer-3', period: 'daily', windowStart: 1700000000000, progress: 1, completed: false },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.active[0]!.progressDates).toBeUndefined();
  });

  it('shape guard: missing defId → mission element 제거', () => {
    const raw = {
      ...baseUser,
      missions: {
        active: [
          { period: 'daily', windowStart: 1700000000000, progress: 0, completed: false } as unknown as object,
          { defId: 'daily-answer-4', period: 'daily', windowStart: 1700000000000, progress: 0, completed: false },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.active).toHaveLength(1);
    expect(u.missions.active[0]!.defId).toBe('daily-answer-4');
  });

  it('shape guard: defId non-string → element 제거', () => {
    const raw = {
      ...baseUser,
      missions: {
        active: [
          { defId: 42 as unknown as string, period: 'daily', windowStart: 1700000000000, progress: 0, completed: false },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    };
    const u = migrateUserToV3(raw);
    expect(u.missions.active).toHaveLength(0);
  });
});
