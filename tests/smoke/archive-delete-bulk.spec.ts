import { test, expect } from '@playwright/test';

test('선택 모드에서 다건 선택 + 벌크 삭제 + undo 복원', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await page.addInitScript(() => {
    // 온보딩 완료 상태
    localStorage.setItem('user', JSON.stringify({ interests: ['tech'] }));
    // briefings 자동 새로고침 억제
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    localStorage.setItem(
      'dg.answers',
      JSON.stringify([
        { id: 'e1', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
        { id: 'e2', questionId: 'q2', text: 'two', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
        { id: 'e3', questionId: 'q3', text: 'three', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
      ])
    );
  });

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await page.click('#archiveSelectToggle');
  await page.click('.archive-card[data-answer-id="e1"]');
  await page.click('.archive-card[data-answer-id="e3"]');
  await expect(page.locator('#archiveBulkDelete')).toContainText('2');
  await page.click('#archiveBulkDelete');
  await expect(page.locator('.archive-card[data-answer-id="e1"]')).toHaveCount(0);
  await expect(page.locator('.archive-card[data-answer-id="e3"]')).toHaveCount(0);
  await expect(page.locator('.archive-card[data-answer-id="e2"]')).toBeVisible();
  await page.click('.dg-toast--undo button');
  await expect(page.locator('.archive-card[data-answer-id="e1"]')).toBeVisible();
});

test('0건 선택 시 벌크 삭제 버튼 disabled', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ interests: ['tech'] }));
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    localStorage.setItem(
      'dg.answers',
      JSON.stringify([
        { id: 'e1', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
      ])
    );
  });

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await page.click('#archiveSelectToggle');
  await expect(page.locator('#archiveBulkDelete')).toBeDisabled();
});
