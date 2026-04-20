import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function seedUser(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'TestUser',
        interests: ['recruiting', 'ai_ml'],
        onboardedAt: '2026-04-01',
        streak: 0, lastActiveDate: '', xp: 0, level: 1,
      }),
    );
    localStorage.removeItem('dg.briefings');
  });
}

test('desktop (1280x800) shows sidebar nav on the left', async ({ page }) => {
  await seedUser(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();

  const nav = page.locator('#bottomNav');
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(4);
  expect(box!.y).toBeLessThanOrEqual(4);
  expect(box!.width).toBeGreaterThan(200);
  expect(box!.height).toBeGreaterThan(400);
});

test('mobile (375x667) keeps bottom nav + submit is not covered', async ({ page }) => {
  await seedUser(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();

  const nav = page.locator('#bottomNav');
  const navBox = await nav.boundingBox();
  expect(navBox).not.toBeNull();
  expect(navBox!.y + navBox!.height).toBeGreaterThan(600);

  const submit = page.locator('#submitBtn');
  await submit.scrollIntoViewIfNeeded();
  const submitBox = await submit.boundingBox();
  expect(submitBox).not.toBeNull();
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navBox!.y);
});
