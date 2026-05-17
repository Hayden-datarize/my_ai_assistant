import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

// v3.21 T10: Plant detail modal smoke test.
// stats 탭의 garden card 클릭 → plant-detail modal 가 열리고 Standard 콘텐츠
// (stage label / counts) 가 표시된다. Esc 누르면 닫힌다.
//
// Fixture 전략 (사전 review P0-5 fix):
//  - primeOnboardedUser(schemaVersion: 4): production read key 'user' + name 필수.
//  - addInitScript로 plantStateByInterest + gardenBackfilled=true read-merge.
//    backfillGarden(user) 가 가짜 stage=1로 덮어쓰는 것을 차단 (gardenBackfilled gate).
//  - briefings auto-refresh 억제 (RSS 호출 차단, v3.15-garden / v3.13-missions 패턴).
//
// Selector 표준 (v3.15-garden.spec.ts 패턴):
//  - stats 탭: '#bottomNav button[data-tab-id="stats"]' (getByRole('tab') 미사용 — bottom nav는 button 요소).

test.use({ serviceWorkers: 'block' });

test('plant-detail modal opens and shows Standard content', async ({ page }) => {
  // 1) onboarded user with leadership interest + plantState seed
  await primeOnboardedUser(page, { interests: ['leadership'], schemaVersion: 4 });
  await page.addInitScript(() => {
    // primeOnboardedUser 가 set 한 user 를 read-merge — plant 관련 필드만 추가.
    // production read key 는 'user' (src/state/user.ts:39 const KEY = 'user').
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return;
    const u = JSON.parse(userRaw);
    u.plantStateByInterest = {
      leadership: {
        stage: 2,
        cumulativeActivity: 10,
        lastEngagedAt: new Date().toISOString(),
      },
    };
    u.gardenBackfilled = true;   // backfillGarden 차단 (idempotent gate)
    u.gardenIntroduced = true;   // 환영 모달 억제 (helper default true 이지만 명시)
    localStorage.setItem('user', JSON.stringify(u));

    // briefings auto-refresh 억제 (RSS 실제 호출 방지)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });

  await page.goto('/');

  // 2) stats 탭 이동 — bottom nav 버튼 (v3.15-garden.spec.ts 패턴 차용).
  await page.locator('#bottomNav button[data-tab-id="stats"]').click();

  // 3) garden card 클릭
  const card = page.locator('.garden-card[data-interest-id="leadership"]');
  await expect(card).toBeVisible();
  await card.click();

  // 4) modal Standard 콘텐츠 검증
  const modal = page.locator('.plant-detail-modal');
  await expect(modal).toBeVisible();
  // stage label (1~5 중 하나 — seed stage=2 → '새싹')
  await expect(modal).toContainText(/씨앗|새싹|줄기|봉오리|만개/);
  // counts: "N개 답변 · M개 스크랩"
  await expect(modal).toContainText(/개 답변/);
  await expect(modal).toContainText(/개 스크랩/);

  // 5) Esc → modal close (closeModal 이 element 를 detach 함 → not visible)
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
});

// v3.36 T3: plant action chip → archive 검색어 prefill (Codex Coverage Gap 흡수)
test('v3.36: plant action chip → archive 탭 + 검색어 prefill', async ({ page }) => {
  await primeOnboardedUser(page, { interests: ['leadership'], schemaVersion: 4 });
  await page.addInitScript(() => {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return;
    const u = JSON.parse(userRaw);
    u.plantStateByInterest = {
      leadership: { stage: 2, cumulativeActivity: 10, lastEngagedAt: new Date().toISOString() },
    };
    u.gardenBackfilled = true;
    u.gardenIntroduced = true;
    localStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="stats"]').click();
  await page.locator('.garden-card[data-interest-id="leadership"]').click();
  await expect(page.locator('.plant-detail-modal')).toBeVisible();

  // chip click
  await page.locator('.plant-action-chip').click();

  // modal 제거 + archive 탭 활성 + search input prefill
  await expect(page.locator('.plant-detail-modal')).not.toBeVisible();
  await expect(page.locator('#bottomNav button[data-tab-id="archive"]')).toHaveClass(/active/);
  await expect(page.locator('#archiveSearch')).toHaveValue('리더십');
});
