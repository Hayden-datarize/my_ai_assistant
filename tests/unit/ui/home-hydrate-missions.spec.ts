import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * v3.13.1 T9 / P2-1: hydrateMissions saveUser Quota 토스트.
 *
 * Background: hydrateMissions 는 lazy regen이 발생한 경우 saveUser(u)를 호출.
 * v3.7 이후 saveUser는 throw 정책이라 try/catch 없으면 UI 흐름이 끊긴다.
 * 토스트로 surface + render는 계속 진행 (active는 in-memory mutate된 상태).
 *
 * Toast 검증 패턴: applyAnswerActivity 회귀 spec(home-answer-save-error.spec.ts)
 * 과 동일하게 `.toast` DOM element 확인. showToast 가 modalRoot 또는 body 에
 * `.toast-container > .toast` 를 append.
 */
describe('home — hydrateMissions Quota guard (v3.13.1 T9 / P2-1)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modalRoot';
    const missionsContainer = document.createElement('div');
    missionsContainer.id = 'missionsContainer';
    document.body.append(modalRoot, missionsContainer);
    vi.setSystemTime(new Date('2026-05-01T03:00:00Z'));   // KST 12:00, lazy regen 발동 보장
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function seedUser(): void {
    // v3 user with empty missions — getActiveMissions가 lazy regen → dirty=true
    const user = {
      name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-19',
      streak: 0, lastActiveDate: '', xp: 0,
      earnedBadges: {}, gamificationMigrated: true, schemaVersion: 3,
      missions: {
        active: [],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '',
        currentWeekIso: '',
        currentMonthIso: '',
      },
    };
    localStorage.setItem('user', JSON.stringify(user));
  }

  it('saveUser 실패 시 Quota 토스트 표시 + 렌더는 진행 (silent throw 차단)', async () => {
    seedUser();
    const original = localStorage.getItem('user')!;

    // 'user' 키에 대한 setItem만 throw — getCachedUser 의 lazy migrate setItem은
    // try/catch로 swallow하므로 hydrateMissions 의 saveUser 만 surface된다.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === 'user' && value !== original) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
    });

    const { hydrateMissions } = await import('../../../src/ui/handlers/home');

    expect(() => hydrateMissions()).not.toThrow();

    const toast = document.querySelector('.toast');
    expect(toast?.textContent).toContain('저장 공간이 가득 찼어요');

    // saveUser 실패해도 active는 in-memory mutate된 상태 → 렌더는 진행
    const cards = document.querySelectorAll('#missionsContainer .mission-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('정상 path: lazy regen + saveUser 성공 시 토스트 없음', async () => {
    seedUser();

    const { hydrateMissions } = await import('../../../src/ui/handlers/home');
    hydrateMissions();

    expect(document.querySelector('.toast')).toBeNull();
    expect(document.querySelectorAll('#missionsContainer .mission-card').length).toBeGreaterThan(0);
  });
});
