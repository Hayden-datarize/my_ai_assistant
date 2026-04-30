import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mountRewards, __resetForTest } from '../../../src/ui/rewards';
import { dispatch } from '../../../src/ui/events';

beforeEach(() => {
  document.body.innerHTML = '<div id="modalRoot"></div>';
  __resetForTest();
  mountRewards();
});

afterEach(() => { vi.useRealTimers(); });

describe('rewards — toast 큐', () => {
  it('badge-unlock event → 토스트 1개 DOM 추가', () => {
    dispatch('dg:reward:badge-unlock', { badgeId: 'streak-3', at: Date.now() });
    expect(document.querySelectorAll('.toast--badge')).toHaveLength(1);
  });

  it('동시 5개 unlock → 최대 3개만 visible (큐 cap)', () => {
    for (const id of ['streak-3', 'answers-1', 'tier-3-tree', 'memo-5', 'scrap-1']) {
      dispatch('dg:reward:badge-unlock', { badgeId: id, at: Date.now() });
    }
    expect(document.querySelectorAll('.toast--badge').length).toBeLessThanOrEqual(3);
  });

  it('dismiss 버튼 → 토스트 즉시 제거', () => {
    dispatch('dg:reward:badge-unlock', { badgeId: 'streak-3', at: Date.now() });
    const closeBtn = document.querySelector<HTMLButtonElement>('.toast--badge .toast-close');
    closeBtn?.click();
    expect(document.querySelectorAll('.toast--badge')).toHaveLength(0);
  });

  it('알 수 없는 badgeId → 토스트 안 띄움 (graceful)', () => {
    dispatch('dg:reward:badge-unlock', { badgeId: 'unknown-99', at: Date.now() });
    expect(document.querySelectorAll('.toast--badge')).toHaveLength(0);
  });

  it('badge 토스트 3초 후 자동 제거', () => {
    vi.useFakeTimers();
    dispatch('dg:reward:badge-unlock', { badgeId: 'streak-3', at: Date.now() });
    expect(document.querySelectorAll('.toast--badge')).toHaveLength(1);
    vi.advanceTimersByTime(3500);
    expect(document.querySelectorAll('.toast--badge')).toHaveLength(0);
  });

  it('큐 4번째: silent persist만 (이미 persistUnlocks가 처리한 상태이므로 토스트만 drop)', () => {
    for (const id of ['streak-3', 'answers-1', 'tier-3-tree', 'memo-5']) {
      dispatch('dg:reward:badge-unlock', { badgeId: id, at: Date.now() });
    }
    expect(document.querySelectorAll('.toast--badge').length).toBeLessThanOrEqual(3);
  });

  it('mountRewards idempotent — 두 번 호출해도 listener 1번만', () => {
    mountRewards();  // beforeEach가 이미 호출함, 본 줄은 두 번째
    dispatch('dg:reward:badge-unlock', { badgeId: 'streak-3', at: Date.now() });
    expect(document.querySelectorAll('.toast--badge')).toHaveLength(1);  // 2개 아님
  });

  it('badge 토스트 click → modal-system openModal 호출 (T10에서 wiring)', () => {
    dispatch('dg:reward:badge-unlock', { badgeId: 'streak-3', at: Date.now() });
    const detail = document.querySelector<HTMLButtonElement>('.toast--badge .toast-detail');
    expect(detail).not.toBeNull();
    // 실제 modal 본체는 T10에서 lazy-load + 검증
  });
});
