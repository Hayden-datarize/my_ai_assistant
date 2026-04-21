import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function seedUser(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      name: 'Polish', interests: ['pm'],
      onboardedAt: '2026-04-01', streak: 0, lastActiveDate: '', xp: 0, level: 1,
    }));
  });
}

test('briefing card hover applies inset primary box-shadow (existence check)', async ({ page }) => {
  await seedUser(page);
  await page.route('**/api.rss2json.com/**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        feed: { title: 'src' },
        items: [{ title: 'T', link: 'https://example.com/1', description: 'd', pubDate: '' }],
      }),
    }),
  );
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();
  await page.locator('#refreshBriefing').click();
  const card = page.locator('.briefing-card').first();
  await expect(card).toBeVisible({ timeout: 10_000 });

  const beforeHover = await card.evaluate((el) => getComputedStyle(el).boxShadow);
  await card.hover();
  const afterHover = await card.evaluate((el) => getComputedStyle(el).boxShadow);

  expect(afterHover).not.toBe(beforeHover);
  expect(afterHover).not.toBe('none');
  expect(afterHover).toContain('inset');
});
