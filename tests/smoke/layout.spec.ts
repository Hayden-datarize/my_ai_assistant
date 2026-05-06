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

// v3.17 T8: graduate v3.16 T6 일회성 N=10 검증 → 영구 N=3 regression guard.
// 핵심 mobile submit 영역만 N=3 loop 적용 (desktop layout은 N=1 유지).
for (let n = 1; n <= 3; n++) {
  test(`mobile (375x667) keeps bottom nav + submit is not covered (N=${n})`, async ({ page }) => {
    await seedUser(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('#homeTab')).toBeVisible();

    // v3.18 T7 G4-1: cold-fork hydration guard — submitBtn must be attached + laid out
    // before geometric assertions. v3.14.3 lesson #2 (cold-start vs warm) — explicit
    // hydration wait is the root-cause fix; timeout lift below is defense-in-depth.
    await expect(page.locator('#submitBtn')).toBeAttached();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#submitBtn') as HTMLElement | null;
        return !!el && el.offsetHeight > 0;
      },
      undefined,
      { timeout: 5000 },
    );

    const nav = page.locator('#bottomNav');
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox!.y + navBox!.height).toBeGreaterThan(600);

    // v3.16 T6 (C6): #submitBtn lives in #questionSection (non-fixed flow content) below
    // briefing scroll + garden mini. `scrollIntoViewIfNeeded()` only scrolls until submit
    // is fully in viewport, but the fixed bottom-nav (z-index var(--z-floating)) overlaps
    // the lower 64px — submit lands underneath. Use `block: 'center'` so submit settles
    // mid-viewport, well clear of the nav. The assertion below verifies the invariant.
    const submit = page.locator('#submitBtn');
    await expect(submit).toBeVisible();
    await submit.evaluate((el) => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    });

    // Geometric invariant polling — defends against any residual style/scroll race
    // (Codex 사전 P2-3 pattern). Same property as the final assertion.
    await expect.poll(async () => {
      const sBox = await submit.boundingBox();
      const nBox = await nav.boundingBox();
      if (!sBox || !nBox) return null;
      return sBox.y + sBox.height <= nBox.y;
    }, { timeout: 3000, intervals: [100, 200, 400] }).toBe(true);

    const submitBox = await submit.boundingBox();
    expect(submitBox).not.toBeNull();
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navBox!.y);
  });
}
