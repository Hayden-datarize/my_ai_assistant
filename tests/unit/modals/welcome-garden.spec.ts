import { describe, it, expect, beforeEach, vi } from 'vitest';
import { maybeShowWelcomeGarden } from '../../../src/ui/modals/welcome-garden';

// switchTab / scrollToGardenSection mock
// v3.29 T3: switchTab is async (dynamic import) — return resolved Promise so .then() works.
vi.mock('../../../src/ui/nav', () => ({ switchTab: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../src/ui/handlers/stats-shared', () => ({ scrollToGardenSection: vi.fn() }));

function setUser(opts: { gardenIntroduced: boolean; plants?: Record<string, { stage: number; cumulativeActivity: number }> }): void {
  localStorage.setItem('user', JSON.stringify({
    name: 'h',
    interests: Object.keys(opts.plants ?? {}),
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
    plantStateByInterest: opts.plants ?? {},
    gardenIntroduced: opts.gardenIntroduced,
    gardenBackfilled: true,
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.body.textContent = '';
  vi.clearAllMocks();
});

describe('maybeShowWelcomeGarden', () => {
  it('gardenIntroduced false → 모달 노출', () => {
    setUser({ gardenIntroduced: false, plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } } });
    maybeShowWelcomeGarden();
    expect(document.querySelector('.welcome-garden-modal')).toBeTruthy();
  });

  it('gardenIntroduced true → 모달 미노출 (idempotent)', () => {
    setUser({ gardenIntroduced: true });
    maybeShowWelcomeGarden();
    expect(document.querySelector('.welcome-garden-modal')).toBeFalsy();
  });

  it('backfill highlight — 가장 큰 stage 식물 명시', () => {
    setUser({
      gardenIntroduced: false,
      plants: {
        ai_ml: { stage: 4, cumulativeActivity: 100 },
        data: { stage: 2, cumulativeActivity: 15 },
      },
    });
    maybeShowWelcomeGarden();
    const modal = document.querySelector('.welcome-garden-modal');
    // ai_ml → 'AI/ML', stage 4 → '봉오리'
    expect(modal?.querySelector('.welcome-garden-highlight')?.textContent).toContain('AI/ML');
    expect(modal?.querySelector('.welcome-garden-highlight')?.textContent).toContain('봉오리');
  });

  it('newcomer (모든 식물 stage 1, cum 0) → "씨앗부터 시작해요"', () => {
    setUser({
      gardenIntroduced: false,
      plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } },
    });
    maybeShowWelcomeGarden();
    const modal = document.querySelector('.welcome-garden-modal');
    expect(modal?.querySelector('.welcome-garden-newcomer')?.textContent).toContain('씨앗부터');
  });

  it('닫기 버튼 → 모달 제거 + gardenIntroduced 셋', () => {
    setUser({ gardenIntroduced: false, plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } } });
    maybeShowWelcomeGarden();
    document.querySelector<HTMLButtonElement>('#welcomeGardenCloseBtn')?.click();
    expect(document.querySelector('.welcome-garden-modal')).toBeFalsy();
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.gardenIntroduced).toBe(true);
  });

  it('ESC → 모달 제거 + flag 셋', () => {
    setUser({ gardenIntroduced: false, plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } } });
    maybeShowWelcomeGarden();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.welcome-garden-modal')).toBeFalsy();
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.gardenIntroduced).toBe(true);
  });

  it('"정원 보러 가기" → switchTab(stats) 호출', async () => {
    const { switchTab } = await import('../../../src/ui/nav');
    setUser({ gardenIntroduced: false, plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } } });
    maybeShowWelcomeGarden();
    document.querySelector<HTMLButtonElement>('#welcomeGardenViewBtn')?.click();
    expect(switchTab).toHaveBeenCalledWith('stats');
  });

  it('user 없음 → no-op', () => {
    expect(() => maybeShowWelcomeGarden()).not.toThrow();
    expect(document.querySelector('.welcome-garden-modal')).toBeFalsy();
  });

  // C3 (v3.16): Escape listener cleanup via AbortController

  it('C3 baseline: open 후 ESC press → 모달 닫힘 (기존 동작 유지)', () => {
    setUser({ gardenIntroduced: false, plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } } });
    maybeShowWelcomeGarden();
    expect(document.querySelector('.welcome-garden-modal')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.welcome-garden-modal')).toBeNull();
  });

  it('C3 cleanup: 버튼 close → AbortController.signal.aborted=true (listener 즉시 정리)', () => {
    const OriginalAbortController = global.AbortController;
    const captured: AbortController[] = [];
    global.AbortController = class extends OriginalAbortController {
      constructor() {
        super();
        captured.push(this);
      }
    } as typeof AbortController;

    try {
      setUser({ gardenIntroduced: false, plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } } });
      maybeShowWelcomeGarden();
      expect(captured.length).toBeGreaterThanOrEqual(1);
      const escController = captured[captured.length - 1]!;
      expect(escController.signal.aborted).toBe(false);

      (document.querySelector('#welcomeGardenCloseBtn') as HTMLButtonElement).click();
      expect(escController.signal.aborted).toBe(true);
    } finally {
      global.AbortController = OriginalAbortController;
    }
  });

  it('C3 cleanup: backdrop click → AbortController.signal.aborted=true', () => {
    const OriginalAbortController = global.AbortController;
    const captured: AbortController[] = [];
    global.AbortController = class extends OriginalAbortController {
      constructor() {
        super();
        captured.push(this);
      }
    } as typeof AbortController;

    try {
      setUser({ gardenIntroduced: false, plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } } });
      maybeShowWelcomeGarden();
      const escController = captured[captured.length - 1]!;
      const backdrop = document.querySelector('.dg-modal-backdrop') as HTMLElement;

      backdrop.click();

      expect(escController.signal.aborted).toBe(true);
      expect(document.querySelector('.welcome-garden-modal')).toBeNull();
    } finally {
      global.AbortController = OriginalAbortController;
    }
  });

  it('v3.18.1 H1 — uses .dg-modal-backdrop class (CSS 매칭 보장, regression guard)', () => {
    setUser({ gardenIntroduced: false, plants: { ai_ml: { stage: 1, cumulativeActivity: 0 } } });
    maybeShowWelcomeGarden();
    expect(document.querySelector('.dg-modal-backdrop')).not.toBeNull();
    expect(document.querySelector('.dg-modal-card')).not.toBeNull();
  });
});
