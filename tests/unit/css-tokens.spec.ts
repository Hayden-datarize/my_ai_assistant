import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, '..', '..', 'src', 'styles', 'main.css');
const css = readFileSync(cssPath, 'utf-8');

describe('css drift guards (v3.2b-polish)', () => {
  it('--sidebar-width defined in :root with 240px', () => {
    expect(css).toMatch(/:root\s*\{[\s\S]*?--sidebar-width:\s*240px/);
  });
  it('--sidebar-width used at least twice (max-width + padding-left + width)', () => {
    const matches = css.match(/var\(--sidebar-width\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
