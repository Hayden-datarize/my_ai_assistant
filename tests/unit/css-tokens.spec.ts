import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(here, '..', '..', 'src', 'styles');
// v3.3.0: tokens moved to tokens.css (@layer tokens); main.css still consumes them.
const tokensCss = readFileSync(join(stylesDir, 'tokens.css'), 'utf-8');
const mainCss = readFileSync(join(stylesDir, 'main.css'), 'utf-8');

describe('css drift guards (v3.2b-polish)', () => {
  it('--sidebar-width defined in :root with 240px', () => {
    expect(tokensCss).toMatch(/:root\s*\{[\s\S]*?--sidebar-width:\s*240px/);
  });
  it('--sidebar-width used at least twice (max-width + padding-left + width)', () => {
    const matches = mainCss.match(/var\(--sidebar-width\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
