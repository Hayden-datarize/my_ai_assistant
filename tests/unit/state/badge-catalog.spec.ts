import { describe, it, expect } from 'vitest';
import { BADGE_CATALOG, findBadge } from '../../../src/state/badgeCatalog';
import type { Snapshot } from '../../../src/state/gameTypes';

function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    xp: 0, streak: 0, answersCount: 0, scrapsCount: 0, memosCount: 0,
    uniqueAnsweredTypes: new Set(), selectedInterests: new Set(),
    engagedInterests: new Set(), uniqueScrapCategories: 0,
    earnedBadgeIds: new Set(),
    missionsActive: [],
    missionsCumulative: { daily: 0, weekly: 0, monthly: 0 },
    ...over,
  };
}

describe('BADGE_CATALOG', () => {
  it('총 18개', () => expect(BADGE_CATALOG).toHaveLength(18));
  it('id 모두 unique', () => {
    const ids = BADGE_CATALOG.map(b => b.id);
    expect(new Set(ids).size).toBe(18);
  });
  it('5 카테고리 분포 — Streak 5 / Volume 4 / Tier 3 / Diversity 3 / Engagement 3', () => {
    const byCat = BADGE_CATALOG.reduce((m, b) => ((m[b.category] = (m[b.category] ?? 0) + 1), m), {} as Record<string, number>);
    expect(byCat).toEqual({ streak: 5, volume: 4, tier: 3, diversity: 3, engagement: 3 });
  });
});

describe('predicates — Streak (5)', () => {
  it('streak-3 unlock at streak===3', () => expect(findBadge('streak-3')!.predicate(snap({ streak: 3 }))).toBe(true));
  it('streak-3 locked at streak===2', () => expect(findBadge('streak-3')!.predicate(snap({ streak: 2 }))).toBe(false));
  it('streak-7 at 7', () => expect(findBadge('streak-7')!.predicate(snap({ streak: 7 }))).toBe(true));
  it('streak-30 at 30', () => expect(findBadge('streak-30')!.predicate(snap({ streak: 30 }))).toBe(true));
  it('streak-100 at 100', () => expect(findBadge('streak-100')!.predicate(snap({ streak: 100 }))).toBe(true));
  it('streak-365 at 365', () => expect(findBadge('streak-365')!.predicate(snap({ streak: 365 }))).toBe(true));
});

describe('predicates — Volume (4)', () => {
  it('answers-1 at 1', () => expect(findBadge('answers-1')!.predicate(snap({ answersCount: 1 }))).toBe(true));
  it('answers-10 at 10', () => expect(findBadge('answers-10')!.predicate(snap({ answersCount: 10 }))).toBe(true));
  it('answers-30 at 30', () => expect(findBadge('answers-30')!.predicate(snap({ answersCount: 30 }))).toBe(true));
  it('answers-100 at 100', () => expect(findBadge('answers-100')!.predicate(snap({ answersCount: 100 }))).toBe(true));
});

describe('predicates — Tier (3)', () => {
  it('tier-3-tree at xp===300', () => expect(findBadge('tier-3-tree')!.predicate(snap({ xp: 300 }))).toBe(true));
  it('tier-3-tree locked at xp===299', () => expect(findBadge('tier-3-tree')!.predicate(snap({ xp: 299 }))).toBe(false));
  it('tier-5-mountain at xp===1000', () => expect(findBadge('tier-5-mountain')!.predicate(snap({ xp: 1000 }))).toBe(true));
  it('tier-6-sky at xp===2000', () => expect(findBadge('tier-6-sky')!.predicate(snap({ xp: 2000 }))).toBe(true));
});

describe('predicates — Diversity (3)', () => {
  it('diversity-types: 5종 중 4종 답변 → unlock', () => {
    const s = snap({ uniqueAnsweredTypes: new Set(['분석', '전환', '실무', '성장']) });
    expect(findBadge('diversity-types')!.predicate(s)).toBe(true);
  });
  it('diversity-types: 5종 모두 답변 → unlock', () => {
    const s = snap({ uniqueAnsweredTypes: new Set(['분석', '전환', '실무', '성장', '트렌드']) });
    expect(findBadge('diversity-types')!.predicate(s)).toBe(true);
  });
  it('diversity-types: 3종만 답변 → locked', () => {
    const s = snap({ uniqueAnsweredTypes: new Set(['분석', '전환', '실무']) });
    expect(findBadge('diversity-types')!.predicate(s)).toBe(false);
  });
  it('diversity-interests-all: 선택한 모든 관심분야에 스크랩 1+', () => {
    const s = snap({ selectedInterests: new Set(['AI', 'HR']), engagedInterests: new Set(['AI', 'HR']) });
    expect(findBadge('diversity-interests-all')!.predicate(s)).toBe(true);
  });
  it('diversity-interests-all: 관심분야 0개 → false (최소 1개 선택 필요)', () => {
    const s = snap({ selectedInterests: new Set(), engagedInterests: new Set() });
    expect(findBadge('diversity-interests-all')!.predicate(s)).toBe(false);
  });
  it('diversity-scrap-cats at 8', () => expect(findBadge('diversity-scrap-cats')!.predicate(snap({ uniqueScrapCategories: 8 }))).toBe(true));
});

describe('predicates — Engagement (3)', () => {
  it('scrap-1 at scrapsCount 1', () => expect(findBadge('scrap-1')!.predicate(snap({ scrapsCount: 1 }))).toBe(true));
  it('scrap-50 at scrapsCount 50', () => expect(findBadge('scrap-50')!.predicate(snap({ scrapsCount: 50 }))).toBe(true));
  it('memo-5 at memosCount 5', () => expect(findBadge('memo-5')!.predicate(snap({ memosCount: 5 }))).toBe(true));
});
