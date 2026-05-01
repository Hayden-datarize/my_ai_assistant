import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountRewards, __resetForTest } from '../../../src/ui/rewards';
import { dispatch } from '../../../src/ui/events';

beforeEach(() => {
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
  document.body.innerHTML = '<div id="modalRoot"></div>';
  __resetForTest();
  mountRewards();
});

afterEach(() => __resetForTest());

describe('rewards — mission-complete toast', () => {
  it('mission-complete event → .toast--mission DOM 추가', () => {
    dispatch('dg:reward:mission-complete', {
      defId: 'daily-answer-1',
      period: 'daily',
      rewardXp: 10,
      at: Date.now(),
    });
    const toast = document.querySelector('.toast--mission');
    expect(toast).not.toBeNull();
    expect(toast!.textContent).toMatch(/미션 완수.*\+10 XP/);
  });

  it('monthly mission → .toast--monthly modifier 추가, +200 XP 강조', () => {
    dispatch('dg:reward:mission-complete', {
      defId: 'monthly-answers-20',
      period: 'monthly',
      rewardXp: 200,
      at: Date.now(),
    });
    const toast = document.querySelector('.toast--mission.toast--monthly');
    expect(toast).not.toBeNull();
    expect(toast!.textContent).toMatch(/이달의 도전 완수.*\+200 XP/);
  });
});
