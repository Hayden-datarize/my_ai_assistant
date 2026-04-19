import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadUserData, saveUser, recordActivity, checkAndUpdateStreak } from '../../src/state/user';

describe('state/user', () => {
  beforeEach(() => localStorage.clear());

  it('loadUserData returns null when none saved', () => {
    expect(loadUserData()).toBeNull();
  });

  it('saveUser and loadUserData roundtrip', () => {
    const u = { name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-19', streak: 0, lastActiveDate: '', xp: 0, level: 1 };
    saveUser(u);
    expect(loadUserData()).toEqual(u);
  });

  it('recordActivity increments xp and levels up per 100 xp', () => {
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '', xp: 90, level: 1 });
    recordActivity(20);
    const u = loadUserData()!;
    expect(u.xp).toBe(110);
    expect(u.level).toBe(2);
  });

  it('checkAndUpdateStreak bumps streak when last active was yesterday', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 3, lastActiveDate: '2026-04-18', xp: 0, level: 1 });
    checkAndUpdateStreak();
    expect(loadUserData()!.streak).toBe(4);
  });

  it('checkAndUpdateStreak resets to 1 when last active older than 1 day', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 3, lastActiveDate: '2026-04-15', xp: 0, level: 1 });
    checkAndUpdateStreak();
    expect(loadUserData()!.streak).toBe(1);
  });

  it('checkAndUpdateStreak is idempotent when already ran today', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 5, lastActiveDate: '2026-04-19', xp: 0, level: 1 });
    checkAndUpdateStreak();
    expect(loadUserData()!.streak).toBe(5);
  });
});
