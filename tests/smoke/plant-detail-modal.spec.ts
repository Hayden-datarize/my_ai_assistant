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

// v3.36 T3: plant action chip → archive entry (검색어 prefill 제거 — v3.39 T8 review Codex 최종 P1-1)
test('v3.36 + v3.39 T8 review: plant action chip → archive 탭 + #archiveSearch 비어 있음 (entity filter SoT)', async ({ page }) => {
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
  // v3.38 T2 (v3.37 T3 reviewer M-1 흡수): garden-card visibility wait — cold-start race click-before-paint flake 차단.
  const card2 = page.locator('.garden-card[data-interest-id="leadership"]');
  await expect(card2).toBeVisible();
  await card2.click();
  await expect(page.locator('.plant-detail-modal')).toBeVisible();

  // chip click
  await page.locator('.plant-action-chip').click();

  // modal 제거 + archive 탭 활성 + search input 비어 있음 (T8 review: prefill 제거)
  await expect(page.locator('.plant-detail-modal')).not.toBeVisible();
  await expect(page.locator('#bottomNav button[data-tab-id="archive"]')).toHaveClass(/active/);
  // v3.39 T8 review (Codex 최종 P1-1): pickSearchKeyword + #archiveSearch prefill path 제거 —
  // applyInterestFilter('leadership')가 entity filter SoT. 검색 input은 비어 있는 상태 유지.
  await expect(page.locator('#archiveSearch')).toHaveValue('');
});

// v3.47: 시든 식물 재참여 CTA → 홈 탭 이동
test('v3.47: 시든 식물 홈 버튼 → 홈 탭 활성', async ({ page }) => {
  await primeOnboardedUser(page, { interests: ['leadership'], schemaVersion: 4 });
  await page.addInitScript(() => {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return;
    const u = JSON.parse(userRaw);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    u.plantStateByInterest = {
      leadership: { stage: 2, cumulativeActivity: 10, lastEngagedAt: eightDaysAgo },
    };
    u.gardenBackfilled = true;
    u.gardenIntroduced = true;
    localStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="stats"]').click();
  const card = page.locator('.garden-card[data-interest-id="leadership"]');
  await expect(card).toBeVisible();
  await card.click();

  const modal = page.locator('.plant-detail-modal');
  await expect(modal).toBeVisible();
  // 시든 식물 → 홈 버튼 보임
  const homeBtn = page.locator('.plant-action-home-chip');
  await expect(homeBtn).toBeVisible();

  await homeBtn.click();
  // modal 닫힘 + 홈 탭 활성
  await expect(modal).not.toBeVisible();
  await expect(page.locator('#bottomNav button[data-tab-id="home"]')).toHaveClass(/active/);
});

// v3.37 T3: stale filter setup → plant action → entity/filter all reset + #archiveSearch focus 회귀 가드.
// (v3.36 P2-1 + P2-2 carry-forward 청산. T2 reviewer I-2 흡수 — switchTab race + tab-changed listener
//  race end-to-end 검증. Production switchTab은 pendingSwitchToken race guard + dg:nav:tab-changed
//  dispatch + hydrateArchive listener를 동반하므로, unit spec mock으로는 다 cover 못 함.)
test('v3.37: stale filter setup 후 plant action → archive entity/filter all reset + focus', async ({ page }) => {
  // 1) 사전 시드 (test 2 패턴 복제)
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

  // 2) archive 탭 사전 진입 → entity '답변' chip → filter '분석' chip 활성화
  // (Codex 사전 P1-3 정정: production filter 값은 all/분석/전환/실무/성장/트렌드.)
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await page.locator('.archive-entity-chip[data-entity="answer"]').click();
  await expect(page.locator('.archive-entity-chip[data-entity="answer"]')).toHaveClass(/active/);

  // filter chip '분석' 클릭 — production 행동 (UI 클릭으로 사전 setup)
  const filterAnalysis = page.locator('.filter-chip[data-filter="분석"]');
  await filterAnalysis.click();
  await expect(filterAnalysis).toHaveClass(/active/);

  // 3) 정원 (stats 탭) 이동 → 식물 카드 클릭 → modal open
  await page.locator('#bottomNav button[data-tab-id="stats"]').click();
  // v3.38 T2 (v3.37 T3 reviewer M-1 흡수): garden-card visibility wait — cold-start race click-before-paint flake 차단.
  const card3 = page.locator('.garden-card[data-interest-id="leadership"]');
  await expect(card3).toBeVisible();
  await card3.click();
  await expect(page.locator('.plant-detail-modal')).toBeVisible();

  // 4) "📚 이 분야로 archive 탐색" chip 클릭
  await page.locator('.plant-action-chip').click();

  // 5) 검증 — archive 탭 활성 + modal 제거
  await expect(page.locator('#bottomNav button[data-tab-id="archive"]')).toHaveClass(/active/);
  await expect(page.locator('.plant-detail-modal')).not.toBeVisible();

  // entity chip 'all' active + aria-checked='true' (사전 'answer'에서 복귀)
  const entityAll = page.locator('.archive-entity-chip[data-entity="all"]');
  await expect(entityAll).toHaveClass(/active/);
  await expect(entityAll).toHaveAttribute('aria-checked', 'true');

  // 사전 활성화했던 'answer' chip은 inactive로 복귀
  await expect(page.locator('.archive-entity-chip[data-entity="answer"]')).not.toHaveClass(/active/);

  // filter chip 'all' active (사전 '분석'에서 복귀)
  await expect(page.locator('.filter-chip[data-filter="all"]')).toHaveClass(/active/);
  await expect(page.locator('.filter-chip[data-filter="분석"]')).not.toHaveClass(/active/);

  // question type row 표시 (entity='all' 이므로 visible)
  await expect(page.locator('#archiveFilters')).toBeVisible();

  // v3.39 T8 review (Codex 최종 P1-1): search input value는 비어 있음 (prefill 제거), focus는 유지.
  const searchInput = page.locator('#archiveSearch');
  await expect(searchInput).toHaveValue('');
  await expect(searchInput).toBeFocused();
});
