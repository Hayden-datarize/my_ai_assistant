import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function seedOnboarding(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ interests: ['growth'], gamificationMigrated: true, gardenIntroduced: true }));
    localStorage.removeItem('dg-sidebar-last-state');
    // v3.3.4.3: suppress briefings auto-refresh (no briefings fixture seeded)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });
}

test.describe('Sidebar drawer (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedOnboarding(page);
    await page.goto('/');
  });

  test('starts closed, hamburger click opens', async ({ page }) => {
    const drawer = page.locator('#sidebarDrawer');
    const toggle = page.locator('#sidebarToggle');
    await expect(drawer).toHaveAttribute('data-open', 'false');
    await toggle.click();
    await expect(drawer).toHaveAttribute('data-open', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('ESC closes drawer and refocuses toggle', async ({ page }) => {
    await page.locator('#sidebarToggle').click();
    await page.keyboard.press('Escape');
    const drawer = page.locator('#sidebarDrawer');
    await expect(drawer).toHaveAttribute('data-open', 'false');
    // focus returns to toggle
    await expect(page.locator('#sidebarToggle')).toBeFocused();
  });

  test('backdrop click closes drawer', async ({ page }) => {
    await page.locator('#sidebarToggle').click();
    // Click at element center (viewport-agnostic — backdrop is full viewport
    // and drawer covers left 240px, so center is always outside the drawer).
    await page.locator('#sidebarBackdrop').click();
    await expect(page.locator('#sidebarDrawer')).toHaveAttribute('data-open', 'false');
  });

  test('drawer tab click switches tab and closes drawer', async ({ page }) => {
    await page.locator('#sidebarToggle').click();
    await page.locator('#sidebarDrawer .nav-item[data-tab-id="archive"]').click();
    await expect(page.locator('#sidebarDrawer')).toHaveAttribute('data-open', 'false');
    await expect(page.locator('#archiveTab')).toBeVisible();
    await expect(page.locator('#sidebarDrawer .nav-item[data-tab-id="archive"]')).toHaveClass(/active/);
  });

  test('state persists across reload (open)', async ({ page }) => {
    // addInitScript runs on every navigation including reload, so we cannot rely on
    // the removeItem seed surviving into the reload. Instead, seed the persisted 'open'
    // state directly so the drawer initialises open after reload.
    await page.addInitScript(() => {
      localStorage.setItem('dg-sidebar-last-state', 'open');
    });
    await page.reload();
    await expect(page.locator('#sidebarDrawer')).toHaveAttribute('data-open', 'true');
  });
});

test.describe('Sidebar hidden on mobile', () => {
  test('viewport 375×667 — toggle/backdrop/drawer all hidden, bottom-nav visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await seedOnboarding(page);
    await page.goto('/');
    await expect(page.locator('#sidebarToggle')).toBeHidden();
    await expect(page.locator('#sidebarBackdrop')).toBeHidden();
    await expect(page.locator('#sidebarDrawer')).toBeHidden();
    await expect(page.locator('#bottomNav')).toBeVisible();
  });
});
