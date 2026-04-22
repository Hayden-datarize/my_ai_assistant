const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface FocusTrap {
  activate(): void;
  deactivate(): void;
}

export function createFocusTrap(container: HTMLElement): FocusTrap {
  let handler: ((e: KeyboardEvent) => void) | null = null;

  function getFocusable(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  }

  return {
    activate() {
      const items = getFocusable();
      if (items.length > 0) items[0].focus();
      handler = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      container.addEventListener('keydown', handler);
    },
    deactivate() {
      if (handler) {
        container.removeEventListener('keydown', handler);
        handler = null;
      }
    },
  };
}
