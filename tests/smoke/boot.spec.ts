import { test, expect } from '@playwright/test';

// Seed localStorage before the page loads so the onboarding overlay is skipped
// and the main app (#homeTab, bottom-nav) is rendered on boot.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg_onboarded', '"true"');
    localStorage.setItem(
      'dg_user',
      JSON.stringify({
        name: 'SmokeTester',
        interests: ['culture', 'productivity'],
        createdAt: new Date().toISOString(),
        streak: 0,
        totalXp: 0,
        totalAnswers: 0,
        deepChats: 0,
        scrappedCount: 0,
        lastActiveDate: null,
      }),
    );
  });
});

test('legacy daily-growth.html boots and shows home tab', async ({ page }) => {
  await page.goto('/daily-growth.html');
  // Home tab visible by default
  await expect(page.locator('#homeTab')).toBeVisible();
  await expect(page.locator('#questionContent')).toBeVisible();
});

test('archive tab switch works', async ({ page }) => {
  await page.goto('/daily-growth.html');
  await page.locator('.bottom-nav button').nth(1).click();
  await expect(page.locator('#archiveList')).toBeVisible();
});

test('settings tab opens api key status', async ({ page }) => {
  await page.goto('/daily-growth.html');
  await page.locator('.bottom-nav button').last().click();
  // Legacy settings tab exposes the current API key status via #settingsApiKey.
  // The original spec referenced #apiKeyStatus, but that element lives inside
  // the (hidden) onboarding step 3 — not the settings tab. See task report.
  await expect(page.locator('#settingsApiKey')).toBeVisible();
});
