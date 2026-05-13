import { describe, it, expect } from 'vitest';
import { scoreEntry } from '../../src/utils/ranking';

describe('scoreEntry (v3.34 T1)', () => {
  it('빈 토큰 → 0', () => {
    expect(scoreEntry([{ text: 'hello', weight: 1 }], [])).toBe(0);
  });

  it('단일 토큰이 단일 field에 hit → field weight', () => {
    expect(scoreEntry([{ text: 'hello world', weight: 2 }], ['hello'])).toBe(2);
  });

  it('토큰이 hit 안 함 → 0 (AND filter 우회 케이스)', () => {
    expect(scoreEntry([{ text: 'hello', weight: 2 }], ['xyz'])).toBe(0);
  });

  it('multi-field hit → max(weight) 한 번만 (binary)', () => {
    expect(
      scoreEntry(
        [
          { text: 'react hooks', weight: 2 },
          { text: 'react guide', weight: 1 },
        ],
        ['react'],
      ),
    ).toBe(2);
  });

  it('multi-token 합산', () => {
    expect(
      scoreEntry(
        [
          { text: 'react hooks', weight: 2 },
          { text: 'guide', weight: 1 },
        ],
        ['react', 'hooks'],
      ),
    ).toBe(4);
  });

  it('occurrence cap=1 (binary) — 같은 토큰 여러 번 나와도 1회만', () => {
    expect(scoreEntry([{ text: 'react react react react react', weight: 1 }], ['react'])).toBe(1);
  });

  it('초성 토큰 — substring 토큰과 동일하게 max(weight) 기여', () => {
    expect(scoreEntry([{ text: '리액트 가이드', weight: 2 }], ['ㄹㅇ'])).toBe(2);
  });

  it('NFC 정규화 + lowercase', () => {
    expect(scoreEntry([{ text: 'HELLO', weight: 2 }], ['hello'])).toBe(2);
    const nfd = '한국'.normalize('NFD');
    expect(scoreEntry([{ text: nfd, weight: 1 }], ['한국'])).toBe(1);
  });

  // Codex 사전 P2-2 흡수: 중복 토큰 dedupe 안 함 invariant.
  it('중복 토큰 — raw 가산 (dedupe 안 함)', () => {
    expect(scoreEntry([{ text: 'react hooks', weight: 2 }], ['react', 'react'])).toBe(4);
  });
});
