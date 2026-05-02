import { createFocusTrap, type FocusTrap } from '../utils/focus-trap';

export interface ModalConfig {
  title: string;
  /** Caller-owned HTML; caller MUST escape any user interpolation before passing. */
  bodyHtml: string;
  /** Called after the modal is closed (ESC, backdrop, close button, or programmatic).
   *  Use for cleanup only — do NOT rely on this for save semantics (ESC would save-on-cancel). */
  onClose?: () => void;
}

interface CloseOpts {
  skipFocusRestore?: boolean;
}

let active: HTMLDivElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let activeOnClose: (() => void) | null = null;
let activeFocusTrap: FocusTrap | null = null;
let lastFocusedBeforeOpen: HTMLElement | null = null;

export function openModal(cfg: ModalConfig): HTMLDivElement {
  // 1. Save pre-first-open focus (don't overwrite if already set — modal chain preserves original trigger)
  if (!lastFocusedBeforeOpen) {
    lastFocusedBeforeOpen = document.activeElement as HTMLElement | null;
  }

  // 2. Clear previous modal without restoring focus (we already saved original)
  closeModal({ skipFocusRestore: true });

  const root = document.getElementById('modalRoot') ?? document.body;
  const wrap = document.createElement('div');
  wrap.className = 'dg-modal';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');

  const titleId = `dg-modal-title-${crypto.randomUUID()}`;
  wrap.setAttribute('aria-labelledby', titleId);

  // eslint-disable-next-line no-restricted-syntax -- 정적 셸; title uses textContent, body uses caller-escaped innerHTML per ModalConfig contract
  wrap.innerHTML = `
    <div class="dg-modal-backdrop"></div>
    <div class="dg-modal-card">
      <header class="dg-modal-header">
        <h3 class="dg-modal-title" id="${titleId}"></h3>
        <button type="button" class="dg-modal-close" aria-label="닫기">×</button>
      </header>
      <div class="dg-modal-body"></div>
    </div>
  `;

  const titleEl = wrap.querySelector<HTMLHeadingElement>('.dg-modal-title');
  if (titleEl) titleEl.textContent = cfg.title;

  const bodyEl = wrap.querySelector<HTMLDivElement>('.dg-modal-body');
  // eslint-disable-next-line no-restricted-syntax -- caller-supplied bodyHtml per ModalConfig contract; caller MUST escape interpolations
  if (bodyEl) bodyEl.innerHTML = cfg.bodyHtml;

  wrap.querySelector('.dg-modal-close')?.addEventListener('click', () => closeModal());
  wrap.querySelector('.dg-modal-backdrop')?.addEventListener('click', () => closeModal());

  root.append(wrap);
  active = wrap;
  activeOnClose = cfg.onClose ?? null;

  escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', escHandler);

  // 3. Activate focus trap (auto-focuses first focusable inside modal)
  activeFocusTrap = createFocusTrap(wrap);
  activeFocusTrap.activate();

  // v3.14.2 T14 (P2-NEW-6): wrap return — caller가 자기 modal scope로 query 가능 (nested modal 방어).
  return wrap;
}

/**
 * Closes the currently active modal.
 *
 * @param opts - Close options
 * @param opts.skipFocusRestore - **Internal use only.** Used by {@link openModal}
 *   when replacing an active modal (chain removal) so the trigger-element focus
 *   restoration is deferred to the final close. External callers should omit
 *   this flag — passing `true` will cause focus to escape to `body`.
 * @internal
 */
export function closeModal(opts?: CloseOpts): void {
  const cb = activeOnClose;

  if (activeFocusTrap) {
    activeFocusTrap.deactivate();
    activeFocusTrap = null;
  }
  if (active) {
    active.remove();
    active = null;
  }
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  activeOnClose = null;

  if (!opts?.skipFocusRestore) {
    lastFocusedBeforeOpen?.focus();
    lastFocusedBeforeOpen = null;
  }

  if (cb) cb();
}
