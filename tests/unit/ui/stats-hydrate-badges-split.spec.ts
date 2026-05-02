import { describe, it, expect, beforeEach } from 'vitest';
import { hydrateStats } from '../../../src/ui/handlers/stats';
import { saveUser } from '../../../src/state/user';
import { mkUser } from '../state/userFixture';

/**
 * v3.14.2 T10 — split-helper regression guard for hydrateBadges (P2-12-9).
 *
 * Validates that after extracting renderBadgeButton + renderBadgeCategory:
 *   - badges-section heading still renders with "(earned / total)" form
 *   - 6 카테고리 nested .badges-grid가 각각 한 개 렌더
 *   - 각 카테고리 grid는 ≥1 .badge 자식을 가짐 (BADGE_CATALOG 기준)
 *
 * Note: 보다 깊은 동작 회귀(click → openBadgeDetail, locked → tooltip)는
 *       기존 hydrate-badges.spec.ts 가 커버. 본 spec 은 split 자체의 smoke 회귀.
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

describe('hydrateBadges — split helper regression (v3.14.2 T10 / P2-12-9)', () => {
  beforeEach(() => {
    localStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
    document.body.innerHTML = STATS_DOM;
  });

  it('renders badges-section heading + 6 nested .badges-grid (one per category)', () => {
    saveUser(mkUser({ gamificationMigrated: true }));
    hydrateStats();

    const section = document.querySelector('.badges-section');
    expect(section).not.toBeNull();

    const heading = section?.querySelector('h3');
    expect(heading?.textContent).toMatch(/🏆 뱃지 \(\d+ \/ \d+\)/);

    const nestedGrids = section?.querySelectorAll('.badges-category .badges-grid') ?? [];
    expect(nestedGrids).toHaveLength(6);
    nestedGrids.forEach((grid) => {
      expect(grid.querySelectorAll('.badge').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('earned 카운트가 heading 에 정확히 반영 (renderBadgeCategory가 earned Set 그대로 전달)', () => {
    saveUser(mkUser({
      earnedBadges: { 'streak-3': 1700000000000, 'answers-1': 1700000000000, 'scrap-1': 1700000000000 },
      gamificationMigrated: true,
    }));
    hydrateStats();
    const heading = document.querySelector('.badges-section h3');
    // earned Set keys = 3 (split helper가 set 누락 없이 전달했는지 검증)
    expect(heading?.textContent).toMatch(/^🏆 뱃지 \(3 \/ \d+\)$/);
    expect(document.querySelectorAll('.badge--earned')).toHaveLength(3);
  });
});
