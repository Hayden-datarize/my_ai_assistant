import { describe, it, expect } from 'vitest';
import { tickMissionProgress } from '../../../src/state/missionEngine';
import type { User } from '../../../src/state/user';

/** 미션 + 식물 통합 테스트용 User fixture */
function makeUserWithPlants(
  missionsActive: User['missions']['active'],
  plants: Record<string, { stage: 1 | 2 | 3 | 4 | 5; cumulativeActivity: number }>,
): User {
  return {
    name: 'h',
    interests: Object.keys(plants),
    onboardedAt: '',
    streak: 0,
    lastActiveDate: '',
    xp: 0,
    earnedBadges: {},
    gamificationMigrated: true,
    schemaVersion: 6,
    missions: {
      active: missionsActive,
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '',
      currentWeekIso: '',
      currentMonthIso: '',
    },
    plantStateByInterest: { ...plants },
    gardenIntroduced: false,
    gardenBackfilled: true,
    streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
    insights: [],
  };
}

describe('missionEngine + plant bonus integration (T6)', () => {
  it('daily 미션 완수 → 모든 식물 cumulativeActivity +1', () => {
    // daily-answer-1: target=1, triggerOn='answer'
    const u = makeUserWithPlants(
      [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false }],
      {
        ai:     { stage: 1, cumulativeActivity: 5 },
        design: { stage: 1, cumulativeActivity: 3 },
      },
    );

    tickMissionProgress(u, 'answer', new Date('2026-05-04T01:00:00Z'));

    expect(u.missions.active[0]!.completed).toBe(true);
    expect(u.missions.cumulative.dailyCount).toBe(1);
    // 모든 식물에 daily bonus +1 적용
    expect(u.plantStateByInterest['ai']!.cumulativeActivity).toBe(6);
    expect(u.plantStateByInterest['design']!.cumulativeActivity).toBe(4);
  });

  it('weekly 미션 완수 → 모든 식물 cumulativeActivity +5', () => {
    // weekly-answers-5: target=5, triggerOn='answer'
    const u = makeUserWithPlants(
      [{ defId: 'weekly-answers-5', period: 'weekly', windowStart: 0, progress: 4, completed: false }],
      {
        ai:   { stage: 1, cumulativeActivity: 10 },
        data: { stage: 2, cumulativeActivity: 20 },
      },
    );

    tickMissionProgress(u, 'answer', new Date('2026-05-04T01:00:00Z'));

    expect(u.missions.active[0]!.completed).toBe(true);
    expect(u.missions.cumulative.weeklyCount).toBe(1);
    // 모든 식물에 weekly bonus +5 적용
    expect(u.plantStateByInterest['ai']!.cumulativeActivity).toBe(15);
    expect(u.plantStateByInterest['data']!.cumulativeActivity).toBe(25);
  });

  it('monthly 미션 완수 → 모든 식물 cumulativeActivity +20', () => {
    // monthly-answers-20: target=20, triggerOn='answer'
    const u = makeUserWithPlants(
      [{ defId: 'monthly-answers-20', period: 'monthly', windowStart: 0, progress: 19, completed: false }],
      {
        ai:     { stage: 1, cumulativeActivity: 0 },
        design: { stage: 3, cumulativeActivity: 50 },
        data:   { stage: 2, cumulativeActivity: 15 },
      },
    );

    tickMissionProgress(u, 'answer', new Date('2026-05-04T01:00:00Z'));

    expect(u.missions.active[0]!.completed).toBe(true);
    expect(u.missions.cumulative.monthlyCount).toBe(1);
    // 모든 식물에 monthly bonus +20 적용
    expect(u.plantStateByInterest['ai']!.cumulativeActivity).toBe(20);
    expect(u.plantStateByInterest['design']!.cumulativeActivity).toBe(70);
    expect(u.plantStateByInterest['data']!.cumulativeActivity).toBe(35);
  });

  it('미션 미완수 (progress++ but < target) → plant 변동 없음', () => {
    // daily-answer-2: target=2, triggerOn='answer' — progress 0→1은 미완수
    const u = makeUserWithPlants(
      [{ defId: 'daily-answer-2', period: 'daily', windowStart: 0, progress: 0, completed: false }],
      {
        ai:     { stage: 1, cumulativeActivity: 7 },
        design: { stage: 1, cumulativeActivity: 2 },
      },
    );

    tickMissionProgress(u, 'answer', new Date('2026-05-04T01:00:00Z'));

    // 미완수 → completed=false, cumulative 변동 없음
    expect(u.missions.active[0]!.completed).toBe(false);
    expect(u.missions.cumulative.dailyCount).toBe(0);
    // 식물 변동 없음
    expect(u.plantStateByInterest['ai']!.cumulativeActivity).toBe(7);
    expect(u.plantStateByInterest['design']!.cumulativeActivity).toBe(2);
  });

  it('plantStateByInterest가 비어 있을 때 미션 완수해도 오류 없이 통과', () => {
    // 식물이 없어도 applyMissionBonus가 오류 없이 실행되어야 함
    const u = makeUserWithPlants(
      [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false }],
      {},
    );

    expect(() => tickMissionProgress(u, 'answer', new Date('2026-05-04T01:00:00Z'))).not.toThrow();
    expect(u.missions.active[0]!.completed).toBe(true);
    expect(u.missions.cumulative.dailyCount).toBe(1);
  });
});
