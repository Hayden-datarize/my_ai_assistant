import { test, expect } from '@playwright/test';
import { getDateStr } from '../../src/utils/dates';

// Block service worker so tests don't hit stale caches.
test.use({ serviceWorkers: 'block' });

const seedUser = `
  localStorage.setItem('user', JSON.stringify({ name: 'T', interests: ['ai_ml'], onboardedAt: '2026-04-26', streak: 1, lastActiveDate: '2026-04-26', xp: 0, earnedBadges: {}, gamificationMigrated: true, gardenIntroduced: true, schemaVersion: 2 }));
`;

test('영문 카드 토글: 한글 ↔ 영문 swap', async ({ page }) => {
  // Block any RSS refresh attempts so auto-refresh can't replace the seeded card.
  await page.route('**/api.rss2json.com/**', (route) => route.abort());
  await page.route('**/medium.com/feed/**', (route) => route.abort());
  await page.route('**/tech.kakao.com/**', (route) => route.abort());

  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"text":"한글 요약 결과입니다"}' }] } }],
      }),
    });
  });

  const today = getDateStr();
  await page.addInitScript((args: { init: string; today: string }) => {
    // eslint-disable-next-line no-eval
    eval(args.init);
    localStorage.setItem('dg_gemini_key', 'TEST_KEY');
    // Mark auto-refresh as already-tried so hydrateBriefings doesn't kick off
    // a refresh when the seeded date doesn't match the runner's local date.
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    // Use a far-future date so any date-comparison still treats it as today-ish
    // (firstDate !== today triggers refresh path, but session flag blocks it).
    localStorage.setItem('briefings', JSON.stringify([{
      id: 'card-1', date: args.today, url: 'https://e.com/x',
      title: 'OpenAI launches new model',
      summary: 'OpenAI announced a new GPT model with improved reasoning capabilities and lower cost.',
      scrapped: false, read: false, memo: '',
    }]));
  }, { init: seedUser, today });

  await page.goto('/');
  // Wait for card to render
  await expect(page.locator('.briefing-card')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('.card-lang-toggle').first()).toBeVisible();

  const toggle = page.locator('.card-lang-toggle').first();
  const summary = page.locator('.briefing-card .card-summary').first();

  await expect(summary).toContainText('OpenAI announced');

  await toggle.click();
  await expect(summary).toContainText('한글 요약 결과입니다');

  await toggle.click();
  await expect(summary).toContainText('OpenAI announced');
});

test('한글 카드는 토글 노출 안 됨', async ({ page }) => {
  const today = getDateStr();
  await page.addInitScript((args: { init: string; today: string }) => {
    // eslint-disable-next-line no-eval
    eval(args.init);
    localStorage.setItem('dg_gemini_key', 'TEST_KEY');
    localStorage.setItem('briefings', JSON.stringify([{
      id: 'card-1', date: args.today, url: 'https://e.com/y',
      title: '오픈AI 새 모델 발표',
      summary: '한국어 본문입니다.',
      scrapped: false, read: false, memo: '',
    }]));
  }, { init: seedUser, today });
  await page.goto('/');
  await expect(page.locator('.briefing-card')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('.card-lang-toggle')).toHaveCount(0);
});

test('API key 없으면 토글 비노출', async ({ page }) => {
  const today = getDateStr();
  await page.addInitScript((args: { init: string; today: string }) => {
    // eslint-disable-next-line no-eval
    eval(args.init);
    localStorage.removeItem('dg_gemini_key');
    localStorage.setItem('briefings', JSON.stringify([{
      id: 'card-1', date: args.today, url: 'https://e.com/x',
      title: 'OpenAI launches',
      summary: 'English body content here for testing only.',
      scrapped: false, read: false, memo: '',
    }]));
  }, { init: seedUser, today });
  await page.goto('/');
  await expect(page.locator('.briefing-card')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('.card-lang-toggle')).toHaveCount(0);
});

test('background queue: 영문 제목이 자동으로 한글로 swap된다', async ({ page }) => {
  await page.route('**/api.rss2json.com/**', (route) => route.abort());
  await page.route('**/medium.com/feed/**', (route) => route.abort());
  await page.route('**/tech.kakao.com/**', (route) => route.abort());

  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"text":"오픈AI가 새 모델을 발표"}' }] } }],
      }),
    });
  });

  const today = getDateStr();
  await page.addInitScript((args: { init: string; today: string }) => {
    // eslint-disable-next-line no-eval
    eval(args.init);
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    localStorage.setItem('dg_gemini_key', 'TEST_KEY');
    localStorage.setItem('briefings', JSON.stringify([{
      id: 'card-1', date: args.today, url: 'https://e.com/x',
      title: 'OpenAI launches new model',
      summary: 'long English body containing more than eighty characters to trigger summarize path. lorem ipsum dolor sit amet.',
      scrapped: false, read: false, memo: '',
    }]));
  }, { init: seedUser, today });

  await page.goto('/');
  await expect(page.locator('.briefing-card')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('.card-title').first()).toContainText('오픈AI가 새 모델을 발표', { timeout: 5000 });
});
