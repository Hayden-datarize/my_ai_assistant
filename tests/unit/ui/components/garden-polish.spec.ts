import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(
  join(here, '..', '..', '..', '..', 'src', 'styles', 'components', 'garden.css'),
  'utf-8'
);

describe('v3.17 T5 — garden polish', () => {
  it('garden-grid has ambient gradient background', () => {
    expect(css).toMatch(/\.garden-grid\s*\{[^}]*background:[^;}]*linear-gradient/);
  });

  it('garden-card has radius-xl + shadow-md + spring transition', () => {
    expect(css).toMatch(/\.garden-card\s*\{[\s\S]*?border-radius:\s*var\(--radius-xl\)/);
    expect(css).toMatch(/\.garden-card\s*\{[\s\S]*?box-shadow:\s*var\(--shadow-md\)/);
    expect(css).toMatch(/\.garden-card[\s\S]*?transition[\s\S]*?var\(--ease-spring\)/);
  });

  it('garden-card hover guarded by @media (hover: hover) with translateY scale', () => {
    expect(css).toMatch(
      /@media\s*\(hover:\s*hover\)\s*\{[\s\S]*?\.garden-card:hover[\s\S]*?translateY\(-1px\)\s*scale\(1\.02\)/
    );
  });

  it('garden-empty fallback message has card-like polish (centered + bg-card)', () => {
    expect(css).toMatch(/\.garden-empty\s*\{[\s\S]*?text-align:\s*center/);
    expect(css).toMatch(/\.garden-empty\s*\{[\s\S]*?background:\s*var\(--bg-card\)/);
    expect(css).toMatch(/\.garden-empty\s*\{[\s\S]*?padding:\s*var\(--space-8\)\s+var\(--space-4\)/);
  });

  it('garden-mini-cell:hover/active uses var(--shadow-md) (G1-5, was hardcoded rgba)', () => {
    expect(css).toMatch(
      /\.garden-mini-cell:hover[^{]*,\s*\.garden-mini-cell:active\s*\{[^}]*?box-shadow:\s*var\(--shadow-md\)/
    );
  });
});
