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

// Answer 타입: id, questionId, text, authorId, createdAt, schemaVersion + optional date/type/evaluation
const seedAnswers = () => {
  saveAnswers([
    { id: 'a', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    { id: 'b', questionId: 'q2', text: 'two', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
  ] as never);
};

describe('archive target delete', () => {
  it('removes card from DOM and storage on ✕ click', async () => {
    seedAnswers();
    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    const card = document.querySelector<HTMLElement>(
      '.archive-card[data-answer-id="a"]'
    );
    expect(card, 'card exists').not.toBeNull();

    const btn = card!.querySelector<HTMLButtonElement>('.archive-card-delete');
    expect(btn, '✕ button exists').not.toBeNull();
    btn!.click();

    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers()).toHaveLength(1);
    expect(loadAnswers()[0]?.id).toBe('b');
    expect(document.querySelector('.toast--undo')).not.toBeNull();
  });

  it('restores answer when undo clicked within 5s', async () => {
    saveAnswers([
      { id: 'a', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    ] as never);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document
      .querySelector<HTMLButtonElement>('.archive-card-delete')!
      .click();
    document
      .querySelector<HTMLButtonElement>('.toast--undo button')!
      .click();

    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers()).toHaveLength(1);
    expect(loadAnswers()[0]?.id).toBe('a');
  });

  it('Undo 클릭 시 atomic single write로 복원하고 DELETE_UNDO_RESTORED 토스트를 표시한다', async () => {
    saveAnswers([
      { id: 'a', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    ] as never);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);

    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    // 단건 ✕ 클릭
    document.querySelector<HTMLButtonElement>('.archive-card-delete')!.click();

    // setItem 호출 카운트는 Undo 시점부터 측정
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    // Undo 클릭
    document.querySelector<HTMLButtonElement>('.toast--undo button')!.click();

    // atomic: dg.answers setItem 1회만 (saveAnswers([...current, snapshot]))
    const calls = setItemSpy.mock.calls.filter(([k]) => k === 'dg.answers');
    expect(calls).toHaveLength(1);

    // DELETE_UNDO_RESTORED 토스트 표시
    const { MSG } = await import('../src/ui/messages');
    expect(document.body.textContent).toContain(MSG.DELETE_UNDO_RESTORED);

    setItemSpy.mockRestore();
  });

  it('shows error toast and keeps card on storage throw', async () => {
    saveAnswers([
      { id: 'a', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    ] as never);

    // setItem을 항상 throw — 카드 삭제 자체가 실패하는 시나리오
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);
    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document.querySelector<HTMLButtonElement>('.archive-card-delete')!.click();

    // 카드가 DOM에 남아 있어야 함 (delete 실패)
    expect(document.querySelector('.archive-card[data-answer-id="a"]')).not.toBeNull();
    // undo 토스트는 뜨면 안 됨
    expect(document.querySelector('.toast--undo')).toBeNull();
    setItem.mockRestore();
  });

  it('storage throw 시 showToast(getSaveErrorMessage(err)) 호출 (P2-6)', async () => {
    saveAnswers([
      { id: 'a', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    ] as never);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);
    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    const { MSG } = await import('../src/ui/messages');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    // dg.answers 키만 throw (다른 setItem은 통과)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string) => {
      if (k === 'dg.answers') {
        throw new DOMException('quota', 'QuotaExceededError');
      }
    });

    document.querySelector<HTMLButtonElement>('.archive-card-delete')!.click();

    // 카드 잔존 + 에러 토스트 정확 메시지 + Undo 토스트 미표출
    expect(document.querySelector('.archive-card[data-answer-id="a"]')).not.toBeNull();
    const toastText = document.getElementById('toastContainer')?.textContent ?? '';
    expect(toastText).toContain(MSG.SAVE_QUOTA_EXCEEDED);
    expect(document.querySelector('.toast--undo')).toBeNull();

    setItemSpy.mockRestore();
  });

  it('5초 후 Undo 버튼이 DOM에서 사라진다 (P2-7 통합)', async () => {
    saveAnswers([
      { id: 'a', questionId: 'q1', text: 'one', authorId: 'self', createdAt: '2026-04-27T00:00:00.000Z', schemaVersion: 1, date: '2026-04-27' },
    ] as never);

    const container = document.createElement('div');
    container.id = 'archiveTab';
    document.body.appendChild(container);
    const tab = await import('../src/ui/tabs/archive');
    const handlers = await import('../src/ui/handlers/archive');
    tab.renderArchive(container);
    handlers.mountArchiveHandlers();

    document.querySelector<HTMLButtonElement>('.archive-card-delete')!.click();
    expect(document.querySelector('.toast--undo')).not.toBeNull();

    vi.advanceTimersByTime(5000);
    // leaving 클래스 → 250ms 후 remove (toast.ts 패턴)
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.toast--undo')).toBeNull();
  });
});
