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
    expect(document.querySelector('.toast')).not.toBeNull();
    // 5000ms 타이머 → leaving 클래스 + 250ms 후 remove (v3.9 2단계 패턴)
    vi.advanceTimersByTime(5251);
    expect(onUndo).not.toHaveBeenCalled();
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('invokes onUndo and dismisses immediately on action click', async () => {
    const { showUndoToast } = await import('../src/utils/toast');
    const onUndo = vi.fn();
    showUndoToast({ message: '삭제되었어요.', actionLabel: '되돌리기', onUndo });
    const btn = document.querySelector<HTMLButtonElement>('.toast button');
    expect(btn).not.toBeNull();
    btn!.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.toast')).toBeNull();
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

describe('showUndoToast — v3.9 통합', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('Undo 토스트는 .toast.toast--undo 클래스 + #toastContainer--undo 컨테이너에 표시한다', async () => {
    const { showUndoToast } = await import('../src/utils/toast');
    showUndoToast({ message: '삭제됨', actionLabel: '되돌리기', onUndo: () => {} });
    const container = document.getElementById('toastContainer--undo');
    expect(container).toBeTruthy();
    const toast = container?.querySelector('.toast.toast--undo');
    expect(toast).toBeTruthy();
    // 레거시 클래스명 회귀 가드
    expect(document.querySelector('.dg-toast')).toBeNull();
    expect(document.querySelector('.dg-toast--undo')).toBeNull();
  });

  it('일반 토스트는 #toastContainer (top), Undo 토스트는 #toastContainer--undo (bottom)으로 분리된다', async () => {
    const { showToast, showUndoToast } = await import('../src/utils/toast');
    showToast('일반');
    showUndoToast({ message: '삭제됨', actionLabel: '되돌리기', onUndo: () => {} });
    expect(document.getElementById('toastContainer')?.querySelector('.toast')).toBeTruthy();
    expect(document.getElementById('toastContainer--undo')?.querySelector('.toast--undo')).toBeTruthy();
  });
});
