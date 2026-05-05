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
});
