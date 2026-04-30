import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mountRewards, __resetForTest } from '../../../src/ui/rewards';
import { dispatch } from '../../../src/ui/events';

beforeEach(() => {
  document.body.innerHTML = `
    <div id="modalRoot"></div>
    <div class="chat-bubble" id="ut"></div>
    <span id="xpBadge">XP 0</span>
  `;
  __resetForTest();
  mountRewards();
});

afterEach(() => { vi.useRealTimers(); });

describe('xp-float', () => {
  it('xp-float event → .xp-float DOM 1개 추가', () => {
    dispatch('dg:reward:xp-float', { amount: 10, at: Date.now() });
    expect(document.querySelectorAll('.xp-float')).toHaveLength(1);
    expect(document.querySelector('.xp-float')!.textContent).toBe('+10 XP');
  });

  it('xp-float 1.2초 후 DOM 제거', () => {
    vi.useFakeTimers();
    dispatch('dg:reward:xp-float', { amount: 10, at: Date.now() });
    vi.advanceTimersByTime(1500);
    expect(document.querySelectorAll('.xp-float')).toHaveLength(0);
  });

  it('xpBadge ping — .badge-pulse 클래스 add 후 300ms remove', () => {
    vi.useFakeTimers();
    dispatch('dg:reward:xp-float', { amount: 10, at: Date.now() });
    vi.advanceTimersByTime(1000);
    expect(document.getElementById('xpBadge')!.classList.contains('badge-pulse')).toBe(true);
    vi.advanceTimersByTime(400);
    expect(document.getElementById('xpBadge')!.classList.contains('badge-pulse')).toBe(false);
  });

  it('xpBadge 미존재 시 → fallback 좌표 (우상단 absolute) 사용, 에러 안 남', () => {
    document.getElementById('xpBadge')?.remove();
    expect(() => dispatch('dg:reward:xp-float', { amount: 10, at: Date.now() })).not.toThrow();
    expect(document.querySelectorAll('.xp-float')).toHaveLength(1);
  });

  it('chat-bubble 미존재 시 → 화면 중앙 fallback start point', () => {
    document.querySelector('.chat-bubble')?.remove();
    expect(() => dispatch('dg:reward:xp-float', { amount: 10, at: Date.now() })).not.toThrow();
  });
});
