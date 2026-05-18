import { describe, it, expect } from 'vitest';
import { levenshteinDistance, fuzzyMatchesToken } from '../../src/utils/fuzzy';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('counts insertions', () => {
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
  });

  it('counts deletions', () => {
    expect(levenshteinDistance('cats', 'cat')).toBe(1);
  });

  it('counts substitutions', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
  });

  it('combines operations (kitten vs sitting)', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('handles empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('handles Korean (NFC normalized)', () => {
    expect(levenshteinDistance('분석', '분식')).toBe(1);
    expect(levenshteinDistance('리더쉽', '리더십')).toBe(1);
  });
});

describe('fuzzyMatchesToken', () => {
  it('matches exact substring (distance 0)', () => {
    expect(fuzzyMatchesToken('hello world', 'hello')).toBe(true);
  });

  it('matches with 1 typo for token length 3-4', () => {
    expect(fuzzyMatchesToken('hello world', 'helo')).toBe(true); // 1 deletion
    expect(fuzzyMatchesToken('hello world', 'hxllo')).toBe(true); // 1 substitution
  });

  it('matches with 2 typos for token length 5+', () => {
    expect(fuzzyMatchesToken('developer track', 'develpor')).toBe(true); // 2 swaps
  });

  it('strict for very short tokens (length ≤ 2)', () => {
    expect(fuzzyMatchesToken('hello', 'hi')).toBe(false); // distance 2 but token short
    expect(fuzzyMatchesToken('hi there', 'hi')).toBe(true); // exact substring
  });

  it('returns false for distance over threshold', () => {
    expect(fuzzyMatchesToken('hello', 'xyzab')).toBe(false);
  });

  it('NFC normalizes Korean inputs', () => {
    const nfdToken = '분석'.normalize('NFD');
    expect(fuzzyMatchesToken('분석 자료', nfdToken)).toBe(true);
  });

  it('skips fuzzy when token is initial-only Korean (returns false to let initial match handle it)', () => {
    // 'ㄹㄷ' (리더 초성) — 초성 token은 본 함수에서 skip, 기존 matchesAllTokens initial 매칭이 처리.
    expect(fuzzyMatchesToken('리더십 발휘', 'ㄹㄷ')).toBe(false);
  });

  it('per-record cap — extremely long text returns false (UI freeze 차단)', () => {
    const longText = 'a'.repeat(20_000); // 20k chars
    // token len 6 → 120,000 op > 100k cap → exact substring만 시도 (fail).
    expect(fuzzyMatchesToken(longText, 'xyzabc')).toBe(false);
  });
});
