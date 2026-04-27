/**
 * @vitest-environment jsdom
 *
 * v3.9 T4 — Archive scrap 카드 마크업 통일 (delegation 마이그레이션)
 * - 카드 className: archive-card archive-card--scrap
 * - data-briefing-id 속성 (b.id 사용, b.date 아님)
 * - per-card listener 제거 → handleCardClick (document-level delegation)
 * - ✕ 버튼/select 모드 호환은 T5에서 처리
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
    document.querySelector<HTMLButtonElement>('[data-filter="scrap"]')!.click();

    const card = document.querySelector<HTMLElement>('.archive-card.archive-card--scrap');
    expect(card).toBeTruthy();
    expect(card?.dataset['briefingId']).toBe('b1');
    // ✕ 버튼은 T5에서 추가 — 본 task에서는 마크업/delegation만 검증
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
      },
    ]);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document.querySelector<HTMLButtonElement>('[data-filter="scrap"]')!.click();
    document.querySelector<HTMLElement>('.archive-card--scrap')!.click();

    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: '기록 상세' })
    );
  });
});
