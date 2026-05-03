import type { User } from '../../../src/state/user';

/**
 * v3.13 T1: unit test용 User v3 픽스처 헬퍼.
 * v3.15 T1: schemaVersion: 4 + plantStateByInterest/gardenIntroduced/gardenBackfilled 기본값 추가.
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
    schemaVersion: 4,
    missions: { ...DEFAULT_MISSIONS, ...mOver },
    plantStateByInterest: {},
    gardenIntroduced: false,
    gardenBackfilled: false,
    ...rest,
  };
}
