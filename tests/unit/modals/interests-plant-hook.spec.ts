import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleInterestsSave } from '../../../src/ui/modals/interests';

// DOM 불필요 — handleInterestsSave는 localStorage + state만 조작
vi.mock('../../../src/utils/toast', () => ({ showToast: vi.fn() }));
// openModal/closeModal DOM 의존 제거
vi.mock('../../../src/ui/modals/shared', () => ({
  openModal: vi.fn(() => document.createElement('div')),
  closeModal: vi.fn(),
}));

const BASE_USER = {
  name: 'h',
  interests: [] as string[],
  onboardedAt: '',
  streak: 0,
  lastActiveDate: '',
  xp: 0,
  earnedBadges: {} as Record<string, number>,
  gamificationMigrated: true,
  schemaVersion: 4 as const,
  missions: {
    active: [],
    cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
    lastDailySeed: '',
    currentWeekIso: '',
    currentMonthIso: '',
  },
  plantStateByInterest: {} as Record<string, { stage: number; cumulativeActivity: number; lastEngagedAt: string }>,
  gardenIntroduced: false,
  gardenBackfilled: true,
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify(BASE_USER));
});

describe('interests modal save → ensurePlantsForInterests', () => {
  it('새 분야 추가 시 stage 1 식물 자동 생성', () => {
    handleInterestsSave(['recruiting', 'ai_ml']);
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.plantStateByInterest.recruiting?.stage).toBe(1);
    expect(u.plantStateByInterest.ai_ml?.stage).toBe(1);
  });

  it('분야 제거 시 entry 그대로 유지 (archived)', () => {
    handleInterestsSave(['recruiting', 'ai_ml']);
    handleInterestsSave(['recruiting']); // ai_ml 제거
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(u.plantStateByInterest.ai_ml).toBeDefined(); // entry 보존
    expect(u.interests).toEqual(['recruiting']);
  });

  it('분야 재추가 시 기존 entry 복원 (cumulativeActivity 보존)', () => {
    handleInterestsSave(['ai_ml']);
    // cumulativeActivity / stage 임의 셋
    const u1 = JSON.parse(localStorage.getItem('user')!);
    u1.plantStateByInterest.ai_ml.cumulativeActivity = 50;
    u1.plantStateByInterest.ai_ml.stage = 3;
    localStorage.setItem('user', JSON.stringify(u1));

    handleInterestsSave([]); // 제거
    handleInterestsSave(['ai_ml']); // 재추가
    const u2 = JSON.parse(localStorage.getItem('user')!);
    expect(u2.plantStateByInterest.ai_ml.stage).toBe(3); // 보존
    expect(u2.plantStateByInterest.ai_ml.cumulativeActivity).toBe(50);
  });

  it('빈 분야 list 저장 → 식물 entry 0', () => {
    handleInterestsSave([]);
    const u = JSON.parse(localStorage.getItem('user')!);
    expect(Object.keys(u.plantStateByInterest)).toHaveLength(0);
  });
});
