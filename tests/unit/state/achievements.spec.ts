import { describe, it, expect, beforeEach, vi } from 'vitest';
import { takeSnapshot, detectEvents, runSweep, persistUnlocks } from '../../../src/state/achievements';
import type { Snapshot, GameEvent } from '../../../src/state/gameTypes';
import { saveUser, loadUserData } from '../../../src/state/user';
import { mkUser } from './userFixture';

beforeEach(() => localStorage.clear());

function emptySnap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    xp: 0, streak: 0, answersCount: 0, scrapsCount: 0, memosCount: 0,
    uniqueAnsweredTypes: new Set(), selectedInterests: new Set(),
    engagedInterests: new Set(), uniqueScrapCategories: 0,
    earnedBadgeIds: new Set(),
    ...over,
  };
}

describe('achievements — detectEvents', () => {
  it('xp-gained: prev.xp < curr.xp → event with delta amount', () => {
    const events = detectEvents(emptySnap({ xp: 90 }), emptySnap({ xp: 100 }));
    const xp = events.find(e => e.kind === 'xp-gained');
    expect(xp).toBeDefined();
    expect((xp as any).amount).toBe(10);
  });

  it('xp-gained: same xp → no event', () => {
    const events = detectEvents(emptySnap({ xp: 100 }), emptySnap({ xp: 100 }));
    expect(events.find(e => e.kind === 'xp-gained')).toBeUndefined();
  });

  it('level-up: 99 → 100 (boundary 정확) → 새잎 tier event', () => {
    const events = detectEvents(emptySnap({ xp: 99 }), emptySnap({ xp: 100 }));
    const lv = events.find(e => e.kind === 'level-up');
    expect(lv).toBeDefined();
    expect((lv as any).tierId).toBe(2);
  });

  it('level-up: 100 → 200 (same tier) → no event', () => {
    const events = detectEvents(emptySnap({ xp: 100 }), emptySnap({ xp: 200 }));
    expect(events.find(e => e.kind === 'level-up')).toBeUndefined();
  });

  it('streak-milestone: prev<3 && curr>=3 → 3 days event', () => {
    const events = detectEvents(emptySnap({ streak: 2 }), emptySnap({ streak: 3 }));
    const sm = events.find(e => e.kind === 'streak-milestone');
    expect(sm).toBeDefined();
    expect((sm as any).days).toBe(3);
  });

  it('streak-milestone: 7→8 → no event (already past 7)', () => {
    const events = detectEvents(emptySnap({ streak: 7 }), emptySnap({ streak: 8 }));
    expect(events.find(e => e.kind === 'streak-milestone')).toBeUndefined();
  });

  it('streak-milestone: 0→100 → 통과한 모든 milestone emit (3/7/30/100)', () => {
    const events = detectEvents(emptySnap({ streak: 0 }), emptySnap({ streak: 100 }));
    // UI 큐 max 3 cap이므로 4번째부터 silent persist (rewards.ts에서 처리).
    const days = events.filter(e => e.kind === 'streak-milestone').map(e => (e as any).days);
    expect(days).toContain(100);
    expect(days).toContain(3);
  });

  it('takeSnapshot: empty user → zeros', () => {
    saveUser(mkUser());
    const snap = takeSnapshot();
    expect(snap.xp).toBe(0);
    expect(snap.streak).toBe(0);
    expect(snap.earnedBadgeIds.size).toBe(0);
  });

  it('persistUnlocks: badge events → user.earnedBadges 갱신', () => {
    saveUser(mkUser());
    const events: GameEvent[] = [{ kind: 'badge', badgeId: 'streak-3', at: 1700000000000 }];
    persistUnlocks(events);
    const u = loadUserData()!;
    expect(u.earnedBadges['streak-3']).toBe(1700000000000);
  });

  it('runSweep: events 없으면 dispatch도 persist도 안 함', () => {
    saveUser(mkUser());
    const spy = vi.spyOn(document, 'dispatchEvent');
    const same = emptySnap({ xp: 100 });
    runSweep(same, same);
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ type: expect.stringMatching(/^dg:reward:/) }));
  });
});

describe('takeSnapshot — engagedInterests integration (P1-A fix)', () => {
  it('한국어 label keyword 매칭: 인사제도 텍스트 → hr_system engaged', () => {
    saveUser(mkUser({ interests: ['hr_system', 'ai_ml'] }));
    // briefings 직접 seed (briefings.ts 우회)
    localStorage.setItem('briefings', JSON.stringify([
      { id: '1', date: '2026-04-30', url: 'https://x.com', title: '신규 인사제도 도입 사례', summary: '...', scrapped: true, read: false, memo: '', sourceTitle: '' },
    ]));
    const snap = takeSnapshot();
    expect(snap.engagedInterests.has('hr_system')).toBe(true);
    expect(snap.engagedInterests.has('ai_ml')).toBe(false);  // 매칭 안 됨
  });

  it('snake_case ID는 텍스트에 직접 안 나타나도 label split keyword가 매칭', () => {
    saveUser(mkUser({ interests: ['self_dev'] }));
    localStorage.setItem('briefings', JSON.stringify([
      { id: '1', date: '2026-04-30', url: 'https://x.com', title: '자기계발 루틴 5선', summary: '...', scrapped: true, read: false, memo: '', sourceTitle: '' },
    ]));
    const snap = takeSnapshot();
    expect(snap.engagedInterests.has('self_dev')).toBe(true);
  });

  it('스크랩 안 된 briefing은 engagedInterests 매칭 안 됨', () => {
    saveUser(mkUser({ interests: ['hr_system'] }));
    localStorage.setItem('briefings', JSON.stringify([
      { id: '1', date: '2026-04-30', url: 'https://x.com', title: '인사제도 사례', summary: '...', scrapped: false, read: false, memo: '', sourceTitle: '' },
    ]));
    const snap = takeSnapshot();
    expect(snap.engagedInterests.has('hr_system')).toBe(false);
  });
});
