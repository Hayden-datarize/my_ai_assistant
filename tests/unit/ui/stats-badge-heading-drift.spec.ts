import { describe, it, expect, beforeEach } from 'vitest';

/**
 * v3.14.3 T13 (P3-T10-drift): hydrateBadges heading "🏆 뱃지 (X / Y)"의
 * X(=earned 카운트)가 catalog 부재 legacy ID까지 포함하던 버그 회귀 spec.
 * heading은 `Object.keys(user.earnedBadges).size` 그대로 셌으나,
 * DOM `.badge--earned`은 BADGE_CATALOG만 iterate → catalog 부재 ID는 미렌더.
 * → catalog filter 적용으로 heading X == DOM `.badge--earned` count 정합 보장.
 *
 * v3.14.4 T10 (M1+M2+M3) — spec 보강:
 *
 * **Heading filter 의도** (M1):
 *   `src/ui/handlers/stats.ts` `hydrateBadges()` 는 `Object.keys(user.earnedBadges)` 를
 *   `BADGE_CATALOG` ID Set으로 필터링한 뒤 heading X 카운트와 `earned` Set을 동시에 산출한다.
 *   따라서 legacy/unknown ID가 `earnedBadges` 에 남아도 heading과 DOM 모두 일관되게 무시된다.
 *
 * **Drift 시나리오** (M1):
 *   1) 과거 catalog에 존재했지만 v3.x에서 제거된 뱃지 ID가 user.earnedBadges에 잔존 (예: badge sweep 누락)
 *   2) schema migration 중 다른 사용자/디바이스에서 import된 unknown ID 혼입
 *   3) test fixture/QA 도구로 임의 주입된 ID
 *
 * **Legacy ID examples** (M2 — 본 spec에서 사용하는 catalog 부재 ID):
 *   - `'legacy-removed-2024'`     — 가상의 과거 제거된 뱃지 ID
 *   - `'old-style-id-1'`          — 옛 naming convention 잔존
 *   - `'removed-mission-x'`       — v3.13 mission 카테고리 도입 이전 prototype ID
 *
 *   대비되는 정상 catalog ID 예: `'answers-1'`, `'scrap-1'`, `'streak-3'` (badgeCatalog.ts).
 *
 * **Coverage** (3 it-blocks):
 *   1) legacy ID 1건 + catalog ID 1건 → heading=1, DOM=1
 *   2) clean user (catalog ID만) → heading=2, DOM=2
 *   3) (M3) legacy ID 다건 + catalog ID 다건 혼재 → heading은 catalog 교집합만 카운트
 */

const STATS_DOM = `
  <span id="statStreak"></span><span id="statAnswers"></span>
  <span id="statArticles"></span><span id="statXp"></span>
  <span id="levelIcon"></span><span id="levelName"></span>
  <span id="levelXpText"></span><span id="xpProgressFill"></span>
  <div id="heatmapGrid"></div>
  <div id="badgesGrid"></div>
  <div id="categoryBreakdown"></div>
  <div id="growthSummary"></div>
`;

describe('hydrateBadges — heading count == .badge--earned count (v3.14.3 T13 P3-T10)', () => {
  beforeEach(() => {
    localStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
    document.body.innerHTML = STATS_DOM;
  });

  it('legacy/unknown badge IDs are excluded from heading count (matches DOM)', async () => {
    localStorage.setItem('user', JSON.stringify({
      name: 'T', interests: ['pm'], onboardedAt: '2026-04-01',
      streak: 0, lastActiveDate: '', xp: 0,
      earnedBadges: {
        'answers-1': 1735000000000,        // catalog ID (정상)
        'legacy-removed-2024': 1700000000, // 카탈로그 부재 (drift 원인)
      },
      gamificationMigrated: true, schemaVersion: 3,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    }));
    const { hydrateStats } = await import('../../../src/ui/handlers/stats');
    hydrateStats();
    const heading = document.querySelector('.badges-section h3');
    expect(heading?.textContent).toMatch(/1 \/ /); // earned: legacy 제외 → 1
    const earnedDom = document.querySelectorAll('#badgesGrid .badge--earned');
    expect(earnedDom.length).toBe(1); // DOM도 1
  });

  it('clean user (no legacy IDs) — heading == DOM', async () => {
    localStorage.setItem('user', JSON.stringify({
      name: 'T', interests: ['pm'], onboardedAt: '2026-04-01',
      streak: 0, lastActiveDate: '', xp: 0,
      earnedBadges: { 'answers-1': 1735000000000, 'scrap-1': 1735000000000 },
      gamificationMigrated: true, schemaVersion: 3,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    }));
    const { hydrateStats } = await import('../../../src/ui/handlers/stats');
    hydrateStats();
    const heading = document.querySelector('.badges-section h3');
    expect(heading?.textContent).toMatch(/2 \/ /);
    const earnedDom = document.querySelectorAll('#badgesGrid .badge--earned');
    expect(earnedDom.length).toBe(2);
  });

  // v3.14.4 T10 M3: legacy + clean ID 다건 혼재 → catalog 교집합만 카운트
  it('mixed legacy + clean IDs — heading counts catalog intersection only', async () => {
    localStorage.setItem('user', JSON.stringify({
      name: 'T', interests: ['pm'], onboardedAt: '2026-04-01',
      streak: 0, lastActiveDate: '', xp: 0,
      earnedBadges: {
        // catalog 정상 ID 3건 (badgeCatalog.ts에 존재)
        'answers-1': 1735000000000,
        'scrap-1': 1735000000000,
        'streak-3': 1735000000000,
        // catalog 부재 legacy/unknown ID 3건 — drift 시뮬레이션
        'legacy-removed-2024': 1700000000,
        'old-style-id-1': 1700000000,
        'removed-mission-x': 1700000000,
      },
      gamificationMigrated: true, schemaVersion: 3,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    }));
    const { hydrateStats } = await import('../../../src/ui/handlers/stats');
    hydrateStats();
    // earnedBadges 6건 중 catalog 교집합 3건만 heading X에 반영되어야 함
    const heading = document.querySelector('.badges-section h3');
    expect(heading?.textContent).toMatch(/^🏆 뱃지 \(3 \/ /);
    // DOM도 동일하게 3건만 .badge--earned
    const earnedDom = document.querySelectorAll('#badgesGrid .badge--earned');
    expect(earnedDom.length).toBe(3);
    // 정상 ID 3건이 실제로 .badge--earned 인지 검증 (data-badge-id attribute 기준)
    const earnedIds = Array.from(earnedDom)
      .map((el) => el.getAttribute('data-badge-id'))
      .filter(Boolean)
      .sort();
    expect(earnedIds).toEqual(['answers-1', 'scrap-1', 'streak-3']);
  });
});
