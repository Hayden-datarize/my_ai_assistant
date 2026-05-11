import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

// serviceWorkers 'block': SW가 fetch를 가로채면 page.route Gemini mock이 bypass됨
// (card-translation.spec.ts 동일 패턴 — v3.23 T10 신규 lesson)
test.use({ serviceWorkers: 'block' });

// v3.23 T10: E2 인사이트 카드 happy path smoke
//
// 검증 흐름:
//   1. v6 user seed + apiKey + chat history (user+ai pair) 주입
//   2. Gemini API route mock (generativelanguage.googleapis.com)
//   3. 홈 탭 → #generateInsightBtn 클릭
//   4. .chat-preview-bubble 확인 → 저장(preview-primary) 클릭
//   5. '인사이트 카드 1장 추가' 토스트 확인
//   6. 인사이트 탭 이동 → .insight-card grid 렌더 확인
//   7. 카드 클릭 → .insight-detail-text 모달 확인
//   8. ESC로 모달 닫기
//
// Fixture 전략:
//   - primeOnboardedUser: base user (name/interests/onboardedAt 등 필수 필드)
//   - addInitScript에서 user read-merge: schemaVersion=6 업그레이드 + insights:[]
//   - chat history: KST 오늘 날짜 키(chat_YYYY-MM-DD), user+ai pair 1회 주입
//   - dg_gemini_key: 'test-key' 주입 (getApiKey() 통과)
//   - dg_gemini_usage: 미설정 → count=0 → checkAndIncrementGemini() true
//   - briefings auto-refresh 억제: sessionStorage 'dg.briefings.auto-refresh-tried'=1
//   - 오늘의 질문 seed: dg.todayQuestion.{today} (API 호출 없이 렌더)
//
// TZ: getKstDateStr() 패턴 — Intl.DateTimeFormat KST (v3.14.4 lesson #5 graduated)

test('E2 인사이트 카드 happy path: chat → 생성 → 저장 → 인사이트 탭 grid → detail 모달', async ({ page }) => {
  // 1. base user seed (필수 필드 주입)
  await primeOnboardedUser(page, { interests: ['ai_ml'], schemaVersion: 2 });

  // 2. v6 업그레이드 + chat history + apiKey seed
  await page.addInitScript(() => {
    // KST 오늘 날짜 (v3.14.4 T3 패턴: Intl.DateTimeFormat — TZ-safe)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

    // primeOnboardedUser 설정된 user를 read-merge: v6 필수 필드 추가
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    // schemaVersion 6 필드 추가
    user.schemaVersion = 6;
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
    user.insights = [];   // v6 신규 필드 — 빈 배열로 시작
    localStorage.setItem('user', JSON.stringify(user));

    // chat history: KST 오늘 날짜 키 (loadChatHistory(today) 가 `chat_${today}` 읽음)
    const chatKey = `chat_${today}`;
    localStorage.setItem(chatKey, JSON.stringify([
      { role: 'user', text: '오늘 채용 전형에서 배운 점이 있어요', at: Date.now() - 60000 },
      { role: 'ai',   text: '좋은 경험이네요. 어떤 점이 가장 인상 깊었나요?', at: Date.now() - 30000 },
    ]));

    // API key (getApiKey() 통과)
    localStorage.setItem('dg_gemini_key', 'test-key');

    // 오늘의 질문 seed → hydrateQuestion이 API 호출 없이 렌더
    localStorage.setItem(
      `dg.todayQuestion.${today}`,
      JSON.stringify({
        type: '성찰',
        question: '오늘 가장 의미 있었던 순간은?',
        hint: '구체적인 상황을 떠올려 보세요.',
      }),
    );

    // briefings auto-refresh 억제 (RSS 실제 호출 방지)
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });

  // 3. Gemini API mock (generativelanguage.googleapis.com — generateText 경로)
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: '오늘 대화의 통찰: 작은 도전이 큰 변화를 만든다' }],
          },
        }],
      }),
    });
  });

  // 4. 홈 탭 진입
  await page.goto('/');

  // hydrateChatHistory가 chat history를 렌더 → #chatContainer.show 추가
  // #generateInsightBtn이 홈 탭 DOM에 렌더되길 대기
  await expect(page.locator('#generateInsightBtn')).toBeVisible({ timeout: 10_000 });

  // 5. 인사이트 카드 만들기 클릭
  await page.locator('#generateInsightBtn').click();

  // 6. chat preview bubble 확인 (Gemini mock 응답 텍스트)
  await expect(page.locator('.chat-preview-bubble')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.chat-preview-bubble')).toContainText('작은 도전');

  // 7. 저장 버튼 클릭 (onPrimary: saveUser + dispatch dg:insights:added + showToast)
  await page.locator('.chat-preview-bubble .preview-primary').click();

  // 8. 토스트 확인 ('인사이트 카드 1장 추가')
  await expect(page.getByText('인사이트 카드 1장 추가')).toBeVisible({ timeout: 3_000 });

  // v3.27 T2a/T2b: 인사이트 탭 폐기 → archive entity chip 'insight'.
  // 9. archive 탭 이동
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  // 9b. entity chip 'insight' 선택
  await page.locator('.archive-entity-chip[data-entity="insight"]').click();

  // 10. .archive-insight-card에 방금 저장한 카드 렌더 확인
  await expect(page.locator('.archive-insight-card').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.archive-insight-card').first()).toContainText('작은 도전');

  // 11. 카드 클릭 → insight detail 모달
  await page.locator('.archive-insight-card').first().click();
  await expect(page.locator('.insight-detail-text')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('.insight-detail-text')).toContainText('작은 도전');

  // 12. ESC로 모달 닫기
  await page.keyboard.press('Escape');
  await expect(page.locator('.insight-detail-text')).not.toBeVisible({ timeout: 2_000 });
});
