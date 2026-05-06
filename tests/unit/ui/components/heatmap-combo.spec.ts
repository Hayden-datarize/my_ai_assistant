import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('v3.18 T4 (G2-3) — heatmap is-today + hover + focus-visible combo', () => {
  let css: string;

  beforeAll(() => {
    css = readFileSync(
      resolve(__dirname, '../../../../src/styles/components/heatmap.css'),
      'utf-8',
    );
  });

  it('is-today + focus-visible + hover combo rule exists with all 3 layers', () => {
    // 명시 rule: is-today inset + focus-ring + shadow-glow 모두 box-shadow에 stack
    expect(css).toMatch(
      /\.heatmap-cell\.is-today:focus-visible:hover\s*\{[^}]*box-shadow:[^;]*inset[^;]*var\(--primary\)[^;]*var\(--focus-ring\)[^;]*var\(--shadow-glow\)/,
    );
  });

  it('combo rule appears AFTER both is-today:hover and is-today:focus-visible (CSS source order)', () => {
    const todayHoverIdx = css.search(/\.heatmap-cell\.is-today:hover\b/);
    const todayFocusIdx = css.search(/\.heatmap-cell\.is-today:focus-visible\b(?!:hover)/);
    const comboIdx = css.search(/\.heatmap-cell\.is-today:focus-visible:hover\b/);
    expect(comboIdx).toBeGreaterThan(todayHoverIdx);
    expect(comboIdx).toBeGreaterThan(todayFocusIdx);
  });
});
