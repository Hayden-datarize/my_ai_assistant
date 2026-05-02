import { describe, it, expect } from 'vitest';
import { tickMissionProgress } from '../../../src/state/missionEngine';
import type { User } from '../../../src/state/user';

function makeUserWithActiveDayMission(): User {
  return {
    name: 'T', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '',
    xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 3,
    missions: {
      active: [{ defId: 'weekly-active-5days', period: 'weekly', windowStart: 0,
                 progress: 0, completed: false, progressDates: [] }],
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
    },
  } as unknown as User;
}

describe('progressDates — immutable spread update (v3.13.2 P2-3)', () => {
  it('tick replaces progressDates array (new reference, not mutated in-place)', () => {
    const u = makeUserWithActiveDayMission();
    const before = u.missions.active[0]!.progressDates;
    tickMissionProgress(u, 'answer', new Date(2026, 4, 2));
    const after = u.missions.active[0]!.progressDates;
    expect(after).not.toBe(before); // new reference
    expect(after?.length).toBe(1);
  });

  it('idempotent: same-day tick does not double-push', () => {
    const u = makeUserWithActiveDayMission();
    const now = new Date(2026, 4, 2);
    tickMissionProgress(u, 'answer', now);
    tickMissionProgress(u, 'answer', now);
    expect(u.missions.active[0]!.progressDates?.length).toBe(1);
  });
});
