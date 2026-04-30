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

  it('toggleScrap: scraps 0→1 → sweep 호출 (xp-float은 X — xp 변화 없음)', () => {
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
    const captured = captureRewardEvents();
    toggleScrap(0);
    // xp 변화 없으므로 reward event 0개 (T5 badge arm 활성화 후엔 'scrap-1' badge unlock 발생)
    expect(captured).toHaveLength(0);
  });

  it('saveMemo: memo 작성 → sweep 호출 (T5 후 memo 5건째에 unlock)', () => {
    saveBriefings([{ id: '1', date: '2026-04-30', url: 'https://x.com', title: 't', summary: 's', scrapped: false, read: false, memo: '' }]);
    const captured = captureRewardEvents();
    saveMemo(0, '내 메모');
    expect(captured).toHaveLength(0);  // T5 후 badge arm 활성화 시 갱신
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
