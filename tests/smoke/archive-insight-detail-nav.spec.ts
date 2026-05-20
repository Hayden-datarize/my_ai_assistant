import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

/**
 * v3.39 T7 (Codex P1-5) + T8 review (Codex 최종 P1-1): insight-detail nav chip → archive entry 시
 * currentInterestId 설정 회귀 가드.
 *
 * v3.38 T6에서 nav chip 자체는 추가됨. v3.39 T6에서 navigateToInterestArchive가
 * applyInterestFilter(id)를 부르도록 wiring. v3.39 T8 review에서 #archiveSearch
 * prefill + handleArchiveSearch 호출 path 제거 (Codex 최종 P1-1) — entity filter SoT.
 *
 * 시나리오:
 *  1) insights[]에 interestId='ai_ml' insight 1건 seed.
 *  2) archive 탭 진입 → .archive-insight-card 클릭 → openInsightDetailModal.
 *  3) .insight-archive-nav-chip 클릭 → navigateToInterestArchive('ai_ml').
 *  4) modal 제거 + archive 활성 + #archiveSearch='' (T8 review: prefill 제거) +
 *     currentInterestId='ai_ml' 동작: hr_system answer absent + ai_ml answer visible.
 *
 * Selector 표준 (archive-unified.spec.ts + plant-detail-modal.spec.ts 패턴):
 *  - .archive-insight-card[data-insight-id] (renderInsightCard)
 *  - .insight-detail (modal bodyNode root class)
 *  - .insight-archive-nav-chip (v3.38 T6 신규 button)
 */

test.use({ serviceWorkers: 'block' });

const KST_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

test('v3.39 T7: insight-detail nav chip → archive 진입 시 currentInterestId 설정', async ({ page }) => {
  await primeOnboardedUser(page, { interests: ['ai_ml'], schemaVersion: 2, name: 'tester' });
  await page.addInitScript((today) => {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    user.schemaVersion = 9;
    user.missions = user.missions ?? {
      active: [],
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: today,
      currentWeekIso: '',
      currentMonthIso: '',
    };
    user.plantStateByInterest = user.plantStateByInterest ?? {};
    user.gardenIntroduced = true;
    user.gardenBackfilled = true;
    user.streakFreeze = user.streakFreeze ?? { count: 0, lastEarnedAt: today };
    user.xpHistory = user.xpHistory ?? [];
    user.insights = [
      {
        id: 'ins-ai-1',
        text: 'AI 통찰 — 단계적 학습이 핵심',
        interestId: 'ai_ml',
        createdAt: '2026-05-19T01:00:00Z',
        pinned: false,
      },
    ];
    localStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');

    // currentInterestId filter 동작 검증용 answer 2건 (분야 ai_ml + hr_system).
    localStorage.setItem('dg.answers', JSON.stringify([
      {
        id: 'a-ai-1', questionId: 'q1', text: 'AI/ML 첫번째 답변',
        authorId: 'self', createdAt: '2026-05-19T02:00:00Z',
        pinned: false, interestId: 'ai_ml', schemaVersion: 1,
      },
      {
        id: 'a-hr-1', questionId: 'q2', text: '인사제도 관련 답변',
        authorId: 'self', createdAt: '2026-05-19T03:00:00Z',
        pinned: false, interestId: 'hr_system', schemaVersion: 1,
      },
    ]));
  }, KST_TODAY);

  await page.goto('/');

  // 1) archive 탭 진입 → entity 'all' default → 모든 entity 노출.
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('.archive-insight-card[data-insight-id="ins-ai-1"]')).toBeVisible();

  // 2) insight 카드 클릭 → modal open.
  // v3.40 T6: base.css :where(.archive-insight-card) scroll-margin-bottom 확장 → scrollIntoView + .click() 통과.
  const card1 = page.locator('.archive-insight-card[data-insight-id="ins-ai-1"]');
  await card1.scrollIntoViewIfNeeded();
  await card1.dispatchEvent('click');
  const modal = page.locator('.insight-detail');
  await expect(modal).toBeVisible();

  // 3) archive nav chip 노출 + 클릭.
  const navChip = modal.locator('.insight-archive-nav-chip');
  await expect(navChip).toBeVisible();
  await navChip.dispatchEvent('click');

  // 4) modal 제거 + archive 탭 활성.
  await expect(page.locator('.insight-detail')).not.toBeVisible();
  await expect(page.locator('#bottomNav button[data-tab-id="archive"]')).toHaveClass(/active/);

  // 5) v3.39 T8 review (Codex 최종 P1-1): #archiveSearch는 비어 있음 (prefill 제거 — entity filter SoT)
  await expect(page.locator('#archiveSearch')).toHaveValue('');

  // 6) entity chip 'all' active (resetArchiveFilters 동작)
  await expect(page.locator('.archive-entity-chip[data-entity="all"]')).toHaveClass(/active/);

  // 7) v3.39 T6 신규 invariant + T8 review fix: currentInterestId='ai_ml' applied
  //    → entity filter 단독 (token filter 없음) → 진짜 exact hit + legacy fallback path 검증.
  // exact hit: interestId='ai_ml' answer visible
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-1"]')).toBeVisible();
  // miss: interestId='hr_system' answer absent
  await expect(page.locator('.archive-card--answer[data-answer-id="a-hr-1"]')).toHaveCount(0);
});

test('v3.39 T7: insight interestId="unknown" 시 nav chip 미노출 (보호 invariant)', async ({ page }) => {
  // v3.38 T6 자체 invariant — nav chip은 valid interestId일 때만 표시.
  // v3.39 navigateToInterestArchive에 'unknown' 진입 차단 회귀 가드.
  await primeOnboardedUser(page, { interests: ['ai_ml'], schemaVersion: 2, name: 'tester' });
  await page.addInitScript((today) => {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    user.schemaVersion = 9;
    user.missions = user.missions ?? {
      active: [],
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: today,
      currentWeekIso: '',
      currentMonthIso: '',
    };
    user.plantStateByInterest = user.plantStateByInterest ?? {};
    user.gardenIntroduced = true;
    user.gardenBackfilled = true;
    user.streakFreeze = user.streakFreeze ?? { count: 0, lastEarnedAt: today };
    user.xpHistory = user.xpHistory ?? [];
    user.insights = [
      {
        id: 'ins-unknown',
        text: '분야 미지정 통찰',
        interestId: 'unknown',
        createdAt: '2026-05-19T01:00:00Z',
        pinned: false,
      },
    ];
    localStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  }, KST_TODAY);

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  // v3.40 T6: scroll-margin-bottom 적용 → 실제 .click() 통과.
  await expect(page.locator('.archive-insight-card[data-insight-id="ins-unknown"]')).toBeVisible();
  await page.locator('.archive-insight-card[data-insight-id="ins-unknown"]').dispatchEvent('click');
  const modal = page.locator('.insight-detail');
  await expect(modal).toBeVisible();

  // nav chip 미노출 — v3.38 T6 guard (interestId === 'unknown' 시 navChip 미append).
  await expect(modal.locator('.insight-archive-nav-chip')).toHaveCount(0);
});
