import { describe, it, expect, beforeEach, vi } from 'vitest';
import { maybeShowWelcomeGarden } from '../../../src/ui/modals/welcome-garden';

// switchTab / scrollToGardenSection mock
vi.mock('../../../src/ui/nav', () => ({ switchTab: vi.fn() }));
vi.mock('../../../src/ui/handlers/stats', () => ({ scrollToGardenSection: vi.fn() }));

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
});
