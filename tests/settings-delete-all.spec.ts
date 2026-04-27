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

const mountSettings = async () => {
  const container = document.createElement('div');
  container.id = 'settingsTab';
  document.body.appendChild(container);
  const tab = await import('../src/ui/tabs/settings');
  tab.renderSettings(container);
  tab.bindHandlers();
  return tab;
};

describe('settings delete all answers', () => {
  it('shows confirm with answer count and deletes on accept', async () => {
    saveAnswers([
      { id: 'a', text: 'one', date: '2026-04-27' },
      { id: 'b', text: 'two', date: '2026-04-27' },
    ] as never);
    await mountSettings();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    document.querySelector<HTMLButtonElement>('#deleteAllAnswersBtn')!.click();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy.mock.calls[0]?.[0]).toContain('2개');
    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers()).toEqual([]);
    expect(document.querySelector('.toast--undo')).not.toBeNull();
  });

  it('cancel keeps answers untouched', async () => {
    saveAnswers([{ id: 'a', text: 'one', date: '2026-04-27' }] as never);
    await mountSettings();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    document.querySelector<HTMLButtonElement>('#deleteAllAnswersBtn')!.click();

    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers()).toHaveLength(1);
    expect(document.querySelector('.toast--undo')).toBeNull();
  });

  it('disables button when no answers', async () => {
    await mountSettings();
    const btn = document.querySelector<HTMLButtonElement>('#deleteAllAnswersBtn');
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(true);
  });

  it('undo restores all', async () => {
    saveAnswers([
      { id: 'a', text: 'one', date: '2026-04-27' },
      { id: 'b', text: 'two', date: '2026-04-27' },
    ] as never);
    await mountSettings();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    document.querySelector<HTMLButtonElement>('#deleteAllAnswersBtn')!.click();
    document.querySelector<HTMLButtonElement>('.toast--undo button')!.click();

    const { loadAnswers } = await import('../src/state/persistence');
    expect(loadAnswers()).toHaveLength(2);
  });

  it('Undo 클릭 시 atomic single write로 복원하고 DELETE_UNDO_RESTORED 토스트를 표시한다', async () => {
    saveAnswers([
      { id: 'a', text: 'one', date: '2026-04-27' },
      { id: 'b', text: 'two', date: '2026-04-27' },
      { id: 'c', text: 'three', date: '2026-04-27' },
    ] as never);
    await mountSettings();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    document.querySelector<HTMLButtonElement>('#deleteAllAnswersBtn')!.click();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    document.querySelector<HTMLButtonElement>('.toast--undo button')!.click();

    // atomic: dg.answers setItem 1회만 (saveAnswers(snapshot))
    const calls = setItemSpy.mock.calls.filter(([k]) => k === 'dg.answers');
    expect(calls).toHaveLength(1);

    const { MSG } = await import('../src/ui/messages');
    expect(document.body.textContent).toContain(MSG.DELETE_UNDO_RESTORED);

    setItemSpy.mockRestore();
  });
});
