import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectEvents, takeSnapshot } from '../../../src/state/achievements';
import { mountRewards, __resetForTest } from '../../../src/ui/rewards';
import { dispatch } from '../../../src/ui/events';
import type { Snapshot } from '../../../src/state/gameTypes';

function makeSnap(plantStages: Record<string, number> = {}): Snapshot {
  return {
    xp: 0, streak: 0, answersCount: 0, scrapsCount: 0, memosCount: 0,
    uniqueAnsweredTypes: new Set(), selectedInterests: new Set(),
    engagedInterests: new Set(), uniqueScrapCategories: 0,
    earnedBadgeIds: new Set(), missionsActive: [],
    missionsCumulative: { daily: 0, weekly: 0, monthly: 0 },
    plantStages,
  };
}

describe('detectEvents — plant-stage-up (S6 fix: kind discriminant)', () => {
  it('stage 1→2 전환 → plant-stage-up emit', () => {
    const prev = makeSnap({ recruiting: 1 });
    const curr = makeSnap({ recruiting: 2 });
    const events = detectEvents(prev, curr);
    expect(events).toContainEqual(expect.objectContaining({
      kind: 'plant-stage-up', interestId: 'recruiting', newStage: 2,
    }));
  });

  it('stage 4→5 전환 → plant-stage-up newStage 5', () => {
    const prev = makeSnap({ ai_ml: 4 });
    const curr = makeSnap({ ai_ml: 5 });
    const events = detectEvents(prev, curr);
    expect(events.find(e => e.kind === 'plant-stage-up')).toEqual(expect.objectContaining({
      kind: 'plant-stage-up', interestId: 'ai_ml', newStage: 5,
    }));
  });

  it('S1 fix: prev에 entry 없음 (분야 추가 직후) → plant-stage-up emit 안 함', () => {
    const prev = makeSnap({});
    const curr = makeSnap({ recruiting: 3 });  // 새 식물 stage 3 (backfill 등)
    const events = detectEvents(prev, curr);
    expect(events.filter(e => e.kind === 'plant-stage-up')).toHaveLength(0);
  });

  it('S1 fix: prev에 entry 없음 + curr stage 5 (backfill 즉시 max) → emit 안 함', () => {
    const prev = makeSnap({});
    const curr = makeSnap({ ai_ml: 5 });
    const events = detectEvents(prev, curr);
    expect(events.filter(e => e.kind === 'plant-stage-up')).toHaveLength(0);
  });

  it('stage 동일 → emit 안 함', () => {
    const prev = makeSnap({ recruiting: 3 });
    const curr = makeSnap({ recruiting: 3 });
    const events = detectEvents(prev, curr);
    expect(events.filter(e => e.kind === 'plant-stage-up')).toHaveLength(0);
  });

  it('stage 감소 (불가능 케이스, 데이터 손상) → emit 안 함 (S11 accepted tradeoff)', () => {
    const prev = makeSnap({ recruiting: 4 });
    const curr = makeSnap({ recruiting: 2 });
    const events = detectEvents(prev, curr);
    expect(events.filter(e => e.kind === 'plant-stage-up')).toHaveLength(0);
  });

  it('여러 식물 동시 전환 (미션 보너스) → 각각 emit', () => {
    const prev = makeSnap({ recruiting: 1, ai_ml: 2, self_dev: 3 });
    const curr = makeSnap({ recruiting: 2, ai_ml: 3, self_dev: 3 });  // recruiting/ai_ml 전환, self_dev 유지
    const events = detectEvents(prev, curr).filter(e => e.kind === 'plant-stage-up');
    expect(events).toHaveLength(2);
  });

  it('emit된 event는 at: number 필드 포함 (다른 events와 일관)', () => {
    const prev = makeSnap({ recruiting: 1 });
    const curr = makeSnap({ recruiting: 2 });
    const events = detectEvents(prev, curr);
    const e = events.find(ev => ev.kind === 'plant-stage-up');
    expect(typeof (e as any)?.at).toBe('number');
  });
});

describe('takeSnapshot.plantStages', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('user.plantStateByInterest → Snapshot.plantStages 매핑', () => {
    localStorage.setItem('user', JSON.stringify({
      name: 'h', interests: ['ai'], onboardedAt: '', streak: 0,
      lastActiveDate: '2026-05-03', xp: 0, earnedBadges: {},
      gamificationMigrated: true, schemaVersion: 4,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 }, lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
      plantStateByInterest: { ai: { stage: 3, cumulativeActivity: 30 } },
      gardenIntroduced: false, gardenBackfilled: true,
    }));
    const snap = takeSnapshot();
    expect(snap.plantStages).toEqual({ ai: 3 });
  });

  it('user 없음 → 빈 plantStages', () => {
    const snap = takeSnapshot();
    expect(snap.plantStages).toEqual({});
  });
});

describe('plant-stage-up event handler (max stage, T14)', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
    __resetForTest();
    mountRewards();
  });

  afterEach(() => {
    __resetForTest();
  });

  it('newStage === 5 → toast--bloom emit', async () => {
    dispatch('dg:reward:plant-stage-up', { interestId: 'ai_ml', newStage: 5, at: Date.now() });
    await new Promise(r => setTimeout(r, 50));
    const toast = document.querySelector('.toast--bloom');
    expect(toast?.textContent).toMatch(/AI/i);
    expect(toast?.textContent).toContain('만개');
  });

  it('newStage 1~4 → toast 안 emit (silent)', async () => {
    for (const stage of [1, 2, 3, 4] as const) {
      dispatch('dg:reward:plant-stage-up', { interestId: 'ai_ml', newStage: stage, at: Date.now() });
    }
    await new Promise(r => setTimeout(r, 50));
    expect(document.querySelectorAll('.toast--bloom')).toHaveLength(0);
  });

  it('C5 fix: toast 클릭 시 navigate 안 함 (비-action toast — close 버튼만 동작)', async () => {
    dispatch('dg:reward:plant-stage-up', { interestId: 'ai_ml', newStage: 5, at: Date.now() });
    await new Promise(r => setTimeout(r, 50));
    const toast = document.querySelector('.toast--bloom') as HTMLElement | null;
    expect(toast).not.toBeNull();
    // bloom toast에는 navigate 링크/버튼이 없음 (비-action)
    expect(toast?.querySelectorAll('[data-tab-id]')).toHaveLength(0);
    expect(toast?.querySelectorAll('a[href]')).toHaveLength(0);
  });
});
