import { describe, it, expect } from 'vitest';
import { BADGE_CATALOG, findBadge } from '../../../src/state/badgeCatalog';
import type { Snapshot } from '../../../src/state/gameTypes';

function snapshot(daily: number, weekly: number, monthly: number): Snapshot {
  return {
    xp: 0,
    streak: 0,
    answersCount: 0,
    scrapsCount: 0,
    memosCount: 0,
    uniqueAnsweredTypes: new Set(),
    selectedInterests: new Set(),
    engagedInterests: new Set(),
    uniqueScrapCategories: 0,
    earnedBadgeIds: new Set(),
    missionsActive: [],
    missionsCumulative: { daily, weekly, monthly },
  };
}

describe('badgeCatalog — mission badges', () => {
  it('mission-init / mission-master / weekly-champion / monthly-hero 4 entries 존재, category=mission', () => {
    const ids = ['mission-init', 'mission-master', 'weekly-champion', 'monthly-hero'];
    for (const id of ids) {
      const def = findBadge(id);
      expect(def).toBeDefined();
      expect(def!.category).toBe('mission');
    }
  });

  it('총 22 entries (18 + 4)', () => {
    expect(BADGE_CATALOG).toHaveLength(22);
  });

  it('mission-init detect: dailyCount >= 1', () => {
    expect(findBadge('mission-init')!.predicate(snapshot(0, 0, 0))).toBe(false);
    expect(findBadge('mission-init')!.predicate(snapshot(1, 0, 0))).toBe(true);
  });

  it('mission-master detect: dailyCount >= 30', () => {
    expect(findBadge('mission-master')!.predicate(snapshot(29, 0, 0))).toBe(false);
    expect(findBadge('mission-master')!.predicate(snapshot(30, 0, 0))).toBe(true);
  });

  it('weekly-champion detect: weeklyCount >= 8', () => {
    expect(findBadge('weekly-champion')!.predicate(snapshot(0, 7, 0))).toBe(false);
    expect(findBadge('weekly-champion')!.predicate(snapshot(0, 8, 0))).toBe(true);
  });

  it('monthly-hero detect: monthlyCount >= 1', () => {
    expect(findBadge('monthly-hero')!.predicate(snapshot(0, 0, 0))).toBe(false);
    expect(findBadge('monthly-hero')!.predicate(snapshot(0, 0, 1))).toBe(true);
  });
});
