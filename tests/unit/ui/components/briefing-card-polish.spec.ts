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
    expect(cardsCss).toMatch(/\.briefing-card\s*\{[\s\S]*?border-radius:\s*var\(--radius-2xl\)/);
  });

  it('briefing-card has shadow-md base', () => {
    expect(cardsCss).toMatch(/\.briefing-card\s*\{[\s\S]*?box-shadow:\s*var\(--shadow-md\)/);
  });

  it('briefing-card hover guarded by @media (hover: hover) with translateY(-2px)', () => {
    expect(cardsCss).toMatch(/@media\s*\(hover:\s*hover\)\s*\{[\s\S]*?\.briefing-card:hover[\s\S]*?translateY\(-2px\)/);
  });

  it('briefing-card hover uses spring easing token', () => {
    expect(cardsCss).toMatch(/\.briefing-card:hover[\s\S]*?var\(--ease-spring\)/);
  });
});

describe('v3.17 T3 — question-section hero polish', () => {
  it('question-section has shadow-lg', () => {
    expect(homeCss).toMatch(/\.question-section\s*\{[\s\S]*?box-shadow:\s*var\(--shadow-lg\)/);
  });

  it('question-section has subtle gradient using primary-ultra-light', () => {
    expect(homeCss).toMatch(/\.question-section\s*\{[\s\S]*?linear-gradient[^}]*primary-ultra-light/);
  });
});
