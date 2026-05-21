import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

test('v3.48: settings ❄️ Streak Freeze 섹션 노출 + 보유량', async ({ page }) => {
  await primeOnboardedUser(page, { interests: ['leadership'], schemaVersion: 4 });
  await page.addInitScript(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const u = JSON.parse(raw);
    // primeOnboardedUser(sv4)는 plantStateByInterest 미포함 → v10 validation(plant guard) 통과 위해 보강.
    u.plantStateByInterest = u.plantStateByInterest ?? {};
    u.gardenBackfilled = true;
    u.freezeHistory = [{ date: '2026-05-15', kind: 'earned', amount: 1 }];
    localStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();

  const status = page.locator('#freezeStatus');
  await expect(status).toBeVisible();
  await expect(status).toContainText('❄️');
  await expect(page.locator('#freezeHistory')).toContainText('충전');
});
