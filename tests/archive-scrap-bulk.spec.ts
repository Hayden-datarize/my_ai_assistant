/**
 * @vitest-environment jsdom
 *
 * v3.9 T5 — Archive scrap 벌크 해제
 * - select 모드 + scrap 필터 + 벌크 해제 → 모두 scrapped:false
 * - SCRAP_BULK_UNDO_TOAST 표시 + Undo 복원
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/ui/modals/shared', () => ({
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

describe('Archive scrap 벌크 해제 (T5)', () => {
  it('scrap 필터 + select 모드 + 카드 N개 선택 + 벌크 → 모두 scrapped:false + SCRAP_BULK_UNDO_TOAST', async () => {
    const { saveBriefings, loadBriefings } = await import('../src/state/briefings');
    saveBriefings([
      { id: 'b1', date: 'd1', url: 'https://example.com/1', title: 't1', summary: 's1', scrapped: true, read: false, memo: '' },
      { id: 'b2', date: 'd2', url: 'https://example.com/2', title: 't2', summary: 's2', scrapped: true, read: false, memo: '' },
    ]);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    const { MSG } = await import('../src/ui/messages');
    tab.renderArchive(container);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    handlers.mountArchiveHandlers();

    document.querySelector<HTMLButtonElement>('[data-entity="scrap"]')!.click();
    document.getElementById('archiveSelectToggle')!.click();
    document
      .querySelectorAll<HTMLElement>('.archive-card--scrap')
      .forEach((c) => c.click());
    document.getElementById('archiveBulkDelete')!.click();

    expect(loadBriefings().every((b) => !b.scrapped)).toBe(true);
    expect(document.body.textContent).toContain(MSG.SCRAP_BULK_UNDO_TOAST(2));
  });

  it('Undo 클릭 시 모든 scrap 복원 + SCRAP_UNDO_RESTORED 토스트', async () => {
    const { saveBriefings, loadBriefings } = await import('../src/state/briefings');
    saveBriefings([
      { id: 'b1', date: 'd1', url: 'https://example.com/1', title: 't1', summary: 's1', scrapped: true, read: false, memo: '' },
      { id: 'b2', date: 'd2', url: 'https://example.com/2', title: 't2', summary: 's2', scrapped: true, read: false, memo: '' },
    ]);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    const { MSG } = await import('../src/ui/messages');
    tab.renderArchive(container);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    handlers.mountArchiveHandlers();

    document.querySelector<HTMLButtonElement>('[data-entity="scrap"]')!.click();
    document.getElementById('archiveSelectToggle')!.click();
    document
      .querySelectorAll<HTMLElement>('.archive-card--scrap')
      .forEach((c) => c.click());
    document.getElementById('archiveBulkDelete')!.click();

    document.querySelector<HTMLButtonElement>('.toast--undo button')!.click();

    expect(loadBriefings().every((b) => b.scrapped)).toBe(true);
    expect(document.body.textContent).toContain(MSG.SCRAP_UNDO_RESTORED);
  });
});
