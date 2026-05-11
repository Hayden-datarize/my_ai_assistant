import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveUser, getCachedUser, type Insight } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';
import { saveAnswers, loadAnswers } from '../../src/state/persistence';
import { saveBriefings, loadBriefings, type Briefing } from '../../src/state/briefings';
import type { Answer } from '../../src/state/schema';

/**
 * v3.27 T4: 핀 토글 — 3 entity unified (answer / scrap / insight).
 * Codex 사전 review P0-2 (scrap → loadBriefings/saveBriefings)
 *              P0-3 (Answer → loadAnswers/saveAnswers single-write)
 *              P1-4 (dg:archive:updated EventMap)
 */

function mkAnswer(over: Partial<Answer> = {}): Answer {
  return {
    id: 'a1',
    questionId: '',
    text: 'answer body',
    authorId: 'self',
    createdAt: '2026-05-10T10:00:00.000Z',
    schemaVersion: 1 as Answer['schemaVersion'],
    ...over,
  };
}

function mkBriefing(over: Partial<Briefing> = {}): Briefing {
  return {
    id: 'b1',
    title: 'title',
    summary: 'summary',
    url: 'https://example.com',
    source: 'src',
    interestId: 'ai_ml',
    date: '2026-05-10',
    read: false,
    scrapped: true,
    memo: '',
    ...over,
  } as Briefing;
}

function mkInsight(over: Partial<Insight> = {}): Insight {
  return {
    id: 'i1',
    text: 'insight body',
    interestId: 'ai_ml',
    createdAt: '2026-05-10T10:00:00.000Z',
    ...over,
  };
}

describe('v3.27 T4: togglePin — 3 entity unified', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('togglePin("insight", id) — pinned false→true + saveUser 1회 + dg:archive:updated emit', async () => {
    saveUser(mkUser({ insights: [mkInsight({ pinned: false })] }));
    const { togglePin } = await import('../../src/ui/handlers/archive');

    const evtSpy = vi.fn();
    document.addEventListener('dg:archive:updated', evtSpy);

    togglePin('insight', 'i1');

    expect(getCachedUser()?.insights[0]?.pinned).toBe(true);
    expect(evtSpy).toHaveBeenCalledTimes(1);
    const detail = (evtSpy.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(detail).toEqual({ entity: 'insight', id: 'i1' });
  });

  it('togglePin("answer", id) — saveAnswers single-write + dg:archive:updated emit (P0-3)', async () => {
    saveAnswers([mkAnswer({ pinned: false })]);
    const { togglePin } = await import('../../src/ui/handlers/archive');

    const evtSpy = vi.fn();
    document.addEventListener('dg:archive:updated', evtSpy);

    togglePin('answer', 'a1');

    expect(loadAnswers()[0]?.pinned).toBe(true);
    expect(evtSpy).toHaveBeenCalledTimes(1);

    togglePin('answer', 'a1');
    expect(loadAnswers()[0]?.pinned).toBe(false);
  });

  it('togglePin("scrap", id) — saveBriefings single-write + dg:archive:updated emit (P0-2)', async () => {
    saveBriefings([mkBriefing({ pinned: false })]);
    const { togglePin } = await import('../../src/ui/handlers/archive');

    const evtSpy = vi.fn();
    document.addEventListener('dg:archive:updated', evtSpy);

    togglePin('scrap', 'b1');

    expect(loadBriefings()[0]?.pinned).toBe(true);
    expect(evtSpy).toHaveBeenCalledTimes(1);
  });

  it('없는 id → no-op + console.warn (이벤트 emit 안 함)', async () => {
    saveUser(mkUser());
    saveAnswers([]);
    saveBriefings([]);
    const { togglePin } = await import('../../src/ui/handlers/archive');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const evtSpy = vi.fn();
    document.addEventListener('dg:archive:updated', evtSpy);

    togglePin('insight', 'nope');
    togglePin('answer', 'nope');
    togglePin('scrap', 'nope');

    expect(evtSpy).not.toHaveBeenCalled();
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('saveUser throw 시 toast (v3.7 패턴, 이벤트 emit 안 함)', async () => {
    // gardenBackfilled: true seed — getCachedUser 내부 자동 persist 차단 (test 격리).
    saveUser(mkUser({ insights: [mkInsight({ pinned: false })], gardenBackfilled: true }));
    const toastMod = await import('../../src/utils/toast');
    const userMod = await import('../../src/state/user');
    const toastSpy = vi.spyOn(toastMod, 'showToast').mockImplementation(() => {});
    // saveUser만 throw — getCachedUser 내부 setItem은 정상 (가시화 격리).
    const saveUserSpy = vi.spyOn(userMod, 'saveUser').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });

    const { togglePin } = await import('../../src/ui/handlers/archive');
    const evtSpy = vi.fn();
    document.addEventListener('dg:archive:updated', evtSpy);

    togglePin('insight', 'i1');

    expect(saveUserSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(evtSpy).not.toHaveBeenCalled();
  });
});
