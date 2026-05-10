import { createFocusTrap, type FocusTrap } from '../utils/focus-trap';

/**
 * v3.26 T3 (v3.24 P2-3): discriminated xor union body contract.
 * - bodyHtml: 기존 path — caller-escaped HTML 문자열 (caller invariant)
 * - bodyNode: DOM Node — innerHTML 직렬화 단계 0, listener/identity 보존, XSS round-trip 안전
 *
 * 둘 중 정확히 하나만 지정 (xor). TypeScript는 ?never 패턴으로 enforce.
 */
type ModalBody =
  | { bodyHtml: string; bodyNode?: never }
  | { bodyNode: Node; bodyHtml?: never };

export type ModalConfig = {
  title: string;
  /** Called after the modal is closed (ESC, backdrop, close button, or programmatic).
   *  Use for cleanup only — do NOT rely on this for save semantics (ESC would save-on-cancel). */
  onClose?: () => void;
} & ModalBody;

interface CloseOpts {
  skipFocusRestore?: boolean;
}

let active: HTMLDivElement | null = null;
let escController: AbortController | null = null;
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

  // v3.24 T3: indent 압축 (production-safe).
  // eslint-disable-next-line no-restricted-syntax -- 정적 셸; title uses textContent, body uses caller-escaped innerHTML per ModalConfig contract
  wrap.innerHTML = `<div class="dg-modal-backdrop"></div><div class="dg-modal-card"><header class="dg-modal-header"><h3 class="dg-modal-title" id="${titleId}"></h3><button type="button" class="dg-modal-close" aria-label="닫기">×</button></header><div class="dg-modal-body"></div></div>`;

  const titleEl = wrap.querySelector<HTMLHeadingElement>('.dg-modal-title');
  if (titleEl) titleEl.textContent = cfg.title;

  const bodyEl = wrap.querySelector<HTMLDivElement>('.dg-modal-body');
  // v3.26 T3: discriminated body 분기 — bodyNode path는 직렬화 0 (listener/identity 보존)
  if (bodyEl) {
    if ('bodyNode' in cfg && cfg.bodyNode) {
      bodyEl.append(cfg.bodyNode);
    } else if ('bodyHtml' in cfg) {
      // eslint-disable-next-line no-restricted-syntax -- caller-supplied bodyHtml per ModalConfig contract; caller MUST escape interpolations
      bodyEl.innerHTML = cfg.bodyHtml;
    }
  }

  wrap.querySelector('.dg-modal-close')?.addEventListener('click', () => closeModal());
  wrap.querySelector('.dg-modal-backdrop')?.addEventListener('click', () => closeModal());

  root.append(wrap);
  active = wrap;
  activeOnClose = cfg.onClose ?? null;

  escController = new AbortController();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  }, { signal: escController.signal });

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
  if (escController) {
    escController.abort();
    escController = null;
  }
  activeOnClose = null;

  if (!opts?.skipFocusRestore) {
    lastFocusedBeforeOpen?.focus();
    lastFocusedBeforeOpen = null;
  }

  if (cb) cb();
}
