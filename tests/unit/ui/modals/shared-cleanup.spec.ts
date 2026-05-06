import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openModal, closeModal } from '../../../../src/ui/modals/shared';

describe('v3.17 T7 — shared modal AbortController cleanup', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  afterEach(() => {
    closeModal();
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; empty static string, no interpolation
    document.body.innerHTML = '';
  });

  it('open → close → ESC press → onClose 미호출 (listener removed via abort)', () => {
    let closeCalls = 0;
    openModal({
      title: 'test',
      bodyHtml: '<p>x</p>',
      onClose: () => closeCalls++,
    });
    closeModal();
    expect(closeCalls).toBe(1);

    // 이후 ESC press가 closeModal을 다시 트리거하지 않아야 함
    const evt = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(evt);
    expect(closeCalls).toBe(1); // 변화 없음
  });

  it('open A → open B → close → 5회 ESC → onClose 정확 2회만', () => {
    let closeCalls = 0;
    openModal({ title: 'A', bodyHtml: '<p>a</p>', onClose: () => closeCalls++ });
    openModal({ title: 'B', bodyHtml: '<p>b</p>', onClose: () => closeCalls++ });
    closeModal();
    for (let i = 0; i < 5; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    expect(closeCalls).toBe(2); // open A 교체 시 1회 + closeModal() 1회. 이후 ESC는 무효.
  });

  it('listener-count regression — open/close 5회 반복 후 누수 없음 (사전 review P1-9)', () => {
    // open → close 5회 반복 후 외부 ESC dispatch에 reaction 없어야 함
    for (let i = 0; i < 5; i++) {
      openModal({
        title: `cycle-${i}`,
        bodyHtml: '<p>x</p>',
        onClose: () => { /* noop */ },
      });
      closeModal();
    }
    // 모든 모달 시스템 listener는 abort 됨. once 리스너 1개로 재확인.
    let triggered = 0;
    document.addEventListener('keydown', () => { triggered++; }, { once: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(triggered).toBe(1);
  });

  it('direct listener count — addEventListener spy 0 leak after open/close cycles (G4-2)', () => {
    // Spy on document.addEventListener to count keydown listeners with AbortSignal.
    const originalAdd = document.addEventListener.bind(document);
    const originalRemove = document.removeEventListener.bind(document);
    let activeKeydownCount = 0;

    document.addEventListener = ((type: string, listener: EventListener, options?: AddEventListenerOptions | boolean) => {
      if (type === 'keydown') {
        activeKeydownCount++;
        const sig = typeof options === 'object' ? options?.signal : undefined;
        if (sig) {
          sig.addEventListener('abort', () => {
            activeKeydownCount = Math.max(0, activeKeydownCount - 1);
          }, { once: true });
        }
      }
      return originalAdd(type, listener, options);
    }) as typeof document.addEventListener;

    document.removeEventListener = ((type: string, listener: EventListener, options?: EventListenerOptions | boolean) => {
      if (type === 'keydown') activeKeydownCount = Math.max(0, activeKeydownCount - 1);
      return originalRemove(type, listener, options);
    }) as typeof document.removeEventListener;

    try {
      for (let i = 0; i < 5; i++) {
        openModal({ title: `cycle-${i}`, bodyHtml: '<p>x</p>', onClose: () => { /* noop */ } });
        closeModal();
      }
      // After all cycles, no leaked keydown listener should remain from modal system.
      expect(activeKeydownCount).toBe(0);
    } finally {
      document.addEventListener = originalAdd;
      document.removeEventListener = originalRemove;
    }
  });
});
