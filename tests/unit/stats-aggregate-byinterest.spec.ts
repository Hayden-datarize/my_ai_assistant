/**
 * stats-aggregate-byinterest.spec.ts — v3.24 T6 (B2) → v3.39 T6 (Codex P1-4)
 * byInterest 'unknown' bucket 정밀화 정책 검증.
 *
 * v3.39 T6: 분류 기준을 `a.type`(질문 유형, 레거시) → `a.interestId`(관심분야)로 정정.
 *
 * 정책:
 * - A. 'unknown' 정의: a.interestId 가 null / undefined / '' / whitespace-only / 'unknown' → 'unknown'
 * - B. 'unknown' bucket은 byInterest 결과 + activeInterests에서 제외
 * - C. byInterest 비어있을 때 (모든 답변 unknown): 빈 배열 + activeInterests=0
 * - D. cache fingerprint(stats-range-modal.buildFingerprint)는 자연 invalidate
 *
 * v3.23 T6 mid-pass P1-2 carry-forward.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStatsRange } from '../../src/utils/statsAggregate';
import type { Answer } from '../../src/state/schema';

vi.mock('../../src/state/persistence', () => ({
  loadAnswers: vi.fn(),
}));

import { loadAnswers } from '../../src/state/persistence';

const mkAnswer = (overrides: Partial<Answer>): Answer => ({
  schemaVersion: 1,
  id: overrides.id ?? 'a',
  questionId: 'q',
  text: 't',
  authorId: 'self',
  createdAt: overrides.createdAt ?? '2026-05-08T09:00:00Z', // KST 18:00, NY 05:00 동일 5/8
  pinned: false,
  interestId: 'unknown', // v3.39 T2
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  // TZ-agnostic instant: 2026-05-08T09:00:00Z → KST 5/8 18:00, NY 5/8 05:00
  vi.setSystemTime(new Date('2026-05-08T09:00:00Z'));
});

describe("byInterest semantics — 'unknown' bucket 제외 정책 (v3.39 T6 Codex P1-4: a.type → a.interestId)", () => {
  it('Answer.interestId 정상 분야는 분리 집계', () => {
    (loadAnswers as ReturnType<typeof vi.fn>).mockReturnValue([
      mkAnswer({ id: '1', interestId: 'ai_ml' }),
      mkAnswer({ id: '2', interestId: 'ai_ml' }),
      mkAnswer({ id: '3', interestId: 'hr_system' }),
    ]);
    const r = getStatsRange(7);
    expect(r.byInterest).toEqual([
      { id: 'ai_ml', count: 2 },
      { id: 'hr_system', count: 1 },
    ]);
    expect(r.activeInterests).toBe(2);
  });

  it("interestId='unknown' / 빈값 / whitespace는 'unknown' bucket 통합 후 제외", () => {
    // null은 legacy 런타임 데이터 방어용 (TS schema는 string이지만 storage는 임의 JSON).
    const nullInterest = mkAnswer({ id: '6' });
    (nullInterest as { interestId: unknown }).interestId = null;

    (loadAnswers as ReturnType<typeof vi.fn>).mockReturnValue([
      mkAnswer({ id: '1', interestId: 'ai_ml' }),
      mkAnswer({ id: '2', interestId: 'unknown' }),
      mkAnswer({ id: '3', interestId: '' }),
      mkAnswer({ id: '4', interestId: '   ' }),
      mkAnswer({ id: '5', interestId: '\t\n' }),
      nullInterest,
    ]);
    const r = getStatsRange(7);
    expect(r.byInterest.find((b) => b.id === 'unknown')).toBeUndefined();
    expect(r.byInterest).toEqual([{ id: 'ai_ml', count: 1 }]);
    expect(r.activeInterests).toBe(1);
    // totalAnswers는 전체 (unknown 포함)
    expect(r.totalAnswers).toBe(6);
  });

  it('mixed 분야 + unknown 합쳐도 byInterest는 known만, totalAnswers/avgPerDay는 전체', () => {
    (loadAnswers as ReturnType<typeof vi.fn>).mockReturnValue([
      mkAnswer({ id: '1', interestId: 'ai_ml' }),
      mkAnswer({ id: '2', interestId: 'ai_ml' }),
      mkAnswer({ id: '3', interestId: 'unknown' }),
      mkAnswer({ id: '4', interestId: 'hr_system' }),
    ]);
    const r = getStatsRange(7);
    expect(r.totalAnswers).toBe(4);
    expect(r.activeInterests).toBe(2);
    expect(r.byInterest).toEqual([
      { id: 'ai_ml', count: 2 },
      { id: 'hr_system', count: 1 },
    ]);
  });

  it('전체 unknown 시 byInterest 빈 배열, activeInterests=0, totalAnswers는 보존', () => {
    (loadAnswers as ReturnType<typeof vi.fn>).mockReturnValue([
      mkAnswer({ id: '1', interestId: 'unknown' }),
      mkAnswer({ id: '2', interestId: '' }),
    ]);
    const r = getStatsRange(7);
    expect(r.byInterest).toEqual([]);
    expect(r.activeInterests).toBe(0);
    expect(r.totalAnswers).toBe(2);
  });

  it("a.type(질문 유형)은 더 이상 byInterest에 영향 없음 (의미 정정 검증)", () => {
    // v3.39 T6 정정 핵심: a.type='분석'이어도 a.interestId='unknown'이면 byInterest 제외.
    (loadAnswers as ReturnType<typeof vi.fn>).mockReturnValue([
      mkAnswer({ id: '1', type: '분석', interestId: 'unknown' }),
      mkAnswer({ id: '2', type: '트렌드', interestId: 'ai_ml' }),
    ]);
    const r = getStatsRange(7);
    expect(r.byInterest).toEqual([{ id: 'ai_ml', count: 1 }]);
    expect(r.activeInterests).toBe(1);
  });
});
