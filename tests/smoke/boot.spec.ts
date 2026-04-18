import { test, expect } from '@playwright/test';

test('app boots and shows home tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();
});

test('archive tab switch works', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('#archiveTab')).toBeVisible();
});

test('settings tab opens api key status', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await expect(page.locator('#apiKeyInput')).toBeVisible();
});
