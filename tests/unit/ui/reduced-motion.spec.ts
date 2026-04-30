import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('prefers-reduced-motion CSS rule (link to main.css existence)', () => {
  it('main.css 안에 @media (prefers-reduced-motion: reduce) 블록 존재', () => {
    const filePath = resolve(__dirname, '../../../src/styles/main.css');
    const text = readFileSync(filePath, 'utf-8');
    expect(text).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
    expect(text).toMatch(/\.confetti-particle\s*\{[^}]*display:\s*none/);
    expect(text).toMatch(/\.xp-float[^{}]*\{[^}]*animation:\s*none/);
  });
});
