import { test, expect } from '@playwright/test';
import { getDateStr } from '../../src/utils/dates';

// Block service worker so cached assets don't interfere with seeded state.
test.use({ serviceWorkers: 'block' });

test('cap 도달 시 토글 비활성 + aria-disabled', async ({ page }) => {
  const today = getDateStr();

  // Block any RSS refresh so the seeded card isn't replaced.
  await page.route('**/api.rss2json.com/**', (route) => route.abort());
  await page.route('**/medium.com/feed/**', (route) => route.abort());
  await page.route('**/tech.kakao.com/**', (route) => route.abort());

  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"text":"ko"}' }] } }],
      }),
    });
  });

  await page.addInitScript((args) => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'T',
        interests: ['ai_ml'],
        onboardedAt: args.today,
        streak: 1,
        lastActiveDate: args.today,
        xp: 0,
        level: 1,
      }),
    );
    localStorage.setItem('dg_gemini_key', 'TEST_KEY');
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    // Seed cap=30 and usage=30 for today → cap already reached.
    localStorage.setItem('dg_translate_cap', '30');
    localStorage.setItem(
      'dg_translate_usage',
      JSON.stringify({ date: args.today, count: 30 }),
    );
    localStorage.setItem(
      'briefings',
      JSON.stringify([
        {
          id: 'card-1',
          date: args.today,
          url: 'https://e.com/x',
          title: 'OpenAI launches new model',
          summary: 'English body content here for testing only.',
          detectedLang: 'en',
          scrapped: false,
          read: false,
          memo: '',
        },
      ]),
    );
  }, { today });

  await page.goto('/');
  await expect(page.locator('.briefing-card')).toHaveCount(1, { timeout: 5000 });

  const toggle = page.locator('.card-lang-toggle').first();
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-disabled', 'true');
});
