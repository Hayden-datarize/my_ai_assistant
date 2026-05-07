import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// v3.20 H4 (F4): settings desktop 좌우 padding 대칭 + section 가운데 정렬.
// production 발견 — desktop에서 좌측 80px만 적용되고 우측 0이라 카드가 좌측 치우침.
// fix: forms.css @media (min-width: 768px) { .settings-section { padding-left: 80px; padding-right: 80px } }
//      .settings-section { max-width: 560px; margin: 0 auto } 는 baseline부터 존재 (가운데 정렬 보장).

const formsCss = readFileSync(
  resolve(__dirname, '../../../src/styles/components/forms.css'),
  'utf-8',
);

describe('v3.20 H4: settings desktop padding 대칭', () => {
  it('.settings-section base has max-width 560 + margin: 0 auto', () => {
    expect(formsCss).toMatch(/\.settings-section\s*\{[^}]*max-width:\s*560px/);
    expect(formsCss).toMatch(/\.settings-section\s*\{[^}]*margin:\s*0\s+auto/);
  });

  it('desktop @media has explicit padding-left + padding-right (양쪽 대칭)', () => {
    // @media (min-width: 768px) { .settings-section { padding-left: 80px; padding-right: 80px } }
    expect(formsCss).toMatch(
      /@media\s*\(\s*min-width:\s*768px\s*\)[\s\S]*?\.settings-section\s*\{[^}]*padding-left:\s*80px/,
    );
    expect(formsCss).toMatch(
      /@media\s*\(\s*min-width:\s*768px\s*\)[\s\S]*?\.settings-section\s*\{[^}]*padding-right:\s*80px/,
    );
  });

  it('comments cascade layer priority (forms.css overrides layout.css)', () => {
    // 향후 cleanup/리팩 시 의도 보존 회귀 가드 — layer priority 의도 명시
    expect(formsCss).toMatch(/cascade\s+layer/i);
  });
});
