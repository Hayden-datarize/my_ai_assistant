import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('v3.3.3 focus-trap integration', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  afterEach(async () => {
    const { closeModal } = await import('../../src/ui/modals/shared');
    closeModal();
  });

  it('focuses first focusable element when modal opens', async () => {
    const { openModal } = await import('../../src/ui/modals/shared');
    openModal({
      title: '테스트',
      bodyHtml: '<button id="btn1">첫 버튼</button><button id="btn2">둘째</button>'
    });
    // close 버튼(header)이 DOM 순서상 첫 focusable
    const close = document.querySelector<HTMLButtonElement>('.dg-modal-close');
    expect(document.activeElement).toBe(close);
  });

  it('sets aria-labelledby to title element id', async () => {
    const { openModal } = await import('../../src/ui/modals/shared');
    openModal({ title: 'ARIA 테스트', bodyHtml: '<p>body</p>' });
    const modal = document.querySelector('.dg-modal');
    const labelledBy = modal?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const title = document.getElementById(labelledBy!);
    expect(title?.textContent).toBe('ARIA 테스트');
  });

  it('restores focus to previously focused element on close', async () => {
    const { openModal, closeModal } = await import('../../src/ui/modals/shared');
    const trigger = document.createElement('button');
    trigger.id = 'triggerBtn';
    document.body.append(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    openModal({ title: '복원', bodyHtml: '<button>x</button>' });
    expect(document.activeElement).not.toBe(trigger);

    closeModal();
    expect(document.activeElement).toBe(trigger);
  });

  it('chained openModal: focus restores to original (pre-first-open) element', async () => {
    const { openModal, closeModal } = await import('../../src/ui/modals/shared');
    const original = document.createElement('button');
    original.id = 'origBtn';
    document.body.append(original);
    original.focus();

    openModal({ title: '1차', bodyHtml: '<button>a</button>' });
    // 1차 열려 있음, close 버튼 focus
    openModal({ title: '2차', bodyHtml: '<button>b</button>' });
    // 2차 열림, 1차 정리됨, 하지만 original focus는 preserve되어야

    const title = document.querySelector('.dg-modal-title');
    expect(title?.textContent).toBe('2차');

    closeModal();
    expect(document.activeElement).toBe(original);
  });
});
