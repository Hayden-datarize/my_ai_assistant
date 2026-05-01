import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mountRewards, __resetForTest } from '../../../src/ui/rewards';
import { dispatch } from '../../../src/ui/events';

beforeEach(() => {
  // eslint-disable-next-line no-restricted-syntax
  document.body.innerHTML = '<div id="modalRoot"></div>';
  __resetForTest();
  mountRewards();
});

afterEach(() => { vi.useRealTimers(); });

describe('level-up', () => {
  it('level-up event → .toast--levelup 1개 + .confetti-particle 30개', () => {
    dispatch('dg:reward:level-up', { tierId: 3, at: Date.now() });
    expect(document.querySelectorAll('.toast--levelup')).toHaveLength(1);
    expect(document.querySelectorAll('.confetti-particle')).toHaveLength(30);
  });

  it('confetti 1초 후 모두 제거', () => {
    vi.useFakeTimers();
    dispatch('dg:reward:level-up', { tierId: 3, at: Date.now() });
    vi.advanceTimersByTime(1500);
    expect(document.querySelectorAll('.confetti-particle')).toHaveLength(0);
  });

  it('알 수 없는 tierId → 토스트 안 띄움 (graceful)', () => {
    dispatch('dg:reward:level-up', { tierId: 99, at: Date.now() });
    expect(document.querySelectorAll('.toast--levelup')).toHaveLength(0);
  });

  it('confetti는 level-up 1회만 — badge unlock 동시 발생해도 confetti 1회', () => {
    dispatch('dg:reward:level-up', { tierId: 3, at: Date.now() });
    dispatch('dg:reward:badge-unlock', { badgeId: 'tier-3-tree', at: Date.now() });
    expect(document.querySelectorAll('.confetti-particle')).toHaveLength(30);
  });
});
