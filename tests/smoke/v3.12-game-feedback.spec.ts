import { test, expect } from '@playwright/test';

// v3.12 game-feedback + badges end-to-end smoke. Two paths the unit tests
// (jsdom) can't cover:
//  1. Answer submit → applyAnswerActivity → recordDailyAnswer triggers the
//     achievement sweep → dispatches dg:reward:xp-float + dg:reward:badge-unlock
//     → rewards.ts spawns .xp-float and .toast--badge in the real DOM.
//  2. Stats tab → hydrateBadges renders 5-category silhouette grid with
//     all 18 BADGE_CATALOG entries; locked badges show the 🔒 overlay.
//
// Storage shape uses v2 (earnedBadges/gamificationMigrated/schemaVersion) so
// the welcome-gamification modal does not pop up on home enter and intercept
// the submit flow.

test.describe('v3.12 Game Feedback + Badges', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(
        'user',
        JSON.stringify({
          name: 'Smoke',
          interests: ['ai_ml'],
          onboardedAt: new Date().toISOString(),
          streak: 0,
          lastActiveDate: '',
          xp: 0,
          earnedBadges: {},
          gamificationMigrated: true,
          schemaVersion: 2,
        }),
      );
      // Seed today's question so hydrateQuestion does not need an API key.
      localStorage.setItem(
        `dg.todayQuestion.${today}`,
        JSON.stringify({
          type: '분석',
          question: '오늘 가장 인상 깊었던 순간은?',
          hint: '구체적인 상황을 떠올려 보세요.',
        }),
      );
      // Suppress briefings auto-refresh so this spec doesn't hit live RSS.
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    });
    await page.goto('/');
  });

  test('답변 제출 → toast--badge (첫 답변) + xp-float visible', async ({ page }) => {
    const textarea = page.locator('#answerArea');
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    await textarea.fill('오늘은 TypeScript 타입 가드를 공부했고, 생각보다 유용했다.');

    // v3.14.1 T6: submit 버튼이 활성화될 때까지 명시 대기 (hydration race 제거)
    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // +XP floating animation (cold-start 마진 5000ms)
    await expect(page.locator('.xp-float')).toBeVisible({ timeout: 5000 });

    // answers-1 badge unlock toast (v3.13 미션 입문 뱃지와 공존 — 첫 답변 toast로 명시 필터)
    const toast = page.locator('.toast--badge').filter({ hasText: '첫 답변' });
    await expect(toast).toBeVisible({ timeout: 5000 });
    // v3.13 미션 입문 뱃지와 공존 가능 — badge name "첫 답변" 또는 일반 suffix "뱃지 획득" 둘 다 허용
    await expect(toast).toContainText(/첫 답변|뱃지 획득/);
  });

  test('stats 탭 → silhouette grid 6 카테고리 + locked 회색', async ({ page }) => {
    await page.locator('#bottomNav button[data-tab-id="stats"]').click();
    await expect(page.locator('#statsTab')).toBeVisible();

    // 6 카테고리 heading (streak / volume / tier / diversity / engagement / mission)
    await expect(page.locator('.badges-category h4')).toHaveCount(6);

    // 22 뱃지 모두 grid에 (v3.12 18 + v3.13 mission 4)
    await expect(page.locator('#badgesGrid .badge')).toHaveCount(22);

    // locked 22 (빈 user — earnedBadges = {}, v3.12 18 + v3.13 mission 4)
    await expect(page.locator('#badgesGrid .badge--locked')).toHaveCount(22);

    // 첫 locked 뱃지에 🔒 overlay
    await expect(page.locator('.badge--locked .badge-lock').first()).toContainText('🔒');
  });
});
