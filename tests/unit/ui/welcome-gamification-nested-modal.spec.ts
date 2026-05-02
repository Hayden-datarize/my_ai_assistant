import { describe, it, expect, beforeEach } from 'vitest';

describe('openModal — returns wrap element for nested-safe queries (v3.12.1 P2-NEW-6)', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  it('openModal returns the wrap HTMLDivElement', async () => {
    const { openModal } = await import('../../../src/ui/modals/shared');
    const wrap = openModal({ title: 'T', bodyHtml: '<button id="x">x</button>' });
    expect(wrap).toBeInstanceOf(HTMLDivElement);
    expect(wrap.classList.contains('dg-modal')).toBe(true);
    expect(wrap.querySelector('#x')).not.toBeNull();
  });

  it('caller can scope queries to its own wrap (defensive against nested modal)', async () => {
    const { openModal } = await import('../../../src/ui/modals/shared');
    const wrapA = openModal({ title: 'A', bodyHtml: '<button id="goStatsBtn">A</button>' });
    expect(wrapA.querySelector('#goStatsBtn')).not.toBeNull();
  });

  it('chain detach — closeModal 후 wrap은 detached, 다음 openModal은 새 wrap 반환 (v3.14.3 T14)', async () => {
    const { openModal, closeModal } = await import('../../../src/ui/modals/shared');
    const wrapA = openModal({ title: 'A', bodyHtml: '<span id="a">A</span>' });
    expect(wrapA.querySelector('#a')).not.toBeNull();
    expect(wrapA.parentElement).not.toBeNull();   // attached
    closeModal();
    expect(wrapA.parentElement).toBeNull();       // detached after close
    const wrapB = openModal({ title: 'B', bodyHtml: '<span id="b">B</span>' });
    expect(wrapB).not.toBe(wrapA);                // 새 wrap 인스턴스
    expect(wrapB.querySelector('#b')).not.toBeNull();
  });
});
