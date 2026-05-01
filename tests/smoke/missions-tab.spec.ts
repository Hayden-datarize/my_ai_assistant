import { test, expect } from '@playwright/test';

// v3.14 T9: 미션 탭 smoke
//  m1: 6탭 nav 가시 (mobile 375×667) — 신규 '미션' 탭 라벨 확인
//  m2: 미션 탭 클릭 → #missionsSection 가시 + daily 그룹 1개 + '답변 1개' 텍스트
//
// Fixture 주의:
//  - localStorage KEY는 'user' (NOT 'dg.user') — src/state/user.ts:31
//  - missions schema 필드는 `currentWeekIso` (NOT `lastWeeklyIso`) — src/state/missionTypes.ts
//  - lastDailySeed = today (KST) → daily regen 차단, seeded daily-answer-1 mission 유지
//  - v3.13-missions.spec.ts 와 동일한 fixture 패턴

test.describe('v3.14 Missions Tab', () => {
  test('m1: bottom-nav shows 6 items including 미션 (mobile 375×667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => {
      const user = {
        name: 'T',
        interests: ['ai_ml'],
        onboardedAt: 1,
        streak: 0,
        lastActiveDate: '',
        xp: 0,
        earnedBadges: {},
        gamificationMigrated: true,
        schemaVersion: 3,
      };
      localStorage.setItem('user', JSON.stringify(user));
    });
    await page.goto('/');
    await expect(page.locator('.bottom-nav .nav-item')).toHaveCount(6);
    const missionNav = page.locator('.bottom-nav .nav-item', { hasText: '미션' });
    await expect(missionNav).toBeVisible();
  });

  test('m2: switching to missions tab renders #missionsSection with daily group', async ({ page }) => {
    await page.addInitScript(() => {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
      const today = fmt.format(new Date());          // 'YYYY-MM-DD' (KST)
      const thisMonth = today.slice(0, 7);           // 'YYYY-MM'

      // KST 기준 ISO 8601 주차 ('YYYY-Www') 계산 — missionEngine.getKSTWeekIso 동일 로직.
      // 비워두면 weekly mission이 regen돼 group이 추가 렌더되므로, 현재 주를 정확히 주입해야
      // .mission-group toHaveCount(1) 가 성립한다.
      const y = Number(today.slice(0, 4));
      const mo = Number(today.slice(5, 7));
      const d = Number(today.slice(8, 10));
      const utc = new Date(Date.UTC(y, mo - 1, d));
      const day = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      const thisWeek = `${utc.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      const user = {
        name: 'T',
        interests: ['ai_ml'],
        onboardedAt: 1,
        streak: 0,
        lastActiveDate: '',
        xp: 0,
        earnedBadges: {},
        gamificationMigrated: true,
        schemaVersion: 3,
        missions: {
          // daily-answer-1만 active 주입 → daily 그룹 1개만 렌더 (weekly/monthly empty → skip)
          active: [
            { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
          ],
          cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
          lastDailySeed: today,
          currentWeekIso: thisWeek,
          currentMonthIso: thisMonth,
        },
      };
      localStorage.setItem('user', JSON.stringify(user));
    });
    await page.goto('/');
    await page.locator('.bottom-nav .nav-item', { hasText: '미션' }).click();
    await expect(page.locator('#missionsSection')).toBeVisible();
    await expect(page.locator('.mission-group')).toHaveCount(1); // daily만 fixture에 active
    await expect(page.locator('.mission-card')).toContainText('답변 1개');
  });
});
