import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openPlantDetailModal } from '../../../src/ui/modals/plant-detail';
import { saveUser } from '../../../src/state/user';
import { closeModal } from '../../../src/ui/modals/shared';
import { mkUser } from '../../unit/state/userFixture';
import type { PlantState } from '../../../src/state/plantTypes';

describe('plant-detail modal shell', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('openPlantDetailModal — modal DOM 존재', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    expect(document.querySelector('.dg-modal')).toBeTruthy();
    expect(document.querySelector('.plant-detail-modal')).toBeTruthy();
  });

  it('closeModal() 호출 시 DOM 제거', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } } satisfies Record<string, PlantState>,
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
      plantStateByInterest: { leadership: { stage: 1, cumulativeActivity: 3 } } satisfies Record<string, PlantState>,
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
        leadership: { stage: 5, cumulativeActivity: 200, unlockedAt: '2026-04-15T00:00:00.000Z' },
      } satisfies Record<string, PlantState>,
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
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 15 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    const body = document.querySelector('.plant-detail-modal')!.textContent!;
    expect(body).toMatch(/15.*25/);  // 15 / 25 form
  });

  it('unlockedAt absent (stage < 5) → ✨ 항목 hide', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 3, cumulativeActivity: 50 } } satisfies Record<string, PlantState>,
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
        leadership: { stage: 3, cumulativeActivity: 50, lastEngagedAt: eightDaysAgo },
      } satisfies Record<string, PlantState>,
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
        my_custom_interest: { stage: 5, cumulativeActivity: 200 },
      } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('my_custom_interest');
    const body = document.querySelector('.plant-detail-modal')!.textContent!;
    expect(body).toContain('🌸');
    expect(body).toContain('0개 답변');
    expect(body).toContain('0개 스크랩');
  });
});

// v3.36 T1: Plant action chip (navigation to archive)
// v3.39 T8 review (Codex 최종 P1-1): interestKeywords import 제거 — pickSearchKeyword path 폐기 후 미사용.

describe('plant-detail action chip (v3.36)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('chip render — .plant-action-chip button DOM 존재 + aria-label', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    const chip = document.querySelector<HTMLButtonElement>('.plant-action-chip');
    expect(chip).toBeTruthy();
    expect(chip!.tagName).toBe('BUTTON');
    expect(chip!.getAttribute('aria-label')).toBe('이 분야 키워드로 archive 검색');
    expect(chip!.textContent).toContain('archive 탐색');
  });

  it('chip click → modal 제거 + #archiveTab 활성 + #archiveSearch는 비어 있음 (T8 review: prefill 제거, entity filter SoT)', async () => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture container, no user interpolation
    document.body.innerHTML = '<div id="app"></div>';
    saveUser(mkUser({
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    const chip = document.querySelector<HTMLButtonElement>('.plant-action-chip')!;
    chip.click();
    // void Promise + switchTab dynamic import + render → flush until input mount
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 5));
      if (document.querySelector('#archiveSearch')) break;
    }

    expect(document.querySelector('.dg-modal')).toBeFalsy();
    const input = document.querySelector<HTMLInputElement>('#archiveSearch');
    expect(input).toBeTruthy();
    // v3.39 T8 review (Codex 최종 P1-1): pickSearchKeyword + #archiveSearch prefill 제거 —
    // applyInterestFilter('leadership')가 entity filter SoT. search input은 비어 있는 상태 유지.
    expect(input!.value).toBe('');
  });

  // v3.39 T8 review: interestKeywords invariant 검증은 unit/interestKeywords.spec.ts에서 단독 검증.
  // pickSearchKeyword 함수는 폐기되어 본 컨텍스트에서 검증할 invariant 없음 — 테스트 제거.
});

describe('navigateToInterestArchive sequence (v3.37 T2)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.resetModules();
    vi.doUnmock('../../../src/ui/handlers/archive');
    vi.doUnmock('../../../src/ui/nav');
    vi.doUnmock('../../../src/ui/modals/shared');
    vi.doUnmock('../../../src/utils/interestKeywords');
  });

  // Codex 사전 P1-4: switchTab fidelity — real switchTab은 #app innerHTML 교체.
  // closeModal restore가 switchTab 후 사라지는 race를 spec이 정확히 재현해야 함.
  // v3.39 T6 (Codex P0-2): applyInterestFilter 추가 — currentInterestId 단일 진입점.
  // v3.39 T8 review (Codex 최종 P1-1): handleArchiveSearch 호출 제거 — applyInterestFilter가
  //   entity filter SoT. #archiveSearch.value는 비어 있는 상태 유지.
  function setupSwitchTabFidelity(callOrder: string[]) {
    const closeModalSpy = vi.fn(() => { callOrder.push('closeModal'); });
    const resetSpy = vi.fn(() => { callOrder.push('reset'); });
    const applyInterestSpy = vi.fn(() => { callOrder.push('applyInterestFilter'); });
    const handleSearchSpy = vi.fn(() => { callOrder.push('handleArchiveSearch'); });
    const switchTabSpy = vi.fn(async () => {
      callOrder.push('switchTab');
      // 실제 switchTab은 #app innerHTML 교체 — archive DOM을 새로 마운트
      const app = document.getElementById('app');
      if (app) {
        app.replaceChildren();
        const input = document.createElement('input');
        input.id = 'archiveSearch';
        app.appendChild(input);
      }
    });

    vi.doMock('../../../src/ui/handlers/archive', () => ({
      resetArchiveFilters: resetSpy,
      applyInterestFilter: applyInterestSpy,
      handleArchiveSearch: handleSearchSpy,
    }));
    vi.doMock('../../../src/ui/nav', () => ({ switchTab: switchTabSpy }));
    vi.doMock('../../../src/ui/modals/shared', () => ({ openModal: vi.fn(), closeModal: closeModalSpy }));
    // v3.39 T8 review: interestKeywords 더 이상 production에서 import 안 함 — mock 유지하나 호출 안 됨.
    vi.doMock('../../../src/utils/interestKeywords', () => ({
      interestKeywords: () => ['전략', 'strategy'],
    }));

    return { closeModalSpy, resetSpy, applyInterestSpy, handleSearchSpy, switchTabSpy };
  }

  it('closeModal → reset → applyInterestFilter → switchTab 순서 호출 + 새 input에 focus (T8 review: handleArchiveSearch 미호출)', async () => {
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    const callOrder: string[] = [];
    const { handleSearchSpy } = setupSwitchTabFidelity(callOrder);

    const { navigateToInterestArchive } = await import('../../../src/ui/handlers/archive-nav');
    await navigateToInterestArchive('investing');

    // v3.39 T8 review (Codex 최종 P1-1): handleArchiveSearch 호출 제거 — entity filter SoT.
    expect(callOrder).toEqual([
      'closeModal',
      'reset',
      'applyInterestFilter',
      'switchTab',
    ]);
    expect(handleSearchSpy).not.toHaveBeenCalled();

    // switchTab으로 새 mount된 input이 document.activeElement (focus 부여는 유지)
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    expect(input).not.toBeNull();
    // v3.39 T8 review: #archiveSearch는 비어 있는 상태 (prefill 제거).
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('focus 옵션 preventScroll=true로 호출', async () => {
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    const callOrder: string[] = [];
    setupSwitchTabFidelity(callOrder);

    // input이 mount된 후 focus를 spy로 교체 — switchTab 후
    const focusArgs: unknown[][] = [];
    const origFocus = HTMLInputElement.prototype.focus;
    HTMLInputElement.prototype.focus = function (opts?: FocusOptions) {
      focusArgs.push([opts]);
      return origFocus.call(this, opts);
    };

    try {
      const { navigateToInterestArchive } = await import('../../../src/ui/handlers/archive-nav');
      await navigateToInterestArchive('investing');

      expect(focusArgs).toContainEqual([{ preventScroll: true }]);
    } finally {
      HTMLInputElement.prototype.focus = origFocus;
    }
  });

  // Codex 사전 P2-1: focus({ preventScroll }) throw → 일반 focus fallback
  it('focus({ preventScroll }) throw 시 일반 focus()로 fallback', async () => {
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    const callOrder: string[] = [];
    setupSwitchTabFidelity(callOrder);

    const focusCalls: Array<{ withOptions: boolean }> = [];
    const origFocus = HTMLInputElement.prototype.focus;
    HTMLInputElement.prototype.focus = function (opts?: FocusOptions) {
      if (opts !== undefined) {
        focusCalls.push({ withOptions: true });
        throw new TypeError('preventScroll not supported');
      }
      focusCalls.push({ withOptions: false });
      return origFocus.call(this);
    };

    try {
      const { navigateToInterestArchive } = await import('../../../src/ui/handlers/archive-nav');
      await navigateToInterestArchive('investing');

      // 1) 옵션 있는 호출 (throw됨)
      // 2) catch 후 옵션 없는 호출
      expect(focusCalls).toEqual([
        { withOptions: true },
        { withOptions: false },
      ]);
    } finally {
      HTMLInputElement.prototype.focus = origFocus;
    }
  });

  it('#archiveSearch 미존재 시 silent return (focus skip — T8 review: handleArchiveSearch 호출 안 함은 항상 invariant)', async () => {
    document.body.replaceChildren();
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    const callOrder: string[] = [];
    const closeModalSpy = vi.fn(() => { callOrder.push('closeModal'); });
    const resetSpy = vi.fn(() => { callOrder.push('reset'); });
    // v3.39 T6 (Codex P0-2): applyInterestFilter도 mock — currentInterestId 진입점.
    const applyInterestSpy = vi.fn(() => { callOrder.push('applyInterestFilter'); });
    const handleSearchSpy = vi.fn(() => { callOrder.push('handleArchiveSearch'); });
    // switchTab이 input을 mount하지 않음 — race 시뮬레이션
    const switchTabSpy = vi.fn(async () => { callOrder.push('switchTab'); });

    vi.doMock('../../../src/ui/handlers/archive', () => ({
      resetArchiveFilters: resetSpy,
      applyInterestFilter: applyInterestSpy,
      handleArchiveSearch: handleSearchSpy,
    }));
    vi.doMock('../../../src/ui/nav', () => ({ switchTab: switchTabSpy }));
    vi.doMock('../../../src/ui/modals/shared', () => ({ openModal: vi.fn(), closeModal: closeModalSpy }));
    vi.doMock('../../../src/utils/interestKeywords', () => ({ interestKeywords: () => ['전략'] }));

    const { navigateToInterestArchive } = await import('../../../src/ui/handlers/archive-nav');
    await expect(navigateToInterestArchive('investing')).resolves.toBeUndefined();

    // handleArchiveSearch는 input null 검사 이후라 호출 안 됨
    expect(handleSearchSpy).not.toHaveBeenCalled();
  });
});

describe('plant-detail nudge (v3.47)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('stage 2, cum 10 → 일반 nudge "다음 단계까지 15번 더"', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    const nudge = document.querySelector('.plant-detail-nudge');
    expect(nudge).toBeTruthy();
    expect(nudge!.textContent).toContain('15');
    expect(nudge!.textContent).toContain('더 가꾸면');
  });

  it('stage 2, cum 23 → 임박 nudge "딱 2번!" (remaining ≤ 3)', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 23 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    expect(document.querySelector('.plant-detail-nudge')!.textContent).toContain('딱 2번');
  });

  it('stage 5 (만개) → nudge 부재', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 5, cumulativeActivity: 200 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    expect(document.querySelector('.plant-detail-nudge')).toBeFalsy();
  });

  // 사전 review P1-1: <=3 경계(inclusive) 고정
  it('stage 2, cum 22 → remaining 3 경계 → "딱 3번!" (inclusive)', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 22 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    expect(document.querySelector('.plant-detail-nudge')!.textContent).toContain('딱 3번');
  });

  // 사전 review P1-1: 손상 데이터 clamp (cum>=threshold인데 stage 미진화) → remaining 최소 1
  it('stage 4, cum 160 (손상) → clamp remaining 1 → "딱 1번!"', () => {
    saveUser(mkUser({
      interests: ['leadership'],
      gardenBackfilled: true,
      plantStateByInterest: { leadership: { stage: 4, cumulativeActivity: 160 } } satisfies Record<string, PlantState>,
    }));
    openPlantDetailModal('leadership');
    expect(document.querySelector('.plant-detail-nudge')!.textContent).toContain('딱 1번');
  });
});
