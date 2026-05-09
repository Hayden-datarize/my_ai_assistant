/**
 * v3.25 T1: Insight.interestId entry-level guard spec.
 *
 * - INTERESTS 15개 whitelist 매칭 → 그대로 반환
 * - 매칭 실패 또는 'unknown' sentinel → 'unknown'
 * - trim은 caller 책임 (parseInsightResponse가 처리)
 */
import { describe, it, expect } from 'vitest';
import { validateInterestId } from '../../src/state/user';

describe('validateInterestId (v3.25 T1)', () => {
  it('whitelist 멤버는 그대로 반환', () => {
    expect(validateInterestId('recruiting')).toBe('recruiting');
    expect(validateInterestId('ai_ml')).toBe('ai_ml');
    expect(validateInterestId('self_dev')).toBe('self_dev');
  });

  it('whitelist 외 string은 unknown 폴백', () => {
    expect(validateInterestId('hallucinated')).toBe('unknown');
    expect(validateInterestId('')).toBe('unknown');
    expect(validateInterestId('  recruiting  ')).toBe('unknown');  // trim은 caller 책임
  });

  it("'unknown' 입력은 그대로 unknown (whitelist 외이지만 sentinel)", () => {
    expect(validateInterestId('unknown')).toBe('unknown');
  });
});
