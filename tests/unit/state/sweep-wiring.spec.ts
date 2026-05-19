import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveUser, recordDailyAnswer } from '../../../src/state/user';
import { toggleScrap, saveMemo, saveBriefings } from '../../../src/state/briefings';
import { mkUser } from './userFixture';

beforeEach(() => {
  localStorage.clear();
  saveUser(mkUser({ xp: 95 }));
});

function captureRewardEvents(): string[] {
  const captured: string[] = [];
  const handler = (e: Event) => captured.push(e.type);
  ['dg:reward:xp-float', 'dg:reward:level-up', 'dg:reward:streak-milestone', 'dg:reward:badge-unlock'].forEach(n =>
    document.addEventListener(n, handler)
  );
  return captured;
}

// 단일 capture: type + detail (badge ID 등 verification 용)
type CapturedEvent = { type: string; detail: unknown };
function captureRewardEventsWithDetail(): CapturedEvent[] {
  const captured: CapturedEvent[] = [];
  const handler = (e: Event) => captured.push({ type: e.type, detail: (e as CustomEvent).detail });
  ['dg:reward:xp-float', 'dg:reward:level-up', 'dg:reward:streak-milestone', 'dg:reward:badge-unlock'].forEach(n =>
    document.addEventListener(n, handler)
  );
  return captured;
}

describe('sweep wiring', () => {
  it('recordDailyAnswer(10) → xp-float event dispatch', () => {
    const captured = captureRewardEvents();
    recordDailyAnswer(10);
    expect(captured).toContain('dg:reward:xp-float');
  });

  it('recordDailyAnswer(10): xp 95→105 → level-up event dispatch', () => {
    const captured = captureRewardEvents();
    recordDailyAnswer(10);
    expect(captured).toContain('dg:reward:level-up');
  });

  it('recordDailyAnswer: saveUser throw 시 sweep 안 함', () => {
    const captured = captureRewardEvents();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => recordDailyAnswer(10)).toThrow();
    expect(captured).toHaveLength(0);
    spy.mockRestore();
  });

  it('toggleScrap: scraps 0→1 → sweep 호출 (T5 badge arm 활성화: scrap-1 unlock)', () => {
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown' }]);
    const captured = captureRewardEvents();
    toggleScrap(0);
    // T5 badge arm 활성화: scrap-1 unlock 발생
    expect(captured).toContain('dg:reward:badge-unlock');
  });

  it('saveMemo: 단일 memo → memo-5 (>=5) predicate 미충족, 0 events', () => {
    // KST 2026-05-01 — daily-memo-1이 RNG-pick되지 않는 날짜 (date-RNG drift fix)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T15:00:00.000Z'));
    try {
      saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown' }]);
      const captured = captureRewardEvents();
      saveMemo(0, '내 메모');
      // memo-5는 5건 이상 필요 → 1건 작성으로는 unlock 안 됨
      expect(captured).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('toggleScrap: saveBriefings throw 시 sweep 안 함', () => {
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown' }]);
    const captured = captureRewardEvents();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k) => {
      if (k === 'briefings') throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => toggleScrap(0)).toThrow();
    expect(captured).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('sweep wiring — badge arm (T5 활성화 후)', () => {
  it('toggleScrap: scraps 0→1 → scrap-1 badge unlock', () => {
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown' }]);
    const captured = captureRewardEvents();
    toggleScrap(0);
    expect(captured).toContain('dg:reward:badge-unlock');
  });

  it('saveMemo: 5번째 memo → memo-5 badge unlock', () => {
    // KST 2026-05-01 — daily-memo-1 미선택 날짜 + badge ID 명시 검증
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T15:00:00.000Z'));
    try {
      const briefings = Array.from({ length: 6 }, (_, i) => ({
        id: `${i}`, date: '2026-04-30', url: `https://x${i}.com`, title: 't', summary: 's',
        scrapped: false, read: false, memo: i < 4 ? `m${i}` : '', pinned: false, interestId: 'unknown',
      }));
      saveBriefings(briefings);
      const captured = captureRewardEventsWithDetail();
      saveMemo(4, '다섯번째');  // 4 → 5 memos
      const memo5Unlock = captured.find(c =>
        c.type === 'dg:reward:badge-unlock' &&
        (c.detail as { badgeId?: string } | null)?.badgeId === 'memo-5'
      );
      expect(memo5Unlock).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
