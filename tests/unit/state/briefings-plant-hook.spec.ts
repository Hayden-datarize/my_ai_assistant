import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  tickPlantsByBriefingInMemory,
  toggleScrap,
  saveMemo,
  saveBriefings,
} from '../../../src/state/briefings';
import type { Briefing } from '../../../src/state/briefings';
import { mkUser } from './userFixture';
import { getKSTDateIso, getKSTWeekIso, getKSTMonthIso } from '../../../src/state/missionEngine';

// テスト用 briefing ファクトリ
function mkBriefing(over: Partial<Briefing> = {}): Briefing {
  return {
    id: '1',
    date: '2026-05-03',
    url: 'https://x.com/1',
    title: 'test title',
    summary: '',
    scrapped: false,
    read: false,
    memo: '',
    sourceTitle: '',
    ...over,
  };
}

describe('tickPlantsByBriefingInMemory (단위 — saveUser 호출 X)', () => {
  it('AI 키워드 매칭 briefing → ai_ml 식물에만 +1', () => {
    const u = mkUser({ interests: ['ai_ml', 'recruiting'], gardenBackfilled: true });
    tickPlantsByBriefingInMemory(u, mkBriefing({
      title: 'GPT-5 출시 — AI 모델 새 milestone',
      summary: '...',
    }), 1);
    expect(u.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(1);
    expect(u.plantStateByInterest.recruiting).toBeUndefined();
  });

  it('AI + recruiting 모두 매칭 briefing → 두 식물에 +1', () => {
    const u = mkUser({ interests: ['ai_ml', 'recruiting'], gardenBackfilled: true });
    tickPlantsByBriefingInMemory(u, mkBriefing({
      title: 'AI 채용 트렌드',
      summary: '...',
    }), 1);
    expect(u.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(1);
    expect(u.plantStateByInterest.recruiting?.cumulativeActivity).toBe(1);
  });

  it('아무 분야와도 매칭 안 되는 briefing → no-op', () => {
    const u = mkUser({ interests: ['ai_ml', 'recruiting'], gardenBackfilled: true });
    tickPlantsByBriefingInMemory(u, mkBriefing({
      title: '날씨 예보',
      summary: '맑음.',
    }), 1);
    expect(Object.keys(u.plantStateByInterest)).toHaveLength(0);
  });
});

describe('mutateWithSweep integration (S7 fix — atomic single saveUser)', () => {
  beforeEach(() => {
    localStorage.clear();
    // 미션 시드를 현재 기간으로 pre-seed — getActiveMissions lazy regen이 발동하지 않아
    // tickMissionProgress → applyMissionBonus 경로를 차단 (plant count 순수 격리).
    const now = new Date();
    const seedUser = mkUser({
      interests: ['ai_ml'],
      gardenBackfilled: true,
      missions: {
        active: [],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: getKSTDateIso(now),
        currentWeekIso: getKSTWeekIso(now),
        currentMonthIso: getKSTMonthIso(now),
      },
    });
    localStorage.setItem('user', JSON.stringify(seedUser));
    // 제목에 "AI"가 포함되어야 ai_ml 키워드(\bai\b) 매칭됨
    saveBriefings([mkBriefing({
      id: '1',
      title: 'AI 모델 최신 동향',
      summary: '',
      scrapped: false,
      read: false,
      memo: '',
    })]);
  });

  it('toggleScrap (false→true) → ai_ml 식물 +1 + 단일 saveUser', () => {
    toggleScrap(0);
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(1);
  });

  it('toggleScrap (true→false) → 식물 변동 0 (un-scrap은 카운트 안 함)', () => {
    toggleScrap(0);  // false → true (+1)
    toggleScrap(0);  // true → false (no-op)
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(1);
  });

  it('saveMemo (빈→non-빈, 스크랩 없음) → 식물 변동 없음 (P1-1: 스크랩 없이 memo만은 tick X)', () => {
    // beforeEach에서 briefing은 scrapped=false
    saveMemo(0, '메모 내용');
    const u = JSON.parse(localStorage.getItem('user')!);
    // 스크랩 없이 메모만 작성 → P1-1 fix로 plant tick 안 됨
    expect(u.plantStateByInterest.ai_ml).toBeUndefined();
  });

  it('saveMemo (스크랩 후 빈→non-빈) → 식물 +1 (스크랩된 경우만 tick)', () => {
    toggleScrap(0);           // false→true 스크랩 (+1)
    const u1 = JSON.parse(localStorage.getItem('user')!);
    expect(u1.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(1);  // scrap tick
    saveMemo(0, '메모 내용'); // 스크랩됐으므로 빈→non-빈 → +1
    const u2 = JSON.parse(localStorage.getItem('user')!);
    expect(u2.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(2);
  });

  it('saveMemo (non-빈 → 다른 non-빈, 스크랩 없음) → 변동 0', () => {
    saveMemo(0, '메모 1');  // 스크랩 없음 → tick X
    saveMemo(0, '메모 2');  // non-빈 → non-빈 (no-op 기준)
    const u = JSON.parse(localStorage.getItem('user')!);
    // 스크랩 없이 메모만 → 변동 없음
    expect(u.plantStateByInterest.ai_ml).toBeUndefined();
  });

  it('스크랩 + 메모 동시 발생 → 각 +1 합쳐 +2', () => {
    toggleScrap(0);        // 스크랩 +1
    saveMemo(0, '메모');   // 스크랩됐으므로 메모 +1
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(2);
  });

  // v3.15 T16.1 P1-1 fix: 스크랩 없이 memo만 작성 시 plant tick 안 됨
  it('P1-1 fix: 스크랩 안 된 briefing + memo 작성 → plant tick 0 (backfill 정책 정합)', () => {
    // briefing은 scrapped=false 상태 (beforeEach에서 설정)
    saveMemo(0, '메모');
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.plantStateByInterest.ai_ml).toBeUndefined();
  });

  // v3.16 T1 C1 fix: memo 먼저 → scrap ON 시 memo retroactive catch-up
  it('C1 catch-up: memo 먼저 → scrap ON → memo +1 + scrap +1 (cumulative +2)', () => {
    // beforeEach briefing은 scrapped=false, memo=''. memo 먼저 채움 (스크랩 없는 동안엔 tick 0)
    saveMemo(0, '메모 먼저');
    const u0 = JSON.parse(localStorage.getItem('user')!);
    expect(u0.plantStateByInterest.ai_ml).toBeUndefined();  // 스크랩 없는 memo는 tick 안 됨

    toggleScrap(0);  // 이제 scrap ON → scrap +1 + memo catch-up +1

    const u1 = JSON.parse(localStorage.getItem('user')!);
    expect(u1.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(2);
  });

  it('C1 baseline (regression guard): scrap 먼저 → memo 추가 → memo +1 (기존 동작 유지)', () => {
    toggleScrap(0);              // scrap +1
    const u1 = JSON.parse(localStorage.getItem('user')!);
    expect(u1.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(1);

    saveMemo(0, '나중에 작성');   // 스크랩됐고 빈→non-빈 → memo +1

    const u2 = JSON.parse(localStorage.getItem('user')!);
    expect(u2.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(2);
  });

  it('C1 regression: 비스크랩 + memo only → cumulative 변화 없음 (정책 일치)', () => {
    // beforeEach briefing은 scrapped=false
    saveMemo(0, '비스크랩에 memo만 추가');

    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.plantStateByInterest.ai_ml).toBeUndefined();  // tick 0
  });

  it('C1 regression: scrap OFF 토글 → catch-up 없음', () => {
    // 먼저 scrap ON + memo 작성 → cumulative 2
    toggleScrap(0);              // scrap +1
    saveMemo(0, '메모 있음');     // memo +1
    const u1 = JSON.parse(localStorage.getItem('user')!);
    expect(u1.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(2);

    toggleScrap(0);  // ON → OFF → no-op (un-scrap은 catch-up 없음)

    const u2 = JSON.parse(localStorage.getItem('user')!);
    expect(u2.plantStateByInterest.ai_ml?.cumulativeActivity).toBe(2);
  });
});

describe('mutateWithSweep P0-2: saveUser 실패 시 sweep 차단 (atomic invariant)', () => {
  beforeEach(() => {
    localStorage.clear();
    const now = new Date();
    const seedUser = mkUser({
      interests: ['ai_ml'],
      gardenBackfilled: true,
      missions: {
        active: [],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: getKSTDateIso(now),
        currentWeekIso: getKSTWeekIso(now),
        currentMonthIso: getKSTMonthIso(now),
      },
    });
    localStorage.setItem('user', JSON.stringify(seedUser));
    saveBriefings([mkBriefing({ id: '1', title: 'AI 모델 최신 동향', summary: '' })]);
  });

  it('P0-2 fix: saveUser throws → runSweep 호출 안 됨 (sweep 차단)', async () => {
    // saveUser를 throw하도록 mock
    const userModule = await import('../../../src/state/user');
    const saveSpy = vi.spyOn(userModule, 'saveUser').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    // runSweep 호출 여부 spy
    const achievementsModule = await import('../../../src/state/achievements');
    const sweepSpy = vi.spyOn(achievementsModule, 'runSweep');

    toggleScrap(0);

    // saveUser throw → saveOk=false → runSweep 호출 0회
    expect(sweepSpy).not.toHaveBeenCalled();

    saveSpy.mockRestore();
    sweepSpy.mockRestore();
  });
});
