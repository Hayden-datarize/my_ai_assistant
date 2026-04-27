/**
 * @vitest-environment jsdom
 *
 * v3.9 T5 — Select 모드 진입 시 답변/scrap 혼합 선택 차단
 * - active 외 chip aria-disabled=true + disabled
 * - select 모드 종료 시 모든 chip 복원
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

describe('Select 모드 필터 잠금 (T5)', () => {
  it('select 모드 진입 → active 외 filter chip이 aria-disabled=true가 된다', async () => {
    const { saveAnswers } = await import('../src/state/persistence');
    saveAnswers([
      { id: 'a1', questionId: 'q1', text: 't', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    ] as never);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document.getElementById('archiveSelectToggle')!.click();

    const active = document.querySelector<HTMLButtonElement>(
      '.filter-chip[data-filter="all"]'
    )!;
    expect(active.disabled).toBe(false);
    expect(active.getAttribute('aria-disabled')).not.toBe('true');

    document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((c) => {
      if (c !== active) {
        expect(c.disabled).toBe(true);
        expect(c.getAttribute('aria-disabled')).toBe('true');
      }
    });
  });

  it('select 모드 종료 → 모든 chip 복원 (disabled=false, aria-disabled 제거)', async () => {
    const { saveAnswers } = await import('../src/state/persistence');
    saveAnswers([
      { id: 'a1', questionId: 'q1', text: 't', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    ] as never);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    const toggle = document.getElementById('archiveSelectToggle')!;
    toggle.click(); // ON
    toggle.click(); // OFF

    document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((c) => {
      expect(c.disabled).toBe(false);
      expect(c.getAttribute('aria-disabled')).not.toBe('true');
    });
  });
});
