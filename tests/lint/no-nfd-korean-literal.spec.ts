/**
 * v3.38 T1b — no-nfd-korean-literal local ESLint rule.
 *
 * NFC normalize 한국어 literal은 PASS, NFD 음절 블록은 FAIL.
 * 자모 분리 / 호환성 자모는 본 rule scope 외 (false negative, v3.39+ carry).
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — `@types/eslint` 미설치 (외부 라이브러리 0줄 추가 제약). RuleTester는 v8 legacy API.
import { RuleTester } from 'eslint';
// @ts-expect-error — .eslint-rules/*.js는 plain ESM, 타입 선언 없음.
import nfdRule from '../../.eslint-rules/no-nfd-korean-literal.js';

// ESLint v8 RuleTester는 legacy `parserOptions` API (flat config `languageOptions` 미지원).
const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

describe('no-nfd-korean-literal rule', () => {
  it('passes NFC normalize 한국어 literal', () => {
    // ruleTester.run throws on assertion failure — wrap in expect for vitest reporter.
    expect(() => {
      ruleTester.run('no-nfd-korean-literal', nfdRule, {
        valid: [
          { code: "const a = '분석';" },
          { code: 'const a = `리더십 ${x}`;' },
          { code: "const a = 'no korean';" },
          { code: "const a = 'asdf 1234';" },
        ],
        invalid: [],
      });
    }).not.toThrow();
  });

  it('flags NFD 음절 블록 한국어 literal', () => {
    const nfdString = '분석'.normalize('NFD');
    const nfdTemplate = `리더십`.normalize('NFD');
    expect(() => {
      ruleTester.run('no-nfd-korean-literal', nfdRule, {
        valid: [],
        invalid: [
          {
            code: `const a = '${nfdString}';`,
            errors: [{ messageId: 'nfd' }],
          },
          {
            code: `const a = \`${nfdTemplate}\`;`,
            errors: [{ messageId: 'nfd' }],
          },
        ],
      });
    }).not.toThrow();
  });

  it('false negative — 호환성 자모 분리 (v3.39+ carry)', () => {
    // 'ㄱ' + 'ㅏ' + 'ㄴ' 호환성 자모 — 음절 블록 아니므로 본 rule scope 외.
    expect(() => {
      ruleTester.run('no-nfd-korean-literal', nfdRule, {
        valid: [
          { code: "const a = 'ㄱㅏㄴ';" }, // 호환성 자모, false negative
        ],
        invalid: [],
      });
    }).not.toThrow();
  });
});
