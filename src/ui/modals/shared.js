let active = null;
let escHandler = null;
export function openModal(cfg) {
    closeModal();
    const root = document.getElementById('modalRoot') ?? document.body;
    const wrap = document.createElement('div');
    wrap.className = 'dg-modal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    // eslint-disable-next-line no-restricted-syntax -- 정적 셸 구조; 사용자 입력 없음, title/body는 아래에서 별도 처리
    wrap.innerHTML = `
    <div class="dg-modal-backdrop"></div>
    <div class="dg-modal-card">
      <header class="dg-modal-header">
        <h3 class="dg-modal-title"></h3>
        <button type="button" class="dg-modal-close" aria-label="닫기">×</button>
      </header>
      <div class="dg-modal-body"></div>
    </div>
  `;
    const titleEl = wrap.querySelector('.dg-modal-title');
    if (titleEl)
        titleEl.textContent = cfg.title;
    const bodyEl = wrap.querySelector('.dg-modal-body');
    // eslint-disable-next-line no-restricted-syntax -- caller-supplied bodyHtml per ModalConfig contract; caller MUST escape interpolations
    if (bodyEl)
        bodyEl.innerHTML = cfg.bodyHtml;
    wrap.querySelector('.dg-modal-close')?.addEventListener('click', closeModal);
    wrap.querySelector('.dg-modal-backdrop')?.addEventListener('click', closeModal);
    root.append(wrap);
    active = wrap;
    escHandler = (e) => { if (e.key === 'Escape')
        closeModal(); };
    document.addEventListener('keydown', escHandler);
}
export function closeModal() {
    if (active) {
        active.remove();
        active = null;
    }
    if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
    }
}
