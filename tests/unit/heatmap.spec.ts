import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';

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

describe('hydrateHeatmap cell semantics', () => {
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

  it('marks today cell with .is-today', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const todayCells = document.querySelectorAll('.heatmap-cell.is-today');
    expect(todayCells.length).toBe(1);
    expect((todayCells[0] as HTMLButtonElement).dataset['date']).toBe('2026-04-22');
  });

  it('gives each data cell aria-label "YYYY-MM-DD, N개 달성"', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    localStorage.setItem('dg.answers', JSON.stringify([
      { date: '2026-04-20', text: 'a', type: '감정' },
      { date: '2026-04-20', text: 'b', type: '감정' },
    ]));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const cell = document.querySelector<HTMLButtonElement>('.heatmap-cell[data-date="2026-04-20"]');
    expect(cell).not.toBeNull();
    expect(cell!.getAttribute('aria-label')).toBe('2026-04-20, 2개 달성');
  });

  it('gives 0-count cell aria-label "YYYY-MM-DD, 기록 없음"', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    // Pick any empty day in the window, e.g., 2026-04-15
    const cell = document.querySelector<HTMLButtonElement>('.heatmap-cell[data-date="2026-04-15"]');
    expect(cell).not.toBeNull();
    expect(cell!.getAttribute('aria-label')).toBe('2026-04-15, 기록 없음');
  });
});

describe('hydrateHeatmap inline info', () => {
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

  it('shows empty state message when no answers in 28-day window', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const info = document.getElementById('heatmapInfo');
    expect(info?.textContent).toBe('아직 기록이 없어요. 첫 답변을 남겨보세요.');
  });

  it('shows summary with total + streak when there are answers', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    localStorage.setItem('dg.answers', JSON.stringify([
      { date: '2026-04-21', text: 'a', type: '감정' },
      { date: '2026-04-22', text: 'b', type: '감정' },
      { date: '2026-04-22', text: 'c', type: '감정' },
    ]));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const info = document.getElementById('heatmapInfo');
    expect(info?.textContent).toBe('최근 28일 · 3개 달성 · 최장 연속 2일');
  });

  it('updates info on cell mouseenter: "M월 D일 (요일) · N개 달성"', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    localStorage.setItem('dg.answers', JSON.stringify([
      { date: '2026-04-20', text: 'a', type: '감정' },
    ]));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const cell = document.querySelector<HTMLButtonElement>('.heatmap-cell[data-date="2026-04-20"]')!;
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const info = document.getElementById('heatmapInfo');
    expect(info?.textContent).toBe('4월 20일 (월) · 1개 달성');
  });

  it('updates info on empty cell mouseenter: "기록 없음"', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const cell = document.querySelector<HTMLButtonElement>('.heatmap-cell[data-date="2026-04-15"]')!;
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const info = document.getElementById('heatmapInfo');
    expect(info?.textContent).toBe('4월 15일 (수) · 기록 없음');
  });

  it('resets info to default on mouseleave', async () => {
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
    localStorage.setItem('dg.answers', JSON.stringify([
      { date: '2026-04-22', text: 'a', type: '감정' },
    ]));
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const cell = document.querySelector<HTMLButtonElement>('.heatmap-cell[data-date="2026-04-15"]')!;
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    cell.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    const info = document.getElementById('heatmapInfo');
    expect(info?.textContent).toBe('최근 28일 · 1개 달성 · 최장 연속 1일');
  });
});

describe('hydrateHeatmap roving tabindex + keyboard nav', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mountHeatmapDom();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  async function setupAndGetCells(): Promise<HTMLButtonElement[]> {
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.heatmap-cell:not(.is-blank)'));
  }

  it('first data cell has tabindex=0, others have tabindex=-1', async () => {
    const cells = await setupAndGetCells();
    expect(cells[0]!.getAttribute('tabindex')).toBe('0');
    for (let i = 1; i < cells.length; i++) expect(cells[i]!.getAttribute('tabindex')).toBe('-1');
  });

  it('ArrowDown on first cell moves focus to second data cell (next day)', async () => {
    const cells = await setupAndGetCells();
    cells[0]!.focus();
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(cells[1]);
    expect(cells[0]!.getAttribute('tabindex')).toBe('-1');
    expect(cells[1]!.getAttribute('tabindex')).toBe('0');
  });

  it('ArrowUp on first data cell does not move (boundary)', async () => {
    const cells = await setupAndGetCells();
    cells[0]!.focus();
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(cells[0]);
    expect(cells[0]!.getAttribute('tabindex')).toBe('0');
  });

  it('ArrowRight moves focus 7 days forward (next week same weekday)', async () => {
    const cells = await setupAndGetCells();
    cells[0]!.focus();
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(cells[7]);
  });

  it('ArrowLeft on first week does not move (boundary)', async () => {
    const cells = await setupAndGetCells();
    cells[0]!.focus();
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(cells[0]);
  });

  it('ArrowRight beyond last week does not move (boundary)', async () => {
    const cells = await setupAndGetCells();
    const last = cells[cells.length - 1]!;
    last.setAttribute('tabindex', '0');
    cells[0]!.setAttribute('tabindex', '-1');
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(last);
  });

  it('Enter on focused cell opens modal (shared.ts openModal called)', async () => {
    const cells = await setupAndGetCells();
    cells[0]!.focus();
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('.dg-modal')).not.toBeNull();
  });

  it('Modal close returns focus to the cell that opened it', async () => {
    const cells = await setupAndGetCells();
    cells[3]!.focus();
    cells[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('.dg-modal')).not.toBeNull();
    const { closeModal } = await import('../../src/ui/modals/shared');
    closeModal();
    expect(document.activeElement).toBe(cells[3]);
  });
});

describe('hydrateHeatmap entrance animation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mountHeatmapDom();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T03:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('first visit: adds .is-entering, sets sessionStorage, removes class after 250ms', async () => {
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const grid = document.getElementById('heatmapGrid')!;
    expect(grid.classList.contains('is-entering')).toBe(true);
    expect(sessionStorage.getItem('dg-heatmap-animated')).toBe('1');
    vi.advanceTimersByTime(250);
    expect(grid.classList.contains('is-entering')).toBe(false);
  });

  it('second visit (sessionStorage set): no .is-entering', async () => {
    sessionStorage.setItem('dg-heatmap-animated', '1');
    const mod = await import('../../src/ui/handlers/stats');
    mod.hydrateStats();
    const grid = document.getElementById('heatmapGrid')!;
    expect(grid.classList.contains('is-entering')).toBe(false);
  });
});

describe('v3.3.3 palette ramp B', () => {
  let css: string;
  beforeAll(() => {
    css = readFileSync('src/styles/tokens.css', 'utf8');
  });

  it('light ramp: l0=#E2E8F0, l1=#A5B4FC, l2=#818CF8, l3=primary', () => {
    const roots = css.match(/:root\s*\{[^}]*\}/g)?.join('\n') ?? '';
    expect(roots).toMatch(/--heatmap-l0:\s*#E2E8F0/);
    expect(roots).toMatch(/--heatmap-l1:\s*#A5B4FC/);
    expect(roots).toMatch(/--heatmap-l2:\s*#818CF8/);
    expect(roots).toMatch(/--heatmap-l3:\s*var\(--primary\)/);
  });

  it('dark ramp: l0=#0F172A, l1=#4338CA, l2=#6366F1, l3=primary', () => {
    const darks = css.match(/\[data-theme="dark"\]\s*\{[^}]*\}/g)?.join('\n') ?? '';
    expect(darks).toMatch(/--heatmap-l0:\s*#0F172A/);
    expect(darks).toMatch(/--heatmap-l1:\s*#4338CA/);
    expect(darks).toMatch(/--heatmap-l2:\s*#6366F1/);
    expect(darks).toMatch(/--heatmap-l3:\s*var\(--primary\)/);
  });
});
