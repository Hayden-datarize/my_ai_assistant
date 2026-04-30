import { test, expect, type Page } from '@playwright/test';

// B4: verifies end-to-end that when user submits an answer without an API key,
// a chat bubble with "설정 열기" action is created, and that clicking it
// navigates to the settings tab with #apiKeyInput present. Also verifies the
// already-on-settings path (scroll, no re-render loop).
//
// Storage key conventions (confirmed against existing smokes + src):
//   - user   → plain 'user' key (see boot/heatmap/modal-overhaul specs)
//   - apiKey → 'dg_gemini_key' (see src/ui/onboarding.ts, src/ui/tabs/settings.ts)
//
// B5: `addBubble` now adds `.show` to `#chatContainer` on every append
// (src/ui/handlers/home.ts), so the bubble + action button are actually
// visible to the user. These smokes use `toBeVisible()` + `click()` as a
// real user would — no synthetic dispatch needed.

async function seedNoApiKey(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: '테스트',
        interests: ['tech'],
        onboardedAt: new Date().toISOString(),
        streak: 0,
        lastActiveDate: today,
        xp: 0,
        earnedBadges: {}, gamificationMigrated: true, schemaVersion: 2,
      }),
    );
    // Ensure no API key so submit triggers the bubble+action path.
    localStorage.removeItem('dg_gemini_key');
  });
}

test('no API key: answer submit creates "설정 열기" bubble action → navigates to settings', async ({ page }) => {
  await seedNoApiKey(page);
  await page.goto('/');

  // Home tab is default. Enter an answer (≥10 chars to pass the submit guard).
  const textarea = page.locator('#answerArea');
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill('오늘은 TypeScript 타입 가드를 공부했다. 생각보다 유용하다.');

  await page.locator('#submitBtn').click();

  // Action button is created inside an AI chat bubble. Label is "⚙ 설정 열기"
  // (hasText does substring match so "설정 열기" is enough).
  const action = page.locator('.chat-bubble-action', { hasText: '설정 열기' });
  await expect(action).toBeVisible({ timeout: 5_000 });
  await expect(action).toHaveText(/설정 열기/);

  // Real user gesture — `#chatContainer.show` is added by addBubble (B5 fix),
  // so the action button is actionable without synthetic dispatch.
  await action.click();

  // Settings tab becomes the active tab. Scope to #bottomNav because the
  // desktop sidebar drawer mirrors `.nav-item.active` state on a separate
  // element (both are present in the DOM).
  const activeTab = page.locator('#bottomNav .nav-item.active');
  await expect(activeTab).toHaveAttribute('data-tab-id', 'settings');

  // API key input is present and visible on the rendered settings tab.
  await expect(page.locator('#apiKeyInput')).toBeVisible();
});

test('no API key: manual nav to settings keeps #apiKeyInput visible (no re-render loop)', async ({ page }) => {
  await seedNoApiKey(page);
  await page.goto('/');

  // Produce a bubble action first (home tab, submit without key) — verifies
  // the submit path does not throw or leave home in a bad state before nav.
  const textarea = page.locator('#answerArea');
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill('오늘도 열심히 배웠다. TypeScript 타입 시스템이 점점 더 자연스러워진다.');
  await page.locator('#submitBtn').click();

  await expect(page.locator('.chat-bubble-action', { hasText: '설정 열기' })).toBeVisible();

  // Manually switch to settings. Home DOM is replaced; verify settings renders
  // the API key input cleanly (no infinite re-render / no stray bubble leftover).
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();

  // Scope to #bottomNav (sidebar drawer also mirrors .active on ≥768px).
  const activeTab = page.locator('#bottomNav .nav-item.active');
  await expect(activeTab).toHaveAttribute('data-tab-id', 'settings');
  await expect(page.locator('#apiKeyInput')).toBeVisible();
});
