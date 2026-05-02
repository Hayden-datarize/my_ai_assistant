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
});
