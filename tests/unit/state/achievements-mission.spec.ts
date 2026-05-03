import { describe, it, expect } from 'vitest';
import { detectEvents } from '../../../src/state/achievements';
import type { Snapshot } from '../../../src/state/gameTypes';

function emptySnapshot(): Snapshot {
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
    missionsCumulative: { daily: 0, weekly: 0, monthly: 0 },
    plantStages: {},
  };
}

describe('detectEvents — mission-complete', () => {
  it('false → true 전환 → mission-complete event emit', () => {
    const prev = emptySnapshot();
    const curr = emptySnapshot();
    prev.missionsActive = [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false }];
    curr.missionsActive = [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 1, completed: true }];
    const events = detectEvents(prev, curr);
    const ev = events.find(e => e.kind === 'mission-complete');
    expect(ev).toBeDefined();
    expect((ev as { defId: string }).defId).toBe('daily-answer-1');
  });

  it('true → true (이미 완료) → event 없음', () => {
    const prev = emptySnapshot();
    const curr = emptySnapshot();
    prev.missionsActive = [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 1, completed: true }];
    curr.missionsActive = [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 1, completed: true }];
    expect(detectEvents(prev, curr).filter(e => e.kind === 'mission-complete')).toHaveLength(0);
  });

  it('새 instance (prev에 없음) → mission-complete event 없음 (reset된 미션은 그 자체로 event 아님)', () => {
    const prev = emptySnapshot();
    const curr = emptySnapshot();
    curr.missionsActive = [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false }];
    expect(detectEvents(prev, curr).filter(e => e.kind === 'mission-complete')).toHaveLength(0);
  });

  it('multiple missions completed → multiple events', () => {
    const prev = emptySnapshot();
    const curr = emptySnapshot();
    prev.missionsActive = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
      { defId: 'weekly-answers-5', period: 'weekly', windowStart: 0, progress: 4, completed: false },
    ];
    curr.missionsActive = [
      { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 1, completed: true },
      { defId: 'weekly-answers-5', period: 'weekly', windowStart: 0, progress: 5, completed: true },
    ];
    const events = detectEvents(prev, curr).filter(e => e.kind === 'mission-complete');
    expect(events).toHaveLength(2);
  });

  it('rewardXp / period 정보 event에 포함', () => {
    const prev = emptySnapshot();
    const curr = emptySnapshot();
    prev.missionsActive = [{ defId: 'monthly-answers-20', period: 'monthly', windowStart: 0, progress: 19, completed: false }];
    curr.missionsActive = [{ defId: 'monthly-answers-20', period: 'monthly', windowStart: 0, progress: 20, completed: true }];
    const ev = detectEvents(prev, curr).find(e => e.kind === 'mission-complete') as { period: string; rewardXp: number };
    expect(ev.period).toBe('monthly');
    expect(ev.rewardXp).toBe(200);
  });
});
