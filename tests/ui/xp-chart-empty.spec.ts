import { describe, it, expect } from 'vitest';
import { renderXpChart } from '../../src/ui/components/xp-chart';

/**
 * v3.27 T6: XP 차트 empty guard (history.length < 2).
 */

describe('v3.27 T6: XP 차트 empty guard', () => {
  it('history.length=0 → empty-state + "아직 데이터가 없어요"', () => {
    const svg = renderXpChart([]);
    expect(svg.querySelector('.empty-state-text')).not.toBeNull();
    expect(svg.textContent).toMatch(/아직 데이터가 없어요/);
    expect(svg.querySelector('path')).toBeNull();
  });

  it('history.length=1 → empty-state (line 그릴 수 없음)', () => {
    const svg = renderXpChart([{ date: '2026-05-01', cumulativeXp: 10 }]);
    expect(svg.querySelector('.empty-state-text')).not.toBeNull();
    expect(svg.querySelector('path')).toBeNull();
  });
});
