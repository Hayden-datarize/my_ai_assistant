import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveUser, loadUserData, recordDailyAnswer } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';

/**
 * v3.21 T3: recordDailyAnswer freeze 주입 통합 테스트.
 *
 * Duolingo 정석:
 *   - regen 먼저 → consume → streak update (사전 review R2)
 *   - atomic single-write (saveUser 1회 — v3.10 graduated)
 *   - gap 0 → streak +1
 *   - gap N + freeze ≥ N → streak +1, freeze -N
 *   - gap N + freeze < N → streak = 1 (reset)
 *   - 신규 user (lastActiveDate empty) → streak 1, freeze 그대로
 *   - idempotent — 같은 날 재제출 → 변화 없음
 *
 * 모든 시나리오는 today=2026-05-08 (KST) 기준 vi.setSystemTime로 결정론화한다.
 */
describe('recordDailyAnswer with freeze', () => {
  beforeEach(() => {
    localStorage.clear();
    // KST 자정 anchored — Asia/Seoul 2026-05-08 00:00:00 = UTC 2026-05-07 15:00:00
    vi.setSystemTime(new Date(Date.parse('2026-05-08T00:00:00+09:00')));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gap 0 (어제 활동) + freeze 2 → streak +1, freeze 그대로', () => {
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-05-07',  // 어제
      streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },  // 1d ago — regen 안 함
      gardenBackfilled: true,
    }));
    recordDailyAnswer(0);
    const after = loadUserData()!;
    expect(after.streak).toBe(6);
    expect(after.streakFreeze.count).toBe(2);
  });

  it('gap 1 + freeze 1 → streak +1, freeze 0 (covered)', () => {
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-05-06',  // 그제 (gap=1)
      streakFreeze: { count: 1, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));
    recordDailyAnswer(0);
    const after = loadUserData()!;
    expect(after.streak).toBe(6);
    expect(after.streakFreeze.count).toBe(0);
  });

  it('gap 2 + freeze 1 → streak reset 1, freeze 0 (insufficient)', () => {
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-05-05',  // 3일 전 (gap=2)
      streakFreeze: { count: 1, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));
    recordDailyAnswer(0);
    const after = loadUserData()!;
    expect(after.streak).toBe(1);
    expect(after.streakFreeze.count).toBe(0);
  });

  it('gap 2 + freeze 2 → streak +1, freeze 0 (covered)', () => {
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-05-05',  // 3일 전 (gap=2)
      streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));
    recordDailyAnswer(0);
    const after = loadUserData()!;
    expect(after.streak).toBe(6);
    expect(after.streakFreeze.count).toBe(0);
  });

  it('idempotent — 같은 날 재제출 시 streak/freeze 변화 없음', () => {
    saveUser(mkUser({
      streak: 6,
      lastActiveDate: '2026-05-08',  // 오늘
      streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));
    recordDailyAnswer(0);
    recordDailyAnswer(0);
    const after = loadUserData()!;
    expect(after.streak).toBe(6);
    expect(after.streakFreeze.count).toBe(2);
  });

  it('신규 user (lastActiveDate empty) → streak 1, freeze 그대로', () => {
    saveUser(mkUser({
      streak: 0,
      lastActiveDate: '',
      streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));
    recordDailyAnswer(0);
    const after = loadUserData()!;
    expect(after.streak).toBe(1);
    expect(after.streakFreeze.count).toBe(2);
  });

  it('순서 invariant — 1주 결석 + freeze 0 + lastEarnedAt 8일 전 → regen +1 후 consume → cover 불가, reset', () => {
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-04-30',  // 8일 전 (gap=7)
      streakFreeze: { count: 0, lastEarnedAt: '2026-04-30' },  // 8d ago → regen +1
      gardenBackfilled: true,
    }));
    recordDailyAnswer(0);
    const after = loadUserData()!;
    // regen으로 +1 freeze (count: 0 → 1), 그러나 gap=7일이라 cover 불가 → reset
    // consume(7, count=1) → consumed=1, preserved=false → freeze 0, streak 1
    expect(after.streak).toBe(1);
    expect(after.streakFreeze.count).toBe(0);  // regen +1 → consume 1 (cover 부족) → 0
  });
});
