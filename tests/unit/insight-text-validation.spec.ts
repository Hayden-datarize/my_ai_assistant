/**
 * v3.24 T5 (B1): Insight.text entry-level guard spec.
 *
 * `validateInsightText` invariant:
 *   - trim 적용 후 반환
 *   - 빈/공백-only 입력은 throw (caller 책임)
 *   - 200자 max cap (storage bloat + UI overflow 차단)
 */
import { describe, it, expect } from 'vitest';
import { validateInsightText } from '../../src/state/user';

describe('validateInsightText (v3.24 T5 / B1)', () => {
  it('non-empty 정상 텍스트는 trim 후 반환', () => {
    expect(validateInsightText('  통찰 한 줄  ')).toBe('통찰 한 줄');
  });

  it('빈 문자열은 throw', () => {
    expect(() => validateInsightText('')).toThrow(/empty|빈/);
  });

  it('공백 only는 throw', () => {
    expect(() => validateInsightText('   \t\n  ')).toThrow(/empty|빈/);
  });

  it('200자 초과는 trim (max cap)', () => {
    const longText = 'a'.repeat(201);
    const result = validateInsightText(longText);
    expect(result.length).toBe(200);
  });

  it('200자 정확은 그대로', () => {
    const exact = 'b'.repeat(200);
    expect(validateInsightText(exact)).toBe(exact);
  });
});
