import { test, expect } from '@playwright/test';
import { getKstDateStr } from '../../src/utils/dates';
import { primeOnboardedUser } from '../helpers/seed';

test.use({ serviceWorkers: 'block' });

// 브리핑 카드가 localStorage에 미리 저장된 상태로 시작 → RSS fetch 없이 렌더링
// v3.3.4.3: date는 오늘로 seed한다. hydrateBriefings가 stale(date != 오늘)을 감지하면
// 자동 refresh를 트리거해서 고정 픽스처를 RSS 응답으로 덮어쓰기 때문.
// v3.14.4 T3: today를 Node-side getKstDateStr()로 계산해 args로 전달 (cardnews.spec.ts 선례).
//   browser-context의 toISOString()은 UTC라 KST 새벽엔 1일 어긋남 → fixture refresh로 덮임.
async function seedAll(page: import('@playwright/test').Page): Promise<void> {
  const today = getKstDateStr();
  await primeOnboardedUser(page, { interests: ['growth'] });
  await page.addInitScript((args: { today: string }) => {
    localStorage.setItem(
      'briefings',
      JSON.stringify([
        {
          id: 'fixture-1',
          date: args.today,
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
    // drawer가 닫힌 기본 상태에서 시작하도록 보장 (이전 테스트가 open 상태로 persist했을 경우 대비)
    localStorage.removeItem('dg-sidebar-last-state');
  }, { today });
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

test('viewport 1920×1080 — settings section width <= 560px', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedAll(page);
  await page.goto('/');
  // Open drawer via hamburger, click settings tab
  await page.locator('#sidebarToggle').click();
  await page.locator('#sidebarDrawer .nav-item[data-tab-id="settings"]').click();
  const section = page.locator('#settingsTab');
  await expect(section).toBeVisible();
  const box = await section.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(560);
});

test.describe('Desktop layout (≥768px) — briefing card not occluded by sidebar', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`viewport ${viewport.width}x${viewport.height} — briefing card not occluded by closed drawer`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedAll(page);
      await page.goto('/');
      await expect(page.locator('#homeTab')).toBeVisible();

      const firstCard = page.locator('.briefing-scroll .briefing-card').first();
      await firstCard.waitFor({ state: 'visible', timeout: 10_000 });

      // Drawer should be off-screen (translateX(-100%)) when closed.
      // Card should render starting at x >= 0 and NOT be inside drawer's visible bounds.
      const drawer = page.locator('#sidebarDrawer');
      const drawerBox = await drawer.boundingBox();
      const cardBox = await firstCard.boundingBox();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.x).toBeGreaterThanOrEqual(0);
      if (drawerBox !== null && drawerBox.width > 0) {
        // drawer right edge should be <= 0 (off-screen) when closed.
        // If drawer accidentally visible (data-open='true'), card overlap would be drawerBox.x+width > 0.
        expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(0);
      }
    });
  }
});
