import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  // F4-A: KST 경계 dedup — UTC 전날이어도 KST 기준 키가 정확히 생성되는지 확인
  it('KST 자정 직후 (UTC 전날) — getKSTDateIso가 KST 기준 날짜를 반환', () => {
    // KST 2026-05-02 00:30 = UTC 2026-05-01 15:30
    const fakeNow = new Date('2026-05-01T15:30:00Z');
    vi.setSystemTime(fakeNow);
    try {
      // UTC 기준 toISOString().slice(0,10) → '2026-05-01' (틀림)
      // KST 기준 getKSTDateIso → '2026-05-02' (맞음)
      const kstKey = getKSTDateIso(fakeNow);
      const utcKey = fakeNow.toISOString().slice(0, 10);
      expect(kstKey).toBe('2026-05-02');
      expect(utcKey).toBe('2026-05-01');
      expect(kstKey).not.toBe(utcKey); // 자정 직후 구간에서 반드시 달라야 함
    } finally {
      vi.useRealTimers();
    }
  });

  // F4-B: saveUser throw 시 fireTrigger가 예외를 전파 → 호출자(archive.ts)의 catch가 처리
  it('saveUser throw 시 fireArchiveRevisitTrigger가 예외를 전파 (호출자 catch 보장)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      if (key === 'user') throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    });
    try {
      expect(() => fireArchiveRevisitTrigger()).toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
