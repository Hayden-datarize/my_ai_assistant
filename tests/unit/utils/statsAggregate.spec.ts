/**
 * statsAggregate.spec.ts — v3.23 T4
 * KST anchor 기반 getStatsRange(7|30) 검증.
 * codex P0-2 fix: 양쪽 TZ 머신 (Asia/Seoul, America/New_York) 동일 결과 의무.
 * TZ-agnostic instant: T09:00:00Z (KST 18:00 → 5/8, NY 05:00 → 5/8)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStatsRange } from '../../../src/utils/statsAggregate';

// 기준 시각: 2026-05-08T09:00:00Z → KST 2026-05-08 18:00, NY 2026-05-08 05:00
const NOW_UTC = '2026-05-08T09:00:00Z';

// v3.39 T6 (Codex P1-4): byInterest 분류 기준이 `a.type` → `a.interestId`로 정정됨.
// 기존 type 인자 호환 유지(아래 일부 케이스에 잔존), 신규 interestId 인자 우선.
function makeAnswer(overrides: { id: string; createdAt: string; type?: string; interestId?: string }) {
  return {
    schemaVersion: 1 as const,
    questionId: 'q1',
    text: 'x',
    authorId: 'self',
    type: '분석',
    interestId: 'career',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_UTC));
});

describe('getStatsRange', () => {
  it('빈 데이터: 0/0/0/0 + byInterest 빈 배열 + daily undefined(7)', () => {
    const r = getStatsRange(7);
    expect(r.totalAnswers).toBe(0);
    expect(r.longestStreak).toBe(0);
    expect(r.activeInterests).toBe(0);
    expect(r.avgPerDay).toBe(0);
    expect(r.byInterest).toEqual([]);
    expect(r.daily).toBeUndefined();
  });

  // codex P0-2 fix verification: createdAt UTC → KST 날짜 정확 매핑
  it('P0-2 KST boundary: UTC late night → KST 다음날로 올바르게 분류', () => {
    // 2026-05-01T15:00:00Z = KST 2026-05-02 00:00 → range 7 (KST 5/2~5/8) 포함
    // 2026-04-30T15:00:00Z = KST 2026-05-01 00:00 → range 7 첫날(5/2) 이전, 미포함
    const answers = [
      makeAnswer({ id: 'a1', createdAt: '2026-05-01T15:00:00Z' }),
      makeAnswer({ id: 'a2', createdAt: '2026-04-30T15:00:00Z' }),
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    const r = getStatsRange(7);
    expect(r.totalAnswers).toBe(1); // a1만 포함 (KST 5/2)
  });

  it('range=7: daily 반환 안 됨 (undefined)', () => {
    const r = getStatsRange(7);
    expect(r.daily).toBeUndefined();
  });

  it('range=30: daily 배열 길이 30', () => {
    const r = getStatsRange(30);
    expect(Array.isArray(r.daily)).toBe(true);
    expect(r.daily).toHaveLength(30);
  });

  it('byInterest: count 내림차순 정렬, 상위 5개 제한 (v3.39 T6: interestId 기준)', () => {
    // 2026-05-08T03:00:00Z = KST 5/8 12:00 → range 내
    // v3.39 T6 (Codex P1-4): a.type → a.interestId 정정. INTERESTS id 6개 분포.
    const createdAt = '2026-05-08T03:00:00Z';
    const answers = [
      makeAnswer({ id: 'a1', createdAt, interestId: 'career' }),
      makeAnswer({ id: 'a2', createdAt, interestId: 'career' }),
      makeAnswer({ id: 'a3', createdAt, interestId: 'self_dev' }),
      makeAnswer({ id: 'a4', createdAt, interestId: 'productivity' }),
      makeAnswer({ id: 'a5', createdAt, interestId: 'leadership' }),
      makeAnswer({ id: 'a6', createdAt, interestId: 'communication' }),
      makeAnswer({ id: 'a7', createdAt, interestId: 'culture' }),
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    const r = getStatsRange(7);
    expect(r.byInterest[0]).toEqual({ id: 'career', count: 2 });
    // 동일 count(=1) entries는 정렬 순서가 stable 아니므로 set 단위 검증.
    const restIds = r.byInterest.slice(1, 5).map(b => b.id);
    expect(restIds.every(id => ['self_dev', 'productivity', 'leadership', 'communication', 'culture'].includes(id))).toBe(true);
    expect(r.byInterest).toHaveLength(5); // 최대 5개 제한
    expect(r.activeInterests).toBe(6); // 실제 분야 수
  });

  it('longestStreak: 연속 3일 답변 정확 측정', () => {
    // 2026-05-06~08T03:00:00Z = KST 5/6~5/8 12:00 → range 7 내 연속 3일
    const answers = [
      makeAnswer({ id: 'a1', createdAt: '2026-05-06T03:00:00Z' }),
      makeAnswer({ id: 'a2', createdAt: '2026-05-07T03:00:00Z' }),
      makeAnswer({ id: 'a3', createdAt: '2026-05-08T03:00:00Z' }),
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    const r = getStatsRange(7);
    expect(r.longestStreak).toBe(3); // 5/6, 5/7, 5/8 연속
  });

  it('longestStreak: 중간 공백이 있으면 끊김', () => {
    // 5/2, 5/4, 5/6 — 연속 없음, 각각 1
    const answers = [
      makeAnswer({ id: 'a1', createdAt: '2026-05-02T03:00:00Z' }),
      makeAnswer({ id: 'a2', createdAt: '2026-05-04T03:00:00Z' }),
      makeAnswer({ id: 'a3', createdAt: '2026-05-06T03:00:00Z' }),
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    const r = getStatsRange(7);
    expect(r.longestStreak).toBe(1);
  });

  it('avgPerDay: total / days, 소수 1자리 반올림', () => {
    // range=7에 3건 → 3/7 ≈ 0.4
    const answers = [
      makeAnswer({ id: 'a1', createdAt: '2026-05-08T03:00:00Z' }),
      makeAnswer({ id: 'a2', createdAt: '2026-05-08T04:00:00Z' }),
      makeAnswer({ id: 'a3', createdAt: '2026-05-08T05:00:00Z' }),
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    const r = getStatsRange(7);
    expect(r.avgPerDay).toBe(0.4); // Math.round(3/7*10)/10 = 0.4
  });

  it('avgPerDay: 7건 / 7일 = 1.0', () => {
    const answers = Array.from({ length: 7 }, (_, i) =>
      makeAnswer({ id: `a${i}`, createdAt: '2026-05-08T03:00:00Z' }),
    );
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    const r = getStatsRange(7);
    expect(r.avgPerDay).toBe(1.0);
  });

  // P0-2 fix verification — 양쪽 TZ 머신 동일 결과 의무
  it('P0-2: TZ-agnostic instant T09:00:00Z (KST 5/8 18:00) → range 포함 확인', () => {
    // NOW_UTC = T09:00:00Z → KST 5/8, NY 5/8 AM. 어떤 머신에서도 KST 5/8 날짜.
    const a1 = makeAnswer({ id: 'a1', createdAt: NOW_UTC });
    localStorage.setItem('dg.answers', JSON.stringify([a1]));

    const r = getStatsRange(7);
    expect(r.totalAnswers).toBe(1); // KST 5/8, range 5/2~5/8 포함
  });

  it('P0-2: range 경계 fromDate (days-1일 이전) 포함, 그 이전은 미포함', () => {
    // range=7, today=5/8 → fromDate=5/2
    // 5/2 KST 정오 T03:00:00Z = 5/2 KST 12:00 → 포함
    // 5/1 KST 정오 T03:00:00Z = 5/1 KST 12:00 → 미포함
    // 날짜를 정오 기준으로 잡아 KST 기준 명확
    const answers = [
      makeAnswer({ id: 'in', createdAt: '2026-05-02T03:00:00Z' }),  // KST 5/2 12:00 → 포함
      makeAnswer({ id: 'out', createdAt: '2026-05-01T03:00:00Z' }), // KST 5/1 12:00 → 미포함
    ];
    localStorage.setItem('dg.answers', JSON.stringify(answers));

    const r = getStatsRange(7);
    expect(r.totalAnswers).toBe(1);
  });

  // v3.24 T6 (P0-2): 'unknown' bucket 정밀화 정책으로 기존 spec 폐기.
  // 신규 superset → tests/unit/stats-aggregate-byinterest.spec.ts (4건).
});
