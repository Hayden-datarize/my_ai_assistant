import { test, expect } from '@playwright/test';

test('settings 전체 답변 초기화 + undo 복원', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  // Seed answers + onboarded user before first page load to bypass onboarding modal.
  await page.addInitScript(() => {
    localStorage.setItem(
      'dg.answers',
      JSON.stringify([
        { id: 's1', text: 'one', date: '2026-04-27' },
        { id: 's2', text: 'two', date: '2026-04-27' },
      ])
    );
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'TestUser',
        interests: ['ai_ml'],
        onboardedAt: '2026-04-01',
        streak: 0,
        lastActiveDate: '',
        xp: 0,
        level: 1,
      })
    );
    // Suppress briefings auto-refresh (no fixture seeded).
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await expect(page.locator('#deleteAllAnswersBtn')).toBeEnabled();
  // The button sits near the bottom of the settings tab and may be obscured by the
  // fixed bottom nav at mobile viewport (375px). Scroll it into view then use
  // JavaScript click to bypass pointer-interception by the nav overlay.
  await page.locator('#deleteAllAnswersBtn').scrollIntoViewIfNeeded();
  await page.locator('#deleteAllAnswersBtn').evaluate((el: HTMLButtonElement) => el.click());
  await expect(page.locator('.dg-toast--undo')).toBeVisible();
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(0);
  await page.click('.dg-toast--undo button');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(2);
});
