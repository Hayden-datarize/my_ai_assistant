import { test, expect } from '@playwright/test';

// Disable the service worker so page.route can intercept rss2json calls.
// The default 'allow' lets sw.js handle the fetch, which bypasses route
// stubs entirely (this was the v3.2a-hotfix2 P1-c gap).
test.use({ serviceWorkers: 'block' });

/**
 * When every RSS source returns an error, the briefing scroll must
 * replace its loading skeleton with an explicit empty state — not
 * leave the "브리핑을 불러오는 중…" message stuck forever.
 *
 * Regression for v3.2a-hotfix3: brunch.co.kr/wanted RSS feeds went
 * dark in prod and the home tab showed an indefinite loading state.
 */
test('briefing refresh shows empty state when every rss2json call fails', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'TestUser',
        interests: ['recruiting', 'ai_ml'],
        onboardedAt: '2026-04-01',
        streak: 0,
        lastActiveDate: '',
        xp: 0,
        earnedBadges: {}, gamificationMigrated: true, gardenIntroduced: true, schemaVersion: 2,
      }),
    );
    // Seed an empty briefings cache so refresh has to hit the network.
    localStorage.removeItem('dg.briefings');
  });

  // Make every rss2json call return 422 — same shape as the prod failure
  // (brunch.co.kr response).
  await page.route('**/api.rss2json.com/**', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'error', message: 'Feed could not be converted' }),
    }),
  );

  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();

  // Trigger refresh explicitly so the loading text appears, then resolves
  // to the empty state.
  await page.locator('#refreshBriefing').click();

  const empty = page.locator('.briefing-empty');
  await expect(empty).toBeVisible({ timeout: 15_000 });
  await expect(empty).toContainText('브리핑');
  // The legacy loading text must be gone.
  await expect(page.locator('#briefingScroll')).not.toContainText('불러오는 중');
});

test('success response renders source chip from feed.title', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'TestUser',
        interests: ['pm'],
        onboardedAt: '2026-04-01',
        streak: 0, lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: true, gardenIntroduced: true, schemaVersion: 2,
      }),
    );
    localStorage.removeItem('dg.briefings');
  });

  await page.route('**/api.rss2json.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        feed: { title: 'toss tech' },
        items: [
          { title: 'T1', link: 'https://example.com/1', description: 'desc', pubDate: '' },
        ],
      }),
    }),
  );

  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();
  await page.locator('#refreshBriefing').click();

  const chip = page.locator('.card-source').first();
  await expect(chip).toBeVisible({ timeout: 10_000 });
  await expect(chip).toHaveText('toss tech');
});
