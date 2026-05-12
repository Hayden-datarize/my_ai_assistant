import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

/**
 * v3.27 T9: archive 통합 path E2E — entity chip + pin 토글 + 검색.
 */

test('v3.27 archive 통합 — entity chip + 핀 + 검색 1 path', async ({ page }) => {
  await primeOnboardedUser(page);
  await page.addInitScript(() => {
    // RSS auto-refresh 억제 (외부 fetch 방지)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    localStorage.setItem('briefings', JSON.stringify([
      {
        id: 'b-pin', date: '2026-05-10',
        url: 'https://example.com/1', title: '핀 스크랩 기사',
        summary: '핀 토글 검증용 스크랩', scrapped: true, read: false, memo: '', pinned: false,
      },
      {
        id: 'b-other', date: '2026-05-09',
        url: 'https://example.com/2', title: '기타 기사',
        summary: '기타 요약', scrapped: true, read: false, memo: '', pinned: false,
      },
    ]));
  });

  await page.goto('/');

  // archive 탭 진입 (mobile viewport — bottomNav)
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();

  // entity chip row 노출 (T2b)
  await expect(page.locator('#archiveEntityFilters')).toBeVisible();
  await expect(page.locator('.archive-entity-chip[data-entity="scrap"]')).toBeVisible();

  // v3.30 T1: archive 탭 entity row segmented + active class 회귀
  const row = page.locator('#archiveEntityFilters');
  await expect(row).toBeVisible();
  const allChip = row.locator('[data-entity="all"]');
  await expect(allChip).toHaveClass(/active/);

  // entity='scrap' click → 2차 question type row 숨김 (T2b)
  await page.locator('.archive-entity-chip[data-entity="scrap"]').click();
  await expect(page.locator('#archiveFilters')).toBeHidden();

  // 핀 토글 (T4) — 첫 카드 pin button click → aria-pressed=true
  const firstPin = page.locator('.archive-card--scrap[data-briefing-id="b-pin"] .archive-pin-toggle');
  await expect(firstPin).toBeVisible();
  await expect(firstPin).toHaveAttribute('aria-pressed', 'false');
  await firstPin.click();
  // dg:archive:updated → rerenderList → 새 button DOM, pinned-first 정렬
  await expect(
    page.locator('.archive-card--scrap[data-briefing-id="b-pin"] .archive-pin-toggle')
  ).toHaveAttribute('aria-pressed', 'true');

  // pinned 항목이 list 첫 카드 (sortPinThenDesc) — 인덱스 0
  const firstCard = page.locator('#archiveList .archive-card--scrap').first();
  await expect(firstCard).toHaveAttribute('data-briefing-id', 'b-pin');

  // 검색 (T3) — debounce 200ms + NFC normalize
  await page.locator('#archiveSearch').fill('핀');
  await page.waitForTimeout(300); // debounce 200ms + margin
  await expect(page.locator('.archive-card--scrap[data-briefing-id="b-pin"]')).toBeVisible();
  await expect(page.locator('.archive-card--scrap[data-briefing-id="b-other"]')).toHaveCount(0);

  // aria-live="polite" #archiveList
  await expect(page.locator('#archiveList')).toHaveAttribute('aria-live', 'polite');
});
