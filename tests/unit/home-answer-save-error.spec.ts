import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('home — applyAnswerActivity 에러 처리', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    const root = document.createElement('div');
    root.id = 'modalRoot';
    document.body.appendChild(root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    applyAnswerActivity({ ...user });

    const toast = document.querySelector('.dg-toast');
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
    applyAnswerActivity({ ...user });

    const toast = document.querySelector('.dg-toast');
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
    expect(() => applyAnswerActivity({ ...user })).not.toThrow();
  });
});
