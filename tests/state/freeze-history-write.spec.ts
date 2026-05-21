import { describe, it, expect, beforeEach } from 'vitest';
import { saveUser, recordDailyAnswer, getFreezeHistory } from '../../src/state/user';
import { getKstDateStr } from '../../src/utils/dates';
import { mkUser } from '../unit/state/userFixture';

// 사전 review P1-2: app date는 KST anchor. UTC slice 금지 (NY TZ gate flake).
const daysAgoKst = (n: number) => getKstDateStr(new Date(Date.now() - n * 86400_000));

describe('freezeHistory write + read (v3.48)', () => {
  beforeEach(() => localStorage.clear());

  it('regen 발생(7일 경과, lastActiveDate 과거) → earned entry push', () => {
    // lastEarnedAt 8일 전 → regenerateFreeze가 +1. count 1 → 2.
    saveUser(mkUser({
      streak: 3, lastActiveDate: daysAgoKst(1),
      streakFreeze: { count: 1, lastEarnedAt: daysAgoKst(8) },
    }));
    recordDailyAnswer(10);
    const hist = getFreezeHistory();
    expect(hist.some((h) => h.kind === 'earned' && h.amount >= 1)).toBe(true);
  });

  it('consume 발생(gap 1, freeze 보유) → consumed entry push', () => {
    // lastActiveDate 2일 전 → gap 1 → consumeFreezeForGap(1) consumed 1.
    saveUser(mkUser({
      streak: 3, lastActiveDate: daysAgoKst(2),
      streakFreeze: { count: 2, lastEarnedAt: daysAgoKst(0) },  // cap → regen 0
    }));
    recordDailyAnswer(10);
    const hist = getFreezeHistory();
    expect(hist.some((h) => h.kind === 'consumed' && h.amount === 1)).toBe(true);
  });

  it('regen 0 + consume 0 (gap 0) → push 없음', () => {
    saveUser(mkUser({
      streak: 1, lastActiveDate: daysAgoKst(1),
      streakFreeze: { count: 2, lastEarnedAt: daysAgoKst(0) },  // cap → regen 0; gap 0 → consume 0
    }));
    recordDailyAnswer(10);
    expect(getFreezeHistory()).toEqual([]);
  });

  it('getFreezeHistory — 최근 desc + limit', () => {
    saveUser(mkUser({
      streakFreeze: { count: 0, lastEarnedAt: daysAgoKst(0) },
      freezeHistory: [
        { date: '2026-05-01', kind: 'earned', amount: 1 },
        { date: '2026-05-08', kind: 'consumed', amount: 1 },
        { date: '2026-05-15', kind: 'earned', amount: 2 },
      ],
    }));
    const hist = getFreezeHistory(2);
    expect(hist).toHaveLength(2);
    expect(hist[0]!.date).toBe('2026-05-15');  // 최신 first
    expect(hist[1]!.date).toBe('2026-05-08');
  });
});
