import { describe, it, expect } from 'vitest';
import { getActiveMissions } from '../../../src/state/missionEngine';
import type { User } from '../../../src/state/user';

function makeUser(): User {
  // v3.14.3 T8 (P3-T2-polish): Partial<User> → User cast 명시.
  // schema v3 minimal shape — earnedBadges, missions, gamificationMigrated 모두 포함.
  return {
    name: 'T', interests: ['pm'], onboardedAt: '2026-04-01',
    streak: 0, lastActiveDate: '', xp: 0, earnedBadges: {},
    gamificationMigrated: true, schemaVersion: 3,
    missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
  } as Partial<User> as User;
}

describe('getActiveMissions — cross-midnight paired-call (v3.13.2 P2-1)', () => {
  it('paired prev/curr with same now is consistent', () => {
    const u = makeUser();
    const now = new Date(2026, 4, 2, 10, 0, 0); // KST: 2026-05-02 10:00
    const prev = getActiveMissions(now, u);
    const curr = getActiveMissions(now, u);
    expect(prev.active.length).toBe(curr.active.length);
    expect(prev.active.map(m => m.defId).sort()).toEqual(curr.active.map(m => m.defId).sort());
  });

  it('cross-midnight (separate now objects) regenerates daily missions', () => {
    const u = makeUser();
    // v3.14.3 T8 (P3-T2-polish): KST 자정 경계 — JS Date local TZ를 KST로 가정.
    // before/after 객체는 별도 인스턴스로, dirty=true (regen 발동) 검증.
    const before = new Date(2026, 4, 2, 23, 59, 50);
    const after  = new Date(2026, 4, 3, 0,  0,  10);
    const prev = getActiveMissions(before, u);
    const dailyBefore = prev.active.filter(m => m.period === 'daily').map(m => m.defId);
    expect(dailyBefore.length).toBeGreaterThan(0);
    const curr = getActiveMissions(after, u);
    expect(curr.dirty).toBe(true);
    expect(u.missions.lastDailySeed).not.toBe('');
  });

  it('single now capture invariant: same now produces idempotent dirty=false on second call', () => {
    const u = makeUser();
    const now = new Date(2026, 4, 2, 10, 0, 0);
    getActiveMissions(now, u);
    const second = getActiveMissions(now, u);
    expect(second.dirty).toBe(false);
  });
});
