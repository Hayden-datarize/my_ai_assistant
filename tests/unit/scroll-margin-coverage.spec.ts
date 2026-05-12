import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('v3.18 T6 (G3-2) — scroll-margin coverage for scrollIntoView targets', () => {
  let homeTabTs: string;
  let statsTabTs: string;
  let homeHandlersTs: string;
  let statsHandlersTs: string;
  let statsSharedTs: string;

  beforeAll(() => {
    // markup은 src/ui/tabs/, scrollIntoView 호출은 src/ui/handlers/ (T0 review P1-3 정정)
    // v3.30 T3: scrollToGardenSection 본문이 stats-shared.ts로 분리 (dynamic split 완성)
    homeTabTs = readFileSync(resolve(__dirname, '../../src/ui/tabs/home.ts'), 'utf-8');
    statsTabTs = readFileSync(resolve(__dirname, '../../src/ui/tabs/stats.ts'), 'utf-8');
    homeHandlersTs = readFileSync(resolve(__dirname, '../../src/ui/handlers/home.ts'), 'utf-8');
    statsHandlersTs = readFileSync(resolve(__dirname, '../../src/ui/handlers/stats.ts'), 'utf-8');
    statsSharedTs = readFileSync(resolve(__dirname, '../../src/ui/handlers/stats-shared.ts'), 'utf-8');
  });

  it('chatContainer markup (tabs/home.ts) has data-scroll-target attribute', () => {
    expect(homeTabTs).toMatch(/id=["']chatContainer["'][^>]*data-scroll-target/);
  });

  it('gardenSection markup (tabs/stats.ts) has data-scroll-target attribute', () => {
    expect(statsTabTs).toMatch(/id=["']gardenSection["'][^>]*data-scroll-target/);
  });

  it('scrollIntoView call site count baseline = 3 (regression guard)', () => {
    // 회귀 가드: scrollIntoView 호출 site 수 = 3 (현 baseline).
    // 4번째 추가 시 plan 갱신 + scroll-margin 적용 검토 필요.
    // v3.30 T3: stats.ts의 scrollToGardenSection이 stats-shared.ts로 분리됨 (총합 동일).
    const homeMatches = (homeHandlersTs.match(/scrollIntoView/g) ?? []).length;
    const statsMatches = (statsHandlersTs.match(/scrollIntoView/g) ?? []).length;
    const sharedMatches = (statsSharedTs.match(/scrollIntoView/g) ?? []).length;
    expect(homeMatches + statsMatches + sharedMatches).toBe(3);
  });
});
