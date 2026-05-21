import { describe, it, expect } from 'vitest';
import { tickPlantActivity, applyMissionBonus, ensurePlantsForInterests, checkWilting } from '../../../src/state/plantEngine';
import type { User } from '../../../src/state/user';

function makeUser(): User {
  return {
    name: 'Hayden', interests: ['ai', 'design'], onboardedAt: '2026-04-01',
    streak: 0, lastActiveDate: '2026-05-03', xp: 0,
    earnedBadges: {}, gamificationMigrated: true,
    schemaVersion: 10,
    missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 }, lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    plantStateByInterest: {},
    gardenIntroduced: false,
    gardenBackfilled: false,
    streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
    insights: [],
  };
}

describe('tickPlantActivity', () => {
  it('첫 호출 시 식물 생성 (stage 1, cum 1)', () => {
    const u = makeUser();
    tickPlantActivity(u, 'ai', 1);
    expect(u.plantStateByInterest['ai']?.stage).toBe(1);
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(1);
    expect(u.plantStateByInterest['ai']?.lastEngagedAt).toBeDefined();
  });

  it('stage 1→2 전환 (cum 7 → 8)', () => {
    const u = makeUser();
    u.plantStateByInterest['ai'] = { stage: 1, cumulativeActivity: 7 };
    tickPlantActivity(u, 'ai', 1);
    expect(u.plantStateByInterest['ai']?.stage).toBe(2);
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(8);
  });

  it('stage 4→5 전환 시 unlockedAt 셋 (영구 마크)', () => {
    const u = makeUser();
    u.plantStateByInterest['ai'] = { stage: 4, cumulativeActivity: 159 };
    tickPlantActivity(u, 'ai', 1);
    expect(u.plantStateByInterest['ai']?.stage).toBe(5);
    expect(u.plantStateByInterest['ai']?.unlockedAt).toBeDefined();
  });

  it('stage 5 도달 후 추가 활동 — unlockedAt 변경 X (idempotent)', () => {
    const u = makeUser();
    const fixedDate = '2026-05-01T00:00:00.000Z';
    u.plantStateByInterest['ai'] = { stage: 5, cumulativeActivity: 200, unlockedAt: fixedDate };
    tickPlantActivity(u, 'ai', 5);
    expect(u.plantStateByInterest['ai']?.unlockedAt).toBe(fixedDate);
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(205);
  });

  it('delta 0 / negative / NaN 무시 (defensive)', () => {
    const u = makeUser();
    u.plantStateByInterest['ai'] = { stage: 2, cumulativeActivity: 10 };
    tickPlantActivity(u, 'ai', 0);
    tickPlantActivity(u, 'ai', -3);
    tickPlantActivity(u, 'ai', NaN);
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(10);
  });

  it('cumulativeActivity NaN/Infinite 자체 손상 → 0으로 시작 (defensive)', () => {
    const u = makeUser();
    u.plantStateByInterest['ai'] = { stage: 2, cumulativeActivity: NaN as unknown as number };
    tickPlantActivity(u, 'ai', 5);
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(5);
  });
});

describe('applyMissionBonus', () => {
  it('daily 완수 = 모든 식물에 +1', () => {
    const u = makeUser();
    u.plantStateByInterest['ai'] = { stage: 1, cumulativeActivity: 5 };
    u.plantStateByInterest['design'] = { stage: 1, cumulativeActivity: 3 };
    applyMissionBonus(u, 'daily');
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(6);
    expect(u.plantStateByInterest['design']?.cumulativeActivity).toBe(4);
  });

  it('monthly 완수 = 모든 식물에 +20', () => {
    const u = makeUser();
    u.plantStateByInterest['ai'] = { stage: 2, cumulativeActivity: 50 };  // 50 + 20 = 70 → stage 4
    applyMissionBonus(u, 'monthly');
    expect(u.plantStateByInterest['ai']?.cumulativeActivity).toBe(70);
    expect(u.plantStateByInterest['ai']?.stage).toBe(4);
  });

  it('plantStateByInterest 빈 객체 — 호출 안전 (no-op)', () => {
    const u = makeUser();
    expect(() => applyMissionBonus(u, 'weekly')).not.toThrow();
    expect(Object.keys(u.plantStateByInterest)).toHaveLength(0);
  });

  it('archived 식물(interests 외 entry) 도 보너스 적용 — 분야 재추가 시 누적 보존', () => {
    const u = makeUser();
    u.interests = ['ai_ml'];  // recruiting 제거됐지만
    u.plantStateByInterest['ai_ml'] = { stage: 1, cumulativeActivity: 5 };
    u.plantStateByInterest['recruiting'] = { stage: 1, cumulativeActivity: 5 };  // archived
    applyMissionBonus(u, 'daily');
    expect(u.plantStateByInterest['recruiting']?.cumulativeActivity).toBe(6);  // 누적 update
  });
});

describe('ensurePlantsForInterests (S10 / P1-4 fix)', () => {
  it('user.interests 새 ID에 stage 1 entry 자동 생성', () => {
    const u = makeUser();
    u.interests = ['recruiting', 'ai_ml'];
    ensurePlantsForInterests(u);
    expect(u.plantStateByInterest['recruiting']?.stage).toBe(1);
    expect(u.plantStateByInterest['ai_ml']?.stage).toBe(1);
    expect(u.plantStateByInterest['recruiting']?.cumulativeActivity).toBe(0);
  });

  it('기존 entry는 보존 (idempotent)', () => {
    const u = makeUser();
    u.interests = ['recruiting'];
    u.plantStateByInterest['recruiting'] = { stage: 4, cumulativeActivity: 100 };
    ensurePlantsForInterests(u);
    expect(u.plantStateByInterest['recruiting']?.stage).toBe(4);
    expect(u.plantStateByInterest['recruiting']?.cumulativeActivity).toBe(100);
  });

  it('archived entry (interests 외) 는 건드리지 않음', () => {
    const u = makeUser();
    u.interests = ['recruiting'];  // ai_ml 제거됨
    u.plantStateByInterest['ai_ml'] = { stage: 3, cumulativeActivity: 30 };
    ensurePlantsForInterests(u);
    expect(u.plantStateByInterest['ai_ml']?.stage).toBe(3);  // 변동 없음
    expect(u.plantStateByInterest['recruiting']?.stage).toBe(1);  // 신규 생성
  });

  it('interests 빈 배열 → no-op', () => {
    const u = makeUser();
    u.interests = [];
    ensurePlantsForInterests(u);
    expect(Object.keys(u.plantStateByInterest)).toHaveLength(0);
  });

  it('lastEngagedAt = 진입 시점 (C3 패턴 follow, 첫 인상 wilting 회피)', () => {
    const u = makeUser();
    u.interests = ['recruiting'];
    const before = Date.now();
    ensurePlantsForInterests(u);
    const after = Date.now();
    const last = new Date(u.plantStateByInterest['recruiting']!.lastEngagedAt!).getTime();
    expect(last).toBeGreaterThanOrEqual(before);
    expect(last).toBeLessThanOrEqual(after);
  });
});

describe('checkWilting', () => {
  const fixedNow = new Date('2026-05-15T00:00:00.000Z');

  it('lastEngagedAt 7일 이상 이전 → true', () => {
    const plant = { lastEngagedAt: '2026-05-08T00:00:00.000Z' };  // 7일 전
    expect(checkWilting(plant, fixedNow)).toBe(true);
  });

  it('lastEngagedAt 6일 이전 → false (boundary)', () => {
    const plant = { lastEngagedAt: '2026-05-09T00:00:00.000Z' };  // 6일 전
    expect(checkWilting(plant, fixedNow)).toBe(false);
  });

  it('lastEngagedAt 8일 이전 → true', () => {
    const plant = { lastEngagedAt: '2026-05-07T00:00:00.000Z' };
    expect(checkWilting(plant, fixedNow)).toBe(true);
  });

  it('lastEngagedAt undefined → false (새 식물)', () => {
    expect(checkWilting({}, fixedNow)).toBe(false);
  });

  it('lastEngagedAt 손상 ISO → false (defensive)', () => {
    expect(checkWilting({ lastEngagedAt: 'not-a-date' }, fixedNow)).toBe(false);
  });

  it('default now (테스트에서 fixed clock 미주입) — wilting 판단 가능', () => {
    const futureLast = new Date(Date.now() + 1000).toISOString();
    expect(checkWilting({ lastEngagedAt: futureLast })).toBe(false);  // 미래
  });

  it('Read-only — plant 객체 변경 안 됨', () => {
    const plant = { lastEngagedAt: '2026-05-08T00:00:00.000Z', stage: 3 as const };
    const before = JSON.stringify(plant);
    checkWilting(plant, fixedNow);
    expect(JSON.stringify(plant)).toBe(before);
  });
});
