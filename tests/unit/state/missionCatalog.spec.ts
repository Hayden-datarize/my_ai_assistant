import { describe, it, expect } from 'vitest';
import { MISSION_CATALOG, getMissionDef, DAILY_POOL, WEEKLY_FIXED, MONTHLY_FIXED } from '../../../src/state/missionCatalog';

describe('missionCatalog', () => {
  it('total 10 entries (7 daily + 2 weekly + 1 monthly)', () => {
    expect(MISSION_CATALOG).toHaveLength(10);
    expect(DAILY_POOL).toHaveLength(7);
    expect(WEEKLY_FIXED).toHaveLength(2);
    expect(MONTHLY_FIXED).toHaveLength(1);
  });

  it('defId 고유', () => {
    const ids = MISSION_CATALOG.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('각 entry: target ≥ 1, rewardXp > 0, triggerOn enum', () => {
    const validTriggers = new Set(['answer', 'scrap', 'memo', 'briefing-view', 'cross-interest-view', 'archive-revisit', 'active-day']);
    for (const def of MISSION_CATALOG) {
      expect(def.target).toBeGreaterThanOrEqual(1);
      expect(def.rewardXp).toBeGreaterThan(0);
      expect(validTriggers.has(def.triggerOn)).toBe(true);
    }
  });

  it('getMissionDef("daily-answer-1") → 정의 반환', () => {
    expect(getMissionDef('daily-answer-1')?.target).toBe(1);
  });

  it('getMissionDef("nonexistent") → undefined', () => {
    expect(getMissionDef('nonexistent')).toBeUndefined();
  });
});
