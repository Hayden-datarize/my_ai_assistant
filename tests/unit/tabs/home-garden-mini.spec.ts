import { describe, it, expect, beforeEach } from 'vitest';
import { renderHome } from '../../../src/ui/tabs/home';
import { renderGardenMini } from '../../../src/ui/components/garden-grid';
import type { User } from '../../../src/state/user';

beforeEach(() => {
  localStorage.clear();
});

describe('홈 #gardenMini integration', () => {
  it('#gardenMini placeholder 존재', () => {
    const c = document.createElement('div');
    renderHome(c);
    expect(c.querySelector('#gardenMini')).toBeTruthy();
  });

  it('#gardenMini는 streakBanner 뒤, 브리핑 섹션 앞', () => {
    const c = document.createElement('div');
    renderHome(c);
    const streakBanner = c.querySelector('#streakBanner');
    const gardenMini = c.querySelector('#gardenMini');
    const briefingScroll = c.querySelector('#briefingScroll');
    if (streakBanner && gardenMini) {
      // gardenMini는 streakBanner 뒤에 위치해야 함
      expect(
        streakBanner.compareDocumentPosition(gardenMini) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    if (gardenMini && briefingScroll) {
      // gardenMini는 briefingScroll 앞에 위치해야 함
      expect(
        gardenMini.compareDocumentPosition(briefingScroll) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('C2 (v3.16): #gardenMini ID는 DOM 전체에서 유일 (outer placeholder만)', () => {
    const c = document.createElement('div');
    document.body.appendChild(c);
    renderHome(c);

    // 최소 1개 관심분야를 가진 mock user로 renderGardenMini 호출
    const mockUser: User = {
      name: 'Test User',
      interests: ['ai_ml'],
      onboardedAt: '2026-05-01',
      streak: 5,
      plantStateByInterest: {
        ai_ml: {
          stage: 2,
          cumulativeActivity: 10,
          unlockedAt: undefined,
        },
      },
      schemaVersion: 7,
      lastActiveDate: '2026-05-04',
      xp: 100,
      earnedBadges: {},
      gamificationMigrated: true,
      missions: {
        active: [],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '2026-05-04',
        currentWeekIso: '2026-W19',
        currentMonthIso: '2026-05',
      },
      gardenIntroduced: true,
      gardenBackfilled: true,
      streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
      insights: [],
    };

    const root = c.querySelector('#gardenMini') as HTMLElement;
    expect(root).toBeTruthy();

    // renderGardenMini 호출 — inner row가 id="gardenMini"를 가지면 중복됨
    renderGardenMini(root, mockUser);

    // #gardenMini는 정확히 1개만 존재해야 함 (outer placeholder만)
    const matches = c.querySelectorAll('#gardenMini');
    expect(matches.length).toBe(1);

    document.body.removeChild(c);
  });
});
