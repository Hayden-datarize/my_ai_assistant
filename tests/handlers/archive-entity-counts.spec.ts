/**
 * v3.30 T2: getEntityCounts + refreshEntityCounts + dg:archive:updated hook.
 *
 * - getEntityCounts: single source-of-truth (answers/scraps/insights 3종 합산).
 * - refreshEntityCounts: DOM 의 data-entity-count span textContent 갱신 (chip row 재생성 X).
 * - dg:archive:updated 이벤트 dispatch → 자동 재계산 (R1 race 방어).
 *
 * 전략: vi.mock factory + vi.mocked 로 state module 격리.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { getEntityCounts, refreshEntityCounts, mountArchiveHandlers } from '../../src/ui/handlers/archive';

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

  it('dg:archive:updated dispatch → refreshEntityCounts 호출 (DOM count 변경)', () => {
    setMockState(1, 1, 1);
    mountArchiveHandlers();
    // 데이터 변경 simulate
    setMockState(3, 2, 1);
    document.dispatchEvent(new CustomEvent('dg:archive:updated', { detail: { entity: 'answer', id: 'a-new' } }));
    expect(document.querySelector('[data-entity-count="all"]')?.textContent).toBe('6');
    expect(document.querySelector('[data-entity-count="answer"]')?.textContent).toBe('3');
    expect(document.querySelector('[data-entity-count="scrap"]')?.textContent).toBe('2');
    expect(document.querySelector('[data-entity-count="insight"]')?.textContent).toBe('1');
  });
});
