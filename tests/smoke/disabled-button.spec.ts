import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function seedOnboardedUser(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('user', JSON.stringify({
      name: '테',
      interests: ['tech'],
      onboardedAt: new Date().toISOString(),
      streak: 0,
      lastActiveDate: today,
      xp: 0,
      earnedBadges: {}, gamificationMigrated: true, schemaVersion: 2,
    }));
    // v3.3.4.3: suppress briefings auto-refresh (no briefings fixture seeded)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });
}

test('btn-primary:disabled shows muted background in light theme', async ({ page }) => {
  await seedOnboardedUser(page);
  await page.goto('/');

  // Navigate to settings → open interests edit modal
  // Use .first() — two nav buttons share [data-tab-id="settings"] (mobile + sidebar)
  await page.locator('[data-tab-id="settings"]').first().click();
  await page.locator('#editInterestsBtn').click();
  await expect(page.locator('.dg-modal')).toBeVisible();

  // Uncheck the sole pre-checked box to trigger saveBtn.disabled = true
  // Scope to .dg-modal to avoid matching other page checkboxes (e.g. slackAutoToggle)
  const modalChecked = page.locator('.dg-modal input[type="checkbox"]:checked');
  const count = await modalChecked.count();
  for (let i = count - 1; i >= 0; i--) {
    await modalChecked.nth(i).uncheck();
  }

  const saveBtn = page.locator('#saveInterestsBtn');
  await expect(saveBtn).toBeDisabled();

  // Light theme --bg-disabled = #CBD5E1 = rgb(203, 213, 225)
  await expect(saveBtn).toHaveCSS('background-color', 'rgb(203, 213, 225)');
});

test('btn-primary:disabled shows muted background in dark theme', async ({ page }) => {
  await seedOnboardedUser(page);
  // applyTheme() reads localStorage['theme'] on boot; set it before page.goto
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
  });
  await page.goto('/');

  await page.locator('[data-tab-id="settings"]').first().click();
  await page.locator('#editInterestsBtn').click();
  await expect(page.locator('.dg-modal')).toBeVisible();

  const modalChecked = page.locator('.dg-modal input[type="checkbox"]:checked');
  const count = await modalChecked.count();
  for (let i = count - 1; i >= 0; i--) {
    await modalChecked.nth(i).uncheck();
  }

  const saveBtn = page.locator('#saveInterestsBtn');
  await expect(saveBtn).toBeDisabled();

  // Dark theme --bg-disabled = #475569 = rgb(71, 85, 105)
  await expect(saveBtn).toHaveCSS('background-color', 'rgb(71, 85, 105)');
});
