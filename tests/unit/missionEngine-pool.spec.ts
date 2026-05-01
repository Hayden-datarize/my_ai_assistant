import { describe, it, expect } from 'vitest';
import { pickDailyMissions } from '../../src/state/missionEngine';

describe('pickDailyMissions pool size after T10-B graduation', () => {
  it('pool now contains 7 daily entries (DEFERRED_DEFIDS empty)', () => {
    // Different seeds로 호출해서 union of picked.defId 가 7가지 모두 포함되는지 확인 (확률적 sampling)
    const seen = new Set<string>();
    for (let day = 1; day <= 200; day++) {
      const dateIso = `2026-${String((day % 12) + 1).padStart(2, '0')}-${String((day % 28) + 1).padStart(2, '0')}`;
      const picks = pickDailyMissions(dateIso, new Date(`${dateIso}T09:00:00+09:00`));
      picks.forEach(p => seen.add(p.defId));
    }
    expect(seen).toContain('daily-briefing-5');
    expect(seen).toContain('daily-cross-interest-1');
    expect(seen.size).toBe(7);
  });
});
