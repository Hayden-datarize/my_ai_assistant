import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

/**
 * v3.39 T7 (Codex P1-5) + T8 review (Codex 최종 P1-1): plant-detail action chip → archive entry 시
 * currentInterestId 설정 + #archiveSearch reset(prefill 제거) 회귀 가드.
 *
 * v3.39 T8 review fix: navigateToInterestArchive가 더 이상 #archiveSearch prefill +
 * handleArchiveSearch 호출 안 함. applyInterestFilter(id)가 entity filter SoT.
 * 따라서 본 spec은 action chip → archive 진입 후 search input이 비어 있고,
 * currentInterestId='leadership' state 단독으로 hr_system answer가 absent임을 검증.
 *
 * 시나리오:
 *  1) stale 분야 필터 사전 setup (다른 interestId answer로 list 오염 가능 상태).
 *  2) stats 탭 → 정원 카드 클릭 → plant-detail modal open.
 *  3) action chip 클릭 → applyInterestFilter(leadership) (검색어 prefill 없음).
 *  4) archive 탭 활성 + entity chip 'all' active + #archiveSearch='' + hr_system answer absent.
 */

test.use({ serviceWorkers: 'block' });

const KST_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

test('v3.39 T7: plant action chip → archive 진입 시 currentInterestId 설정 + 검색어 prefill', async ({ page }) => {
  await primeOnboardedUser(page, { interests: ['leadership'], schemaVersion: 4 });
  await page.addInitScript((today) => {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return;
    const u = JSON.parse(userRaw);
    u.plantStateByInterest = {
      leadership: { stage: 2, cumulativeActivity: 10, lastEngagedAt: new Date().toISOString() },
    };
    u.gardenBackfilled = true;
    u.gardenIntroduced = true;
    localStorage.setItem('user', JSON.stringify(u));

    // briefings auto-refresh 억제
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');

    // v3.39 T7 NEW: hr_system answer seed — currentInterestId='leadership' filter 시 list에서 절대 안 보여야 함.
    localStorage.setItem('dg.answers', JSON.stringify([
      {
        id: 'a-leader-1', questionId: 'q1', text: '리더십 관련 답변',
        authorId: 'self', createdAt: '2026-05-19T01:00:00Z',
        pinned: false, interestId: 'leadership', schemaVersion: 1,
      },
      {
        id: 'a-hr-1', questionId: 'q2', text: '인사제도 관련 답변',
        authorId: 'self', createdAt: '2026-05-19T02:00:00Z',
        pinned: false, interestId: 'hr_system', schemaVersion: 1,
      },
    ]));
    void today;
  }, KST_TODAY);

  await page.goto('/');

  // 1) stale filter setup — archive 사전 진입 → 다른 검색어 입력해 currentInterestId/검색 state 오염.
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await page.locator('#archiveSearch').fill('인사');
  await page.waitForTimeout(300); // debounce 200ms + margin

  // 2) stats 탭 → 정원 카드 클릭 → plant-detail modal open.
  //    bottomNav fixed overlay 회피: dispatchEvent('click') (v3.39 T7 P1-5 fix)
  await page.locator('#bottomNav button[data-tab-id="stats"]').click();
  const card = page.locator('.garden-card[data-interest-id="leadership"]');
  await expect(card).toBeVisible();
  await card.dispatchEvent('click');
  await expect(page.locator('.plant-detail-modal')).toBeVisible();

  // 3) action chip click → navigateToInterestArchive('leadership')
  //    → resetArchiveFilters() + applyInterestFilter('leadership') (검색어 prefill 없음 — T8 review)
  await page.locator('.plant-action-chip').dispatchEvent('click');

  // 4) modal 제거 + archive 탭 활성
  await expect(page.locator('.plant-detail-modal')).not.toBeVisible();
  await expect(page.locator('#bottomNav button[data-tab-id="archive"]')).toHaveClass(/active/);

  // 5) v3.39 T8 review (Codex 최종 P1-1): #archiveSearch는 비어 있음 (prefill 제거 — entity filter SoT)
  await expect(page.locator('#archiveSearch')).toHaveValue('');

  // 6) entity chip 'all' active (resetArchiveFilters 동작)
  await expect(page.locator('.archive-entity-chip[data-entity="all"]')).toHaveClass(/active/);

  // 7) v3.39 T6 신규 invariant + T8 review fix: currentInterestId='leadership' 적용 → hr_system answer absent.
  //    이제 진짜 entity filter 단독 (token filter 없음) — 본문 매칭 우회로 인한 false negative 차단.
  await expect(page.locator('.archive-card--answer[data-answer-id="a-hr-1"]')).toHaveCount(0);

  // 8) v3.39 T8 review: 같은 분야(leadership) answer는 visible — entity filter SoT 정합 검증.
  await expect(page.locator('.archive-card--answer[data-answer-id="a-leader-1"]')).toBeVisible();
});

test('v3.39 T7 + T8 review: plant action 진입 직전 stale #archiveSearch가 reset 후 빈 문자열로 정리됨', async ({ page }) => {
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

  // archive 탭 사전 진입 + stale 검색어 '오래된검색' 입력
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await page.locator('#archiveSearch').fill('오래된검색');
  await page.waitForTimeout(300);
  await expect(page.locator('#archiveSearch')).toHaveValue('오래된검색');

  // stats 진입 → 식물 카드 → modal → action chip
  await page.locator('#bottomNav button[data-tab-id="stats"]').click();
  const card2 = page.locator('.garden-card[data-interest-id="leadership"]');
  await expect(card2).toBeVisible();
  await card2.dispatchEvent('click');
  await expect(page.locator('.plant-detail-modal')).toBeVisible();
  await page.locator('.plant-action-chip').dispatchEvent('click');

  // v3.39 T8 review (Codex 최종 P1-1): 검색어가 '오래된검색' → '' (비어 있음)으로 정리.
  //   sequence: resetArchiveFilters (input.value='') → applyInterestFilter (input.value='') →
  //             switchTab → focus only (prefill 제거)
  await expect(page.locator('#archiveSearch')).toHaveValue('');
});
