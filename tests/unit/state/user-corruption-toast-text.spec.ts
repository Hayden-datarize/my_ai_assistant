import { describe, it, expect, beforeEach } from 'vitest';

describe('notifyCorruption — friendly UX text (v3.14.3 T6 P2-1)', () => {
  beforeEach(() => {
    localStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture, no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  it('shows friendly recovery text on malformed JSON', async () => {
    localStorage.setItem('user', '{not-valid-json');
    const { getCachedUser } = await import('../../../src/state/user');
    const u = getCachedUser();
    expect(u).toBeNull();
    // dynamic import는 microtask이므로 await 필요
    await new Promise(r => setTimeout(r, 10));
    const toast = document.querySelector('.toast');
    expect(toast?.textContent).toContain('저장된 데이터를');
    expect(toast?.textContent).toContain('새로고침');
  });

  it('does NOT contain "손상" or "복구 모드" 기술 용어', async () => {
    localStorage.setItem('user', '{not-valid-json');
    const { getCachedUser } = await import('../../../src/state/user');
    getCachedUser();
    await new Promise(r => setTimeout(r, 10));
    const toast = document.querySelector('.toast');
    expect(toast?.textContent ?? '').not.toContain('손상');
    expect(toast?.textContent ?? '').not.toContain('복구 모드');
  });
});
