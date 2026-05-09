import { describe, it, expect, beforeEach } from 'vitest';
import { renderGardenGrid, renderGardenMini, INTEREST_LABEL } from '../../../src/ui/components/garden-grid';
import { INTERESTS } from '../../../src/utils/categories';
import type { User } from '../../../src/state/user';

// 최소한의 User fixture — plantStateByInterest 테스트에 필요한 필드만 포함
function mkUser(plants: Record<string, { stage: 1|2|3|4|5; cumulativeActivity: number; lastEngagedAt?: string; unlockedAt?: string }>): User {
  return {
    name: 'h',
    interests: Object.keys(plants),
    onboardedAt: '',
    streak: 0,
    lastActiveDate: '',
    xp: 0,
    earnedBadges: {},
    gamificationMigrated: true,
    schemaVersion: 7,
    missions: {
      active: [],
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '',
      currentWeekIso: '',
      currentMonthIso: '',
    },
    plantStateByInterest: plants,
    gardenIntroduced: true,
    gardenBackfilled: true,
    streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
    insights: [],
  };
}

describe('renderGardenGrid (stats full)', () => {
  let root: HTMLDivElement;
  beforeEach(() => { root = document.createElement('div'); });

  it('식물 N개 → cards N개 렌더', () => {
    const u = mkUser({
      ai_ml:  { stage: 3, cumulativeActivity: 30 },
      pm:     { stage: 1, cumulativeActivity: 5 },
    });
    renderGardenGrid(root, u);
    expect(root.querySelectorAll('.garden-card')).toHaveLength(2);
  });

  it('stage 5 + unlockedAt → bloomed class + trophy', () => {
    const u = mkUser({ ai_ml: { stage: 5, cumulativeActivity: 162, unlockedAt: '2026-05-01' } });
    renderGardenGrid(root, u);
    const card = root.querySelector('.garden-card');
    expect(card?.classList.contains('bloomed')).toBe(true);
    expect(card?.querySelector('.garden-trophy')?.textContent).toBe('✨');
  });

  it('lastEngagedAt 7일+ → wilting class', () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const u = mkUser({ ai_ml: { stage: 3, cumulativeActivity: 30, lastEngagedAt: old } });
    renderGardenGrid(root, u);
    expect(root.querySelector('.garden-card')?.classList.contains('wilting')).toBe(true);
  });

  it('archived 식물 (interests 외) → grid에서 제외', () => {
    const u = mkUser({
      ai_ml:  { stage: 3, cumulativeActivity: 30 },
      pm:     { stage: 1, cumulativeActivity: 5 },
    });
    u.interests = ['ai_ml'];  // pm 제외 (archived)
    renderGardenGrid(root, u);
    expect(root.querySelectorAll('.garden-card')).toHaveLength(1);
    expect(root.textContent).toContain('AI/ML');
    expect(root.textContent).not.toContain('프로덕트');
  });

  it('식물 0개 → empty 안내', () => {
    const u = mkUser({});
    renderGardenGrid(root, u);
    expect(root.querySelector('.garden-empty')).toBeTruthy();
  });

  it('cumulativeActivity 카운트 표시', () => {
    const u = mkUser({ ai_ml: { stage: 3, cumulativeActivity: 42 } });
    renderGardenGrid(root, u);
    expect(root.textContent).toContain('42회');
  });

  it('stage 라벨 정확 (만개)', () => {
    const u = mkUser({ ai_ml: { stage: 5, cumulativeActivity: 200 } });
    renderGardenGrid(root, u);
    expect(root.textContent).toContain('만개');
  });
});

describe('renderGardenMini (홈 preview)', () => {
  let root: HTMLDivElement;
  beforeEach(() => { root = document.createElement('div'); });

  it('식물 N개 → mini cells N개', () => {
    const u = mkUser({
      ai_ml:  { stage: 1, cumulativeActivity: 0 },
      pm:     { stage: 1, cumulativeActivity: 0 },
    });
    renderGardenMini(root, u);
    expect(root.querySelectorAll('.garden-mini-cell')).toHaveLength(2);
  });

  it('식물 0개 → empty (미표시)', () => {
    renderGardenMini(root, mkUser({}));
    expect(root.querySelectorAll('.garden-mini-cell')).toHaveLength(0);
  });

  it('cell aria-label = 분야명 포함', () => {
    const u = mkUser({ ai_ml: { stage: 1, cumulativeActivity: 0 } });
    renderGardenMini(root, u);
    expect(root.querySelector('.garden-mini-cell')?.getAttribute('aria-label')).toContain('AI/ML');
  });
});

// v3.18.1 H4 (#5): mini label 4자 + ellipsis (의미 손실 완화)
// 이전: shortLabel(id, false) = label.slice(0, 2) → '자기계발' → '자기' (의미 손실).
// 이후: 4자 이하는 그대로, 5자 이상은 4자 + '…'.
describe('renderGardenMini (mini label 4자 + ellipsis)', () => {
  let root: HTMLDivElement;
  beforeEach(() => { root = document.createElement('div'); });

  it('4자 이하 label은 그대로 표시 (자기계발 → 자기계발)', () => {
    const u = mkUser({ self_dev: { stage: 1, cumulativeActivity: 0 } });
    renderGardenMini(root, u);
    const miniLabel = root.querySelector('.garden-mini-label')?.textContent;
    expect(miniLabel).toBe('자기계발');
  });

  it('5자 이상 label은 4자 + ellipsis (커뮤니케이션 → 커뮤니케…)', () => {
    const u = mkUser({ communication: { stage: 1, cumulativeActivity: 0 } });
    renderGardenMini(root, u);
    const miniLabel = root.querySelector('.garden-mini-label')?.textContent;
    expect(miniLabel).toBe('커뮤니케…');
  });
});

// v3.16 T5 (C5 bundle trim): INTEREST_LABEL을 INTERESTS catalog에서 derive하도록 변경.
// 15개 catalog ID에 대해 빈 문자열 아님 + emoji prefix 분리 정확성을 회귀 안전망으로 보장.
describe('INTEREST_LABEL (catalog-derived plain label)', () => {
  it('15 catalog IDs 모두 non-empty string', () => {
    for (const interest of INTERESTS) {
      expect(INTEREST_LABEL[interest.id], `INTEREST_LABEL.${interest.id}`).toBeTruthy();
      expect(INTEREST_LABEL[interest.id]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('emoji prefix 제거 — label은 원본 label과 한 칸 차 (catalog 컨벤션 emoji+space+label)', () => {
    for (const interest of INTERESTS) {
      const plain = INTEREST_LABEL[interest.id];
      // 원본 label은 'emoji 한국어' 형식 — plain은 한국어 부분만
      expect(interest.label.endsWith(plain ?? '')).toBe(true);
      // plain은 emoji 자체를 포함하지 않음 (첫 글자가 한글이거나 영문)
      const firstChar = plain?.[0] ?? '';
      expect(firstChar).toMatch(/[가-힣A-Za-z]/);
    }
  });
});
