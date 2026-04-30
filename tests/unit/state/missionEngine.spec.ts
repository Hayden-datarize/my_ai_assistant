import { describe, it, expect, beforeEach } from 'vitest';
import { getKSTDateIso, getKSTWeekIso, getKSTMonthIso, getActiveMissions, pickDailyMissions, tickMissionProgress } from '../../../src/state/missionEngine';
import type { User } from '../../../src/state/user';

function makeUser(): User {
  return {
    name: 'T', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '',
    xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 3,
    missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
                lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
  };
}

describe('KST util', () => {
  it('getKSTDateIso: UTC 2026-04-30T15:00 (= KST 2026-05-01T00:00) → "2026-05-01"', () => {
    expect(getKSTDateIso(new Date('2026-04-30T15:00:00Z'))).toBe('2026-05-01');
  });

  it('getKSTDateIso: UTC 2026-05-01T14:59 → "2026-05-01" (KST 23:59)', () => {
    expect(getKSTDateIso(new Date('2026-05-01T14:59:00Z'))).toBe('2026-05-01');
  });

  it('getKSTMonthIso: 2026-05-01 KST → "2026-05"', () => {
    expect(getKSTMonthIso(new Date('2026-04-30T15:00:00Z'))).toBe('2026-05');
  });

  it('getKSTWeekIso: 2026-05-04 (월요일) KST → "2026-W19"', () => {
    expect(getKSTWeekIso(new Date('2026-05-03T15:00:00Z'))).toBe('2026-W19');
  });
});

describe('pickDailyMissions deterministic', () => {
  it('same date → same 3 missions (동일 시드)', () => {
    const a = pickDailyMissions('2026-05-01', new Date('2026-04-30T15:00:00Z'));
    const b = pickDailyMissions('2026-05-01', new Date('2026-04-30T15:00:00Z'));
    expect(a.map(m => m.defId)).toEqual(b.map(m => m.defId));
  });

  it('different date → different 3 (대부분의 경우)', () => {
    const a = pickDailyMissions('2026-05-01', new Date('2026-04-30T15:00:00Z')).map(m => m.defId).sort();
    const b = pickDailyMissions('2026-05-02', new Date('2026-05-01T15:00:00Z')).map(m => m.defId).sort();
    expect(a).not.toEqual(b);
  });

  it('always 3 daily, no duplicates, all from DAILY_POOL', () => {
    const m = pickDailyMissions('2026-05-01', new Date('2026-04-30T15:00:00Z'));
    expect(m).toHaveLength(3);
    expect(new Set(m.map(x => x.defId)).size).toBe(3);
    expect(m.every(x => x.period === 'daily')).toBe(true);
  });
});

describe('getActiveMissions (lazy regeneration)', () => {
  beforeEach(() => localStorage.clear());

  it('빈 user → 6 missions (3 daily + 2 weekly + 1 monthly), seed/iso 업데이트', () => {
    const u = makeUser();
    const now = new Date('2026-04-30T15:00:00Z');                       // KST 2026-05-01 00:00
    const active = getActiveMissions(now, u);
    expect(active).toHaveLength(6);
    expect(active.filter(m => m.period === 'daily')).toHaveLength(3);
    expect(active.filter(m => m.period === 'weekly')).toHaveLength(2);
    expect(active.filter(m => m.period === 'monthly')).toHaveLength(1);
    expect(u.missions.lastDailySeed).toBe('2026-05-01');
    expect(u.missions.currentMonthIso).toBe('2026-05');
  });

  it('같은 날 재호출 → active 그대로 (no regeneration)', () => {
    const u = makeUser();
    const now = new Date('2026-04-30T15:00:00Z');
    const a = getActiveMissions(now, u);
    const before = a.map(m => m.defId);
    const b = getActiveMissions(now, u);
    expect(b.map(m => m.defId)).toEqual(before);
    expect(b).toHaveLength(6);
  });

  it('자정 넘어가면 daily만 새로 생성, weekly/monthly 유지', () => {
    const u = makeUser();
    const day1 = new Date('2026-04-30T15:00:00Z');                      // KST 5/1 00:00
    getActiveMissions(day1, u);
    const weeklyBefore = u.missions.active.filter(m => m.period === 'weekly').map(m => m.defId).sort();

    const day2 = new Date('2026-05-01T15:00:00Z');                      // KST 5/2 00:00
    getActiveMissions(day2, u);
    expect(u.missions.lastDailySeed).toBe('2026-05-02');
    expect(u.missions.active.filter(m => m.period === 'weekly').map(m => m.defId).sort()).toEqual(weeklyBefore);
  });

  it('saveUser 호출 안 함 (caller invariant)', () => {
    const u = makeUser();
    const now = new Date('2026-04-30T15:00:00Z');
    // saveUser 호출하면 localStorage가 변경됨. localStorage가 비어있는지 확인.
    getActiveMissions(now, u);
    expect(localStorage.getItem('user')).toBeNull();
  });
});

describe('tickMissionProgress', () => {
  it('answer action → daily-answer-1 progress 0→1, completed: true, xp +10, cumulative.dailyCount +1', () => {
    const u = makeUser();
    u.missions.active = [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false }];
    tickMissionProgress(u, 'answer', new Date('2026-04-30T15:00:00Z'));
    expect(u.missions.active[0]!.progress).toBe(1);
    expect(u.missions.active[0]!.completed).toBe(true);
    expect(u.xp).toBe(10);
    expect(u.missions.cumulative.dailyCount).toBe(1);
  });

  it('이미 completed 미션은 tick 무시 (idempotent)', () => {
    const u = makeUser();
    u.missions.active = [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 1, completed: true }];
    u.xp = 10;
    tickMissionProgress(u, 'answer');
    expect(u.xp).toBe(10);
    expect(u.missions.cumulative.dailyCount).toBe(0);
  });

  it('answer 1회 → daily-answer-2 (target 2) progress 1, completed: false', () => {
    const u = makeUser();
    u.missions.active = [{ defId: 'daily-answer-2', period: 'daily', windowStart: 0, progress: 0, completed: false }];
    tickMissionProgress(u, 'answer');
    expect(u.missions.active[0]!.progress).toBe(1);
    expect(u.missions.active[0]!.completed).toBe(false);
    expect(u.xp).toBe(0);
  });

  it('answer 2회 → daily-answer-2 completed', () => {
    const u = makeUser();
    u.missions.active = [{ defId: 'daily-answer-2', period: 'daily', windowStart: 0, progress: 0, completed: false }];
    tickMissionProgress(u, 'answer');
    tickMissionProgress(u, 'answer');
    expect(u.missions.active[0]!.progress).toBe(2);
    expect(u.missions.active[0]!.completed).toBe(true);
    expect(u.xp).toBe(10);
  });

  it('weekly-active-5days: 같은 날 여러 액션 → progressDates idempotent (1 push)', () => {
    const u = makeUser();
    const now = new Date('2026-04-30T15:00:00Z');
    u.missions.active = [{ defId: 'weekly-active-5days', period: 'weekly', windowStart: 0, progress: 0, completed: false, progressDates: [] }];
    tickMissionProgress(u, 'answer', now);
    tickMissionProgress(u, 'scrap', now);
    tickMissionProgress(u, 'memo', now);
    expect(u.missions.active[0]!.progressDates).toEqual(['2026-05-01']);
    expect(u.missions.active[0]!.progress).toBe(1);
  });

  it('weekly-active-5days: 5일 다른 날 → completed', () => {
    const u = makeUser();
    u.missions.active = [{ defId: 'weekly-active-5days', period: 'weekly', windowStart: 0, progress: 0, completed: false, progressDates: [] }];
    for (const day of ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']) {
      tickMissionProgress(u, 'answer', new Date(`${day}T01:00:00Z`));
    }
    expect(u.missions.active[0]!.progress).toBe(5);
    expect(u.missions.active[0]!.completed).toBe(true);
    expect(u.xp).toBe(50);
    expect(u.missions.cumulative.weeklyCount).toBe(1);
  });

  it('monthly-answers-20 completed → xp +200, cumulative.monthlyCount +1', () => {
    const u = makeUser();
    u.missions.active = [{ defId: 'monthly-answers-20', period: 'monthly', windowStart: 0, progress: 19, completed: false }];
    tickMissionProgress(u, 'answer');
    expect(u.missions.active[0]!.completed).toBe(true);
    expect(u.xp).toBe(200);
    expect(u.missions.cumulative.monthlyCount).toBe(1);
  });

  it('action 미매칭은 progress 변화 없음', () => {
    const u = makeUser();
    u.missions.active = [{ defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false }];
    tickMissionProgress(u, 'scrap');
    expect(u.missions.active[0]!.progress).toBe(0);
  });
});

describe('edge cases', () => {
  it('자정 직전/직후 race — 자정 직전 답변, 직후 다시 진입 → 새 daily 미션, 이전은 사라짐', () => {
    const u = makeUser();
    const beforeMidnight = new Date('2026-04-30T14:59:59Z');             // KST 23:59:59
    getActiveMissions(beforeMidnight, u);
    const beforeIso = u.missions.lastDailySeed;

    const afterMidnight = new Date('2026-04-30T15:00:01Z');              // KST 5/1 00:00:01
    getActiveMissions(afterMidnight, u);

    expect(u.missions.lastDailySeed).toBe('2026-05-01');
    expect(u.missions.lastDailySeed).not.toBe(beforeIso);
  });

  it('1주 비움 → daily/weekly/monthly 모두 새로 생성, cumulative 영구 유지', () => {
    const u = makeUser();
    u.missions.cumulative = { dailyCount: 3, weeklyCount: 1, monthlyCount: 0 };
    const week1 = new Date('2026-04-23T15:00:00Z');                      // KST 4/24
    getActiveMissions(week1, u);

    const week3 = new Date('2026-05-07T15:00:00Z');                      // KST 5/8 (~2주 후)
    getActiveMissions(week3, u);

    expect(u.missions.lastDailySeed).toBe('2026-05-08');
    // cumulative은 영구 보존
    expect(u.missions.cumulative).toEqual({ dailyCount: 3, weeklyCount: 1, monthlyCount: 0 });
  });

  it('TZ 강제: UTC 시각이 같아도 KST 기준 날짜로 비교', () => {
    const u = makeUser();
    const a = new Date('2026-04-30T14:59:00Z');                          // KST 4/30 23:59
    getActiveMissions(a, u);
    expect(u.missions.lastDailySeed).toBe('2026-04-30');
  });

  it('getKSTWeekIso: 2025-12-29 KST (월요일) → "2026-W01"', () => {
    expect(getKSTWeekIso(new Date('2025-12-28T15:00:00Z'))).toBe('2026-W01');
  });

  it('getKSTWeekIso: 2021-01-01 KST (금요일) → "2020-W53"', () => {
    expect(getKSTWeekIso(new Date('2020-12-31T15:00:00Z'))).toBe('2020-W53');
  });

  it('getKSTWeekIso: 2023-01-01 KST (일요일) → "2022-W52"', () => {
    expect(getKSTWeekIso(new Date('2022-12-31T15:00:00Z'))).toBe('2022-W52');
  });
});
