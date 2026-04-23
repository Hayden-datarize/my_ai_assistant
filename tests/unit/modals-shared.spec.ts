import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openModal, closeModal } from '../../src/ui/modals/shared';

describe('openModal onClose', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; no user interpolation
    document.body.innerHTML = '';
  });

  it('invokes onClose when ESC is pressed', () => {
    const onClose = vi.fn();
    openModal({ title: 't', bodyHtml: '<p>body</p>', onClose });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when close button is clicked', () => {
    const onClose = vi.fn();
    openModal({ title: 't', bodyHtml: '<p>body</p>', onClose });
    document.querySelector<HTMLButtonElement>('.dg-modal-close')!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    openModal({ title: 't', bodyHtml: '<p>body</p>', onClose });
    document.querySelector<HTMLDivElement>('.dg-modal-backdrop')!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when closeModal() is called programmatically', () => {
    const onClose = vi.fn();
    openModal({ title: 't', bodyHtml: '<p>body</p>', onClose });
    closeModal();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onClose twice if close triggered twice', () => {
    const onClose = vi.fn();
    openModal({ title: 't', bodyHtml: '<p>body</p>', onClose });
    closeModal();
    closeModal();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('works without onClose (no crash)', () => {
    openModal({ title: 't', bodyHtml: '<p>body</p>' });
    expect(() => closeModal()).not.toThrow();
  });
});
