/**
 * @vitest-environment jsdom
 *
 * v3.11 T5 — archive scrap 카드는 home renderBriefingCard 시각 구조를 재사용한다.
 * - .card-overlay / .card-source / .card-thumb|.card-initial 셀렉터 검증
 * - data-briefing-id 보존 (delegation 호환)
 * - ✕ 버튼 aria-label override = '스크랩 해제'
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/ui/modals/shared', () => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

async function setupScrapView(briefing: Parameters<typeof import('../../src/state/briefings').saveBriefings>[0][number]): Promise<void> {
  const { saveBriefings } = await import('../../src/state/briefings');
  saveBriefings([briefing]);

  const container = document.createElement('div');
  container.id = 'archiveTab';
  document.body.appendChild(container);

  const tab = await import('../../src/ui/tabs/archive');
  const handlers = await import('../../src/ui/handlers/archive');
  tab.renderArchive(container);
  handlers.mountArchiveHandlers();

  document.querySelector<HTMLButtonElement>('[data-filter="scrap"]')!.click();
}

describe('archive scrap card uses briefing-card visual structure (v3.11 T5)', () => {
  it('scrapped briefing renders with .card-overlay + .card-source + thumb-or-initial', async () => {
    await setupScrapView({
      id: 'b1',
      date: '2026-04-28',
      url: 'https://example.com/a',
      title: 'sample',
      summary: 'sum',
      scrapped: true,
      read: false,
      memo: '',
      sourceTitle: 'Src',
      imageUrl: 'https://img.example.com/x.jpg',
    });
    const card = document.querySelector('.archive-card--scrap');
    expect(card).not.toBeNull();
    expect(card!.querySelector('.card-overlay')).not.toBeNull();
    expect(card!.querySelector('.card-source')?.textContent).toBe('Src');
    expect(card!.querySelector('.card-thumb, .card-initial')).not.toBeNull();
  });

  it('scrap card retains data-briefing-id for delegation', async () => {
    await setupScrapView({
      id: 'b-x',
      date: '2026-04-28',
      url: 'https://example.com/y',
      title: 't',
      summary: 's',
      scrapped: true,
      read: false,
      memo: '',
      sourceTitle: 'S',
    });
    const card = document.querySelector<HTMLElement>('.archive-card--scrap');
    expect(card?.dataset['briefingId']).toBe('b-x');
  });

  it('scrap card has ✕ delete button (archive-card-delete) with aria-label "스크랩 해제"', async () => {
    await setupScrapView({
      id: 'b1',
      date: '2026-04-28',
      url: 'https://example.com/a',
      title: 't',
      summary: 's',
      scrapped: true,
      read: false,
      memo: '',
      sourceTitle: 'S',
    });
    const btn = document.querySelector('.archive-card--scrap .archive-card-delete');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('스크랩 해제');
  });

  it('scrap card has no .card-actions (♥/✎ removed) — prevents idx-mismatch corruption', async () => {
    const { saveBriefings } = await import('../../src/state/briefings');
    saveBriefings([
      { id: 'A', date: '2026-04-28', url: 'https://a.com', title: 'A', summary: '', scrapped: false, read: false, memo: '', sourceTitle: 'S' },
      { id: 'B', date: '2026-04-28', url: 'https://b.com', title: 'B', summary: '', scrapped: false, read: false, memo: '', sourceTitle: 'S' },
      { id: 'C', date: '2026-04-28', url: 'https://c.com', title: 'C', summary: '', scrapped: true,  read: false, memo: '', sourceTitle: 'S' },
    ]);
    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);
    const tab = await import('../../src/ui/tabs/archive');
    const handlers = await import('../../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();
    document.querySelector<HTMLButtonElement>('[data-filter="scrap"]')!.click();
    const card = document.querySelector<HTMLElement>('.archive-card--scrap');
    expect(card).not.toBeNull();
    // No ♥ or ✎ buttons exposed in archive — prevents idx-bound mutate of wrong briefing
    expect(card!.querySelector('.card-actions')).toBeNull();
    expect(card!.querySelectorAll('button[data-action="scrap"], button[data-action="memo"]').length).toBe(0);
  });

  it('scrap card .card-main link click does NOT trigger setRead on a different briefing', async () => {
    const { loadBriefings, saveBriefings } = await import('../../src/state/briefings');
    saveBriefings([
      { id: 'A', date: '2026-04-28', url: 'https://a.com', title: 'A', summary: '', scrapped: false, read: false, memo: '', sourceTitle: 'S' },
      { id: 'B', date: '2026-04-28', url: 'https://b.com', title: 'B', summary: '', scrapped: false, read: false, memo: '', sourceTitle: 'S' },
      { id: 'C', date: '2026-04-28', url: 'https://c.com', title: 'C', summary: '', scrapped: true, read: false, memo: '', sourceTitle: 'S' },
    ]);
    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);
    const tab = await import('../../src/ui/tabs/archive');
    const handlers = await import('../../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();
    document.querySelector<HTMLButtonElement>('[data-filter="scrap"]')!.click();
    const card = document.querySelector<HTMLElement>('.archive-card--scrap')!;
    const link = card.querySelector<HTMLAnchorElement>('.card-main')!;
    link.click();
    // Verify briefing A (idx=0 in full list) is NOT mutated by the click
    const after = loadBriefings();
    expect(after[0]?.read).toBe(false);  // A still unread
    expect(after[1]?.read).toBe(false);  // B still unread
  });
});
