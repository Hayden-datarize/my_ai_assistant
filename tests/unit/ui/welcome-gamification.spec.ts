import { describe, it, expect, beforeEach, vi } from 'vitest';
import { maybeShowWelcomeGamification } from '../../../src/ui/modals/welcome-gamification';
import { saveUser, loadUserData } from '../../../src/state/user';
import { saveAnswers } from '../../../src/state/persistence';
import { mkUser } from '../state/userFixture';

beforeEach(() => {
  localStorage.clear();
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
  document.body.innerHTML = '<div id="modalRoot"></div>';
});

describe('maybeShowWelcomeGamification', () => {
  it('answers=0 → 모달 안 띄움', async () => {
    saveUser(mkUser());
    saveAnswers([]);
    await maybeShowWelcomeGamification();
    expect(document.querySelector('.dg-modal')).toBeNull();
  });

  it('gamificationMigrated=true → 모달 안 띄움 (idempotent)', async () => {
    saveUser(mkUser({ interests: ['AI'], streak: 5, xp: 100, gamificationMigrated: true }));
    saveAnswers([{ id: '1', questionId: 'q1', text: '...', authorId: 'self', createdAt: '2026-04-01', pinned: false, schemaVersion: 1 }]);
    await maybeShowWelcomeGamification();
    expect(document.querySelector('.dg-modal')).toBeNull();
  });

  it('첫 진입 (answers>=1, !gamificationMigrated) → backfill + 모달 표시', async () => {
    saveUser(mkUser({ interests: ['AI'], streak: 5, xp: 350 }));
    // answers 10개 → answers-10 + answers-1 + tier-3-tree (xp 350) + streak-3 unlock 후보
    const answers = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`, questionId: 'q', text: 'a', authorId: 'self', createdAt: '2026-04-01', pinned: false, schemaVersion: 1 as const,
    }));
    saveAnswers(answers);
    await maybeShowWelcomeGamification();
    expect(document.querySelector('.dg-modal')).not.toBeNull();
    const u = loadUserData()!;
    expect(Object.keys(u.earnedBadges).length).toBeGreaterThan(0);
    expect(u.earnedBadges['streak-3']).toBeDefined();
    expect(u.earnedBadges['answers-10']).toBeDefined();
    expect(u.earnedBadges['tier-3-tree']).toBeDefined();
  });

  it('모달 닫기 → gamificationMigrated=true saveUser', async () => {
    saveUser(mkUser({ interests: ['AI'], streak: 5, xp: 100 }));
    saveAnswers([{ id: '1', questionId: 'q', text: 'a', authorId: 'self', createdAt: '2026-04-01', pinned: false, schemaVersion: 1 }]);
    await maybeShowWelcomeGamification();
    document.querySelector<HTMLButtonElement>('.dg-modal-close')?.click();
    await vi.waitFor(() => {
      expect(loadUserData()!.gamificationMigrated).toBe(true);
    }, { timeout: 2000, interval: 20 });
  });

  it('두 번째 호출 (gamificationMigrated=true) → no-op', async () => {
    saveUser(mkUser({ interests: ['AI'], streak: 5, xp: 100 }));
    saveAnswers([{ id: '1', questionId: 'q', text: 'a', authorId: 'self', createdAt: '2026-04-01', pinned: false, schemaVersion: 1 }]);
    await maybeShowWelcomeGamification();
    document.querySelector<HTMLButtonElement>('.dg-modal-close')?.click();
    await vi.waitFor(() => {
      expect(loadUserData()!.gamificationMigrated).toBe(true);
    }, { timeout: 2000, interval: 20 });
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
    await maybeShowWelcomeGamification();  // 두 번째 호출
    expect(document.querySelector('.dg-modal')).toBeNull();
  });

  it('backfill 중 throw 시 → schema 보존 + 모달은 그래도 표시 (graceful)', async () => {
    saveUser(mkUser({ interests: ['AI'], streak: 5, xp: 100 }));
    saveAnswers([{ id: '1', questionId: 'q', text: 'a', authorId: 'self', createdAt: '2026-04-01', pinned: false, schemaVersion: 1 }]);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
    await maybeShowWelcomeGamification();
    expect(document.querySelector('.dg-modal')).not.toBeNull();
    spy.mockRestore();
  });

  it('stats 버튼 click → switchTab + modal close + gamificationMigrated set', async () => {
    // nav 모듈 stub — switchTab 가 jsdom 에서 #app/render*까지 끌어들이지 않도록.
    const switchTabSpy = vi.fn();
    vi.doMock('../../../src/ui/nav', () => ({ switchTab: switchTabSpy }));
    saveUser(mkUser({ interests: ['AI'], streak: 5, xp: 100 }));
    saveAnswers([{ id: '1', questionId: 'q', text: 'a', authorId: 'self', createdAt: '2026-04-01', pinned: false, schemaVersion: 1 }]);
    await maybeShowWelcomeGamification();
    expect(document.querySelector('.dg-modal')).not.toBeNull();
    const btn = document.getElementById('goStatsBtn') as HTMLButtonElement;
    btn?.click();
    // lazy imports resolve (closeModal + nav)
    await vi.waitFor(() => {
      expect(document.querySelector('.dg-modal')).toBeNull();
      expect(switchTabSpy).toHaveBeenCalledWith('stats');
    }, { timeout: 2000, interval: 20 });
    expect(loadUserData()!.gamificationMigrated).toBe(true);
    vi.doUnmock('../../../src/ui/nav');
  });

  it('goStatsBtn은 modal scope (.dg-modal 내부) 에서만 매칭 — document 충돌 ID 방어', async () => {
    const switchTabSpy = vi.fn();
    vi.doMock('../../../src/ui/nav', () => ({ switchTab: switchTabSpy }));
    saveUser(mkUser({ interests: ['AI'], streak: 5, xp: 100 }));
    saveAnswers([{ id: '1', questionId: 'q', text: 'a', authorId: 'self', createdAt: '2026-04-01', pinned: false, schemaVersion: 1 }]);

    // 사전: 동일 ID를 가진 가짜 버튼을 modalRoot 보다 DOM tree-order 앞에 prepend.
    // document scope query 였으면 decoy가 첫 매치 → modal 버튼은 wire 안 됨 → switchTabSpy 미호출.
    const decoy = document.createElement('button');
    decoy.id = 'goStatsBtn';
    document.body.prepend(decoy);

    await maybeShowWelcomeGamification();

    const modalBtn = document.querySelector<HTMLButtonElement>('.dg-modal #goStatsBtn');
    expect(modalBtn).not.toBeNull();
    modalBtn!.click();
    await vi.waitFor(() => {
      expect(switchTabSpy).toHaveBeenCalledWith('stats');
    }, { timeout: 2000, interval: 20 });

    decoy.remove();
    vi.doUnmock('../../../src/ui/nav');
  });
});
