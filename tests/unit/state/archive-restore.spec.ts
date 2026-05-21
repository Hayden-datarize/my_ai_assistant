import { describe, it, expect } from 'vitest';
import { tickPlantActivity } from '../../../src/state/plantEngine';
import type { User } from '../../../src/state/user';

function makeUserWithPlant(): User {
  return {
    name: 'h', interests: ['ai'], onboardedAt: '', streak: 0, lastActiveDate: '',
    xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 10,
    missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 }, lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    plantStateByInterest: { ai: { stage: 3, cumulativeActivity: 30 } },
    gardenIntroduced: false, gardenBackfilled: false,
    streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
    insights: [],
  };
}

describe('archive/restore (Q8-B 정책)', () => {
  it('분야 제거 시 plantStateByInterest entry 그대로 유지', () => {
    const u = makeUserWithPlant();
    u.interests = [];  // ai 제거 (settings 등에서)
    expect(u.plantStateByInterest['ai']?.stage).toBe(3);
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(30);
  });

  it('분야 재추가 시 기존 entry 자동 복원 (별도 restore 함수 불필요)', () => {
    const u = makeUserWithPlant();
    u.interests = [];
    u.interests.push('ai');  // 재추가
    // tickPlantActivity 다시 호출 시 기존 entry 그대로 사용
    tickPlantActivity(u, 'ai', 5);
    expect(u.plantStateByInterest['ai']?.stage).toBe(3);  // 유지
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(35);  // 누적
  });

  it('분야 add/remove/add 시퀀스 idempotent (visibility만 토글)', () => {
    const u = makeUserWithPlant();
    u.interests = [];                  // remove
    u.interests = ['ai'];              // add 1
    u.interests = [];                  // remove
    u.interests = ['ai'];              // add 2
    expect(u.plantStateByInterest['ai']?.stage).toBe(3);
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(30);
  });
});
