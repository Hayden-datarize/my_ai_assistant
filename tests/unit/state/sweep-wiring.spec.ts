import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveUser, recordDailyAnswer } from '../../../src/state/user';
import { toggleScrap, saveMemo, saveBriefings, type Briefing } from '../../../src/state/briefings';

beforeEach(() => {
  localStorage.clear();
  saveUser({ name: 'x', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '', xp: 95, earnedBadges: {}, gamificationMigrated: false, schemaVersion: 2 });
});

function captureRewardEvents(): string[] {
  const captured: string[] = [];
  const handler = (e: Event) => captured.push(e.type);
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
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
    const captured = captureRewardEvents();
    toggleScrap(0);
    // T5 badge arm 활성화: scrap-1 unlock 발생
    expect(captured).toContain('dg:reward:badge-unlock');
  });

  it('saveMemo: 단일 memo → memo-5 (>=5) predicate 미충족, 0 events', () => {
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
    const captured = captureRewardEvents();
    saveMemo(0, '내 메모');
    // memo-5는 5건 이상 필요 → 1건 작성으로는 unlock 안 됨
    expect(captured).toHaveLength(0);
  });

  it('toggleScrap: saveBriefings throw 시 sweep 안 함', () => {
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
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
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
    const captured = captureRewardEvents();
    toggleScrap(0);
    expect(captured).toContain('dg:reward:badge-unlock');
  });

  it('saveMemo: 5번째 memo → memo-5 badge unlock', () => {
    const briefings = Array.from({ length: 6 }, (_, i) => ({
      id: `${i}`, date: '2026-04-30', url: `https://x${i}.com`, title: 't', summary: 's',
      scrapped: false, read: false, memo: i < 4 ? `m${i}` : '',
    }));
    saveBriefings(briefings);
    const captured = captureRewardEvents();
    saveMemo(4, '다섯번째');  // 4 → 5 memos
    expect(captured).toContain('dg:reward:badge-unlock');
  });
});
