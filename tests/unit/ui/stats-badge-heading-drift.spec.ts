import { describe, it, expect, beforeEach } from 'vitest';

/**
 * v3.14.3 T13 (P3-T10-drift): hydrateBadges heading "🏆 뱃지 (X / Y)"의
 * X(=earned 카운트)가 catalog 부재 legacy ID까지 포함하던 버그 회귀 spec.
 * heading은 `Object.keys(user.earnedBadges).size` 그대로 셌으나,
 * DOM `.badge--earned`은 BADGE_CATALOG만 iterate → catalog 부재 ID는 미렌더.
 * → catalog filter 적용으로 heading X == DOM `.badge--earned` count 정합 보장.
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
});
