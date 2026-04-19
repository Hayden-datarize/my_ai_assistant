import { test, expect } from '@playwright/test';

/**
 * v2.0 compat smoke.
 * Seeds legacy `answers` key (v2.0 shape) before first navigation, then verifies
 * that the archive tab renders those entries without loss after auto-migration
 * to the `dg.answers` Phase B key.
 */
test('legacy v2.0 `answers` key auto-migrates to dg.answers and renders on archive tab', async ({ page }) => {
  const v20Payload = {
    user: {
      name: 'Hayden',
      interests: ['recruiting', 'ai_ml', 'leadership'],
      onboardedAt: '2026-03-01',
      streak: 12,
      lastActiveDate: '2026-04-18',
      xp: 640,
      level: 7,
    },
    answers: [
      { id: 'a1', date: '2026-04-18', questionId: 'q1', type: '분석', answer: '어제는 팀 1:1에서 비언어적 신호를 의식적으로 살폈다.' , evaluation: { score: 4, feedback: '구체적입니다' } },
      { id: 'a2', date: '2026-04-17', questionId: 'q2', type: '실무', answer: '30분 딥워크 블록을 하루에 두 번 시도했다.' },
    ],
  };

  await page.addInitScript((payload) => {
    localStorage.setItem('user', JSON.stringify(payload.user));
    localStorage.setItem('answers', JSON.stringify(payload.answers));
  }, v20Payload);

  await page.goto('/');

  // Home tab loads (user is onboarded)
  await expect(page.locator('#homeTab')).toBeVisible();

  // Navigate to archive
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('#archiveTab')).toBeVisible();

  // Both legacy entries are now rendered
  const cards = page.locator('.archive-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('비언어적 신호');

  // Legacy key is consumed; Phase B key holds the migrated payload
  const legacyKey = await page.evaluate(() => localStorage.getItem('answers'));
  const phaseBRaw = await page.evaluate(() => localStorage.getItem('dg.answers'));
  expect(legacyKey, 'legacy `answers` key should be removed after migration').toBeNull();
  expect(phaseBRaw, 'dg.answers should be populated with migrated Phase B shape').toBeTruthy();
  const phaseB = JSON.parse(phaseBRaw ?? '[]') as Array<{ text: string; type?: string; evaluation?: { score: number } }>;
  expect(phaseB).toHaveLength(2);
  expect(phaseB[0]?.text).toContain('비언어적');
  expect(phaseB[0]?.type).toBe('분석');
  expect(phaseB[0]?.evaluation?.score).toBe(4);
});

/**
 * Functional smoke: theme toggle persists across reload.
 */
test('theme toggle persists after reload', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-01',
      streak: 0, lastActiveDate: '', xp: 0, level: 1,
    }));
  });

  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();

  // Default theme is light (no class)
  await expect(page.locator('body.dark')).toHaveCount(0);

  // Click theme button in home header
  await page.locator('#themeBtn').click();
  await expect(page.locator('body.dark')).toBeVisible();

  // Reload — theme persists
  await page.reload();
  await expect(page.locator('body.dark')).toBeVisible();

  // Toggle back
  await page.locator('#themeBtn').click();
  await page.reload();
  await expect(page.locator('body.dark')).toHaveCount(0);
});

/**
 * Functional smoke: archive filter chips narrow the list.
 */
test('archive filter by type narrows the list', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-01',
      streak: 0, lastActiveDate: '', xp: 0, level: 1,
    }));
    localStorage.setItem('dg.answers', JSON.stringify([
      { id: 'a1', questionId: 'q', text: '분석형 답변 하나', authorId: 'self', createdAt: '2026-04-18T00:00:00Z', type: '분석', date: '2026-04-18', schemaVersion: 1 },
      { id: 'a2', questionId: 'q', text: '실무형 답변 둘', authorId: 'self', createdAt: '2026-04-17T00:00:00Z', type: '실무', date: '2026-04-17', schemaVersion: 1 },
      { id: 'a3', questionId: 'q', text: '분석형 답변 셋', authorId: 'self', createdAt: '2026-04-16T00:00:00Z', type: '분석', date: '2026-04-16', schemaVersion: 1 },
    ]));
  });

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(3);

  await page.locator('.filter-chip[data-filter="분석"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(2);

  await page.locator('.filter-chip[data-filter="실무"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(1);

  await page.locator('.filter-chip[data-filter="all"]').click();
  await expect(page.locator('.archive-card')).toHaveCount(3);
});
