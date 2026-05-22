/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { maybeShowWelcomeGarden } from '../../src/ui/modals/welcome-garden';
import { maybeShowWelcomeGamification } from '../../src/ui/modals/welcome-gamification';
import { saveUser } from '../../src/state/user';
import { saveAnswers } from '../../src/state/persistence';
import { mkUser } from './state/userFixture';

/**
 * v3.50 T3 M4 — glassmorphism welcome modal wrappers carry `.modal-glass`.
 *
 * Spec contract:
 *   1. `.welcome-garden-modal` wrapper에 `modal-glass` class 부착
 *   2. `.welcome-game` wrapper에 `modal-glass` class 부착
 *
 * Class 부착 검증이 핵심 — `@supports` color-mix/backdrop-filter 가드는
 * jsdom에서 평가 불가 (computed style은 가드 없는 fallback 반환). plan 의도
 * 보존: wrapper에 토큰 class 부착되었는지만 assert.
 */

beforeEach(() => {
  localStorage.clear();
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
  document.body.innerHTML = '<div id="modalRoot"></div>';
});

describe('M4 glassmorphism — welcome wrappers carry .modal-glass', () => {
  it('welcome-garden modal wrapper has .modal-glass class', () => {
    // gardenIntroduced=false + 식물 1개 → 모달 노출 조건
    localStorage.setItem('user', JSON.stringify({
      name: 'h',
      interests: ['ai_ml'],
      onboardedAt: '2026-01-01',
      streak: 0,
      lastActiveDate: '',
      xp: 0,
      earnedBadges: {},
      gamificationMigrated: true,
      schemaVersion: 4,
      missions: {
        active: [],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '',
        currentWeekIso: '',
        currentMonthIso: '',
      },
      plantStateByInterest: { ai_ml: { stage: 1, cumulativeActivity: 0 } },
      gardenIntroduced: false,
      gardenBackfilled: true,
    }));
    maybeShowWelcomeGarden();
    const wrap = document.querySelector('.welcome-garden-modal');
    expect(wrap).not.toBeNull();
    expect(wrap?.classList.contains('modal-glass')).toBe(true);
  });

  it('welcome-gamification modal wrapper has .modal-glass class', async () => {
    saveUser(mkUser({ interests: ['AI'], streak: 5, xp: 100 }));
    saveAnswers([{
      id: '1', questionId: 'q', text: 'a', authorId: 'self',
      createdAt: '2026-04-01', pinned: false, schemaVersion: 1, interestId: 'unknown',
    }]);
    await maybeShowWelcomeGamification();
    const wrap = document.querySelector('.welcome-game');
    expect(wrap).not.toBeNull();
    expect(wrap?.classList.contains('modal-glass')).toBe(true);
  });
});
