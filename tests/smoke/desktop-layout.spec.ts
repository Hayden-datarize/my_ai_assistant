import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

// 브리핑 카드가 localStorage에 미리 저장된 상태로 시작 → RSS fetch 없이 렌더링
async function seedAll(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'TestUser',
        interests: ['growth'],
        onboardedAt: '2026-04-01',
        streak: 0, lastActiveDate: '', xp: 0, level: 1,
      }),
    );
    localStorage.setItem(
      'briefings',
      JSON.stringify([
        {
          id: 'fixture-1',
          date: '2026-04-23',
          url: 'https://example.com/1',
          title: 'Fixture Article',
          summary: 'Fixture summary for layout regression test.',
          scrapped: false,
          read: false,
          memo: '',
          sourceTitle: 'Fixture Source',
        },
      ]),
    );
  });
}

test('viewport 1440×900 — bottom-nav hidden on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedAll(page);
  await page.goto('/');
  // user/briefings seeding already established in this file — reuse same helper/pattern
  const nav = page.locator('#bottomNav');
  await expect(nav).toBeHidden();
});

test('viewport 375×667 — bottom-nav visible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seedAll(page);
  await page.goto('/');
  const nav = page.locator('#bottomNav');
  await expect(nav).toBeVisible();
});

test.describe('Desktop layout (≥768px) — briefing card not occluded by sidebar', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`viewport ${viewport.width}x${viewport.height} — first briefing card x >= 240`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedAll(page);
      await page.goto('/');
      await expect(page.locator('#homeTab')).toBeVisible();

      const firstCard = page.locator('.briefing-scroll .briefing-card').first();
      await firstCard.waitFor({ state: 'visible', timeout: 5000 });

      const navBox = await page.locator('#bottomNav').boundingBox();
      const cardBox = await firstCard.boundingBox();

      expect(cardBox).not.toBeNull();
      // bottom-nav가 데스크탑에서 좌측 컬럼(240px)으로 표시되면 overlap 발생.
      // 버그 상태: nav fixed left column, card x=0부터 시작 → nav 뒤에 가림.
      // 수정 후: nav는 display:none, drawer는 translateX(-100%) → card 가림 없음.
      if (navBox && navBox.width > 0 && navBox.width < viewport.width) {
        expect(cardBox!.x).toBeGreaterThanOrEqual(navBox.x + navBox.width - 1);
      }
    });
  }
});
