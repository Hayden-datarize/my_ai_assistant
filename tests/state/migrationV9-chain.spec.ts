import { describe, it, expect } from 'vitest';
import {
  migrateUserToV2,
  migrateUserToV3,
  migrateUserToV4,
  migrateUserToV5,
  migrateUserToV6,
  migrateUserToV7,
  migrateUserToV8,
  migrateUserToV9,
} from '../../src/state/migration';

const v9User = {
  name: 'test',
  interests: ['ai_ml'],
  onboardedAt: '2026-05-19',
  streak: 0,
  lastActiveDate: '2026-05-19',
  xp: 0,
  earnedBadges: {},
  gamificationMigrated: false,
  schemaVersion: 9,
  xpHistory: [],
  missions: {
    active: [],
    cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
    lastDailySeed: '',
    currentWeekIso: '',
    currentMonthIso: '',
  },
  plantStateByInterest: {},
  gardenIntroduced: false,
  gardenBackfilled: false,
  streakFreeze: { count: 0, lastEarnedAt: '2026-05-19' },
  insights: [],
};

describe('v9 chain superset — V2~V8 모두 v9 user에 same-reference pass-through', () => {
  it('V2 → v9 user → same reference', () => {
    expect(migrateUserToV2(v9User)).toBe(v9User);
  });
  it('V3 → v9 user → same reference', () => {
    expect(migrateUserToV3(v9User)).toBe(v9User);
  });
  it('V4 → v9 user → same reference', () => {
    expect(migrateUserToV4(v9User)).toBe(v9User);
  });
  it('V5 → v9 user → same reference', () => {
    expect(migrateUserToV5(v9User)).toBe(v9User);
  });
  it('V6 → v9 user → same reference', () => {
    expect(migrateUserToV6(v9User)).toBe(v9User);
  });
  it('V7 → v9 user → same reference', () => {
    expect(migrateUserToV7(v9User)).toBe(v9User);
  });
  it('V8 → v9 user → same reference (downgrade 차단)', () => {
    expect(migrateUserToV8(v9User)).toBe(v9User);
  });
  it('V9 idempotent', () => {
    expect(migrateUserToV9(v9User)).toBe(v9User);
  });
});
