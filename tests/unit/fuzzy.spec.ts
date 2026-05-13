import { describe, it, expect } from 'vitest';
import {
  tokenizeQuery,
  getInitialConsonants,
  isInitialOnlyToken,
  matchesAllTokens,
} from '../../src/utils/fuzzy';

describe('tokenizeQuery (v3.32 T1)', () => {
  it('빈 입력 → 빈 배열', () => {
    expect(tokenizeQuery('')).toEqual([]);
    expect(tokenizeQuery('   ')).toEqual([]);
  });

  it('단일 토큰 — NFC + lowercase + trim', () => {
    expect(tokenizeQuery('  Hello  ')).toEqual(['hello']);
  });

  it('다중 토큰 — whitespace split', () => {
    expect(tokenizeQuery('리액트 훅')).toEqual(['리액트', '훅']);
    expect(tokenizeQuery('a  b\tc\nd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('NFC 먼저 → 한글 NFD 입력도 정상 처리', () => {
    const nfd = '한국'.normalize('NFD');
    expect(tokenizeQuery(nfd)).toEqual(['한국']);
  });

  it('영문 + 한글 혼합', () => {
    expect(tokenizeQuery('React 훅')).toEqual(['react', '훅']);
  });
});

describe('getInitialConsonants (v3.32 T1)', () => {
  it('한글 음절 → 초성 19자 자음 매핑', () => {
    expect(getInitialConsonants('프로젝트')).toBe('ㅍㄹㅈㅌ');
  });

  it('영문/숫자는 그대로 통과', () => {
    expect(getInitialConsonants('React 123')).toBe('React 123');
  });

  it('빈 문자열 → 빈 문자열', () => {
    expect(getInitialConsonants('')).toBe('');
  });

  it('한글 + 영문 혼합', () => {
    expect(getInitialConsonants('React 훅')).toBe('React ㅎ');
  });

  it('19자 자음 테이블 — 경계값', () => {
    expect(getInitialConsonants('각')).toBe('ㄱ'); // 첫 음절 AC00
    expect(getInitialConsonants('힣')).toBe('ㅎ'); // 마지막 음절 D7A3
    expect(getInitialConsonants('까')).toBe('ㄲ'); // 쌍자음
  });
});

describe('isInitialOnlyToken (v3.32 T1)', () => {
  it('한글 자음만 구성 → true', () => {
    expect(isInitialOnlyToken('ㅍㄹ')).toBe(true);
    expect(isInitialOnlyToken('ㄱ')).toBe(true);
  });

  it('한글 음절 포함 → false', () => {
    expect(isInitialOnlyToken('프로')).toBe(false);
  });

  it('영문 포함 → false', () => {
    expect(isInitialOnlyToken('ㅋproject')).toBe(false);
  });

  it('빈 문자열 → false (regex `+` requires 1자)', () => {
    expect(isInitialOnlyToken('')).toBe(false);
  });
});

describe('matchesAllTokens (v3.32 T1)', () => {
  it('빈 토큰 배열 → vacuous true (전체 통과)', () => {
    expect(matchesAllTokens('anything', [])).toBe(true);
  });

  it('단일 substring 토큰 — case-insensitive', () => {
    expect(matchesAllTokens('Hello World', ['hello'])).toBe(true);
    expect(matchesAllTokens('Hello', ['xyz'])).toBe(false);
  });

  it('다중 토큰 AND — 모두 hit해야 true', () => {
    expect(matchesAllTokens('리액트 훅 사용법', ['리액트', '훅'])).toBe(true);
    expect(matchesAllTokens('리액트 컴포넌트', ['리액트', '훅'])).toBe(false);
  });

  it('초성-only 토큰 — 한글 텍스트 초성 매칭', () => {
    expect(matchesAllTokens('프로젝트', ['ㅍㄹ'])).toBe(true);
    expect(matchesAllTokens('프로젝트', ['ㅈㅌ'])).toBe(true); // contiguous
    expect(matchesAllTokens('프로젝트', ['ㅍㅈ'])).toBe(false); // non-contiguous
  });

  it('초성 + substring 혼합 AND', () => {
    expect(matchesAllTokens('리액트 프로젝트', ['ㅍㄹ', 'react'])).toBe(false); // react 없음
    expect(matchesAllTokens('react 프로젝트', ['ㅍㄹ', 'react'])).toBe(true);
  });

  it('NFC 정규화 — text NFD 입력도 매칭', () => {
    const textNfd = '한국'.normalize('NFD');
    expect(matchesAllTokens(textNfd, ['한국'])).toBe(true);
  });
});
