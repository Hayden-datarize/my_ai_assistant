import type { User } from '../../../src/state/user';

/**
 * v3.13 T1: unit test용 User v3 픽스처 헬퍼.
 * v3.15 T1: schemaVersion: 4 + plantStateByInterest/gardenIntroduced/gardenBackfilled 기본값 추가.
 * v3.21 T1: schemaVersion: 5 + streakFreeze 기본값 (count: 2, lastEarnedAt: '2026-05-07').
 * v3.23 T1: schemaVersion: 6 + insights 기본값 ([]).
 * v3.25 T2: schemaVersion: 7 (Insight.interestId 필드 추가, 기본 insights []이라 fixture 영향 없음).
 * v3.27 T1: schemaVersion: 8 + xpHistory 기본값 ([]) 추가. Insight.pinned는 optional이라 fixture 영향 없음.
 * v3.39 T1: schemaVersion: 9 (User-level field 신규 0 — Answer/Briefing storage 측에서 interestId 정규화, fixture 영향 없음).
 * 각 테스트에서 필요한 필드만 override.
 */
export const DEFAULT_MISSIONS: User['missions'] = {
  active: [],
  cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
  lastDailySeed: '',
  currentWeekIso: '',
  currentMonthIso: '',
};

export function mkUser(over: Partial<Omit<User, 'schemaVersion' | 'missions'>> & { missions?: Partial<User['missions']> } = {}): User {
  const { missions: mOver, ...rest } = over;
  return {
    name: 'x',
    interests: [],
    onboardedAt: '',
    streak: 0,
    lastActiveDate: '',
    xp: 0,
    earnedBadges: {},
    gamificationMigrated: false,
    schemaVersion: 10,
    missions: { ...DEFAULT_MISSIONS, ...mOver },
    plantStateByInterest: {},
    gardenIntroduced: false,
    gardenBackfilled: false,
    streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
    insights: [],
    xpHistory: [],
    freezeHistory: [],
    ...rest,
  };
}
