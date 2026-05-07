import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

test.use({ serviceWorkers: 'block' });

async function seedUser(page: import('@playwright/test').Page, interests: string[]): Promise<void> {
  await primeOnboardedUser(page, { interests });
  await page.addInitScript(() => {
    // v3.3.4.3: suppress briefings auto-refresh (no briefings fixture seeded)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });
}

test('settings: opens interests modal + save adds a chip + persists', async ({ page }) => {
  await seedUser(page, ['recruiting']);
  await page.goto('/');
  await page.click('[data-tab-id="settings"]');

  await expect(page.locator('.interest-chip')).toHaveCount(1);

  await page.click('#editInterestsBtn');
  await expect(page.locator('.dg-modal')).toBeVisible();
  await expect(page.locator('.dg-modal-title')).toHaveText('관심 분야 수정');

  const allBoxes = page.locator('.dg-modal input[type="checkbox"]');
  const boxCount = await allBoxes.count();
  let toggled: string | null = null;
  for (let i = 0; i < boxCount; i++) {
    const box = allBoxes.nth(i);
    const checked = await box.isChecked();
    const value = await box.getAttribute('value');
    if (!checked && value && value !== 'recruiting') {
      await box.check();
      toggled = value;
      break;
    }
  }
  expect(toggled).not.toBeNull();

  await page.click('#saveInterestsBtn');
  await expect(page.locator('.dg-modal')).toHaveCount(0);

  await expect(page.locator('.interest-chip')).toHaveCount(2);

  const interests = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('user')!);
    return raw.interests as string[];
  });
  expect(interests).toHaveLength(2);
  expect(interests).toContain(toggled!);
});

test('settings: cancel discards changes', async ({ page }) => {
  await seedUser(page, ['recruiting']);
  await page.goto('/');
  await page.click('[data-tab-id="settings"]');

  await page.click('#editInterestsBtn');

  const allBoxes = page.locator('.dg-modal input[type="checkbox"]');
  const boxCount = await allBoxes.count();
  for (let i = 0; i < boxCount; i++) {
    const box = allBoxes.nth(i);
    if (!(await box.isChecked())) { await box.check(); break; }
  }

  await page.click('#cancelInterestsBtn');
  await expect(page.locator('.dg-modal')).toHaveCount(0);

  await expect(page.locator('.interest-chip')).toHaveCount(1);
  const interests = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('user')!);
    return raw.interests as string[];
  });
  expect(interests).toHaveLength(1);
  expect(interests[0]).toBe('recruiting');
});

test('settings: save button disabled when zero selected', async ({ page }) => {
  await seedUser(page, ['recruiting']);
  await page.goto('/');
  await page.click('[data-tab-id="settings"]');

  await page.click('#editInterestsBtn');
  await expect(page.locator('.dg-modal')).toBeVisible();

  const allBoxes = page.locator('.dg-modal input[type="checkbox"]');
  const boxCount = await allBoxes.count();
  for (let i = 0; i < boxCount; i++) {
    const box = allBoxes.nth(i);
    if (await box.isChecked()) await box.uncheck();
  }

  await expect(page.locator('#saveInterestsBtn')).toBeDisabled();
  await page.click('#cancelInterestsBtn');
});

test('settings: toast on save', async ({ page }) => {
  await seedUser(page, ['recruiting']);
  await page.goto('/');
  await page.click('[data-tab-id="settings"]');
  await page.click('#editInterestsBtn');
  await expect(page.locator('.dg-modal')).toBeVisible();

  const allBoxes = page.locator('.dg-modal input[type="checkbox"]');
  const boxCount = await allBoxes.count();
  for (let i = 0; i < boxCount; i++) {
    const box = allBoxes.nth(i);
    if (!(await box.isChecked())) { await box.check(); break; }
  }

  await page.click('#saveInterestsBtn');

  const toast = page.locator('.toast', { hasText: '관심 분야가 업데이트' }).first();
  await expect(toast).toBeVisible({ timeout: 3000 });
});
