import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedUser } from '../../src/state/user';

// isValidUserShape는 비-export — getCachedUser(localStorage)로 간접 검증 (corrupt → null).
function seed(u: unknown) { localStorage.setItem('user', JSON.stringify(u)); }

const baseV10 = {
  schemaVersion: 10,
  name: 'T', interests: ['leadership'], streak: 1, lastActiveDate: '2026-05-20',
  xp: 0, earnedBadges: {}, gamificationMigrated: true, xpHistory: [],
  plantStateByInterest: {}, streakFreeze: { count: 2, lastEarnedAt: '2026-05-20' },
  insights: [], answers: [], gardenBackfilled: true,
  missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 }, lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
  freezeHistory: [],
};

describe('v10 freezeHistory validation (v3.48)', () => {
  beforeEach(() => localStorage.clear());

  it('valid v10 freezeHistory entry → user 반환', () => {
    seed({ ...baseV10, freezeHistory: [{ date: '2026-05-20', kind: 'earned', amount: 1 }] });
    expect(getCachedUser()).not.toBeNull();
  });

  it('amount NaN → corrupt(null)', () => {
    seed({ ...baseV10, freezeHistory: [{ date: '2026-05-20', kind: 'earned', amount: NaN }] });
    expect(getCachedUser()).toBeNull();
  });

  it('amount 분수 → corrupt(null)', () => {
    seed({ ...baseV10, freezeHistory: [{ date: '2026-05-20', kind: 'earned', amount: 1.5 }] });
    expect(getCachedUser()).toBeNull();
  });

  it('kind 오타 → corrupt(null)', () => {
    seed({ ...baseV10, freezeHistory: [{ date: '2026-05-20', kind: 'bogus', amount: 1 }] });
    expect(getCachedUser()).toBeNull();
  });

  it('amount<=0 → corrupt(null)', () => {
    seed({ ...baseV10, freezeHistory: [{ date: '2026-05-20', kind: 'consumed', amount: 0 }] });
    expect(getCachedUser()).toBeNull();
  });

  it('freezeHistory non-array → corrupt(null)', () => {
    seed({ ...baseV10, freezeHistory: 'x' });
    expect(getCachedUser()).toBeNull();
  });

  // 최종 review P1: 분수 streakFreeze.count → corrupt (self-corruption 체인 차단)
  it('streakFreeze.count 분수 → corrupt(null)', () => {
    seed({ ...baseV10, streakFreeze: { count: 1.5, lastEarnedAt: '2026-05-20' } });
    expect(getCachedUser()).toBeNull();
  });
});
