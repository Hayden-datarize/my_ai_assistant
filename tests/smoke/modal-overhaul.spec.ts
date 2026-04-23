import { test, expect, type Page } from '@playwright/test';

async function seedUserAndAnswer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      name: '테스트', interests: ['ai_ml'], onboardedAt: new Date().toISOString(),
      streak: 0, lastActiveDate: new Date().toISOString(), xp: 0, level: 1,
    }));
    localStorage.setItem('dg.answers', JSON.stringify([{
      id: 'a1', questionId: 'q1', text: '테스트 답변 내용', authorId: 'self',
      type: 'reflection', date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(), schemaVersion: 1,
    }]));
  });
}

async function openArchiveModal(page: Page, viewport: 'mobile' | 'desktop'): Promise<void> {
  if (viewport === 'desktop') {
    await page.locator('#sidebarToggle').click();
    await page.locator('#sidebarDrawer .nav-item[data-tab-id="archive"]').click();
  } else {
    await page.locator('#bottomNav .nav-item[data-tab-id="archive"]').click();
  }
  await expect(page.locator('#archiveTab')).toBeVisible();
  await page.locator('.archive-card').first().click({ timeout: 5000 });
}

test('archive modal renders with dg-modal CSS (fixed positioning + backdrop)', async ({ page }) => {
  await seedUserAndAnswer(page);
  await page.goto('/');
  await openArchiveModal(page, 'mobile');

  const modal = page.locator('.dg-modal');
  await expect(modal).toBeVisible();
  const position = await modal.evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe('fixed');

  const backdrop = page.locator('.dg-modal-backdrop');
  await expect(backdrop).toBeVisible();
  const bgColor = await backdrop.evaluate((el) => getComputedStyle(el).backgroundColor);
  // light mode: rgba(0,0,0,0.4)
  expect(bgColor).toMatch(/rgba?\(0,\s*0,\s*0/);
});

test('desktop centers dialog (≥640px)', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await seedUserAndAnswer(page);
  await page.goto('/');
  await openArchiveModal(page, 'desktop');

  const align = await page.locator('.dg-modal').evaluate((el) => getComputedStyle(el).alignItems);
  expect(align).toBe('center');
});
