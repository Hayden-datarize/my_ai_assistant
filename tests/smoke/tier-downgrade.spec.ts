import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

type SeedBriefing = {
  id: string;
  date: string;
  url: string;
  title: string;
  summary: string;
  scrapped: boolean;
  read: boolean;
  memo: string;
  sourceTitle?: string;
  imageUrl?: string;
};

async function seedOneBriefing(
  page: import('@playwright/test').Page,
  imageUrl: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const briefing: SeedBriefing = {
    id: 'tier-test',
    date: today,
    url: 'https://example.com/article',
    title: 'Test Title',
    summary: 'Test summary',
    scrapped: false,
    read: false,
    memo: '',
    sourceTitle: 'TestSource',
    imageUrl,
  };
  await page.addInitScript((payload) => {
    const t = new Date().toISOString().slice(0, 10);
    localStorage.setItem('user', JSON.stringify({
      name: '테',
      interests: ['tech'],
      onboardedAt: new Date().toISOString(),
      streak: 0,
      lastActiveDate: t,
      xp: 0,
      level: 1,
    }));
    localStorage.setItem('briefings', JSON.stringify([payload]));
  }, briefing);
}

test('tier 1 → 2 when image URL returns 404', async ({ page }) => {
  const imgUrl = 'https://example.com/broken.jpg';
  await seedOneBriefing(page, imgUrl);
  // Route registration order matters: more-specific patterns first, catch-all last.
  // Playwright matches in registration order, so reversing the registration causes
  // the catch-all to swallow specific patterns and break the test.
  await page.route(imgUrl, (route) => route.fulfill({ status: 404 }));
  await page.goto('/');

  const card = page.locator('.briefing-card').first();
  // Wait for img.onerror to fire (brief pause for route + error event propagation)
  await expect(card).toHaveAttribute('data-tier', '2');
  await expect(card.locator('.card-thumb')).toHaveCount(0);
});

test('tier 1 → 2 when image URL returns 500', async ({ page }) => {
  const imgUrl = 'https://example.com/server-error.jpg';
  await seedOneBriefing(page, imgUrl);
  await page.route(imgUrl, (route) => route.fulfill({ status: 500 }));
  await page.goto('/');

  const card = page.locator('.briefing-card').first();
  await expect(card).toHaveAttribute('data-tier', '2');
  await expect(card.locator('.card-thumb')).toHaveCount(0);
});
