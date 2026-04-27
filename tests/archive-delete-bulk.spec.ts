/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveAnswers } from '../src/state/persistence';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

const setupArchive = async () => {
  saveAnswers([
    { id: 'a', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    { id: 'b', questionId: 'q2', text: 'two', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    { id: 'c', questionId: 'q3', text: 'three', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
  ] as never);
  const container = document.createElement('div');
  container.id = 'archiveTab';
  document.body.appendChild(container);
  const tab = await import('../src/ui/tabs/archive');
  const handlers = await import('../src/ui/handlers/archive');
  tab.renderArchive(container);
  handlers.mountArchiveHandlers();
};

describe('archive bulk delete', () => {
  it('toggles select mode and disables bulk button at 0 selected', async () => {
    await setupArchive();
    const toggle = document.querySelector<HTMLButtonElement>('#archiveSelectToggle');
    expect(toggle, 'toggle button exists').not.toBeNull();
    toggle!.click();
    expect(toggle!.getAttribute('aria-pressed')).toBe('true');
    const bulk = document.querySelector<HTMLButtonElement>('#archiveBulkDelete');
    expect(bulk, 'bulk button exists').not.toBeNull();
    expect(bulk!.disabled).toBe(true);
    expect(bulk!.textContent).toContain('0');
  });

  it('selects cards and updates bulk count + enables button', async () => {
    await setupArchive();
    document.querySelector<HTMLButtonElement>('#archiveSelectToggle')!.click();
    const cardA = document.querySelector<HTMLElement>(
      '.archive-card[data-answer-id="a"]'
    )!;
    const cardB = document.querySelector<HTMLElement>(
      '.archive-card[data-answer-id="b"]'
    )!;
    cardA.click();
    cardB.click();
    const bulk = document.querySelector<HTMLButtonElement>('#archiveBulkDelete')!;
    expect(bulk.disabled).toBe(false);
    expect(bulk.textContent).toContain('2');
  });

  it('confirms then deletes selected and shows undo toast', async () => {
    await setupArchive();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    document.querySelector<HTMLButtonElement>('#archiveSelectToggle')!.click();
    document.querySelector<HTMLElement>('.archive-card[data-answer-id="a"]')!.click();
    document.querySelector<HTMLElement>('.archive-card[data-answer-id="c"]')!.click();
    document.querySelector<HTMLButtonElement>('#archiveBulkDelete')!.click();

    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers().map((a) => a.id)).toEqual(['b']);
    expect(document.querySelector('.dg-toast--undo')).not.toBeNull();
  });

  it('cancels confirm leaves answers untouched', async () => {
    await setupArchive();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    document.querySelector<HTMLButtonElement>('#archiveSelectToggle')!.click();
    document.querySelector<HTMLElement>('.archive-card[data-answer-id="a"]')!.click();
    document.querySelector<HTMLButtonElement>('#archiveBulkDelete')!.click();

    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers()).toHaveLength(3);
    expect(document.querySelector('.dg-toast--undo')).toBeNull();
  });

  it('undo restores all deleted answers', async () => {
    await setupArchive();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    document.querySelector<HTMLButtonElement>('#archiveSelectToggle')!.click();
    document.querySelector<HTMLElement>('.archive-card[data-answer-id="a"]')!.click();
    document.querySelector<HTMLElement>('.archive-card[data-answer-id="b"]')!.click();
    document.querySelector<HTMLButtonElement>('#archiveBulkDelete')!.click();
    document.querySelector<HTMLButtonElement>('.dg-toast--undo button')!.click();

    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers()).toHaveLength(3);
  });

  // P1-1 review fix: ✕ click in select mode must be no-op (defense in depth — CSS hide + JS guard)
  it('ignores ✕ click in select mode (no confirm-less single delete)', async () => {
    await setupArchive();
    document.querySelector<HTMLButtonElement>('#archiveSelectToggle')!.click();
    // 선택 모드 ON 상태에서 카드 한 건 선택
    document.querySelector<HTMLElement>('.archive-card[data-answer-id="a"]')!.click();
    // CSS가 disable 시켜도 jsdom에서는 element가 존재 → 프로그래매틱 click 가능
    const deleteBtn = document.querySelector<HTMLButtonElement>(
      '.archive-card[data-answer-id="a"] .archive-card-delete'
    );
    expect(deleteBtn, '✕ button still in DOM in select mode').not.toBeNull();
    deleteBtn!.click();
    // 가드 통과: 답변 그대로 + undo 토스트 안 뜸 + 선택 상태 유지 (selectedIds → CSS .selected)
    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers()).toHaveLength(3);
    expect(document.querySelector('.dg-toast--undo')).toBeNull();
    expect(
      document.querySelector('.archive-card[data-answer-id="a"]')?.classList.contains('selected')
    ).toBe(true);
  });
});
