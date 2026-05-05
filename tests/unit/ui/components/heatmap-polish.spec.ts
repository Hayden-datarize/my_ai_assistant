import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const heatmapCss = readFileSync(
  join(here, '..', '..', '..', '..', 'src', 'styles', 'components', 'heatmap.css'),
  'utf-8'
);

describe('v3.17 T4 — heatmap polish', () => {
  it('heatmap-cell:hover 단독 selector에 shadow-glow', () => {
    // :hover 단독 (콤마 없이) selector + shadow-glow.
    // Negative lookahead 으로 ":hover," 같은 grouped selector 방지.
    expect(heatmapCss).toMatch(
      /\.heatmap-cell:hover(?![,\s]*[a-zA-Z.:])\s*\{[^}]*box-shadow:\s*var\(--shadow-glow\)/
    );
  });

  it('heatmap-info 라벨 color text-secondary 사용 (regression guard)', () => {
    expect(heatmapCss).toMatch(/\.heatmap-info\s*\{[\s\S]*?color:\s*var\(--text-secondary\)/);
  });
});
