import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadUserData, saveUser, recordDailyAnswer, getSaveErrorMessage } from '../../src/state/user';
import { MSG } from '../../src/ui/messages';

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

  it('recordDailyAnswer increments xp and levels up per 100 xp', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '2026-04-19', xp: 90, level: 1 });
    recordDailyAnswer(20);
    const u = loadUserData()!;
    expect(u.xp).toBe(110);
    expect(u.level).toBe(2);
  });

  it('recordDailyAnswer bumps streak when last active was yesterday', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 3, lastActiveDate: '2026-04-18', xp: 0, level: 1 });
    recordDailyAnswer(10);
    expect(loadUserData()!.streak).toBe(4);
  });

  it('recordDailyAnswer resets streak to 1 after gap', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 3, lastActiveDate: '2026-04-15', xp: 0, level: 1 });
    recordDailyAnswer(10);
    expect(loadUserData()!.streak).toBe(1);
  });

  it('recordDailyAnswer keeps streak idempotent on same-day reinvoke (xp still accumulates)', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 5, lastActiveDate: '2026-04-19', xp: 20, level: 1 });
    recordDailyAnswer(10);
    const u = loadUserData()!;
    expect(u.streak).toBe(5);
    expect(u.xp).toBe(30);
  });

  it('recordDailyAnswer starts streak at 1 for fresh user (lastActiveDate="")', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '2026-04-19', streak: 0, lastActiveDate: '', xp: 0, level: 1 });
    recordDailyAnswer(10);
    const u = loadUserData()!;
    expect(u.streak).toBe(1);
    expect(u.lastActiveDate).toBe('2026-04-19');
  });

  it('recordDailyAnswer no-ops when no user cached', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    expect(() => recordDailyAnswer(10)).not.toThrow();
    expect(loadUserData()).toBeNull();
  });

  it('recordDailyAnswer propagates DOMException when setItem throws QuotaExceededError', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser({ name: 'H', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '', xp: 0, level: 1 });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => recordDailyAnswer(10)).toThrow(DOMException);
    spy.mockRestore();
  });

  it('getSaveErrorMessage returns quota message for QuotaExceededError', () => {
    const err = new DOMException('quota', 'QuotaExceededError');
    expect(getSaveErrorMessage(err)).toBe(MSG.SAVE_QUOTA_EXCEEDED);
  });

  it('getSaveErrorMessage returns fallback message for generic Error', () => {
    const err = new Error('boom');
    expect(getSaveErrorMessage(err)).toBe(MSG.SAVE_FAILED);
  });

  it('getSaveErrorMessage returns fallback message for string error', () => {
    expect(getSaveErrorMessage('some string')).toBe(MSG.SAVE_FAILED);
  });

  it('saveUser throws DOMException when setItem throws QuotaExceededError', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const u = { name: 'H', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '', xp: 0, level: 1 };
    expect(() => saveUser(u)).toThrow(DOMException);
    spy.mockRestore();
  });
});
