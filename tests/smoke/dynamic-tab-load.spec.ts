import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

// v3.29 T3 (Codex 사전 P1-3 / R4 P1): tab dynamic import 회귀 — first-mount FOUC 0 +
// navigate 시 chunk 로드 후 < 1500ms 내 render (preview server warm).
//
// boot.spec.ts와 중복되지 않는 가치: cold-start home 렌더 후 archive/stats를 *순차로*
// click하여 각 dynamic chunk가 await import() 후 정상 hydrate되는지 검증. boot.spec.ts는
// 4탭을 모두 click하지만, 본 spec은 chunk 로드 lag을 timeout으로 직접 가드.
test.describe('v3.29 T3 dynamic tab load', () => {
  test('cold-start home → archive → stats — 각 navigate 후 chunk 로드 + render', async ({ page }) => {
    await primeOnboardedUser(page, { interests: ['recruiting', 'ai_ml'] });
    await page.addInitScript(() => {
      // boot.spec.ts 패턴: briefings 자동 refresh 차단 (live RSS fetch 회피).
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    });
    await page.goto('/');
    // home 첫 render 확인 (boot 시점 dynamic import home → hydrate)
    await expect(page.locator('#homeTab')).toBeVisible();

    // archive tab click → dynamic chunk 로드 후 #archiveTab 등장
    await page.locator('#bottomNav button[data-tab-id="archive"]').click();
    await expect(page.locator('#archiveTab')).toBeVisible({ timeout: 1500 });

    // stats tab click → dynamic chunk 로드 후 #statsTab 등장
    await page.locator('#bottomNav button[data-tab-id="stats"]').click();
    await expect(page.locator('#statsTab')).toBeVisible({ timeout: 1500 });
  });
});
