import { describe, it, expect, beforeEach, vi } from 'vitest';

// v3.18 T5 (G3-1): hydrateHeatmap의 loadAnswers / loadBriefings 의존 격리.
// (T0 review P1-2: KST/UTC TZ 영향 가능, sessionStorage 의존 — empty seed mock로 결정론화)
vi.mock('../../../src/state/persistence', () => ({
  loadAnswers: () => [],
  loadBriefings: () => [],
}));

import { hydrateHeatmap } from '../../../src/ui/handlers/stats';

describe('v3.18 T5 (G3-1) — is-future markup-layer focus fix', () => {
  beforeEach(() => {
    // jsdom DOM fixture (heatmapGrid + heatmapInfo)
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; static markup
    document.body.innerHTML = `
      <div id="heatmapWrap">
        <div id="heatmapGrid"></div>
        <div id="heatmapInfo"></div>
      </div>
    `;
    sessionStorage.clear();
    localStorage.clear();
  });

  it('future cells are explicitly tabindex="-1" regardless of dataCells[0] position', () => {
    hydrateHeatmap();
    const futureCells = document.querySelectorAll<HTMLButtonElement>('.heatmap-cell.is-future');
    // 요일 의존 (today가 Sun이면 future 0, 그 외 1~6) — count 검사 X, attribute 일관성만.
    futureCells.forEach((c) => {
      expect(c.getAttribute('tabindex')).toBe('-1');
    });
  });

  it('first non-future cell has tabindex="0" (explicit firstReachable)', () => {
    hydrateHeatmap();
    const allCells = document.querySelectorAll<HTMLButtonElement>('.heatmap-cell');
    const firstNonFuture = Array.from(allCells).find(
      (c) => c.dataset['future'] !== 'true',
    );
    expect(firstNonFuture).toBeDefined();
    expect(firstNonFuture!.getAttribute('tabindex')).toBe('0');
  });

  it('all non-future cells except first are tabindex="-1"', () => {
    hydrateHeatmap();
    const allCells = Array.from(document.querySelectorAll<HTMLButtonElement>('.heatmap-cell'));
    const nonFuture = allCells.filter((c) => c.dataset['future'] !== 'true');
    nonFuture.slice(1).forEach((c) => {
      expect(c.getAttribute('tabindex')).toBe('-1');
    });
  });
});
