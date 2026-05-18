/**
 * v3.30 T2: getEntityCounts + refreshEntityCounts + dg:archive:updated hook.
 *
 * - getEntityCounts: single source-of-truth (answers/scraps/insights 3종 합산).
 * - refreshEntityCounts: DOM 의 data-entity-count span textContent 갱신 (chip row 재생성 X).
 * - dg:archive:updated 이벤트 dispatch → 자동 재계산 (R1 race 방어).
 *
 * 전략: vi.mock factory + vi.mocked 로 state module 격리.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// 모듈 mock 선언 — hoisted, factory 방식 (home-chat-wiring.spec.ts 패턴)
// ---------------------------------------------------------------------------
const mockLoadAnswers = vi.fn();
const mockLoadBriefings = vi.fn();
const mockGetCachedUser = vi.fn();

vi.mock('../../src/state/persistence', () => ({
  loadAnswers: (...a: unknown[]) => mockLoadAnswers(...a),
  saveAnswers: vi.fn(),
  deleteAnswerById: vi.fn(),
  deleteAnswersByIds: vi.fn(),
}));
vi.mock('../../src/state/briefings', () => ({
  loadBriefings: (...a: unknown[]) => mockLoadBriefings(...a),
  saveBriefings: vi.fn(),
  toggleScrap: vi.fn(),
  // home.ts renderBriefingCard 가 ensureDetectedLang → setTranslation 호출 (dg:archive:updated → rerenderList → appendScrapCard 경유).
  setTranslation: vi.fn(),
  getTranslation: vi.fn(),
}));
vi.mock('../../src/state/user', () => ({
  getCachedUser: (...a: unknown[]) => mockGetCachedUser(...a),
  saveUser: vi.fn(),
  getSaveErrorMessage: vi.fn().mockReturnValue('저장 실패'),
}));

import {
  getEntityCounts,
  refreshEntityCounts,
  mountArchiveHandlers,
  resetArchiveHandlersForTest,
  rerenderList,
} from '../../src/ui/handlers/archive';
import {
  registerCoreHandlerListeners,
  resetCoreHandlerListenersForTest,
} from '../../src/ui/handlers/register';

afterEach(() => {
  resetCoreHandlerListenersForTest();
});

// Helper: fixture set (answers 5, scraps 4, insights 3).
// sortPinThenDesc(rerenderList 내부) 가 b.date / a.createdAt / i.createdAt 의 localeCompare를 호출하므로
// 모든 fixture에 date/createdAt 채워 listener test의 throw 방지.
function setMockState(answersN: number, scrapsN: number, insightsN: number): void {
  mockLoadAnswers.mockReturnValue(
    Array.from({ length: answersN }, (_, i) => ({
      id: `a${i}`,
      createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      text: `answer${i}`,
      pinned: false,
    })),
  );
  // briefings: scrapped인 것 = scraps count. scrapped=false 추가 1건 — getScraps 격리 검증.
  const briefings = [
    ...Array.from({ length: scrapsN }, (_, i) => ({
      id: `s${i}`,
      scrapped: true,
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      title: `t${i}`,
      summary: `s${i}`,
      url: `https://x/${i}`,
      pinned: false,
    })),
    { id: 'unscrapped', scrapped: false, date: '2026-01-31', title: 't', summary: 's', url: 'https://x', pinned: false },
  ];
  mockLoadBriefings.mockReturnValue(briefings);
  mockGetCachedUser.mockReturnValue({
    insights: Array.from({ length: insightsN }, (_, i) => ({
      id: `i${i}`,
      createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      text: `insight${i}`,
      pinned: false,
    })),
  });
}

describe('v3.30 T2: getEntityCounts', () => {
  beforeEach(() => {
    mockLoadAnswers.mockReset();
    mockLoadBriefings.mockReset();
    mockGetCachedUser.mockReset();
  });

  it('entity별 count 정확 계산 (all = 답변 + 스크랩 + 인사이트 합)', () => {
    setMockState(5, 4, 3);
    const counts = getEntityCounts();
    expect(counts.answer).toBe(5);
    expect(counts.scrap).toBe(4);
    expect(counts.insight).toBe(3);
    expect(counts.all).toBe(12);
  });

  it('scrapped=false briefing은 scrap count에서 제외', () => {
    setMockState(0, 2, 0);
    // briefings = [s0(scrapped), s1(scrapped), unscrapped(false)] → scrap count = 2
    const counts = getEntityCounts();
    expect(counts.scrap).toBe(2);
  });

  it('cachedUser === null 시 insight = 0 (silent corruption guard)', () => {
    mockLoadAnswers.mockReturnValue([]);
    mockLoadBriefings.mockReturnValue([]);
    mockGetCachedUser.mockReturnValue(null);
    const counts = getEntityCounts();
    expect(counts.insight).toBe(0);
    expect(counts.all).toBe(0);
  });

  it('전체 0 케이스 — all=0 (silent corruption guard)', () => {
    setMockState(0, 0, 0);
    const counts = getEntityCounts();
    expect(counts.all).toBe(0);
    expect(counts.answer).toBe(0);
    expect(counts.scrap).toBe(0);
    expect(counts.insight).toBe(0);
  });
});

describe('v3.30 T2: refreshEntityCounts', () => {
  beforeEach(() => {
    mockLoadAnswers.mockReset();
    mockLoadBriefings.mockReset();
    mockGetCachedUser.mockReset();
    // eslint-disable-next-line no-restricted-syntax -- test fixture static HTML, no interpolation
    document.body.innerHTML = `
      <div id="archiveEntityFilters">
        <span data-entity-count="all">0</span>
        <span data-entity-count="answer">0</span>
        <span data-entity-count="scrap">0</span>
        <span data-entity-count="insight">0</span>
      </div>
    `;
  });

  it('counts 인자 명시 시 — DOM의 data-entity-count span textContent 4개 갱신', () => {
    refreshEntityCounts({ all: 12, answer: 5, scrap: 4, insight: 3 });
    expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('12');
    expect(document.querySelector('[data-entity-count="answer"]')?.textContent).toBe('5');
    expect(document.querySelector('[data-entity-count="scrap"]')?.textContent).toBe('4');
    expect(document.querySelector('[data-entity-count="insight"]')?.textContent).toBe('3');
  });

  it('counts 생략 시 — getEntityCounts() 결과로 자동 갱신', () => {
    setMockState(2, 1, 1);
    refreshEntityCounts();
    expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('4');
    expect(document.querySelector('[data-entity-count="answer"]')?.textContent).toBe('2');
    expect(document.querySelector('[data-entity-count="scrap"]')?.textContent).toBe('1');
    expect(document.querySelector('[data-entity-count="insight"]')?.textContent).toBe('1');
  });

  it('count 0 — placeholder 유지 (silent corruption guard: 0 출력 OK)', () => {
    refreshEntityCounts({ all: 0, answer: 0, scrap: 0, insight: 0 });
    expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('0');
    expect(document.querySelector('[data-entity-count="answer"]')?.textContent).toBe('0');
  });

  it('data-entity-count span 없는 DOM 시 — no-op (안전)', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture static HTML, no interpolation
    document.body.innerHTML = '<div id="archiveEntityFilters"></div>';
    // throw 없이 silent 동작
    expect(() => refreshEntityCounts({ all: 1, answer: 1, scrap: 0, insight: 0 })).not.toThrow();
  });
});

describe('v3.30 T2: dg:archive:updated hook 자동 재계산', () => {
  beforeEach(() => {
    mockLoadAnswers.mockReset();
    mockLoadBriefings.mockReset();
    mockGetCachedUser.mockReset();
    // v3.30 T2 review fix (P1): mount guard reset — 동일 file 내 it마다 mount 정상 재진입.
    resetArchiveHandlersForTest();
    // archiveList 필요 — mountArchiveHandlers 내부 rerenderList 안전 호출.
    // eslint-disable-next-line no-restricted-syntax -- test fixture static HTML, no interpolation
    document.body.innerHTML = `
      <div id="archiveTab">
        <div id="archiveEntityFilters">
          <span data-entity-count="all">0</span>
          <span data-entity-count="answer">0</span>
          <span data-entity-count="scrap">0</span>
          <span data-entity-count="insight">0</span>
        </div>
        <div id="archiveList"></div>
      </div>
    `;
  });

  it('dg:archive:updated dispatch → refreshEntityCounts 호출 (DOM count 변경)', async () => {
    setMockState(1, 1, 1);
    mountArchiveHandlers();
    registerCoreHandlerListeners();
    // 데이터 변경 simulate
    setMockState(3, 2, 1);
    document.dispatchEvent(new CustomEvent('dg:archive:updated', { detail: { entity: 'answer', id: 'a-new' } }));
    await vi.waitFor(() => {
      expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('6');
      expect(document.querySelector('[data-entity-count="answer"]')?.textContent).toBe('3');
      expect(document.querySelector('[data-entity-count="scrap"]')?.textContent).toBe('2');
      expect(document.querySelector('[data-entity-count="insight"]')?.textContent).toBe('1');
    });
  });
});

describe('v3.30 T2 review fix (P1): mountArchiveHandlers double-mount guard', () => {
  beforeEach(() => {
    mockLoadAnswers.mockReset();
    mockLoadBriefings.mockReset();
    mockGetCachedUser.mockReset();
    setMockState(0, 0, 0);
    // eslint-disable-next-line no-restricted-syntax -- test fixture static HTML, no interpolation
    document.body.innerHTML = `
      <div id="archiveTab">
        <div id="archiveEntityFilters">
          <span data-entity-count="all">0</span>
          <span data-entity-count="answer">0</span>
          <span data-entity-count="scrap">0</span>
          <span data-entity-count="insight">0</span>
        </div>
        <div id="archiveList"></div>
      </div>
    `;
  });

  it('두 번째 mountArchiveHandlers와 core registrar는 no-op — dg:archive:updated 1회 dispatch 시 DOM 갱신', async () => {
    // 첫 mount 후 reset 안 함 — guard에 의해 두 번째 호출 차단 검증.
    resetArchiveHandlersForTest();
    mountArchiveHandlers();
    mountArchiveHandlers(); // guard에 막힘 — listener 중복 등록 안 함.
    registerCoreHandlerListeners();
    registerCoreHandlerListeners(); // core guard에 막힘 — dg:* listener 중복 등록 안 함.

    // refreshEntityCounts 호출 횟수를 side-effect로 측정: setMockState 변경 후 dispatch 1회 → DOM 1회 갱신.
    setMockState(2, 1, 0);
    document.dispatchEvent(new CustomEvent('dg:archive:updated', { detail: { entity: 'answer', id: 'x' } }));
    await vi.waitFor(() => {
      expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('3');
      expect(document.querySelector('[data-entity-count="answer"]')?.textContent).toBe('2');
      expect(document.querySelector('[data-entity-count="scrap"]')?.textContent).toBe('1');
    });
    // listener 중복 시에도 idempotent라 DOM 결과는 같지만, 본 spec은 guard가 동작함을 약하게나마 보장.
  });

  it('resetArchiveHandlersForTest() 호출 후 mountArchiveHandlers는 재진입 가능 (guard reset)', () => {
    resetArchiveHandlersForTest();
    mountArchiveHandlers();
    // 한 번 reset — 다시 mount 진입.
    resetArchiveHandlersForTest();
    expect(() => mountArchiveHandlers()).not.toThrow();
  });

  // v3.32 T4 (v3.30 T2 P2-3 carry, Codex 사전 P1-1 흡수): listener-count invariant.
  // 기존 DOM count side-effect (dg:archive:updated 1회 → DOM 1회 갱신) 보강 — listener 수 직접 측정.
  // baseline 9 (handleCardDeleteClick / handleCardClick / select toggle / bulk delete / pin toggle /
  // other-pin-counter / scrap modal close / archive-card detail / answer-modal-edit 9 inline).
  // 신규 listener 추가/삭제 시 baseline 갱신 의무.
  it('mountArchiveHandlers는 10 click listener를 단 1회만 등록 (idempotent)', () => {
    // v3.38 T7b fix (Codex 최종 P1-2): summary chip click이 document-level delegation으로 이전 — listener count 9→10.
    resetArchiveHandlersForTest();
    document.body.replaceChildren();
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture, no user interpolation
    document.body.innerHTML = '<div id="archiveTab"><div id="archiveList"></div></div>';

    const spy = vi.spyOn(document, 'addEventListener');

    mountArchiveHandlers();
    const firstClickCalls = spy.mock.calls.filter(([type]) => type === 'click').length;
    expect(firstClickCalls).toBe(10);

    // 두 번째 호출 — __archiveMounted guard로 early return → 0 추가
    mountArchiveHandlers();
    const totalClickCalls = spy.mock.calls.filter(([type]) => type === 'click').length;
    expect(totalClickCalls).toBe(10);

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// v3.30 T7 P1 fix (Codex 최종 review):
// rerenderList() 본문에 refreshEntityCounts() 자동 호출 — 13 caller 자동 갱신.
// archive 내부 mutation paths (answer 단건/벌크 삭제, scrap 해제/undo, dg:insights:* 등)
// 에서 chip count stale 방지.
// ---------------------------------------------------------------------------
describe('v3.30 T7 P1 fix: rerenderList → refreshEntityCounts 자동 호출', () => {
  beforeEach(() => {
    mockLoadAnswers.mockReset();
    mockLoadBriefings.mockReset();
    mockGetCachedUser.mockReset();
    resetArchiveHandlersForTest();
    // eslint-disable-next-line no-restricted-syntax -- test fixture static HTML, no interpolation
    document.body.innerHTML = `
      <div id="archiveTab">
        <div id="archiveEntityFilters">
          <span data-entity-count="all">99</span>
          <span data-entity-count="answer">99</span>
          <span data-entity-count="scrap">99</span>
          <span data-entity-count="insight">99</span>
        </div>
        <div id="archiveList"></div>
      </div>
    `;
  });

  it('rerenderList() 직접 호출 시 chip count 자동 갱신 (placeholder 99 → 실측치)', () => {
    setMockState(5, 4, 3);
    rerenderList();
    expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('12');
    expect(document.querySelector('[data-entity-count="answer"]')?.textContent).toBe('5');
    expect(document.querySelector('[data-entity-count="scrap"]')?.textContent).toBe('4');
    expect(document.querySelector('[data-entity-count="insight"]')?.textContent).toBe('3');
  });

  it('dg:insights:added dispatch → chip count 자동 갱신 (P1 stale 회귀 가드)', async () => {
    setMockState(0, 0, 1);
    mountArchiveHandlers();
    registerCoreHandlerListeners();

    // 인사이트 추가 simulate (production: addInsight 후 dg:insights:added dispatch).
    setMockState(0, 0, 3);
    document.dispatchEvent(new CustomEvent('dg:insights:added'));

    // P1 fix 전: chip count 99 placeholder stale 유지 (dg:insights:added는 rerenderList만 호출, refreshEntityCounts 누락).
    // P1 fix 후: rerenderList 첫 줄에서 refreshEntityCounts 호출 → DOM 3 갱신.
    await vi.waitFor(() => {
      expect(document.querySelector('[data-entity-count="insight"]')?.textContent).toBe('3');
      expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('3');
    });
  });

  it('dg:insights:removed dispatch → chip count 자동 갱신', async () => {
    setMockState(0, 0, 3);
    mountArchiveHandlers();
    registerCoreHandlerListeners();

    // 인사이트 삭제 simulate.
    setMockState(0, 0, 1);
    document.dispatchEvent(new CustomEvent('dg:insights:removed'));

    await vi.waitFor(() => {
      expect(document.querySelector('[data-entity-count="insight"]')?.textContent).toBe('1');
      expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('1');
    });
  });

  it('data-entity-count span 없는 DOM (archive 탭 진입 전) → silent no-op (안전)', () => {
    setMockState(2, 1, 0);
    // archiveList만 있고 chip row가 없는 케이스 — archive 탭 첫 진입 전 mutation simulate.
    // eslint-disable-next-line no-restricted-syntax -- test fixture static HTML, no interpolation
    document.body.innerHTML = '<div id="archiveTab"><div id="archiveList"></div></div>';
    // throw 없이 silent 동작 — refreshEntityCounts 의 querySelectorAll empty no-op 보장.
    expect(() => rerenderList()).not.toThrow();
  });
});
