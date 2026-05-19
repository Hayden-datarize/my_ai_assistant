/**
 * @vitest-environment jsdom
 *
 * v3.9 T4 — Archive scrap 카드 마크업 통일 (delegation 마이그레이션)
 * - 카드 className: archive-card archive-card--scrap
 * - data-briefing-id 속성 (b.id 사용, b.date 아님)
 * - per-card listener 제거 → handleCardClick (document-level delegation)
 * - ✕ 버튼 + Undo 시나리오는 T5에서 추가됨 (v3.9 T7 사후 정리)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// modals/shared mock — handler가 import할 때 mock 적용되도록 module-level
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

describe('Archive scrap 카드 마크업 통일 (T4)', () => {
  it('scrap 필터 시 카드는 .archive-card.archive-card--scrap + data-briefing-id를 가진다', async () => {
    const { saveBriefings } = await import('../src/state/briefings');
    saveBriefings([
      {
        id: 'b1',
        date: '2026-04-27',
        url: 'https://example.com',
        title: 'T1',
        summary: 'S1',
        scrapped: true,
        read: false,
        memo: '',
        pinned: false,
        interestId: 'unknown',
      },
    ]);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    // scrap 필터로 전환
    document.querySelector<HTMLButtonElement>('[data-entity="scrap"]')!.click();

    const card = document.querySelector<HTMLElement>('.archive-card.archive-card--scrap');
    expect(card).toBeTruthy();
    expect(card?.dataset['briefingId']).toBe('b1');
  });

  it('scrap 카드 click → showArchiveDetail({ kind: "briefing" }) (delegation)', async () => {
    const { saveBriefings } = await import('../src/state/briefings');
    const { openModal } = await import('../src/ui/modals/shared');
    saveBriefings([
      {
        id: 'b1',
        date: '2026-04-27',
        url: 'https://example.com',
        title: 'T1',
        summary: 'S1',
        scrapped: true,
        read: false,
        memo: '',
        pinned: false,
        interestId: 'unknown',
      },
    ]);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document.querySelector<HTMLButtonElement>('[data-entity="scrap"]')!.click();
    document.querySelector<HTMLElement>('.archive-card--scrap')!.click();

    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: '기록 상세' })
    );
  });

  it('scrap 카드 ✕ 클릭 → toggleScrap → SCRAP_UNDO_TOAST 표시', async () => {
    const { saveBriefings, loadBriefings } = await import('../src/state/briefings');
    saveBriefings([
      {
        id: 'b1',
        date: '2026-04-27',
        url: 'https://example.com',
        title: 'T1',
        summary: 'S1',
        scrapped: true,
        read: false,
        memo: '',
        pinned: false,
        interestId: 'unknown',
      },
    ]);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    const { MSG } = await import('../src/ui/messages');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document.querySelector<HTMLButtonElement>('[data-entity="scrap"]')!.click();
    document
      .querySelector<HTMLButtonElement>('.archive-card--scrap .archive-card-delete')!
      .click();

    expect(loadBriefings()[0]?.scrapped).toBe(false);
    expect(document.body.textContent).toContain(MSG.SCRAP_UNDO_TOAST);
  });

  it('Undo 클릭 → scrap 복원 + SCRAP_UNDO_RESTORED 토스트', async () => {
    const { saveBriefings, loadBriefings } = await import('../src/state/briefings');
    saveBriefings([
      {
        id: 'b1',
        date: '2026-04-27',
        url: 'https://example.com',
        title: 'T1',
        summary: 'S1',
        scrapped: true,
        read: false,
        memo: '',
        pinned: false,
        interestId: 'unknown',
      },
    ]);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    const { MSG } = await import('../src/ui/messages');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document.querySelector<HTMLButtonElement>('[data-entity="scrap"]')!.click();
    document
      .querySelector<HTMLButtonElement>('.archive-card--scrap .archive-card-delete')!
      .click();

    document.querySelector<HTMLButtonElement>('.toast--undo button')!.click();

    expect(loadBriefings()[0]?.scrapped).toBe(true);
    expect(document.body.textContent).toContain(MSG.SCRAP_UNDO_RESTORED);
  });
});
