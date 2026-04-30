import { test, expect } from '@playwright/test';
import { getDateStr } from '../../src/utils/dates';

test.use({ serviceWorkers: 'block' });

test('일일 한도 슬라이더 변경 → 즉시 반영 + persist', async ({ page }) => {
  const today = getDateStr();
  await page.addInitScript((args) => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'T',
        interests: ['AI'],
        onboardedAt: args.today,
        streak: 1,
        lastActiveDate: args.today,
        xp: 0,
        earnedBadges: {}, gamificationMigrated: true, schemaVersion: 2,
      }),
    );
    localStorage.setItem('dg_gemini_key', 'TEST_KEY');
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  }, { today });

  await page.goto('/');
  await page.click('[data-tab-id="settings"]');
  await expect(page.locator('#translateCap')).toBeVisible();

  await page.locator('#translateCap').fill('200');
  await expect(page.locator('#translateCapValue')).toHaveText('200건/일');

  // Reload → re-navigate → still 200
  await page.reload();
  await page.click('[data-tab-id="settings"]');
  await expect(page.locator('#translateCap')).toHaveValue('200');
});

test('캐시 초기화 버튼: confirm 후 *Ko 필드 삭제 (브리핑 본문 유지)', async ({ page }) => {
  const today = getDateStr();
  await page.addInitScript((args) => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'T',
        interests: ['AI'],
        onboardedAt: args.today,
        streak: 1,
        lastActiveDate: args.today,
        xp: 0,
        earnedBadges: {}, gamificationMigrated: true, schemaVersion: 2,
      }),
    );
    localStorage.setItem('dg_gemini_key', 'TEST_KEY');
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    localStorage.setItem(
      'briefings',
      JSON.stringify([
        {
          id: 'a',
          date: args.today,
          url: 'https://e.com/a',
          title: 'Hello',
          summary: 'Body',
          titleKo: '안녕',
          summaryKo: '본문',
          detectedLang: 'en',
          scrapped: false,
          read: false,
          memo: '',
        },
      ]),
    );
  }, { today });

  await page.goto('/');
  page.on('dialog', (d) => { void d.accept(); });
  await page.click('[data-tab-id="settings"]');
  await page.click('#clearTranslationCacheBtn');

  // Wait until storage reflects the deletion before asserting
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const raw = localStorage.getItem('briefings') ?? '';
      return raw.includes('"titleKo"');
    });
  }).toBe(false);

  const stored = await page.evaluate(() => localStorage.getItem('briefings'));
  expect(stored).toContain('"title":"Hello"');
  expect(stored).not.toContain('"titleKo"');
  expect(stored).not.toContain('"summaryKo"');
});
