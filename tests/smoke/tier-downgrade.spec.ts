import { test, expect } from '@playwright/test';
import { getDateStr } from '../../src/utils/dates';

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

// v3.14.4 T3: today를 Node-side getDateStr()로 계산해 args로 전달 (cardnews.spec.ts 선례).
// src/utils/dates.ts getDateStr()와 1:1 일치시켜야 hydrateBriefings의 stale 판정을 우회.
// browser-context의 toISOString()은 UTC라 KST 새벽엔 1일 어긋나 fixture가 refresh로 덮여쓰임.
async function seedOneBriefing(
  page: import('@playwright/test').Page,
  imageUrl: string,
): Promise<void> {
  const today = getDateStr();
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
  await page.addInitScript((args: { briefing: SeedBriefing; today: string }) => {
    localStorage.setItem('user', JSON.stringify({
      name: '테',
      interests: ['tech'],
      onboardedAt: new Date().toISOString(),
      streak: 0,
      lastActiveDate: args.today,
      xp: 0,
      earnedBadges: {}, gamificationMigrated: true, gardenIntroduced: true, schemaVersion: 2,
    }));
    localStorage.setItem('briefings', JSON.stringify([args.briefing]));
  }, { briefing, today });
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
  await expect(card).toHaveAttribute('data-tier', '2', { timeout: 10_000 });
  await expect(card.locator('.card-thumb')).toHaveCount(0);
});

test('tier 1 → 2 when image URL returns 500', async ({ page }) => {
  const imgUrl = 'https://example.com/server-error.jpg';
  await seedOneBriefing(page, imgUrl);
  await page.route(imgUrl, (route) => route.fulfill({ status: 500 }));
  await page.goto('/');

  const card = page.locator('.briefing-card').first();
  await expect(card).toHaveAttribute('data-tier', '2', { timeout: 10_000 });
  await expect(card.locator('.card-thumb')).toHaveCount(0);
});
