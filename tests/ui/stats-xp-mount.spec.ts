import { describe, it, expect, beforeEach } from 'vitest';
import { renderStats } from '../../src/ui/tabs/stats';
import { saveUser } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';

/**
 * v3.27 T7: stats tab XP 차트 마운트 회귀.
 */

describe('v3.27 T7: stats #xpChartMount', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('heatmap-wrap 직후 #xpChartMount + svg 마운트', () => {
    saveUser(mkUser({
      xpHistory: [
        { date: '2026-05-01', xpEarned: 10 },
        { date: '2026-05-02', xpEarned: 15 },
      ],
    }));
    const container = document.createElement('div');
    renderStats(container);

    const heatmap = container.querySelector('.heatmap-wrap');
    const xpMount = container.querySelector('#xpChartMount');
    expect(heatmap).not.toBeNull();
    expect(xpMount).not.toBeNull();
    // DOM order: heatmap-wrap이 xpChartMount보다 앞 (DOCUMENT_POSITION_FOLLOWING=4).
    const rel = heatmap!.compareDocumentPosition(xpMount!);
    // eslint-disable-next-line no-bitwise -- DOM API uses bitwise flags
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(xpMount!.querySelector('svg.xp-chart')).not.toBeNull();
  });

  it('xpHistory 변경 후 renderStats 재호출 시 fresh svg (cumulative 갱신)', () => {
    saveUser(mkUser({ xpHistory: [{ date: '2026-05-01', xpEarned: 10 }] }));
    const container = document.createElement('div');
    renderStats(container);
    // 1개 entry → empty-state (length < 2 guard)
    expect(container.querySelector('.empty-state-text')).not.toBeNull();

    // entry 추가 → fresh render
    saveUser(mkUser({ xpHistory: [
      { date: '2026-05-01', xpEarned: 10 },
      { date: '2026-05-02', xpEarned: 15 },
      { date: '2026-05-03', xpEarned: 20 },
    ] }));
    renderStats(container);
    // 이제 path가 그려져야 함 (empty-state 사라짐)
    expect(container.querySelector('#xpChartMount svg.xp-chart path')).not.toBeNull();
  });
});
