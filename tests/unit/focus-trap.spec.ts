import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFocusTrap } from '../../src/ui/utils/focus-trap';

function buildContainer(): HTMLElement {
  const div = document.createElement('div');

  const btn = document.createElement('button');
  btn.id = 'a';
  btn.textContent = 'A';

  const anchor = document.createElement('a');
  anchor.href = '#';
  anchor.id = 'b';
  anchor.textContent = 'B';

  const input = document.createElement('input');
  input.id = 'c';

  div.append(btn, anchor, input);
  document.body.append(div);
  return div;
}

describe('createFocusTrap', () => {
  let container: HTMLElement;
  beforeEach(() => { container = buildContainer(); });
  afterEach(() => { container.remove(); });

  it('activate() focuses first focusable element', () => {
    const trap = createFocusTrap(container);
    trap.activate();
    expect(document.activeElement?.id).toBe('a');
    trap.deactivate();
  });

  it('Tab on last element wraps to first', () => {
    const trap = createFocusTrap(container);
    trap.activate();
    const last = container.querySelector<HTMLInputElement>('#c')!;
    last.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(ev);
    expect(document.activeElement?.id).toBe('a');
    trap.deactivate();
  });

  it('Shift+Tab on first wraps to last', () => {
    const trap = createFocusTrap(container);
    trap.activate();
    const first = container.querySelector<HTMLButtonElement>('#a')!;
    first.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    first.dispatchEvent(ev);
    expect(document.activeElement?.id).toBe('c');
    trap.deactivate();
  });

  it('deactivate() removes keydown listener', () => {
    const trap = createFocusTrap(container);
    trap.activate();
    trap.deactivate();
    const last = container.querySelector<HTMLInputElement>('#c')!;
    last.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(ev);
    // no wrap after deactivate — focus stays
    expect(document.activeElement?.id).toBe('c');
  });
});
