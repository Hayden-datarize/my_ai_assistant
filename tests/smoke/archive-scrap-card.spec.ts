import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

// v3.9 T7: archive scrap 카드 ✕ + select 모드 필터 잠금 E2E 검증
test('scrap 카드 ✕ → "스크랩 해제" 토스트 표시 (하단 중앙)', async ({ page }) => {
  await primeOnboardedUser(page);
  await page.addInitScript(() => {
    // briefings 자동 새로고침 억제 (외부 RSS fetch 방지)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    localStorage.setItem(
      'briefings',
      JSON.stringify([
        {
          id: 'b1',
          date: '2026-04-27',
          url: 'https://example.com',
          title: 'T1',
          summary: 'S1',
          scrapped: true,
          read: false,
          memo: '',
        },
      ])
    );
  });

  await page.goto('/');

  // archive 탭 이동 (mobile viewport — bottomNav 사용)
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();

  // v3.27 T2b: scrap chip 제거 → entity chip 'scrap' 사용
  await page.locator('.archive-entity-chip[data-entity="scrap"]').click();

  // scrap 카드가 보이는지 확인
  await expect(page.locator('.archive-card--scrap[data-briefing-id="b1"]')).toBeVisible();

  // ✕ 버튼 클릭 — 스크랩 해제
  await page.click('.archive-card--scrap[data-briefing-id="b1"] .archive-card-delete');

  // 카드가 사라졌는지 확인
  await expect(page.locator('.archive-card--scrap[data-briefing-id="b1"]')).toHaveCount(0);

  // undo 토스트가 떴는지 + 메시지 + 하단 중앙 컨테이너 검증
  const undoToast = page.locator('.toast--undo');
  await expect(undoToast).toBeVisible();
  await expect(undoToast).toContainText('스크랩을 해제했어요');
  // toast--undo 컨테이너는 하단 중앙 (toast-container--undo)
  await expect(page.locator('.toast-container--undo')).toBeVisible();
});

test('select 모드 진입 → 다른 chip aria-disabled', async ({ page }) => {
  await primeOnboardedUser(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    localStorage.setItem(
      'briefings',
      JSON.stringify([
        {
          id: 'b1',
          date: '2026-04-27',
          url: 'https://example.com',
          title: 'T1',
          summary: 'S1',
          scrapped: true,
          read: false,
          memo: '',
        },
      ])
    );
  });

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();

  // 기본 active 칩은 'all' — select 모드 진입
  await page.click('#archiveSelectToggle');

  // v3.27 T2b: scrap chip 제거 → question chip 중 분석/전환/실무 chip로 검증.
  // active 외 모든 question chip은 aria-disabled='true' + disabled
  const analysisChip = page.locator('.filter-chip[data-filter="분석"]');
  await expect(analysisChip).toHaveAttribute('aria-disabled', 'true');
  await expect(analysisChip).toBeDisabled();

  const transformChip = page.locator('.filter-chip[data-filter="전환"]');
  await expect(transformChip).toHaveAttribute('aria-disabled', 'true');

  // active chip ('all')은 enabled 유지
  const allChip = page.locator('.filter-chip[data-filter="all"]');
  await expect(allChip).not.toHaveAttribute('aria-disabled', 'true');
  await expect(allChip).toBeEnabled();

  // select 모드 해제 → 모든 chip 복원
  await page.click('#archiveSelectToggle');
  await expect(analysisChip).not.toHaveAttribute('aria-disabled', 'true');
  await expect(analysisChip).toBeEnabled();
});
