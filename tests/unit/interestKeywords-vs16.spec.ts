import { describe, it, expect } from 'vitest';
import { interestKeywords } from '../../src/utils/interestKeywords';

describe('interestKeywords — labor_law VS16 strip (v3.12 P2-5)', () => {
  // v3.14.3 T9 (P3-T6): VS16(U+FE0F) 리터럴을 명시 escape으로 통일 + dual-strip 위치 주석.
  // dual-strip 1: src/utils/interestKeywords.ts regex `[\u{FE0F}\u{200D}]/gu` (스킨톤/ZWJ).
  // dual-strip 2: src/utils/categories.ts label에서 emoji + label만 분리 시 VS16 stray.
  const VS16 = '\uFE0F';

  it('extracts no stray VS16 (U+FE0F) from labor_law', () => {
    const tokens = interestKeywords('labor_law');
    for (const t of tokens) {
      expect(t).not.toContain(VS16);
      expect(t.codePointAt(0)).not.toBe(0xFE0F);
    }
  });

  it('produces clean Korean label tokens for labor_law', () => {
    const tokens = interestKeywords('labor_law');
    expect(tokens).toContain('labor_law');
    expect(tokens.some(t => t === '노무' || t === '법률' || t.startsWith('노무'))).toBe(true);
  });

  it('all 15 INTERESTS labels — no stray VS16 in any token', () => {
    const ids = ['recruiting','onboarding','culture','hr_system','labor_law','leadership',
                 'pm','ai_ml','data','startup','marketing','productivity','career',
                 'communication','self_dev'];
    for (const id of ids) {
      const tokens = interestKeywords(id);
      for (const t of tokens) {
        expect(t).not.toContain(VS16);
      }
    }
  });
});
