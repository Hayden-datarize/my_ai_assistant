import type { Page } from '@playwright/test';

/**
 * v3.19 T10: onboarded user localStorage seed (gardenIntroduced 기본 true).
 *
 * v3.18.1 lessons #1 graduation. inline seed (25 spec) → helper 통일을 위한 단일 source of truth.
 *
 * production read key: src/state/user.ts:36 `const KEY = 'user'`. 일부 spec의 `'dg_user'` set은
 * 사실상 dead seed였음 (production은 `'user'` 키만 read).
 *
 * 다양한 spec의 inline seed 형태 호환:
 * - 최소: `{ interests, gamificationMigrated, gardenIntroduced }` (archive-* 계열)
 * - 표준: `{ ...최소, onboardedAt, streak, lastActiveDate, xp, earnedBadges, schemaVersion }` (heatmap 등)
 * - +name/level (slack/card-translation 계열)
 */
export interface PrimeUserOpts {
  gardenIntroduced?: boolean;
  schemaVersion?: 2 | 3 | 4;
  interests?: string[];
  streak?: number;
  xp?: number;
  level?: number;
  name?: string;
}

// T10 review P1 fix: production isValidUserShape (src/state/user.ts:97)는 name: string 필수.
// helper default에 name: 'tester' 포함 → getCachedUser corruption toast 발화 차단.
// 25 spec 마이그레이션(T11) 후 home/stats/missions 의존 spec 모두 통과.
const PRIME_USER_DEFAULTS = {
  gardenIntroduced: true,
  schemaVersion: 2 as const,
  interests: ['tech'],
  streak: 0,
  xp: 0,
  name: 'tester',
};

export async function primeOnboardedUser(page: Page, opts: PrimeUserOpts = {}): Promise<void> {
  const flags = { ...PRIME_USER_DEFAULTS, ...opts };
  await page.addInitScript((f) => {
    const user: Record<string, unknown> = {
      onboardedAt: '2026-04-01',
      interests: f.interests,
      streak: f.streak,
      lastActiveDate: '',
      xp: f.xp,
      earnedBadges: {},
      gamificationMigrated: true,
      gardenIntroduced: f.gardenIntroduced,
      schemaVersion: f.schemaVersion,
    };
    if (f.name !== undefined) user.name = f.name;
    if (f.level !== undefined) user.level = f.level;
    // production read key (src/state/user.ts:36 `const KEY = 'user'`)
    localStorage.setItem('user', JSON.stringify(user));
  }, flags);
}

/**
 * v3.15 정원(garden) localStorage seed.
 * plantStateByInterest 포함 schemaVersion=4 사용자를 주입한다.
 *
 * TZ 주의:
 * - lastActiveDate: Intl.DateTimeFormat KST 기준 오늘 날짜 (browser context 내에서 계산).
 *   → ISO UTC를 쓰면 KST 새벽에 stale 판정되어 refreshBriefings 자동 트리거 발생.
 * - lastEngagedAt: ISO(UTC) OK — wilting 판단은 ms diff 기준.
 */
export async function primeUserWithGarden(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // KST 오늘 날짜 (v3.14.4 T3 패턴: Intl.DateTimeFormat 사용)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

    localStorage.setItem('user', JSON.stringify({
      name: '하야든',
      interests: ['recruiting', 'ai_ml'],
      onboardedAt: '2026-04-01',
      streak: 5,
      lastActiveDate: today,
      xp: 100,
      earnedBadges: {},
      gamificationMigrated: true,
      schemaVersion: 4,
      missions: {
        active: [],
        cumulative: { dailyCount: 5, weeklyCount: 1, monthlyCount: 0 },
        lastDailySeed: today,
        currentWeekIso: '',
        currentMonthIso: '',
      },
      plantStateByInterest: {
        recruiting: {
          stage: 3,
          cumulativeActivity: 30,
          lastEngagedAt: new Date().toISOString(),
        },
        ai_ml: {
          stage: 2,
          cumulativeActivity: 12,
          lastEngagedAt: new Date().toISOString(),
        },
      },
      gardenIntroduced: true,   // 환영 모달 억제 (smoke flow 단순화)
      gardenBackfilled: true,
    }));

    // briefings auto-refresh 억제 (RSS 실제 호출 방지)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });
}
