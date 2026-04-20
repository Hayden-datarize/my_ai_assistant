import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function mountHeatmapDom(): void {
  document.body.innerHTML = `
    <div id="statsTab">
      <div class="heatmap-labels" id="heatmapLabels"></div>
      <div class="heatmap-grid" id="heatmapGrid"></div>
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
    mountHeatmapDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  // [label, ISO date (UTC noon to avoid TZ flakiness), leading blanks, trailing blanks]
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

      for (let i = 0; i < leading; i++) {
        expect(cells[i]!.className).toContain('is-blank');
      }
      for (let i = leading; i < leading + 28; i++) {
        expect(cells[i]!.className).not.toContain('is-blank');
      }
      for (let i = leading + 28; i < cells.length; i++) {
        expect(cells[i]!.className).toContain('is-blank');
      }
    });
  }

  it('marks exactly 8 weekend data cells', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z')); // Wed
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const grid = document.getElementById('heatmapGrid')!;
    const weekendCells = grid.querySelectorAll('.heatmap-cell.is-weekend:not(.is-blank)');
    expect(weekendCells.length).toBe(8);
  });

  it('adds .weekend-label only to 토 and 일 label spans', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const labels = document.getElementById('heatmapLabels')!;
    const spans = Array.from(labels.querySelectorAll('span'));
    expect(spans).toHaveLength(7);
    const weekendLabels = spans.filter((s) => s.classList.contains('weekend-label'));
    expect(weekendLabels.map((s) => s.textContent)).toEqual(['토', '일']);
  });
});
