/**
 * Lightweight transient notification. Appends a styled toast to #modalRoot (or body)
 * and auto-dismisses after `durationMs`.
 */
export function showToast(message: string, durationMs = 2500): void {
  const root = document.getElementById('modalRoot') ?? document.body;
  const el = document.createElement('div');
  el.className = 'dg-toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  root.append(el);
  setTimeout(() => {
    el.classList.add('dg-toast-leaving');
    setTimeout(() => el.remove(), 250);
  }, durationMs);
}
