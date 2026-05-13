import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadUserData, saveUser, recordDailyAnswer, getSaveErrorMessage } from '../../src/state/user';
import { MSG } from '../../src/ui/messages';
import { mkUser } from './state/userFixture';

describe('state/user', () => {
  beforeEach(() => localStorage.clear());

  it('loadUserData returns null when none saved', () => {
    expect(loadUserData()).toBeNull();
  });

  it('saveUser and loadUserData roundtrip', () => {
    // T8: gardenBackfilled: true로 backfill 스킵 — loadUserData in-memory mutation 방지
    const u = mkUser({ name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-19', gardenBackfilled: true });
    saveUser(u);
    expect(loadUserData()).toEqual(u);
  });

  it('recordDailyAnswer increments xp (level 필드 제거됨, tier는 derive)', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser(mkUser({ lastActiveDate: '2026-04-19', xp: 90 }));
    recordDailyAnswer(20);
    const u = loadUserData()!;
    expect(u.xp).toBe(110);
    expect((u as unknown as Record<string, unknown>).level).toBeUndefined();
  });

  it('recordDailyAnswer bumps streak when last active was yesterday', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser(mkUser({ name: 'H', streak: 3, lastActiveDate: '2026-04-18' }));
    recordDailyAnswer(10);
    expect(loadUserData()!.streak).toBe(4);
  });

  it('recordDailyAnswer resets streak to 1 after gap', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser(mkUser({ name: 'H', streak: 3, lastActiveDate: '2026-04-15' }));
    recordDailyAnswer(10);
    expect(loadUserData()!.streak).toBe(1);
  });

  it('recordDailyAnswer keeps streak idempotent on same-day reinvoke (xp still accumulates)', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser(mkUser({ name: 'H', streak: 5, lastActiveDate: '2026-04-19', xp: 20 }));
    recordDailyAnswer(10);
    const u = loadUserData()!;
    expect(u.streak).toBe(5);
    expect(u.xp).toBe(30);
  });

  it('recordDailyAnswer starts streak at 1 for fresh user (lastActiveDate="")', () => {
    vi.setSystemTime(new Date('2026-04-19'));
    saveUser(mkUser({ name: 'H', onboardedAt: '2026-04-19' }));
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
    // T8: gardenBackfilled: true로 backfill setItem 호출 차단 — spy가 saveUser에 도달하도록
    saveUser(mkUser({ name: 'H', gardenBackfilled: true }));
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
    const u = mkUser({ name: 'H' });
    expect(() => saveUser(u)).toThrow(DOMException);
    spy.mockRestore();
  });
});
