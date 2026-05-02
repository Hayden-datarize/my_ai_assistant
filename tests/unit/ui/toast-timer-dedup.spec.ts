import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mountRewards, __resetForTest } from '../../../src/ui/rewards';
import { dispatch } from '../../../src/ui/events';

// v3.14.2 T8 (P2-12-7): close button click 시 pending auto-dismiss timer가
// 다른 toast의 lifecycle을 침범하지 않음을 보장.
// removeToast의 `if (!el.parentElement) return` guard 덕분에
// timer가 fire되어도 DOM은 안전하지만, 본 spec은 그 invariant를 회귀 가드로 고정.

describe('rewards spawnToast — timer cleared on close (v3.12 P2-7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
    __resetForTest();
  });

  afterEach(() => {
    __resetForTest();
    vi.useRealTimers();
  });

  it('close button click clears pending auto-dismiss timer', () => {
    mountRewards();
    // findBadge('first-answer') 부재 → 카탈로그 실재 id 'answers-1' 사용
    dispatch('dg:reward:badge-unlock', { badgeId: 'answers-1', at: Date.now() });
    const toast = document.querySelector('.toast--badge');
    expect(toast).not.toBeNull();

    const closeBtn = toast!.querySelector<HTMLButtonElement>('.toast-close')!;
    closeBtn.click();
    expect(document.querySelector('.toast--badge')).toBeNull();

    // pending timer가 fire 되어도 DOM은 안전 (removeToast guard) — 회귀 가드
    vi.advanceTimersByTime(5000);
    expect(document.querySelector('.toast--badge')).toBeNull();
  });

  it('multi-toast: close one then advance does not affect the other', () => {
    mountRewards();
    dispatch('dg:reward:streak-milestone', { days: 3, at: Date.now() });
    dispatch('dg:reward:streak-milestone', { days: 7, at: Date.now() });

    const toasts = document.querySelectorAll('.toast--streak');
    expect(toasts.length).toBe(2);

    // 첫 toast만 close — 둘째는 정상 auto-dismiss 사이클 유지
    (toasts[0]!.querySelector<HTMLButtonElement>('.toast-close')!).click();
    expect(document.querySelectorAll('.toast--streak').length).toBe(1);

    // 둘째 toast의 auto-dismiss timer (TOAST_DURATIONS.streak = 3000ms) fire
    vi.advanceTimersByTime(3500);
    expect(document.querySelectorAll('.toast--streak').length).toBe(0);
  });
});
