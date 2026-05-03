import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('notifyCorruption — friendly UX text (v3.14.3 T6 P2-1)', () => {
  beforeEach(() => {
    localStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture, no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  it('malformed JSON → toast에 friendly recovery text 노출 ("저장된 데이터를" + "새로고침")', async () => {
    localStorage.setItem('user', '{not-valid-json');
    const { getCachedUser } = await import('../../../src/state/user');
    const u = getCachedUser();
    expect(u, 'malformed user JSON → null cache').toBeNull();
    // v3.14.3 T12 review (M1): vi.waitFor — dynamic import microtask 폴링.
    await vi.waitFor(() => {
      const toast = document.querySelector('.toast');
      expect(toast?.textContent).toContain('저장된 데이터를');
      expect(toast?.textContent).toContain('새로고침');
    });
  });

  it('malformed JSON → toast에 기술 용어("손상" / "복구 모드") 부재', async () => {
    localStorage.setItem('user', '{not-valid-json');
    const { getCachedUser } = await import('../../../src/state/user');
    getCachedUser();
    // v3.14.3 T12 review (M1): vi.waitFor — toast 렌더 후 기술 용어 부재 검증.
    await vi.waitFor(() => {
      const toast = document.querySelector('.toast');
      expect(toast, 'toast should be rendered').not.toBeNull();
      expect(
        toast?.textContent ?? '',
        'friendly UX: avoid jargon "손상"',
      ).not.toContain('손상');
      expect(
        toast?.textContent ?? '',
        'friendly UX: avoid jargon "복구 모드"',
      ).not.toContain('복구 모드');
    });
  });
});
