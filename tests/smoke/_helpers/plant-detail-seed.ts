/**
 * v3.40 T9 (C8): plant-detail / archive 영역 smoke spec 공통 seed boilerplate.
 *
 * 4 smoke spec 공유 v9 schema 필수 필드 + briefings auto-refresh 억제:
 *  - archive-insight-detail-nav.spec.ts
 *  - archive-plant-detail-nav.spec.ts
 *  - plant-detail-modal.spec.ts
 *  - archive-interest-filter.spec.ts
 *
 * Spec별 차이 (insights / dg.answers / plantStateByInterest)는 spec에서 별도 setup —
 * 본 helper는 공통 boilerplate (10줄 → 1줄)만 추출.
 *
 * @internal — tests/smoke/ 영역 전용.
 */
import type { Page } from '@playwright/test';

export interface SeedV9DefaultsOpts {
  schemaVersion?: number; // default: 9
  blockBriefingsRefresh?: boolean; // default: true (RSS 호출 차단)
}

/**
 * v9 schema 필수 필드 + 표준 default 값 read-merge.
 *
 * primeOnboardedUser 호출 직후 page.addInitScript로 user를 read-merge하는 패턴.
 * production migration이 v8→v9로 lazy 올릴 때 missing 필드 default를 동기 보장.
 */
export async function seedV9UserDefaults(
  page: Page,
  opts: SeedV9DefaultsOpts = {},
): Promise<void> {
  const { schemaVersion = 9, blockBriefingsRefresh = true } = opts;
  await page.addInitScript(({ schemaVersion, blockBriefingsRefresh }) => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    user.schemaVersion = schemaVersion;
    user.missions = user.missions ?? {
      active: [],
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: today,
      currentWeekIso: '',
      currentMonthIso: '',
    };
    user.plantStateByInterest = user.plantStateByInterest ?? {};
    user.gardenIntroduced = true;
    user.gardenBackfilled = true;
    user.streakFreeze = user.streakFreeze ?? { count: 0, lastEarnedAt: today };
    user.xpHistory = user.xpHistory ?? [];
    localStorage.setItem('user', JSON.stringify(user));

    if (blockBriefingsRefresh) {
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    }
  }, { schemaVersion, blockBriefingsRefresh });
}
