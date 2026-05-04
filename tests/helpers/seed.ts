import type { Page } from '@playwright/test';

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
