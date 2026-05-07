import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// v3.20 H1 (F1): onboarding step 2 API 키 발급 안내 details
// production 첫 로그인 cycle 발견 — 안내 텍스트만 있고 실제 발급 링크/가이드 부재.
// settings.ts:50-58 패턴 차용, createElement 일관성 유지, 정적 마크업 회귀 가드.

const onboardingSource = readFileSync(
  resolve(__dirname, '../../../src/ui/onboarding.ts'),
  'utf-8',
);

const onboardingCss = readFileSync(
  resolve(__dirname, '../../../src/styles/components/onboarding.css'),
  'utf-8',
);

describe('v3.20 H1: onboarding step 2 API 키 발급 안내', () => {
  it('renderStep2 includes aistudio.google.com link', () => {
    expect(onboardingSource).toMatch(/https:\/\/aistudio\.google\.com\/app\/apikey/);
  });

  it('aistudio link uses target="_blank" with rel="noopener noreferrer"', () => {
    expect(onboardingSource).toMatch(/link\.target\s*=\s*'_blank'/);
    expect(onboardingSource).toMatch(/link\.rel\s*=\s*'noopener noreferrer'/);
  });

  it('details summary text is "API 키 발급 받기"', () => {
    expect(onboardingSource).toMatch(/summary\.textContent\s*=\s*['"]API 키 발급 받기['"]/);
  });

  it('details element uses onboarding-help-details class', () => {
    expect(onboardingSource).toMatch(/onboarding-help-details/);
  });

  it('CSS rule .onboarding-help-details is defined', () => {
    expect(onboardingCss).toMatch(/\.onboarding-help-details\s*\{/);
  });
});
