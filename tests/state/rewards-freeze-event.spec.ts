import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveUser, recordDailyAnswer } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';

/**
 * v3.21 T5: Streak Freeze 소비 toast — caller-side direct dispatch.
 *
 * 사전 review P0-2 fix: 초기 plan은 Snapshot.freezeCount delta + runSweep 흐름이었으나
 * regen +1 → consume −1 → prev/curr 둘 다 0 → net=0 false-negative.
 * 1주 결석 후 첫 답변(=핵심 use case)에서 toast 안 뜸. → caller-side direct dispatch로 우회.
 *
 * 채택 옵션: **Option B (saveUser-after dispatch)** — recordDailyAnswer 안에서
 *   consume 결과를 캡처 → saveUser 성공 후 dispatch.
 *   v3.12 false-fire invariant 정합 (saveUser throw 시 dispatch 차단).
 *
 * `events.ts`의 `dispatch()`/`on()` 헬퍼는 `document`를 target으로 사용한다 (events.ts:51 참고).
 *
 * today=2026-05-08 (KST) 기준 결정론화 — user-record-with-freeze.spec.ts 패턴 차용.
 */
describe('streak-freeze-used reward event (caller-side dispatch)', () => {
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    // KST 자정 anchored — Asia/Seoul 2026-05-08 00:00:00 = UTC 2026-05-07 15:00:00
    vi.setSystemTime(new Date(Date.parse('2026-05-08T00:00:00+09:00')));
    handler = vi.fn();
    document.addEventListener('dg:reward:streak-freeze-used', handler);
  });

  afterEach(() => {
    document.removeEventListener('dg:reward:streak-freeze-used', handler);
    vi.useRealTimers();
  });

  it('consumed 1 + preserved → dispatch with detail {days: 1}', () => {
    // gap=1 + freeze=1 → consume 1 (T3 시나리오 재사용)
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-05-06',  // 그제 (gap=1)
      streakFreeze: { count: 1, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));

    recordDailyAnswer(0);

    expect(handler).toHaveBeenCalledOnce();
    const ev = handler.mock.calls[0]![0] as CustomEvent<{ days: number }>;
    expect(ev.detail).toEqual({ days: 1 });
  });

  it('consumed 0 (gap=0, 어제 활동) → no dispatch', () => {
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-05-07',  // 어제 (gap=0)
      streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));

    recordDailyAnswer(0);

    expect(handler).not.toHaveBeenCalled();
  });

  it('preserved=false (freeze 부족 reset) → no dispatch', () => {
    // gap=2 + freeze=1 → consumed=1, preserved=false (insufficient → reset)
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-05-05',  // 3일 전 (gap=2)
      streakFreeze: { count: 1, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));

    recordDailyAnswer(0);

    expect(handler).not.toHaveBeenCalled();
  });

  it('saveUser throw 시 dispatch 안 함 (Option B — saveUser-after defer)', () => {
    // 초기 saveUser는 정상 실행, recordDailyAnswer 내부 saveUser만 throw하도록 spy 설치
    saveUser(mkUser({
      streak: 5,
      lastActiveDate: '2026-05-06',  // gap=1 (covered)
      streakFreeze: { count: 1, lastEarnedAt: '2026-05-07' },
      gardenBackfilled: true,
    }));

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === 'user') throw new DOMException('Quota', 'QuotaExceededError');
    });

    expect(() => recordDailyAnswer(0)).toThrow();
    // Option B 정합: saveUser throw → dispatch 도달 안 함 (false-fire 방지)
    expect(handler).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});
