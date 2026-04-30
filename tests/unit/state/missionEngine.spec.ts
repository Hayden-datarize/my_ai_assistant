import { describe, it, expect, beforeEach } from 'vitest';
import { getKSTDateIso, getKSTWeekIso, getKSTMonthIso, getActiveMissions, pickDailyMissions } from '../../../src/state/missionEngine';
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
