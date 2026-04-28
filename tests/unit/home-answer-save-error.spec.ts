import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('home — applyAnswerActivity 에러 처리', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    const root = document.createElement('div');
    root.id = 'modalRoot';
    document.body.appendChild(root);
    vi.setSystemTime(new Date('2026-04-19'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows quota toast when localStorage rejects with QuotaExceededError', async () => {
    const user = {
      name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-19',
      streak: 0, lastActiveDate: '', xp: 0, level: 1,
    };
    localStorage.setItem('user', JSON.stringify(user));

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === 'user') throw new DOMException('quota', 'QuotaExceededError');
    });

    const { applyAnswerActivity } = await import('../../src/ui/handlers/home');
    applyAnswerActivity();

    const toast = document.querySelector('.toast');
    expect(toast?.textContent).toContain('저장 공간이 가득 찼어요');
  });

  it('shows fallback toast for generic save error', async () => {
    const user = {
      name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-19',
      streak: 0, lastActiveDate: '', xp: 0, level: 1,
    };
    localStorage.setItem('user', JSON.stringify(user));

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === 'user') throw new Error('disk full');
    });

    const { applyAnswerActivity } = await import('../../src/ui/handlers/home');
    applyAnswerActivity();

    const toast = document.querySelector('.toast');
    expect(toast?.textContent).toContain('저장하지 못했어요');
  });

  it('does not throw when saveUser fails — caller flow continues', async () => {
    const user = {
      name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-19',
      streak: 0, lastActiveDate: '', xp: 0, level: 1,
    };
    localStorage.setItem('user', JSON.stringify(user));

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === 'user') throw new DOMException('quota', 'QuotaExceededError');
    });

    const { applyAnswerActivity } = await import('../../src/ui/handlers/home');
    expect(() => applyAnswerActivity()).not.toThrow();
  });

  it('does not modify localStorage when saveUser fails (atomic single-write)', async () => {
    const user = {
      name: 'H', interests: ['ai_ml'], onboardedAt: '2026-04-19',
      streak: 3, lastActiveDate: '2026-04-15', xp: 50, level: 1,
    };
    const original = JSON.stringify(user);
    localStorage.setItem('user', original);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === 'user' && value !== original) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
    });

    const { applyAnswerActivity } = await import('../../src/ui/handlers/home');
    applyAnswerActivity();

    expect(localStorage.getItem('user')).toBe(original);
  });
});
