import { describe, it, expect, beforeEach } from 'vitest';
import { fireBriefingViewTrigger, fireArchiveRevisitTrigger, fireCrossInterestTrigger } from '../../../src/ui/handlers/missions-triggers';
import { getCachedUser, saveUser } from '../../../src/state/user';
import { migrateUserToV3 } from '../../../src/state/migration';
import { getKSTDateIso, getKSTWeekIso, getKSTMonthIso } from '../../../src/state/missionEngine';

beforeEach(() => {
  localStorage.clear();
  const v3 = migrateUserToV3({
    name: 'T', interests: [], onboardedAt: 0, streak: 0, lastActiveDate: '',
    xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 2,
  });
  v3.missions.active = [
    { defId: 'daily-briefing-5', period: 'daily', windowStart: 0, progress: 0, completed: false },
    { defId: 'daily-cross-interest-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
    { defId: 'daily-archive-revisit-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
  ];
  const now = new Date();
  v3.missions.lastDailySeed = getKSTDateIso(now);    // match today → prevent regen overwriting fixture
  v3.missions.currentWeekIso = getKSTWeekIso(now);
  v3.missions.currentMonthIso = getKSTMonthIso(now);
  saveUser(v3);
});

describe('mission triggers', () => {
  it('fireBriefingViewTrigger → daily-briefing-5 progress +1', () => {
    fireBriefingViewTrigger();
    const u = getCachedUser()!;
    expect(u.missions.active.find(m => m.defId === 'daily-briefing-5')!.progress).toBe(1);
  });

  it('fireArchiveRevisitTrigger → daily-archive-revisit-1 completed', () => {
    fireArchiveRevisitTrigger();
    const u = getCachedUser()!;
    expect(u.missions.active.find(m => m.defId === 'daily-archive-revisit-1')!.completed).toBe(true);
  });

  it('fireCrossInterestTrigger → daily-cross-interest-1 completed', () => {
    fireCrossInterestTrigger();
    const u = getCachedUser()!;
    expect(u.missions.active.find(m => m.defId === 'daily-cross-interest-1')!.completed).toBe(true);
  });
});
