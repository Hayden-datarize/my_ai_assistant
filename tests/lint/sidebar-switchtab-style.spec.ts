import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('sidebar switchTab style (v3.31 C4-sidebar)', () => {
  it('does not use switchTab(...).catch() in drawer nav click handler', () => {
    const source = readFileSync('src/ui/sidebar.ts', 'utf8');
    expect(source).not.toMatch(/switchTab\(t\.id\)\.catch/);
    expect(source).toMatch(/await switchTab\(t\.id\)/);
  });
});
