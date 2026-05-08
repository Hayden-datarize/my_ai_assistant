import { describe, it, expect, beforeEach } from 'vitest';
import { openPlantDetailModal } from '../../../src/ui/modals/plant-detail';
import { saveUser } from '../../../src/state/user';
import { closeModal } from '../../../src/ui/modals/shared';
import { mkUser } from '../../unit/state/userFixture';

describe('plant-detail modal shell', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('openPlantDetailModal — modal DOM 존재', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } as any },
    }));
    openPlantDetailModal('leadership');
    expect(document.querySelector('.dg-modal')).toBeTruthy();
    expect(document.querySelector('.plant-detail-modal')).toBeTruthy();
  });

  it('closeModal() 호출 시 DOM 제거', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } as any },
    }));
    openPlantDetailModal('leadership');
    closeModal();
    expect(document.querySelector('.dg-modal')).toBeFalsy();
  });
});

describe('plant-detail content', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('stage 1 (씨앗) — 정확한 emoji + 라벨', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 1, cumulativeActivity: 3 } as any },
    }));
    openPlantDetailModal('leadership');
    const body = document.querySelector('.plant-detail-modal')!.textContent!;
    expect(body).toContain('씨앗');
    expect(body).toContain('🌱');
  });

  it('stage 5 (만개) — 분야별 emoji + ✨ + unlockedAt 표시', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: {
        leadership: { stage: 5, cumulativeActivity: 200, unlockedAt: '2026-04-15T00:00:00.000Z' } as any,
      },
    }));
    openPlantDetailModal('leadership');
    const body = document.querySelector('.plant-detail-modal')!.textContent!;
    expect(body).toContain('만개');
    expect(body).toContain('👑');  // leadership stage 5
    expect(body).toContain('✨');
    expect(body).toContain('2026년 4월 15일');
  });

  it('progress — stage 2, cum 15 → 다음 stage(3) threshold 25 표시', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 15 } as any },
    }));
    openPlantDetailModal('leadership');
    const body = document.querySelector('.plant-detail-modal')!.textContent!;
    expect(body).toMatch(/15.*25/);  // 15 / 25 form
  });

  it('unlockedAt absent (stage < 5) → ✨ 항목 hide', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 3, cumulativeActivity: 50 } as any },
    }));
    openPlantDetailModal('leadership');
    const body = document.querySelector('.plant-detail-modal')!.textContent!;
    expect(body).not.toContain('✨');
  });

  it('wilting — lastEngagedAt 7일 이상 → wilting 표시', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400_000).toISOString();
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: {
        leadership: { stage: 3, cumulativeActivity: 50, lastEngagedAt: eightDaysAgo } as any,
      },
    }));
    openPlantDetailModal('leadership');
    const body = document.querySelector('.plant-detail-modal')!.textContent!;
    expect(body).toContain('🥀');
  });

  it('사용자 정의 분야 → fallback 🌸 (stage 5) + count 0', () => {
    saveUser(mkUser({
      interests: ['my_custom_interest'],
      gardenBackfilled: true,
      plantStateByInterest: {
        my_custom_interest: { stage: 5, cumulativeActivity: 200 } as any,
      },
    }));
    openPlantDetailModal('my_custom_interest');
    const body = document.querySelector('.plant-detail-modal')!.textContent!;
    expect(body).toContain('🌸');
    expect(body).toContain('0개 답변');
    expect(body).toContain('0개 스크랩');
  });
});
