import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

/**
 * v3.39 T7 (Codex P1-5) + T8 review (Codex 최종 P1-1): archive currentInterestId 필터 회귀 spec.
 *
 * T8 review fix: navigateToInterestArchive가 더 이상 #archiveSearch prefill +
 * handleArchiveSearch 호출 안 함. applyInterestFilter(id)가 entity filter SoT.
 * 따라서 본 spec은 진짜 exact hit (a-ai-1/a-ai-2 visible) + legacy fallback
 * (a-leg-1 'openai' alias 매칭 visible) + 미스매치 (a-hr-1 absent)를 직접 assert.
 *
 * applyInterestFilter('ai_ml')는 plant-detail / insight-detail nav 진입점 경유.
 * smoke는 production UI 클릭 path만 검증 — 따라서 insight-detail nav chip
 * (archive 탭 내부 .archive-insight-card → modal → .insight-archive-nav-chip)을
 * trigger로 사용한다.
 *
 * 시나리오 3종:
 *  1) exact hit — interestId='ai_ml' answer 2건 visible + interestId='hr_system' absent.
 *  2) legacy fallback — interestId='unknown' answer가 본문 keyword('openai') 매칭으로 visible.
 *  3) reset — search input은 항상 비어 있음 (prefill 제거 후), entity chip 'all' 유지.
 *
 * Fixture:
 *  - primeOnboardedUser(schemaVersion: 2) → migration이 v9로 끌어올림.
 *  - addInitScript에서 user read-merge 후 schemaVersion=9 + insights[] + plantState seed.
 *  - localStorage 'dg.answers'에 v3.39 T2 normalize 통과 answer 4건 seed.
 *
 * Selector 표준 (archive-unified.spec.ts 패턴 차용):
 *  - bottomNav button[data-tab-id="archive"|"stats"]
 *  - .archive-card--answer (renderAnswerCard) — dataset answerId
 *  - .archive-insight-card — dataset insightId
 *  - .insight-archive-nav-chip — bodyNode 내부 button
 */

test.use({ serviceWorkers: 'block' });

const KST_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

async function seedAnswersAndInsight(page: import('@playwright/test').Page): Promise<void> {
  await primeOnboardedUser(page, { interests: ['ai_ml'], schemaVersion: 2, name: 'tester' });
  await page.addInitScript((today) => {
    // user read-merge: v9 필수 필드 보강 + 분야 ai_ml insight 1건.
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
        text: 'AI 도입은 단계적 학습이 필요하다',
        interestId: 'ai_ml',
        createdAt: '2026-05-19T01:00:00Z',
        pinned: false,
      },
    ];
    localStorage.setItem('user', JSON.stringify(user));

    // briefings auto-refresh 억제 (외부 fetch 차단)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');

    // v3.39 T2 normalize 통과 answer 4건 (dg.answers persistence anchor)
    // - a-ai-1, a-ai-2: interestId='ai_ml' (exact hit)
    // - a-hr-1:       interestId='hr_system' (exact mismatch — list에서 제외)
    // - a-leg-1:      interestId='unknown' + 본문에 'openai' (BRAND_ALIASES legacy fallback)
    localStorage.setItem('dg.answers', JSON.stringify([
      {
        id: 'a-ai-1', questionId: 'q1', text: 'AI/ML 첫번째 답변',
        authorId: 'self', createdAt: '2026-05-19T02:00:00Z',
        pinned: false, interestId: 'ai_ml', schemaVersion: 1,
      },
      {
        id: 'a-ai-2', questionId: 'q2', text: 'AI/ML 두번째 답변',
        authorId: 'self', createdAt: '2026-05-19T02:30:00Z',
        pinned: false, interestId: 'ai_ml', schemaVersion: 1,
      },
      {
        id: 'a-hr-1', questionId: 'q3', text: '인사제도 관련 답변',
        authorId: 'self', createdAt: '2026-05-19T03:00:00Z',
        pinned: false, interestId: 'hr_system', schemaVersion: 1,
      },
      {
        id: 'a-leg-1', questionId: 'q4', text: 'openai 사례 학습 정리',
        authorId: 'self', createdAt: '2026-05-19T04:00:00Z',
        pinned: false, interestId: 'unknown', schemaVersion: 1,
      },
    ]));
  }, KST_TODAY);
}

test('v3.39 T7 + T8 review: exact hit — insight-detail nav 후 interestId=ai_ml answer 2건 visible + hr_system absent', async ({ page }) => {
  await seedAnswersAndInsight(page);
  await page.goto('/');

  // 1) archive 탭 진입 + entity=all (default)
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();

  // 사전 시드: 4건 answer 모두 list에 표시 (currentInterestId=null 상태).
  await expect(page.locator('.archive-card--answer')).toHaveCount(4);

  // 2) insight 카드 클릭 → openInsightDetailModal
  // v3.40 T6 (Codex 최종 P1-1): scroll-margin selector 확장만 — fixed-nav pointer-events intercept는 미해결, dispatchEvent F13 carry.
  const insightCard = page.locator('.archive-insight-card[data-insight-id="ins-ai-1"]');
  await insightCard.scrollIntoViewIfNeeded();
  await insightCard.dispatchEvent('click');
  const modal = page.locator('.insight-detail');
  await expect(modal).toBeVisible();

  // 3) nav chip 클릭 → navigateToInterestArchive('ai_ml') → applyInterestFilter('ai_ml')
  await modal.locator('.insight-archive-nav-chip').dispatchEvent('click');

  // closeModal + archive 탭 활성
  await expect(page.locator('.insight-detail')).not.toBeVisible();
  await expect(page.locator('#bottomNav button[data-tab-id="archive"]')).toHaveClass(/active/);

  // v3.39 T8 review (Codex 최종 P1-1): #archiveSearch는 비어 있음 (prefill 제거).
  // applyInterestFilter가 entity filter SoT — currentTokens=[] 상태에서 entityMatchesInterest만 적용.
  await expect(page.locator('#archiveSearch')).toHaveValue('');

  // 4) exact hit — interestId='ai_ml' answer 2건 visible (a-ai-1, a-ai-2).
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-1"]')).toBeVisible();
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-2"]')).toBeVisible();

  // 5) legacy fallback — interestId='unknown' a-leg-1은 본문 'openai' BRAND_ALIAS 매칭으로 visible.
  await expect(page.locator('.archive-card--answer[data-answer-id="a-leg-1"]')).toBeVisible();

  // 6) miss — interestId='hr_system' answer는 entityMatchesInterest false → absent.
  await expect(page.locator('.archive-card--answer[data-answer-id="a-hr-1"]')).toHaveCount(0);
});

test('v3.39 T7 + T8 review: legacy fallback — interestId=unknown answer가 BRAND_ALIAS(openai) 매칭으로 visible', async ({ page }) => {
  await seedAnswersAndInsight(page);
  await page.goto('/');

  // archive 탭 → insight nav → applyInterestFilter('ai_ml')
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  // hydration anchor: archive list 렌더 완료까지 대기 (insight card click handler bind 보장).
  await expect(page.locator('.archive-insight-card[data-insight-id="ins-ai-1"]')).toBeVisible();
  // v3.40 T6 (Codex 최종 P1-1): scroll-margin selector 확장만 — fixed-nav pointer-events intercept는 미해결, dispatchEvent F13 carry.
  const insightCardA = page.locator('.archive-insight-card[data-insight-id="ins-ai-1"]');
  await insightCardA.scrollIntoViewIfNeeded();
  await insightCardA.dispatchEvent('click');
  await expect(page.locator('.insight-detail')).toBeVisible();
  await page.locator('.insight-archive-nav-chip').dispatchEvent('click');

  // closeModal + archive 활성 + search input 비어 있음 (T8 review fix: prefill 제거)
  await expect(page.locator('.insight-detail')).not.toBeVisible();
  await expect(page.locator('#archiveSearch')).toHaveValue('');

  // v3.39 T8 review 핵심: entityMatchesInterest legacy fallback —
  //   interestId='unknown' a-leg-1은 본문 'openai 사례 학습 정리'에 BRAND_ALIAS('openai' ∈ ai_ml) 매칭.
  //   currentTokens=[] 상태이므로 token filter 통과 (length 0 → unconditional).
  await expect(page.locator('.archive-card--answer[data-answer-id="a-leg-1"]')).toBeVisible();

  // exact hit 2건도 동시 visible (자연 동거).
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-1"]')).toBeVisible();
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-2"]')).toBeVisible();

  // 핵심: hr_system answer는 분야 미스매치로 absent.
  await expect(page.locator('.archive-card--answer[data-answer-id="a-hr-1"]')).toHaveCount(0);
});

test('v3.39 T7 + T8 review: state — currentInterestId 유지 중 search 사용자 입력 추가도 entity filter SoT 유지', async ({ page }) => {
  await seedAnswersAndInsight(page);
  await page.goto('/');

  // 1) archive 탭 → insight nav → currentInterestId='ai_ml' set, search input은 비어 있음 (T8 review).
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  // hydration anchor: archive list 렌더 완료까지 대기.
  await expect(page.locator('.archive-insight-card[data-insight-id="ins-ai-1"]')).toBeVisible();
  // v3.40 T6 (Codex 최종 P1-1): scroll-margin selector 확장만 — fixed-nav pointer-events intercept는 미해결, dispatchEvent F13 carry.
  const insightCardB = page.locator('.archive-insight-card[data-insight-id="ins-ai-1"]');
  await insightCardB.scrollIntoViewIfNeeded();
  await insightCardB.dispatchEvent('click');
  await expect(page.locator('.insight-detail')).toBeVisible();
  await page.locator('.insight-archive-nav-chip').dispatchEvent('click');
  await expect(page.locator('#archiveSearch')).toHaveValue('');

  // 2) entity chip 'all' active 유지 (currentEntity는 'all'로 별도 — currentInterestId만 변경됨).
  await expect(page.locator('.archive-entity-chip[data-entity="all"]')).toHaveClass(/active/);

  // 3) 진입 직후 — exact hit 2건 + legacy fallback 1건 visible, hr_system absent.
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-1"]')).toBeVisible();
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-2"]')).toBeVisible();
  await expect(page.locator('.archive-card--answer[data-answer-id="a-leg-1"]')).toBeVisible();
  await expect(page.locator('.archive-card--answer[data-answer-id="a-hr-1"]')).toHaveCount(0);

  // 4) 사용자가 search 추가 입력 (분야 외 token, e.g. '인사') — currentInterestId state는 그대로,
  //    text token 필터 추가 적용. ai_ml 분야 내 어떤 answer text도 '인사' 미포함 → 0건.
  //    엄격 핵심: '인사' literal이 본문에 있는 a-hr-1조차 entity filter 미스매치로 absent — 진짜 entity filter SoT.
  await page.locator('#archiveSearch').fill('인사');
  // v3.40 T11: waitForTimeout 제거 — 직후 toHaveCount expect가 debounce 200ms를 polling으로 자연 흡수.
  await expect(page.locator('#archiveSearch')).toHaveValue('인사', { timeout: 1_000 });

  // hr_system answer는 분야 entity filter로 absent (이름은 'a-hr-1', text='인사제도 관련 답변' — token 매칭만 보면 visible 이어야 하지만 entity filter가 우선).
  await expect(page.locator('.archive-card--answer[data-answer-id="a-hr-1"]')).toHaveCount(0, { timeout: 1_000 });
  // ai_ml exact + legacy entity 통과한 entry도 '인사' token miss로 모두 absent.
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-1"]')).toHaveCount(0);
  await expect(page.locator('.archive-card--answer[data-answer-id="a-ai-2"]')).toHaveCount(0);
});
