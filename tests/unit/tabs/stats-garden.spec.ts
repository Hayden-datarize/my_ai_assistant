import { describe, it, expect, beforeEach } from 'vitest';
import { renderStats } from '../../../src/ui/tabs/stats';

beforeEach(() => {
  localStorage.clear();
  // eslint-disable-next-line no-restricted-syntax -- trusted empty string, jsdom reset
  document.body.innerHTML = '';
});

describe('stats 탭 정원 섹션 integration', () => {
  it('#gardenSection 마크업 존재', () => {
    const container = document.createElement('div');
    renderStats(container);
    expect(container.querySelector('#gardenSection')).toBeTruthy();
    expect(container.querySelector('#gardenContainer')).toBeTruthy();
  });

  it('#gardenSection은 #badgesGrid 뒤에 위치', () => {
    const container = document.createElement('div');
    renderStats(container);
    const badges = container.querySelector('#badgesGrid');
    const garden = container.querySelector('#gardenSection');
    expect(badges).toBeTruthy();
    expect(garden).toBeTruthy();
    if (badges && garden) {
      expect(badges.compareDocumentPosition(garden) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('hydrateStats 호출 시 gardenContainer에 renderGardenGrid 결과가 렌더됨', async () => {
    // user fixture + plant 데이터를 localStorage에 주입 (key='user')
    const user = {
      name: 'h',
      interests: ['ai_ml'],
      onboardedAt: '',
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
      plantStateByInterest: {
        ai_ml: { stage: 2, cumulativeActivity: 10 },
      },
      gardenIntroduced: true,
      gardenBackfilled: true,
    };
    localStorage.setItem('user', JSON.stringify(user));

    // stats 마크업을 document.body에 mount (hydrateStats는 document.getElementById를 사용)
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderStats(container);

    const { hydrateStats } = await import('../../../src/ui/handlers/stats');
    // vi.resetModules 없이 import하면 캐시된 모듈 사용. getCachedUser는 localStorage 읽으므로 OK.
    hydrateStats();

    const gardenContainer = document.getElementById('gardenContainer');
    expect(gardenContainer).toBeTruthy();
    expect(gardenContainer?.querySelector('.garden-grid, .garden-empty')).toBeTruthy();
    // 식물 카드 렌더 확인
    expect(gardenContainer?.querySelector('.garden-card')).toBeTruthy();
  });
});
