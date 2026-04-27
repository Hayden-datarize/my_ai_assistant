/**
 * Lightweight transient notification. Appends a styled toast to a top-center
 * container and auto-dismisses after `durationMs`.
 */
function ensureContainer(id: string, modifier?: 'undo'): HTMLElement {
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement('div');
  el.id = id;
  el.className = modifier ? `toast-container toast-container--${modifier}` : 'toast-container';
  const root = document.getElementById('modalRoot') ?? document.body;
  root.append(el);
  return el;
}

export function showToast(message: string, durationMs = 2500): void {
  const container = ensureContainer('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  container.append(el);
  setTimeout(() => {
    el.classList.add('toast-leaving');
    setTimeout(() => el.remove(), 250);
  }, durationMs);
}

// undo 토스트 싱글톤 상태 — 한 번에 하나의 undo 토스트만 표시
let activeUndoTimer: number | null = null;
let activeUndoEl: HTMLElement | null = null;

/**
 * Undo-action toast. Shows a message with an action button that triggers `onUndo`.
 * Only one undo toast is active at a time — calling again dismisses the previous one
 * (discarding its onUndo callback) and shows the new one.
 * Auto-dismisses after `durationMs` (default 5000ms) with a leave animation.
 */
export function showUndoToast(opts: {
  message: string;
  actionLabel: string;
  onUndo: () => void;
  durationMs?: number;
}): void {
  const duration = opts.durationMs ?? 5000;

  // 이전 undo 토스트가 있으면 즉시 제거 + onUndo 폐기
  if (activeUndoTimer !== null) {
    window.clearTimeout(activeUndoTimer);
    activeUndoTimer = null;
  }
  if (activeUndoEl) {
    activeUndoEl.remove();
    activeUndoEl = null;
  }

  const container = ensureContainer('toastContainer--undo', 'undo');
  const el = document.createElement('div');
  el.className = 'toast toast--undo';
  el.setAttribute('role', 'status');

  const msg = document.createElement('span');
  msg.textContent = opts.message;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = opts.actionLabel;
  btn.addEventListener('click', () => {
    if (activeUndoTimer !== null) {
      window.clearTimeout(activeUndoTimer);
      activeUndoTimer = null;
    }
    el.remove();
    activeUndoEl = null;
    opts.onUndo();
  });

  el.append(msg, btn);
  container.append(el);
  activeUndoEl = el;

  activeUndoTimer = window.setTimeout(() => {
    el.classList.add('toast-leaving');
    window.setTimeout(() => {
      el.remove();
      activeUndoEl = null;
      activeUndoTimer = null;
    }, 250);
  }, duration);
}
