import { test, expect } from '@playwright/test';

// v3.8 T4: archive card ✕ 버튼으로 답변 삭제 후 undo로 복원하는 E2E 검증
test('archive 카드 ✕로 답변 삭제 후 undo로 복원', async ({ page }) => {
  await page.addInitScript(() => {
    // 온보딩 완료 상태 + 사용자 세션
    localStorage.setItem('user', JSON.stringify({ interests: ['tech'], gamificationMigrated: true, gardenIntroduced: true }));
    // briefings 자동 새로고침 억제 (fixture 없음)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    localStorage.setItem(
      'dg.answers',
      JSON.stringify([
        {
          id: 'e2e-a',
          questionId: 'q1',
          text: 'e2e test answer',
          authorId: 'self',
          createdAt: '2026-04-27T00:00:00.000Z',
          schemaVersion: 1,
          date: '2026-04-27',
        },
      ]),
    );
  });

  await page.goto('/');

  // archive 탭 이동 (mobile viewport — bottomNav 사용)
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();

  // 카드가 보이는지 확인
  await expect(page.locator('.archive-card[data-answer-id="e2e-a"]')).toBeVisible();

  // ✕ 버튼 클릭 — 삭제
  await page.click('.archive-card[data-answer-id="e2e-a"] .archive-card-delete');

  // 카드가 사라졌는지 확인
  await expect(page.locator('.archive-card[data-answer-id="e2e-a"]')).toHaveCount(0);

  // undo 토스트가 떴는지 확인
  await expect(page.locator('.toast--undo')).toBeVisible();

  // undo 버튼 클릭 → 복원
  await page.click('.toast--undo button');

  // 카드가 다시 나타나는지 확인
  await expect(page.locator('.archive-card[data-answer-id="e2e-a"]')).toBeVisible();
});
