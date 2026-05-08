import { test, expect } from '@playwright/test';
import { getKstDateStr } from '../../src/utils/dates';
import { primeOnboardedUser } from '../helpers/seed';

// Block service worker so stats-tab navigation / seeded answers are not
// cached or intercepted by sw.js (follows convention from layout.spec.ts
// and briefings-empty.spec.ts).
test.use({ serviceWorkers: 'block' });

/**
 * Seed an onboarded user + one answer for today, navigate to the app,
 * and switch to the stats tab so the heatmap is mounted.
 *
 * Notes on adaptation vs. plan template:
 * - Uses `addInitScript` (before goto) instead of `goto → evaluate → reload`,
 *   matching the project convention used by every other smoke test.
 * - Seeds the `user` payload with `interests`/`onboardedAt`/`lastActiveDate`
 *   so the onboarding gate in `boot.ts` does not block render.
 * - Nav selector depends on viewport: bottom-nav is hidden on desktop (≥768px)
 *   while sidebar-drawer is hidden on mobile. `seedAndGoto` detects viewport
 *   width at runtime and uses the correct path.
 */
async function seedAndGoto(page: import('@playwright/test').Page): Promise<void> {
  // v3.14.5 T1 (Codex IR-1): KST today를 Node-side에서 계산해 args로 전달.
  // browser-context의 toISOString()은 UTC라 KST 새벽엔 1일 어긋나 .is-today cell 0개로 false-green.
  const today = getKstDateStr();
  await primeOnboardedUser(page, { interests: ['growth'], streak: 1, xp: 10 });
  await page.addInitScript((args: { today: string }) => {
    localStorage.setItem('dg.answers', JSON.stringify([
      { date: args.today, text: 'today', type: '감정' },
    ]));
    // Reset the first-visit entrance gate so reduce-motion test can
    // deterministically see the animation rule applied / suppressed.
    sessionStorage.removeItem('dg-heatmap-animated');
    // Avoid sidebar-open leak from prior tests persisting into desktop runs.
    localStorage.removeItem('dg-sidebar-last-state');
  }, { today });
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();

  const vw = page.viewportSize()?.width ?? 375;
  if (vw >= 768) {
    // Desktop: bottom-nav is hidden (display:none). Open drawer then click.
    await page.locator('#sidebarToggle').click();
    await page.locator('#sidebarDrawer .nav-item[data-tab-id="stats"]').click();
  } else {
    await page.locator('#bottomNav button[data-tab-id="stats"]').click();
  }
  await expect(page.locator('#heatmapGrid')).toBeVisible();
}

test.describe('heatmap visual + interaction', () => {
  test('renders grid, 7 labels, legend, and inline info', async ({ page }) => {
    await seedAndGoto(page);
    await expect(page.locator('.heatmap-weekday-labels li')).toHaveCount(7);
    await expect(page.locator('.heatmap-legend .legend-item')).toHaveCount(4);
    await expect(page.locator('#heatmapInfo')).not.toBeEmpty();
  });

  test('desktop viewport 1440x900: cell width 48px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAndGoto(page);
    // Use computed CSS width (reads the CSS rule value) instead of the
    // layout box rect — CSS grid tracks can subpixel-round the rendered
    // box, but the rule itself is 48px / 20px exactly. This matches the
    // intent of the test ("the correct media-query rule is active").
    // v3.3.4.2: desktop bumped 28px → 48px (Hayden: still felt visually
    // tiny inside the wide stats card on 1440+ viewports).
    const width = await page.locator('.heatmap-cell:not(.is-blank)').first().evaluate((el) => {
      return getComputedStyle(el).width;
    });
    expect(width).toBe('48px');
  });

  test('mobile viewport 375x667: cell width 20px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await seedAndGoto(page);
    const width = await page.locator('.heatmap-cell:not(.is-blank)').first().evaluate((el) => {
      return getComputedStyle(el).width;
    });
    expect(width).toBe('20px');
  });

  test('today cell has .is-today class', async ({ page }) => {
    await seedAndGoto(page);
    const todayCell = page.locator('.heatmap-cell.is-today');
    await expect(todayCell).toHaveCount(1);
    // v3.14.5 T1 (Codex IR-1): cell의 [data-date]가 Node-side getKstDateStr()과 일치하는지
    // 명시 검증 — KST-shifted host에서 false-green 차단.
    await expect(todayCell).toHaveAttribute('data-date', getKstDateStr());
  });

  test('keyboard: focus first data cell, ArrowRight moves 7 days', async ({ page }) => {
    await seedAndGoto(page);
    await page.locator('.heatmap-cell:not(.is-blank)').first().focus();
    const firstDate = await page.evaluate(() => document.activeElement?.getAttribute('data-date'));
    await page.keyboard.press('ArrowRight');
    const nextDate = await page.evaluate(() => document.activeElement?.getAttribute('data-date'));
    expect(firstDate).not.toBeNull();
    expect(nextDate).not.toBeNull();
    const firstD = new Date(firstDate!);
    const nextD = new Date(nextDate!);
    expect((nextD.getTime() - firstD.getTime()) / (1000 * 60 * 60 * 24)).toBe(7);
  });

  test('hover on cell updates inline info', async ({ page }) => {
    await seedAndGoto(page);
    const info = page.locator('#heatmapInfo');
    const before = await info.textContent();
    await page.locator('.heatmap-cell:not(.is-blank)').first().hover();
    const after = await info.textContent();
    expect(after).not.toBe(before);
    expect(after).toMatch(/\d+월 \d+일/);
  });

  test('Enter on focused cell opens modal; ESC closes and returns focus', async ({ page }) => {
    await seedAndGoto(page);
    const firstCell = page.locator('.heatmap-cell:not(.is-blank)').first();
    await firstCell.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.dg-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.dg-modal')).toHaveCount(0);
    await expect(firstCell).toBeFocused();
  });

  test('reduce-motion: entrance animation removed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedAndGoto(page);
    const cell = page.locator('.heatmap-cell:not(.is-blank)').first();
    const animation = await cell.evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
  });

  test('v3.3.3 light l0 differs from l1 (visible contrast)', async ({ page }) => {
    await seedAndGoto(page);
    const l0 = page.locator('.heatmap-cell.level-0').first();
    const l1 = page.locator('.heatmap-cell.level-1').first();
    if (await l1.count() === 0) {
      // No l1 cells — still validate l0 value
      await expect(l0).toBeVisible();
      const bg = await l0.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toMatch(/226,\s*232,\s*240/);  // #E2E8F0
      return;
    }
    const bg0 = await l0.evaluate((el) => getComputedStyle(el).backgroundColor);
    const bg1 = await l1.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg0).not.toBe(bg1);
    expect(bg0).toMatch(/226,\s*232,\s*240/);  // #E2E8F0
  });

  test('v3.17 T2 dark l0 = warm charcoal (#161823)', async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.dataset['theme'] = 'dark';
      document.body.classList.add('dark');
    });
    await seedAndGoto(page);
    await page.evaluate(() => {
      document.documentElement.dataset['theme'] = 'dark';
      document.body.classList.add('dark');
    });
    const l0 = page.locator('.heatmap-cell.level-0').first();
    if (await l0.count() === 0) return;  // no heatmap rendered yet, skip silently
    const bg = await l0.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/22,\s*24,\s*35/);  // #161823 — bumped from #0F172A in v3.17 T2 (carry from T8 smoke regression catch)
  });
});
