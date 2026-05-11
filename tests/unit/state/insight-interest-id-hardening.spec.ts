import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Insight } from '../../../src/state/user';
import { normalizeInsightInterestIds } from '../../../src/state/user';

/**
 * v3.26 T2 (Codex 사전 P1-3): persisted v7 invalid interestId string hardening.
 * - normalizer는 별도 export (isValidUserShape pure 유지)
 * - input contract: isValidUserShape 통과한 Insight[] (interestId는 항상 string)
 * - 처리: whitelist 매칭 실패 시 'unknown' normalize + console.warn 1줄 가시화
 *   (silent corruption guard, v3.25 lesson #6)
 */
describe('normalizeInsightInterestIds (v3.26 T2 — P1-3)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('preserves known whitelist interestId (recruiting)', () => {
    const insights: Insight[] = [
      { id: 'i1', text: 'foo', createdAt: '2026-05-10T03:00:00Z', interestId: 'recruiting', pinned: false },
    ];
    normalizeInsightInterestIds(insights);
    expect(insights[0]!.interestId).toBe('recruiting');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('preserves "unknown" sentinel', () => {
    const insights: Insight[] = [
      { id: 'i1', text: 'foo', createdAt: '2026-05-10T03:00:00Z', interestId: 'unknown', pinned: false },
    ];
    normalizeInsightInterestIds(insights);
    expect(insights[0]!.interestId).toBe('unknown');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('normalizes invalid string interestId → "unknown" + warns', () => {
    const insights: Insight[] = [
      { id: 'i1', text: 'foo', createdAt: '2026-05-10T03:00:00Z', interestId: '<script>', pinned: false },
    ];
    normalizeInsightInterestIds(insights);
    expect(insights[0]!.interestId).toBe('unknown');
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('interestId'));
  });

  it('normalizes empty string → "unknown"', () => {
    const insights: Insight[] = [
      { id: 'i1', text: 'foo', createdAt: '2026-05-10T03:00:00Z', interestId: '', pinned: false },
    ];
    normalizeInsightInterestIds(insights);
    expect(insights[0]!.interestId).toBe('unknown');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('handles multiple insights with mixed valid/invalid', () => {
    const insights: Insight[] = [
      { id: 'i1', text: 'a', createdAt: 'x', interestId: 'recruiting', pinned: false },
      { id: 'i2', text: 'b', createdAt: 'x', interestId: 'BAD_ID', pinned: false },
      { id: 'i3', text: 'c', createdAt: 'x', interestId: 'unknown', pinned: false },
      { id: 'i4', text: 'd', createdAt: 'x', interestId: '', pinned: false },
    ];
    normalizeInsightInterestIds(insights);
    expect(insights[0]!.interestId).toBe('recruiting');
    expect(insights[1]!.interestId).toBe('unknown');
    expect(insights[2]!.interestId).toBe('unknown');
    expect(insights[3]!.interestId).toBe('unknown');
    expect(console.warn).toHaveBeenCalledTimes(2); // 'BAD_ID' + ''
  });

  it('is idempotent (이중 호출 시에도 결과 동일, 추가 warn 없음)', () => {
    const insights: Insight[] = [
      { id: 'i1', text: 'foo', createdAt: 'x', interestId: 'BAD', pinned: false },
    ];
    normalizeInsightInterestIds(insights);
    expect(insights[0]!.interestId).toBe('unknown');
    expect(console.warn).toHaveBeenCalledTimes(1);

    normalizeInsightInterestIds(insights); // 두 번째 호출
    expect(insights[0]!.interestId).toBe('unknown');
    expect(console.warn).toHaveBeenCalledTimes(1); // 추가 warn 없음 (이미 'unknown')
  });

  it('warn 메시지에 insight.id 포함 (debugging 가시화)', () => {
    const insights: Insight[] = [
      { id: 'insight-xyz', text: 'foo', createdAt: 'x', interestId: 'BAD', pinned: false },
    ];
    normalizeInsightInterestIds(insights);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('insight-xyz'));
  });
});
