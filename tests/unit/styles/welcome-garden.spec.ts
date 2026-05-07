import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// v3.20 H2 (F2): welcome-garden 모달 CSS rule 신설.
// production root cause — wrapper/highlight/newcomer class CSS rule 0건이라 modal default styling만 적용.

const css = readFileSync(
  resolve(__dirname, '../../../src/styles/components/welcome-garden.css'),
  'utf-8',
);

const mainCss = readFileSync(
  resolve(__dirname, '../../../src/styles/main.css'),
  'utf-8',
);

describe('v3.20 H2: welcome-garden CSS rules', () => {
  it('defines .welcome-garden-modal rule', () => {
    expect(css).toMatch(/\.welcome-garden-modal\s*\{/);
  });

  it('defines .welcome-garden-highlight rule', () => {
    expect(css).toMatch(/\.welcome-garden-highlight\s*\{/);
  });

  it('defines .welcome-garden-newcomer rule', () => {
    expect(css).toMatch(/\.welcome-garden-newcomer\s*\{/);
  });

  it('modal-actions stack uses flex with gap', () => {
    expect(css).toMatch(/\.welcome-garden-modal\s+\.modal-actions\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.welcome-garden-modal\s+\.modal-actions\s*\{[^}]*gap:/);
  });

  it('uses only existing design tokens (no hardcoded values)', () => {
    // var(--space-*), var(--radius-*), var(--bg-card), var(--primary), var(--text*) 만 사용
    // 색상/sizing 하드코딩(#hex, px) 없음 검증
    const rules = css.match(/\{[^}]+\}/g) ?? [];
    for (const rule of rules) {
      expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      // px 하드코딩은 token-bound padding/gap에 한해 허용 안 함 — 본 rule은 var() 만
      expect(rule).not.toMatch(/:\s*\d+px\s*[;}]/);
    }
  });

  it('main.css imports welcome-garden.css in components layer', () => {
    expect(mainCss).toMatch(
      /@import\s+['"]\.\/components\/welcome-garden\.css['"]\s+layer\(components\)/,
    );
  });
});
