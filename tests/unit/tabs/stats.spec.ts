import { describe, it, expect, beforeEach } from 'vitest';
import { renderStats } from '../../../src/ui/tabs/stats';

beforeEach(() => {
  localStorage.clear();
});

describe('renderStats', () => {
  it('mounts stats container with categoryBreakdown', () => {
    const root = document.createElement('div');
    renderStats(root);
    expect(root.querySelector('#statsTab')).not.toBeNull();
    expect(root.querySelector('#categoryBreakdown')).not.toBeNull();
  });
  it('displays cumulative answer count in categoryBreakdown', () => {
    const root = document.createElement('div');
    renderStats(root);
    const breakdown = root.querySelector('#categoryBreakdown');
    expect(breakdown?.textContent).toMatch(/누적 답변 0개/);
  });
  it('renders no inline handler attributes', () => {
    const root = document.createElement('div');
    renderStats(root);
    expect(root.querySelectorAll('[onclick],[oninput],[onchange],[onkeydown]').length).toBe(0);
  });
  it('marks 토/일 weekday labels with .weekend-label', () => {
    const root = document.createElement('div');
    renderStats(root);
    const weekend = root.querySelectorAll('.heatmap-weekday-labels .weekend-label');
    expect(Array.from(weekend).map((l) => l.textContent)).toEqual(['토', '일']);
  });
});
