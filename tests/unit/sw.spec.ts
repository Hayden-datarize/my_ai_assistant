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

describe('v3.20 H3 / v3.41 T3: SW pass-through + navigation guards', () => {
  // v3.41 T3 (Codex P1 F3): v9→v10 bump.
  it('CACHE_NAME bumped to daily-growth-v10 (v3.41 T3, stale v9 SW eviction)', () => {
    expect(swSource).toMatch(/CACHE_NAME\s*=\s*['"]daily-growth-v10['"]/);
    expect(swSource).not.toMatch(/CACHE_NAME\s*=\s*['"]daily-growth-v9['"]/);
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

  // v3.41 T3: Non-GET pass-through (cache.put POST reject 차단).
  it('non-GET pass-through guard exists (req.method !== GET)', () => {
    expect(swSource).toMatch(/req\.method\s*!==\s*['"]GET['"]/);
  });

  // v3.41 T3: /api/ pass-through (Firebase Functions rewrite).
  it('/api/ pass-through guard exists (Functions rewrite)', () => {
    expect(swSource).toMatch(/url\.pathname\.startsWith\(['"]\/api\/['"]\)/);
  });

  // v3.41 T3: Navigation network-first.
  it('navigation network-first with /index.html fallback', () => {
    expect(swSource).toMatch(/req\.mode\s*===\s*['"]navigate['"]/);
    expect(swSource).toMatch(/caches\.match\(['"]\/index\.html['"]\)/);
  });

  // v3.41 T3: Non-GET guard 위치 — image/api/navigation 분기보다 먼저.
  it('non-GET guard is first (before any other branches)', () => {
    const nonGetIdx = swSource.indexOf("req.method !== 'GET'");
    const apiIdx = swSource.indexOf("'/api/'");
    const navIdx = swSource.indexOf("req.mode === 'navigate'");
    expect(nonGetIdx).toBeGreaterThan(0);
    expect(apiIdx).toBeGreaterThan(nonGetIdx);
    expect(navIdx).toBeGreaterThan(nonGetIdx);
  });
});
