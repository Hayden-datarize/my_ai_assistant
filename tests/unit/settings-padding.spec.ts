import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('v3.18.1 H5 (#6) — settings 좌우 padding (mobile-only)', () => {
  let layoutCss: string;
  beforeAll(() => {
    layoutCss = readFileSync(resolve(__dirname, '../../src/styles/layout.css'), 'utf-8');
  });

  it('mobile-only @media wrap 안에 #settingsTab horizontal padding 정의됨', () => {
    // T0 review P1-4: padding이 @media (max-width: 767px) 안에 있어야 함
    // (데스크톱 padding-right 회귀 차단).
    expect(layoutCss).toMatch(
      /@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?#settingsTab\s*\{[^}]*?padding-left:\s*20px[^}]*?padding-right:\s*20px/,
    );
  });
});
