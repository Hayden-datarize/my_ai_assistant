import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(here, '..', '..', '..', '..', 'src', 'styles');
const cardsCss = readFileSync(join(stylesDir, 'components', 'cards.css'), 'utf-8');
const homeCss = readFileSync(join(stylesDir, 'pages', 'home.css'), 'utf-8');

describe('v3.17 T3 — briefing card hero polish', () => {
  it('briefing-card uses radius-2xl', () => {
    expect(cardsCss).toMatch(/\.briefing-card\s*\{[^}]*?border-radius:\s*var\(--radius-2xl\)/);
  });

  it('briefing-card has shadow-md base', () => {
    expect(cardsCss).toMatch(/\.briefing-card\s*\{[^}]*?box-shadow:\s*var\(--shadow-md\)/);
  });

  it('briefing-card hover guarded by @media (hover: hover) with translateY(-2px)', () => {
    expect(cardsCss).toMatch(/@media\s*\(hover:\s*hover\)\s*\{[\s\S]*?\.briefing-card:hover[\s\S]*?translateY\(-2px\)/);
  });

  it('briefing-card transition uses spring easing token (T2: moved from :hover to default block for symmetry)', () => {
    // v3.18 T2: ease-spring은 이제 default block의 transition declaration에 위치.
    // :hover는 transform/box-shadow 값만 override.
    expect(cardsCss).toMatch(/\.briefing-card\s*\{[^}]*?var\(--ease-spring\)/);
  });
});

describe('v3.18 T2 — briefing-card hover symmetry', () => {
  // v3.18 T2 (G2-1): hover transition symmetry — default state must include both
  // transform + box-shadow so leaving hover animates back smoothly.
  it('briefing-card default state has transition for both transform AND box-shadow (G2-1)', () => {
    const defaultBlock = cardsCss.match(/\.briefing-card\s*\{[^}]*\}/)?.[0] ?? '';
    expect(defaultBlock).toMatch(/transition:[^;]*transform[^;]*,[^;]*box-shadow/);
  });
});

describe('v3.17 T3 — question-section hero polish', () => {
  it('question-section has shadow-lg', () => {
    expect(homeCss).toMatch(/\.question-section\s*\{[^}]*?box-shadow:\s*var\(--shadow-lg\)/);
  });

  it('question-section has subtle gradient using primary-ultra-light', () => {
    expect(homeCss).toMatch(/\.question-section\s*\{[^}]*?linear-gradient[^}]*primary-ultra-light/);
  });
});
