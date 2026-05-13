import { describe, it, expect } from 'vitest';
import { highlightHtml } from '../../src/utils/highlight';

describe('highlightHtml (v3.32 T2 — tokens 배열 signature)', () => {
  it('빈 배열 → 원문 escape만, mark 없음', () => {
    expect(highlightHtml('Hello <b>X</b>', [])).toBe('Hello &lt;b&gt;X&lt;/b&gt;');
  });

  it('match 없으면 원문 escape', () => {
    expect(highlightHtml('Hello world', ['xyz'])).toBe('Hello world');
  });

  it('단일 토큰 match — <mark> 감싸기 + 외부 escape 유지', () => {
    expect(highlightHtml('Hello world', ['world'])).toBe('Hello <mark>world</mark>');
  });

  it('case-insensitive match (NFC 후 lower)', () => {
    expect(highlightHtml('Hello World', ['world'])).toBe('Hello <mark>World</mark>');
  });

  it('multi-occurrence — 모두 wrap', () => {
    expect(highlightHtml('aba aba', ['a'])).toBe(
      '<mark>a</mark>b<mark>a</mark> <mark>a</mark>b<mark>a</mark>',
    );
  });

  it('XSS: text 안에 <script> → escape', () => {
    expect(highlightHtml('<script>alert(1)</script>', ['alert'])).toBe(
      '&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;',
    );
  });

  it('XSS: token 안에 regex special → 리터럴 매치', () => {
    expect(highlightHtml('a.b.c', ['.'])).toBe('a<mark>.</mark>b<mark>.</mark>c');
  });

  it('XSS: token 안에 < > → escape + literal regex', () => {
    expect(highlightHtml('a<b>c', ['<b>'])).toBe('a<mark>&lt;b&gt;</mark>c');
  });

  it('XSS: text + token 모두에 <img onerror> → script 실행 0', () => {
    const out = highlightHtml('<img onerror="x">', ['img']);
    // 보안 invariant: `<` `>` `"` 모두 escape — 라이브 <tag>로 파싱 불가.
    expect(out).not.toContain('<img');
    expect(out).not.toContain('"x"');
    expect(out).toContain('&lt;');
    expect(out).toContain('&quot;');
    expect(out).toContain('<mark>img</mark>');
  });

  it('NFC normalize — 합성된/풀어쓴 한글 동일 매치', () => {
    const composed = '한국'.normalize('NFC');
    const decomposedToken = '한국'.normalize('NFD');
    expect(highlightHtml(composed, [decomposedToken])).toContain('<mark>');
  });

  // v3.32 T2 신규 case
  it('다중 substring 토큰 — alternation 단일 sweep 모두 wrap', () => {
    expect(highlightHtml('리액트 훅 사용', ['리액트', '훅'])).toBe(
      '<mark>리액트</mark> <mark>훅</mark> 사용',
    );
  });

  it('다중 토큰 longest-first sort — overlap에서 긴 토큰 우선', () => {
    // 토큰 ["프", "프로"] → 길이 desc로 "프로" 먼저 매칭
    expect(highlightHtml('프로젝트', ['프', '프로'])).toBe('<mark>프로</mark>젝트');
  });

  it('초성-only 토큰 — mark 없음 (filter pass-only)', () => {
    expect(highlightHtml('프로젝트', ['ㅍㄹ'])).toBe('프로젝트');
  });

  it('초성 + substring 혼합 — substring 토큰만 mark', () => {
    expect(highlightHtml('react 프로젝트', ['ㅍㄹ', 'react'])).toBe(
      '<mark>react</mark> 프로젝트',
    );
  });
});
