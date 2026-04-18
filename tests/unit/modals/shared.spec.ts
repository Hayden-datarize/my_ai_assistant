import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openModal, closeModal } from '../../../src/ui/modals/shared';

beforeEach(() => {
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; no user interpolation
  document.body.innerHTML = '<div id="modalRoot"></div>';
});

afterEach(() => {
  // Ensure no lingering modal or listeners between tests
  closeModal();
});

describe('modal shared infra', () => {
  it('opens a modal with title and body', () => {
    openModal({ title: 'Test', bodyHtml: '<p>hello</p>' });
    expect(document.querySelector('.dg-modal')).not.toBeNull();
    expect(document.querySelector('.dg-modal-title')?.textContent).toBe('Test');
    expect(document.querySelector('.dg-modal-body')?.textContent).toContain('hello');
  });
  it('closes modal on Escape key', () => {
    openModal({ title: 'X', bodyHtml: '' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.dg-modal')).toBeNull();
  });
  it('closeModal removes the active modal', () => {
    openModal({ title: 'X', bodyHtml: '' });
    closeModal();
    expect(document.querySelector('.dg-modal')).toBeNull();
  });
  it('clicking the backdrop closes the modal', () => {
    openModal({ title: 'X', bodyHtml: '' });
    const backdrop = document.querySelector<HTMLDivElement>('.dg-modal-backdrop');
    backdrop?.click();
    expect(document.querySelector('.dg-modal')).toBeNull();
  });
  it('opening a new modal while one is active replaces it (no stacking)', () => {
    openModal({ title: 'First', bodyHtml: '' });
    openModal({ title: 'Second', bodyHtml: '' });
    const modals = document.querySelectorAll('.dg-modal');
    expect(modals.length).toBe(1);
    expect(document.querySelector('.dg-modal-title')?.textContent).toBe('Second');
  });
});
