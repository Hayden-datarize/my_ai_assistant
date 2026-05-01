import { test, expect } from '@playwright/test';

// v3.13 Mission System smoke tests.
// Two paths that jsdom (vitest) cannot cover:
//  sw1: 홈 진입 → daily-answer-1 미션 카드 → 답변 제출 → .mission-card--completed + ✓
//  sw2: 홈 진입 → monthly-answers-20 미션 카드 → 답변 제출 → progress bar 1/20
//
// Fixture 전략:
//  - lastDailySeed = today KST: daily regen 방지
//  - currentMonthIso = today KST month: monthly regen 방지 (sw2)
//  - currentWeekIso = '': weekly는 항상 regenerate (허용 — 테스트와 무관)
//
// 미션 섹션은 hydrateHome + submitAnswer 후 hydrateMissions()로 즉시 갱신된다 (T12 wiring).

/**
 * KST 기준 오늘 날짜 'YYYY-MM-DD' 를 브라우저에서 계산하는 스니펫.
 * addInitScript 내부에서 사용 (window 환경).
 */
function kstTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

// sw1 답변 제출에 필요한 최소 텍스트 (10자 이상)
const ANSWER_TEXT = 'v3.13 미션 smoke test 답변입니다.';

test.describe('v3.13 Mission System', () => {
  test('sw1: daily-answer-1 답변 1개 → .mission-card--completed + ✓', async ({ page }) => {
    await page.addInitScript(() => {
      // 브라우저 컨텍스트에서 KST 오늘 날짜 계산
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

      const user = {
        name: 'Smoke',
        interests: ['ai_ml'],
        onboardedAt: 1,
        streak: 0,
        lastActiveDate: '',
        xp: 0,
        earnedBadges: {},
        gamificationMigrated: true,
        schemaVersion: 3,
        missions: {
          // daily-answer-1만 active에 직접 주입 (target=1, 답변 1회로 완수)
          active: [
            { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
          ],
          cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
          // lastDailySeed = today → daily regen 차단 (seeded mission 유지)
          lastDailySeed: today,
          // weekly/monthly는 regenerate 허용 (이 테스트는 daily만 검증)
          currentWeekIso: '',
          currentMonthIso: '',
        },
      };
      localStorage.setItem('user', JSON.stringify(user));

      // 오늘의 질문 seed → hydrateQuestion이 API 호출 없이 렌더
      localStorage.setItem(
        `dg.todayQuestion.${today}`,
        JSON.stringify({
          type: '분석',
          question: '오늘 가장 인상 깊었던 순간은?',
          hint: '구체적인 상황을 떠올려 보세요.',
        }),
      );

      // briefings auto-refresh 억제 (RSS 실제 호출 방지)
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    });

    await page.goto('/');

    // T5 이후 미션은 홈에 렌더되지 않음 → 답변 제출 후 미션 탭에서 검증
    // 답변 입력 후 제출 (홈 탭 그대로)
    const textarea = page.locator('#answerArea');
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.fill(ANSWER_TEXT);
    await page.locator('#submitBtn').click();
    await page.waitForTimeout(300); // submit 후 sweep + state save 대기

    // 미션 탭으로 이동 → hydrateMissions() 호출 + #missionsSection 가시
    await page.locator('.bottom-nav .nav-item', { hasText: '미션' }).click();
    await expect(page.locator('#missionsSection')).toBeVisible({ timeout: 10_000 });

    // seeded daily-answer-1 카드는 제출 후 completed 상태
    const dailyCard = page.locator('[data-period="daily"] .mission-card');
    await expect(dailyCard).toHaveCount(1);

    // hydrateMissions() → 미션 카드가 즉시 completed로 전환됨
    await expect(page.locator('.mission-card--completed')).toHaveCount(1, { timeout: 3000 });
    await expect(page.locator('.mission-card__check')).toHaveText('✓');
  });

  test('sw2: monthly-answers-20 답변 1개 → progress bar 1/20', async ({ page }) => {
    await page.addInitScript(() => {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
      const today = fmt.format(new Date());          // 'YYYY-MM-DD'
      const thisMonth = today.slice(0, 7);           // 'YYYY-MM'

      const user = {
        name: 'Smoke',
        interests: ['ai_ml'],
        onboardedAt: 1,
        streak: 0,
        lastActiveDate: '',
        xp: 0,
        earnedBadges: {},
        gamificationMigrated: true,
        schemaVersion: 3,
        missions: {
          // monthly-answers-20만 active에 주입 (target=20, 답변 1회 → progress 1)
          active: [
            { defId: 'monthly-answers-20', period: 'monthly', windowStart: 0, progress: 0, completed: false },
          ],
          cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
          // daily regen 차단 (daily 미션이 추가돼도 무방하지만, 테스트 격리를 위해 차단)
          lastDailySeed: today,
          // weekly regen 허용
          currentWeekIso: '',
          // currentMonthIso = thisMonth → monthly regen 차단 (seeded mission 유지)
          currentMonthIso: thisMonth,
        },
      };
      localStorage.setItem('user', JSON.stringify(user));

      localStorage.setItem(
        `dg.todayQuestion.${today}`,
        JSON.stringify({
          type: '분석',
          question: '이번 달 가장 잘한 일은?',
          hint: '한 가지를 골라 구체적으로 써보세요.',
        }),
      );

      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
    });

    await page.goto('/');

    // T5 이후 미션은 홈에 렌더되지 않음 → 답변 제출 후 미션 탭에서 검증
    // 답변 제출 (홈 탭 그대로)
    const textarea = page.locator('#answerArea');
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.fill(ANSWER_TEXT);
    await page.locator('#submitBtn').click();
    await page.waitForTimeout(300); // submit 후 sweep + state save 대기

    // 미션 탭으로 이동 → hydrateMissions() 호출 + #missionsSection 가시
    await page.locator('.bottom-nav .nav-item', { hasText: '미션' }).click();
    await expect(page.locator('#missionsSection')).toBeVisible({ timeout: 10_000 });

    // hydrateMissions() → progress 1/20 반영
    const pb = page.locator('[data-period="monthly"] [role="progressbar"]');
    await expect(pb).toBeVisible({ timeout: 5000 });
    await expect(pb).toHaveAttribute('aria-valuenow', '1', { timeout: 3000 });
    await expect(pb).toHaveAttribute('aria-valuemax', '20');
    await expect(page.locator('[data-period="monthly"] .mission-card__count')).toHaveText('1/20');
  });
});
