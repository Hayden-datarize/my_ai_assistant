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
        streak: 0, lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 2,
      }),
    );
    localStorage.removeItem('dg.briefings');
    localStorage.removeItem('dg-sidebar-last-state');
  });
}

// v3.5: explicit reset to defeat suite-flake — earlier specs may leak
// viewport size or localStorage/sessionStorage across pages within the same context.
test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 375, height: 667 }); // mobile default; each test overrides as needed
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('desktop (1280x800) hides bottom-nav and shows sidebar drawer (closed default)', async ({ page }) => {
  await seedUser(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();

  // v3.3.1: bottom-nav hidden on desktop (Task 3); drawer replaces it (Task 6).
  await expect(page.locator('#bottomNav')).toBeHidden();

  // drawer is present but closed by default (off-screen via translateX(-100%))
  const drawer = page.locator('#sidebarDrawer');
  await expect(drawer).toHaveAttribute('data-open', 'false');

  // hamburger toggle is visible on desktop
  await expect(page.locator('#sidebarToggle')).toBeVisible();
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
