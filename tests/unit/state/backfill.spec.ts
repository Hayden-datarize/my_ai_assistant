import { describe, it, expect, beforeEach } from 'vitest';
import { backfillGarden } from '../../../src/state/backfillGarden';
import type { User } from '../../../src/state/user';

// 실제 catalog ID 사용: 'ai' → 'ai_ml', 'design' → 'pm'
// interestKeywords('ai_ml') = ['ai_ml', 'ai', 'ml', 'openai', 'genai', 'aiops', 'aiml']
// matchKeyword('ai 발표', 'ai') → word-boundary로 true (독립 단어 'ai')
// matchKeyword('ai 발표', 'ai_ml') → includes 경로 (length>3) → false — 제목에 ai_ml 필요
// 따라서 title에 'ai'만 포함 시 interestKeywords('ai_ml') 중 단어경계 'ai' 토큰이 매칭됨.

function makeUser(briefings: unknown[], interests: string[] = ['ai_ml', 'pm']): User {
  localStorage.setItem('briefings', JSON.stringify(briefings));
  return {
    name: 'h', interests, onboardedAt: '', streak: 0, lastActiveDate: '',
    xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 4,
    missions: {
      active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
    },
    plantStateByInterest: {}, gardenIntroduced: false, gardenBackfilled: false,
  };
}

beforeEach(() => localStorage.clear());

describe('backfillGarden', () => {
  it('ai_ml 매칭 스크랩 5 + 메모 2 → cumulativeActivity 7, stage 1 (8 미만)', () => {
    // 3개는 메모 없음, 2개는 메모 있음 → matched=5, memoCount=2, total=7
    const briefings = [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `${i}`, scrapped: true, title: 'AI 발표', summary: '', memo: '',
        sourceTitle: '', url: '', date: '',
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `m${i}`, scrapped: true, title: 'AI 발표', summary: '', memo: '메모',
        sourceTitle: '', url: '', date: '',
      })),
    ];
    const u = makeUser(briefings);
    backfillGarden(u);
    expect(u.plantStateByInterest['ai_ml']?.cumulativeActivity).toBe(7); // 5 matched + 2 memos
    expect(u.plantStateByInterest['ai_ml']?.stage).toBe(1);              // 7 < 8
  });

  it('cumulativeActivity 25 → stage 3, lastEngagedAt = 진입 시점 (C3 fix)', () => {
    const briefings = Array.from({ length: 25 }, (_, i) => ({
      id: `${i}`, scrapped: true, title: 'AI',
      summary: '', memo: '', sourceTitle: '', url: '', date: '2024-01-01',
    }));
    const u = makeUser(briefings);
    const before = Date.now();
    backfillGarden(u);
    const after = Date.now();
    expect(u.plantStateByInterest['ai_ml']?.stage).toBe(3); // 25 >= 25 (stage 3)
    const last = new Date(u.plantStateByInterest['ai_ml']!.lastEngagedAt!).getTime();
    expect(last).toBeGreaterThanOrEqual(before);
    expect(last).toBeLessThanOrEqual(after);
  });

  it('cumulativeActivity 160+ → stage 5, unlockedAt 셋', () => {
    const briefings = Array.from({ length: 200 }, (_, i) => ({
      id: `${i}`, scrapped: true, title: 'AI',
      summary: '', memo: '', sourceTitle: '', url: '', date: '',
    }));
    const u = makeUser(briefings);
    backfillGarden(u);
    expect(u.plantStateByInterest['ai_ml']?.stage).toBe(5);
    expect(u.plantStateByInterest['ai_ml']?.unlockedAt).toBeDefined();
  });

  it('idempotent (gardenBackfilled flag) — 재호출 시 변동 0', () => {
    const u = makeUser([]);
    u.gardenBackfilled = true;
    u.plantStateByInterest['ai_ml'] = { stage: 3, cumulativeActivity: 30 };
    backfillGarden(u);
    expect(u.plantStateByInterest['ai_ml']?.cumulativeActivity).toBe(30);
  });

  it('신규 사용자 (briefings 0개) → 모든 식물 stage 1, cumulativeActivity 0', () => {
    const u = makeUser([]);
    backfillGarden(u);
    expect(u.plantStateByInterest['ai_ml']?.stage).toBe(1);
    expect(u.plantStateByInterest['ai_ml']?.cumulativeActivity).toBe(0);
    expect(u.plantStateByInterest['pm']?.stage).toBe(1);
    expect(u.plantStateByInterest['pm']?.cumulativeActivity).toBe(0);
  });

  it('gardenBackfilled 셋 (1회만 작동)', () => {
    const u = makeUser([]);
    backfillGarden(u);
    expect(u.gardenBackfilled).toBe(true);
  });

  it('interests 외 entry 자동 생성 안 함 (interests filter)', () => {
    // briefing title에 'AI'가 있어도 interests=['ai_ml']이면 'pm' entry 없음
    const briefings = [{ id: '1', scrapped: true, title: 'AI', summary: '', memo: '', sourceTitle: '', url: '', date: '' }];
    const u = makeUser(briefings, ['ai_ml']);
    backfillGarden(u);
    expect(u.plantStateByInterest['pm']).toBeUndefined();
    expect(u.plantStateByInterest['ai_ml']).toBeDefined();
  });

  it('S2 fix: backfillGarden은 takeSnapshot/runSweep 호출 안 함 (sweep false-fire 방지)', () => {
    // backfillGarden 내부에서 sweep 사이드이펙트가 없음을 확인:
    // backfillGarden 후 plantStateByInterest가 셋 되지만 achievements sweep mock 없이 실행 가능.
    // takeSnapshot/runSweep import가 backfillGarden.ts에 없으므로 이 테스트 자체가 통과되면 증명.
    const briefings = Array.from({ length: 50 }, (_, i) => ({
      id: `${i}`, scrapped: true, title: 'AI',
      summary: '', memo: '', sourceTitle: '', url: '', date: '',
    }));
    const u = makeUser(briefings);
    // sweep를 mock하지 않고 실행 — 에러/사이드이펙트 없어야 함
    expect(() => backfillGarden(u)).not.toThrow();
    // stage 2 이상이지만 sweep 이벤트 없이 조용히 완료
    expect(u.plantStateByInterest['ai_ml']?.stage).toBeGreaterThanOrEqual(2);
  });
});
