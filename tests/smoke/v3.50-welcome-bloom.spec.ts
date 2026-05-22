import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

// v3.50 T5 smoke — welcome glass surface + bloom ambient class 통합 검증.
//
// 사전 실측 정정 사항 (v3.49 lesson #3):
//  - stats 탭 selector: '#bottomNav button[data-tab-id="stats"]'
//    (nav.ts: btn.className='nav-item' + dataset['tabId']=t.id, container #bottomNav).
//    plant-detail-modal.spec.ts 패턴 차용.
//  - welcome-garden 자동 노출: main.ts에서 boot 시 maybeShowWelcomeGarden() 호출,
//    user.gardenIntroduced === false 이면 노출 (welcome-garden.ts:22).
//    wrapper bodyHtml = `<div class="welcome-garden-modal modal-glass">...` (T3 부착).
//  - plantState shape: production read는 { stage, cumulativeActivity, lastEngagedAt }.
//    (plan 예시의 lastWaterDate/unlockedAt 는 미사용 — garden-grid.ts read와 정합.)
//  - gardenBackfilled=true 필수: backfillGarden(user)가 stage=5 seed를 stage=1로
//    덮어쓰는 것 차단 (idempotent gate, plant-detail-modal.spec.ts 패턴).
//  - schemaVersion: 3 — helper가 받는 2|3|4 중. v4는 plantStateByInterest required지만
//    여기서는 read-merge로 주입하므로 3 → migration chain이 v10까지 backfill.

test.use({ serviceWorkers: 'block' });

test.describe('v3.50 M4 — welcome glass + bloom ambient', () => {
  test('welcome-garden modal wrapper carries .modal-glass class', async ({ page }) => {
    // gardenIntroduced=false → boot 시 maybeShowWelcomeGarden() 자동 노출.
    // schemaVersion: 3 → migration chain이 v10까지 끌어올림.
    await primeOnboardedUser(page, {
      schemaVersion: 3,
      gardenIntroduced: false,
      interests: ['tech'],
    });

    // briefings auto-refresh 억제 (RSS 실제 호출 방지).
    await page.addInitScript(() => {
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    });

    await page.goto('/');

    const wrap = page.locator('.welcome-garden-modal');
    await expect(wrap).toBeVisible({ timeout: 5000 });
    await expect(wrap).toHaveClass(/modal-glass/);
  });

  test('garden tab with stage-5 plant has .garden-grid--has-bloomed', async ({ page }) => {
    await primeOnboardedUser(page, {
      schemaVersion: 3,
      gardenIntroduced: true,
      interests: ['tech'],
    });

    await page.addInitScript(() => {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const u = JSON.parse(raw) as Record<string, unknown>;
      u.plantStateByInterest = {
        tech: {
          stage: 5,
          cumulativeActivity: 50,
          lastEngagedAt: new Date().toISOString(),
        },
      };
      // backfillGarden 차단 — seed한 stage=5 식물이 stage=1로 덮어쓰이는 것 방지.
      u.gardenBackfilled = true;
      localStorage.setItem('user', JSON.stringify(u));

      // briefings auto-refresh 억제 (RSS 실제 호출 방지).
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    });

    await page.goto('/');

    // stats(정원) 탭 진입 — bottom nav 버튼 (plant-detail-modal.spec.ts 패턴).
    await page.locator('#bottomNav button[data-tab-id="stats"]').click();

    const grid = page.locator('.garden-grid');
    await expect(grid).toBeVisible({ timeout: 5000 });
    await expect(grid).toHaveClass(/garden-grid--has-bloomed/);

    const bloomedCount = await grid.evaluate(
      (el) => (el as HTMLElement).style.getPropertyValue('--bloomed-count'),
    );
    expect(bloomedCount).toBe('1');
  });
});
