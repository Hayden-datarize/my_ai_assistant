import { describe, it, expect } from 'vitest';
import { getActiveMissions } from '../../../src/state/missionEngine';
import type { User } from '../../../src/state/user';

function makeUser(): User {
  return {
    name: 'T', interests: ['pm'], onboardedAt: '2026-04-01',
    streak: 0, lastActiveDate: '', xp: 0, earnedBadges: {},
    gamificationMigrated: true, schemaVersion: 3,
    missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
  } as unknown as User;
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
    const before = new Date(2026, 4, 2, 23, 59, 50);
    const after  = new Date(2026, 4, 3, 0,  0,  10);
    const prev = getActiveMissions(before, u);
    const _set1 = new Set(prev.active.filter(m => m.period === 'daily').map(m => m.defId));
    void _set1;
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
