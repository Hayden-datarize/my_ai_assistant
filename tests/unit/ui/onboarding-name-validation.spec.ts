import { describe, it, expect } from 'vitest';
import { deriveOnboardingName } from '../../../src/ui/onboarding';

describe('v3.18.1 H3 (#2) — deriveOnboardingName fallback', () => {
  it('빈 문자열 → "사용자" (Hayden 아님, 개인정보 leak 차단)', () => {
    expect(deriveOnboardingName('')).toBe('사용자');
    expect(deriveOnboardingName('')).not.toBe('Hayden');
  });

  it('whitespace-only → "사용자"', () => {
    expect(deriveOnboardingName('   ')).toBe('사용자');
    expect(deriveOnboardingName('\t\n')).toBe('사용자');
  });

  it('정상 이름 → trim 후 그대로', () => {
    expect(deriveOnboardingName('홍길동')).toBe('홍길동');
    expect(deriveOnboardingName('  Sue  ')).toBe('Sue');
  });
});
