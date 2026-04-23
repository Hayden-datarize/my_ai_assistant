import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function mountHeatmapDom(): void {
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM fixture; static template, no user interpolation
  document.body.innerHTML = `
    <div id="statsTab">
      <ol class="heatmap-weekday-labels" aria-hidden="true">
        <li>월</li><li>화</li><li>수</li><li>목</li><li>금</li><li>토</li><li>일</li>
      </ol>
      <div class="heatmap-grid" id="heatmapGrid"></div>
      <p class="heatmap-info" id="heatmapInfo" aria-live="polite"></p>
      <span id="levelIcon"></span>
      <span id="levelName"></span>
      <span id="levelXpText"></span>
      <div id="xpProgressFill"></div>
      <span id="statStreak"></span>
      <span id="statAnswers"></span>
      <span id="statArticles"></span>
      <span id="statXp"></span>
      <div id="badgesGrid"></div>
      <div id="categoryBreakdown"></div>
      <div id="growthSummary"></div>
    </div>
  `;
}

describe('hydrateHeatmap column alignment', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mountHeatmapDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  const weekdays: Array<[string, string, number, number]> = [
    ['Mon', '2026-04-20T03:00:00Z', 1, 6],
    ['Tue', '2026-04-21T03:00:00Z', 2, 5],
    ['Wed', '2026-04-22T03:00:00Z', 3, 4],
    ['Thu', '2026-04-23T03:00:00Z', 4, 3],
    ['Fri', '2026-04-24T03:00:00Z', 5, 2],
    ['Sat', '2026-04-25T03:00:00Z', 6, 1],
    ['Sun', '2026-04-26T03:00:00Z', 0, 0],
  ];

  for (const [label, iso, leading, trailing] of weekdays) {
    it(`aligns columns when today is ${label}`, async () => {
      vi.setSystemTime(new Date(iso));
      const mod = await import('../../src/ui/handlers/stats');
      mod.hydrateStats();
      const grid = document.getElementById('heatmapGrid')!;
      const cells = grid.children;
      expect(cells.length % 7).toBe(0);
      expect(cells.length).toBe(leading + 28 + trailing);
      for (let i = 0; i < leading; i++) expect(cells[i]!.className).toContain('is-blank');
      for (let i = leading; i < leading + 28; i++) expect(cells[i]!.className).not.toContain('is-blank');
      for (let i = leading + 28; i < cells.length; i++) expect(cells[i]!.className).toContain('is-blank');
    });
  }

  it('data cells have no is-weekend class (removed in v3.3.2)', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const grid = document.getElementById('heatmapGrid')!;
    expect(grid.querySelectorAll('.heatmap-cell.is-weekend').length).toBe(0);
  });

  it('static weekday label column has 7 <li> in 월~일 order', () => {
    const labels = document.querySelectorAll('.heatmap-weekday-labels li');
    expect(Array.from(labels).map((l) => l.textContent)).toEqual(['월', '화', '수', '목', '금', '토', '일']);
  });
});
