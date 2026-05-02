import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// v3.14.2 T9 (P2-12-8): __resetForTest 호출 후, mountRewards 시점에 등록되었던
// pending auto-dismiss setTimeout이 fire되어도 DOM에 zombie toast가 남지 않음을 보장.
// 본질은 P2-12-7과 동일 — removeToast의 `if (!el.parentElement) return` guard와
// container 제거(__resetForTest)의 조합이 timer leak을 자연스럽게 무해화.

describe('rewards __resetForTest — clears pending timers (v3.12 P2-8)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reset between specs — pending timer does not fire after reset', async () => {
    const { mountRewards, __resetForTest } = await import('../../../src/ui/rewards');
    const { dispatch } = await import('../../../src/ui/events');
    mountRewards();
    dispatch('dg:reward:streak-milestone', { days: 3, at: Date.now() });
    expect(document.querySelectorAll('.toast--streak').length).toBe(1);
    __resetForTest();
    expect(document.querySelectorAll('.toast--streak').length).toBe(0);
    vi.advanceTimersByTime(5000);
    // After reset + advance, no zombie toast (container removed → timer fires harmlessly)
    expect(document.querySelectorAll('.toast').length).toBe(0);
  });
});
