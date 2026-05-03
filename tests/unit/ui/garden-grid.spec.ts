import { describe, it, expect, beforeEach } from 'vitest';
import { renderGardenGrid, renderGardenMini } from '../../../src/ui/components/garden-grid';
import type { User } from '../../../src/state/user';

// 최소한의 User fixture — plantStateByInterest 테스트에 필요한 필드만 포함
function mkUser(plants: Record<string, { stage: 1|2|3|4|5; cumulativeActivity: number; lastEngagedAt?: string; unlockedAt?: string }>): User {
  return {
    name: 'h',
    interests: Object.keys(plants),
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
    plantStateByInterest: plants,
    gardenIntroduced: true,
    gardenBackfilled: true,
  };
}

describe('renderGardenGrid (stats full)', () => {
  let root: HTMLDivElement;
  beforeEach(() => { root = document.createElement('div'); });

  it('식물 N개 → cards N개 렌더', () => {
    const u = mkUser({
      ai_ml:  { stage: 3, cumulativeActivity: 30 },
      pm:     { stage: 1, cumulativeActivity: 5 },
    });
    renderGardenGrid(root, u);
    expect(root.querySelectorAll('.garden-card')).toHaveLength(2);
  });

  it('stage 5 + unlockedAt → bloomed class + trophy', () => {
    const u = mkUser({ ai_ml: { stage: 5, cumulativeActivity: 162, unlockedAt: '2026-05-01' } });
    renderGardenGrid(root, u);
    const card = root.querySelector('.garden-card');
    expect(card?.classList.contains('bloomed')).toBe(true);
    expect(card?.querySelector('.garden-trophy')?.textContent).toBe('✨');
  });

  it('lastEngagedAt 7일+ → wilting class', () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const u = mkUser({ ai_ml: { stage: 3, cumulativeActivity: 30, lastEngagedAt: old } });
    renderGardenGrid(root, u);
    expect(root.querySelector('.garden-card')?.classList.contains('wilting')).toBe(true);
  });

  it('archived 식물 (interests 외) → grid에서 제외', () => {
    const u = mkUser({
      ai_ml:  { stage: 3, cumulativeActivity: 30 },
      pm:     { stage: 1, cumulativeActivity: 5 },
    });
    u.interests = ['ai_ml'];  // pm 제외 (archived)
    renderGardenGrid(root, u);
    expect(root.querySelectorAll('.garden-card')).toHaveLength(1);
    expect(root.textContent).toContain('AI/ML');
    expect(root.textContent).not.toContain('프로덕트');
  });

  it('식물 0개 → empty 안내', () => {
    const u = mkUser({});
    renderGardenGrid(root, u);
    expect(root.querySelector('.garden-empty')).toBeTruthy();
  });

  it('cumulativeActivity 카운트 표시', () => {
    const u = mkUser({ ai_ml: { stage: 3, cumulativeActivity: 42 } });
    renderGardenGrid(root, u);
    expect(root.textContent).toContain('42회');
  });

  it('stage 라벨 정확 (만개)', () => {
    const u = mkUser({ ai_ml: { stage: 5, cumulativeActivity: 200 } });
    renderGardenGrid(root, u);
    expect(root.textContent).toContain('만개');
  });
});

describe('renderGardenMini (홈 preview)', () => {
  let root: HTMLDivElement;
  beforeEach(() => { root = document.createElement('div'); });

  it('식물 N개 → mini cells N개', () => {
    const u = mkUser({
      ai_ml:  { stage: 1, cumulativeActivity: 0 },
      pm:     { stage: 1, cumulativeActivity: 0 },
    });
    renderGardenMini(root, u);
    expect(root.querySelectorAll('.garden-mini-cell')).toHaveLength(2);
  });

  it('식물 0개 → empty (미표시)', () => {
    renderGardenMini(root, mkUser({}));
    expect(root.querySelectorAll('.garden-mini-cell')).toHaveLength(0);
  });

  it('cell aria-label = 분야명 포함', () => {
    const u = mkUser({ ai_ml: { stage: 1, cumulativeActivity: 0 } });
    renderGardenMini(root, u);
    expect(root.querySelector('.garden-mini-cell')?.getAttribute('aria-label')).toContain('AI/ML');
  });
});
