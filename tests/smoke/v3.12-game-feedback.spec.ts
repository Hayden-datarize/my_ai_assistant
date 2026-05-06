import { test, expect } from '@playwright/test';
import { getDateStr } from '../../src/utils/dates';

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
//
// v3.14.3 T5 (P1-3): cold-start margin 정책 — rewards.ts mount이 가장 느린 cold path라
// 본 spec만 timeout 10_000ms 사용. 다른 smoke spec(`tier-downgrade`, `desktop-layout` 등)은
// 5000ms 유지. 다른 spec에서 cold-start flake 발생 시 동일 패턴(per-spec opt-in 10s)
// 또는 centralize(`tests/smoke/_helpers.ts`)로 graduate 검토.

test.describe('v3.12 Game Feedback + Badges', () => {
  test.beforeEach(async ({ page }) => {
    const today = getDateStr();
    await page.addInitScript((args: { today: string }) => {
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
          gardenIntroduced: true,
          schemaVersion: 2,
        }),
      );
      // Seed today's question so hydrateQuestion does not need an API key.
      localStorage.setItem(
        `dg.todayQuestion.${args.today}`,
        JSON.stringify({
          type: '분석',
          question: '오늘 가장 인상 깊었던 순간은?',
          hint: '구체적인 상황을 떠올려 보세요.',
        }),
      );
      // Suppress briefings auto-refresh so this spec doesn't hit live RSS.
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    }, { today });
    await page.goto('/');
  });

  test('답변 제출 → toast--badge (첫 답변) + xp-float visible', async ({ page }) => {
    const textarea = page.locator('#answerArea');
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    await textarea.fill('오늘은 TypeScript 타입 가드를 공부했고, 생각보다 유용했다.');

    // v3.14.3 T5 (P1-3): rewards.ts mount 완료 신호 = #submitBtn enabled (DOM hydrate 후 활성).
    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // +XP floating animation (cold-start 마진 10000ms로 확장).
    await expect(page.locator('.xp-float')).toBeVisible({ timeout: 10_000 });

    // answers-1 badge unlock toast (v3.13 미션 입문 뱃지와 공존 — 첫 답변 toast로 명시 필터).
    const toast = page.locator('.toast--badge').filter({ hasText: '첫 답변' });
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toContainText(/첫 답변|뱃지 획득/);
  });

  test('stats 탭 → silhouette grid 6 카테고리 + locked 회색', async ({ page }) => {
    // v3.14.3 T5 (C1 fix): mountNav children populate 신호 = stats button visible.
    // (#bottomNav 자체는 index.html에 static이라 first paint부터 visible — readiness 신호 부적합)
    await expect(page.locator('#bottomNav button[data-tab-id="stats"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('#bottomNav button[data-tab-id="stats"]').click();
    await expect(page.locator('#statsTab')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('.badges-category h4')).toHaveCount(6, { timeout: 10_000 });
    await expect(page.locator('#badgesGrid .badge')).toHaveCount(22, { timeout: 10_000 });
    await expect(page.locator('#badgesGrid .badge--locked')).toHaveCount(22, { timeout: 10_000 });
    await expect(page.locator('.badge--locked .badge-lock').first()).toContainText('🔒', { timeout: 10_000 });
  });
});
