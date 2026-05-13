import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('onboarding date anchor (v3.31 C8)', () => {
  it('does not derive onboarding day from UTC ISO slice', () => {
    const source = readFileSync('src/ui/onboarding.ts', 'utf8');
    expect(source).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
    expect(source).toMatch(/getKstDateStr\(\)/);
  });
});
