import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// v3.20 H3 (F3): SW image pass-through — production CSP violation 본질 fix.
// sw.js:81 stale-while-revalidate가 cross-origin image를 fetch()로 처리 →
// SW context의 connect-src CSP rule 적용 → medium 도메인 차단 → 카드뉴스 깨짐.
// fix: event.request.destination === 'image' 시 pass-through (Google Fonts 패턴 차용).

const swSource = readFileSync(
  resolve(__dirname, '../../public/sw.js'),
  'utf-8',
);

describe('v3.20 H3: SW image pass-through', () => {
  it('CACHE_NAME bumped to daily-growth-v9 (stale v8 SW eviction)', () => {
    expect(swSource).toMatch(/CACHE_NAME\s*=\s*['"]daily-growth-v9['"]/);
    expect(swSource).not.toMatch(/CACHE_NAME\s*=\s*['"]daily-growth-v8['"]/);
  });

  it('image destination pass-through guard exists', () => {
    expect(swSource).toMatch(/event\.request\.destination\s*===\s*['"]image['"]/);
  });

  it('image pass-through comments root cause (CSP / connect-src)', () => {
    // 향후 정리/리팩 시 의도 보존 회귀 가드
    expect(swSource).toMatch(/connect-src/);
    expect(swSource).toMatch(/CSP/);
  });

  it('Google Fonts pass-through pattern preserved (regression guard)', () => {
    expect(swSource).toMatch(/fonts\.googleapis\.com/);
    expect(swSource).toMatch(/fonts\.gstatic\.com/);
  });

  it('image pass-through is positioned before stale-while-revalidate path', () => {
    const imageGuardIdx = swSource.indexOf("destination === 'image'");
    const swrIdx = swSource.indexOf('Stale-while-revalidate');
    expect(imageGuardIdx).toBeGreaterThan(0);
    expect(swrIdx).toBeGreaterThan(imageGuardIdx);
  });
});
