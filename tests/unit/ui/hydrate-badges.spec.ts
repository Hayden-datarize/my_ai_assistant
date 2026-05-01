import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hydrateStats } from '../../../src/ui/handlers/stats';
import { saveUser } from '../../../src/state/user';
import { saveBriefings } from '../../../src/state/briefings';
import { mkUser } from '../state/userFixture';

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

beforeEach(() => {
  localStorage.clear();
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
  document.body.innerHTML = STATS_DOM;
});

describe('hydrateBadges (catalog 기반)', () => {
  it('빈 user (xp=0, no badges) → 22 grid + 0 earned', () => {
    saveUser(mkUser({ gamificationMigrated: true }));
    hydrateStats();
    const grid = document.getElementById('badgesGrid')!;
    expect(grid.querySelectorAll('.badge')).toHaveLength(22);
    expect(grid.querySelectorAll('.badge--earned')).toHaveLength(0);
    expect(grid.querySelectorAll('.badge--locked')).toHaveLength(22);
  });

  it('count 헤더 — earned/총 22', () => {
    saveUser(mkUser({ earnedBadges: { 'streak-3': 1700000000000, 'answers-1': 1700000000000 }, gamificationMigrated: true }));
    hydrateStats();
    const heading = document.querySelector('.badges-section h3');
    expect(heading?.textContent).toMatch(/2\s*\/\s*22/);
  });

  it('6 카테고리 grouping (Streak → Volume → Tier → Diversity → Engagement → Mission)', () => {
    saveUser(mkUser({ gamificationMigrated: true }));
    hydrateStats();
    const headings = Array.from(document.querySelectorAll('.badges-category h4')).map(h => h.textContent);
    expect(headings).toEqual([
      expect.stringContaining('Streak'),
      expect.stringContaining('Volume'),
      expect.stringContaining('Tier'),
      expect.stringContaining('Diversity'),
      expect.stringContaining('Engagement'),
      expect.stringContaining('Mission'),
    ]);
  });

  it('v3.12.2 회귀: 부모 #badgesGrid는 grid container 아님 — 카테고리별 nested .badges-grid가 가로 grid 담당', () => {
    saveUser(mkUser({ gamificationMigrated: true }));
    hydrateStats();
    const parent = document.getElementById('badgesGrid')!;
    // 부모는 단순 placeholder — .badges-grid class 가지면 nested grid container 충돌 (badge들이 1열 stack됨)
    expect(parent.classList.contains('badges-grid')).toBe(false);
    // 카테고리 6개 각각 자체 .badges-grid 가짐
    const nestedGrids = parent.querySelectorAll('.badges-category .badges-grid');
    expect(nestedGrids).toHaveLength(6);
  });

  it('locked 뱃지 — 🔒 overlay + data-tooltip 존재', () => {
    saveUser(mkUser({ gamificationMigrated: true }));
    hydrateStats();
    const locked = document.querySelector<HTMLElement>('.badge--locked');
    expect(locked?.querySelector('.badge-lock')?.textContent).toBe('🔒');
    expect(locked?.dataset['tooltip']).toMatch(/달성 조건/);
  });

  it('earned 뱃지 — locked overlay 없음 + aria-label에 이름 포함', () => {
    saveUser(mkUser({ streak: 5, earnedBadges: { 'streak-3': 1700000000000 }, gamificationMigrated: true }));
    hydrateStats();
    const earned = document.querySelector<HTMLElement>('.badge--earned');
    expect(earned).not.toBeNull();
    expect(earned?.querySelector('.badge-lock')).toBeNull();
    expect(earned?.getAttribute('aria-label')).toMatch(/첫 불씨/);
  });

  it('hydrateLevelCard: TIERS import — user.xp=200 → 새잎', () => {
    saveUser(mkUser({ xp: 200, gamificationMigrated: true }));
    hydrateStats();
    expect(document.getElementById('levelName')!.textContent).toBe('새잎');
  });

  it('hydrateGrowthSummary: tierName 포함 (level 숫자 X)', () => {
    saveUser(mkUser({ xp: 350, gamificationMigrated: true }));
    saveBriefings([]);
    hydrateStats();
    const summary = document.getElementById('growthSummary')!.textContent ?? '';
    expect(summary).toMatch(/나무|성장 요약/);
  });

  it('earned 뱃지 click → openModal (badge-detail)', async () => {
    saveUser(mkUser({ streak: 5, earnedBadges: { 'streak-3': 1700000000000 }, gamificationMigrated: true }));
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
    document.body.insertAdjacentHTML('beforeend', '<div id="modalRoot"></div>');
    hydrateStats();
    const earned = document.querySelector<HTMLButtonElement>('.badge--earned');
    earned?.click();
    // v3.14.1 T5: dynamic import 완료를 polling — fixed 50ms cold-start flake 차단
    await vi.waitFor(() => {
      expect(document.querySelector('.badge-modal')).not.toBeNull();
    }, { timeout: 2000, interval: 20 });
  });
});
