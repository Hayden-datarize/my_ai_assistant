import { describe, it, expect, beforeEach } from 'vitest';

describe('openMemoModal', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const root = document.createElement('div');
    root.id = 'modalRoot';
    document.body.append(root);
    const toastRoot = document.createElement('div');
    toastRoot.className = 'toast-container';
    document.body.append(toastRoot);
    localStorage.clear();
    localStorage.setItem('briefings', JSON.stringify([
      {
        id: '1', date: '2026-04-23', url: 'https://x.com', title: 't',
        summary: 's', scrapped: false, read: false, memo: '초기 메모',
      },
    ]));
  });

  it('opens modal pre-filled with existing memo', async () => {
    const { openMemoModal } = await import('../../src/ui/modals/memo');
    openMemoModal(0);
    const ta = document.querySelector<HTMLTextAreaElement>('#memoInput');
    expect(ta).not.toBeNull();
    expect(ta?.value).toBe('초기 메모');
  });

  it('save button persists memo + closes modal', async () => {
    const { openMemoModal } = await import('../../src/ui/modals/memo');
    openMemoModal(0);
    const ta = document.querySelector<HTMLTextAreaElement>('#memoInput')!;
    ta.value = '새로 쓴 메모';
    document.querySelector<HTMLButtonElement>('#saveMemoBtn')!.click();

    expect(document.querySelector('.dg-modal')).toBeNull();
    const stored = JSON.parse(localStorage.getItem('briefings')!) as Array<{ memo: string }>;
    expect(stored[0]!.memo).toBe('새로 쓴 메모');
  });

  it('cancel button closes without saving', async () => {
    const { openMemoModal } = await import('../../src/ui/modals/memo');
    openMemoModal(0);
    const ta = document.querySelector<HTMLTextAreaElement>('#memoInput')!;
    ta.value = '폐기할 메모';
    document.querySelector<HTMLButtonElement>('#cancelMemoBtn')!.click();

    expect(document.querySelector('.dg-modal')).toBeNull();
    const stored = JSON.parse(localStorage.getItem('briefings')!) as Array<{ memo: string }>;
    expect(stored[0]!.memo).toBe('초기 메모');
  });

  it('ESC (closeModal programmatic) does not persist changes', async () => {
    const { openMemoModal } = await import('../../src/ui/modals/memo');
    const { closeModal } = await import('../../src/ui/modals/shared');
    openMemoModal(0);
    const ta = document.querySelector<HTMLTextAreaElement>('#memoInput')!;
    ta.value = '취소될 변경';
    closeModal();

    const stored = JSON.parse(localStorage.getItem('briefings')!) as Array<{ memo: string }>;
    expect(stored[0]!.memo).toBe('초기 메모');
  });

  it('silently no-ops on invalid index', async () => {
    const { openMemoModal } = await import('../../src/ui/modals/memo');
    expect(() => openMemoModal(999)).not.toThrow();
    expect(document.querySelector('.dg-modal')).toBeNull();
  });

  it('escapes HTML in existing memo (no script injection)', async () => {
    localStorage.setItem('briefings', JSON.stringify([
      {
        id: '1', date: '2026-04-23', url: 'https://x.com', title: 't',
        summary: 's', scrapped: false, read: false,
        memo: '<script>alert(1)</script>',
      },
    ]));
    const { openMemoModal } = await import('../../src/ui/modals/memo');
    openMemoModal(0);
    // textarea value should be the literal string, NOT execute script
    const ta = document.querySelector<HTMLTextAreaElement>('#memoInput');
    expect(ta?.value).toBe('<script>alert(1)</script>');
    // script element should not actually be created
    expect(document.querySelector('.dg-modal-body script')).toBeNull();
  });
});
