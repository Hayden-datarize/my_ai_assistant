import { describe, it, expect } from 'vitest';
import { highlightHtml } from '../../src/utils/highlight';

describe('highlightHtml (v3.29 T2)', () => {
  it('빈 query → 원문 escape만, mark 없음', () => {
    expect(highlightHtml('Hello <b>X</b>', '')).toBe('Hello &lt;b&gt;X&lt;/b&gt;');
  });

  it('match 없으면 원문 escape', () => {
    expect(highlightHtml('Hello world', 'xyz')).toBe('Hello world');
  });

  it('단일 match — <mark> 감싸기 + 외부 escape 유지', () => {
    expect(highlightHtml('Hello world', 'world')).toBe('Hello <mark>world</mark>');
  });

  it('case-insensitive match (NFC 후 lower)', () => {
    expect(highlightHtml('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  it('multi-occurrence — 모두 wrap', () => {
    expect(highlightHtml('aba aba', 'a')).toBe('<mark>a</mark>b<mark>a</mark> <mark>a</mark>b<mark>a</mark>');
  });

  it('XSS: text 안에 <script> → escape', () => {
    expect(highlightHtml('<script>alert(1)</script>', 'alert')).toBe(
      '&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;'
    );
  });

  it('XSS: query 안에 regex special → 리터럴 매치', () => {
    expect(highlightHtml('a.b.c', '.')).toBe('a<mark>.</mark>b<mark>.</mark>c');
  });

  it('XSS: query 안에 < > → escape + literal regex', () => {
    expect(highlightHtml('a<b>c', '<b>')).toBe('a<mark>&lt;b&gt;</mark>c');
  });

  it('XSS: text + query 모두에 <img onerror> → script 실행 0', () => {
    const out = highlightHtml('<img onerror="x">', 'img');
    // 보안 invariant: `<` `>` `"` 모두 escape — 라이브 <tag>로 파싱 불가.
    // `onerror=`는 literal text로 살아남지만 inert (브라우저가 attribute로 해석 X).
    expect(out).not.toContain('<img');
    expect(out).not.toContain('"x"');
    expect(out).toContain('&lt;');
    expect(out).toContain('&quot;');
    expect(out).toContain('<mark>img</mark>');
  });

  it('NFC normalize — 합성된/풀어쓴 한글 동일 매치', () => {
    const composed = '한국'.normalize('NFC');
    const decomposed = '한국'.normalize('NFD');
    expect(highlightHtml(composed, decomposed)).toContain('<mark>');
  });
});
