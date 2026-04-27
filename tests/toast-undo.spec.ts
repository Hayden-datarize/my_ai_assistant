/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('showUndoToast', () => {
  it('auto-dismisses after duration without invoking onUndo', async () => {
    const { showUndoToast } = await import('../src/utils/toast');
    const onUndo = vi.fn();
    showUndoToast({
      message: '삭제되었어요.',
      actionLabel: '되돌리기',
      onUndo,
      durationMs: 5000,
    });
    expect(document.querySelector('.dg-toast')).not.toBeNull();
    vi.advanceTimersByTime(5001);
    expect(onUndo).not.toHaveBeenCalled();
    expect(document.querySelector('.dg-toast')).toBeNull();
  });

  it('invokes onUndo and dismisses immediately on action click', async () => {
    const { showUndoToast } = await import('../src/utils/toast');
    const onUndo = vi.fn();
    showUndoToast({ message: '삭제되었어요.', actionLabel: '되돌리기', onUndo });
    const btn = document.querySelector<HTMLButtonElement>('.dg-toast button');
    expect(btn).not.toBeNull();
    btn!.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.dg-toast')).toBeNull();
  });

  it('dismisses previous toast and discards previous onUndo when new one shown', async () => {
    const { showUndoToast } = await import('../src/utils/toast');
    const first = vi.fn();
    const second = vi.fn();
    showUndoToast({ message: 'first', actionLabel: 'undo', onUndo: first });
    showUndoToast({ message: 'second', actionLabel: 'undo', onUndo: second });
    vi.advanceTimersByTime(5001);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
