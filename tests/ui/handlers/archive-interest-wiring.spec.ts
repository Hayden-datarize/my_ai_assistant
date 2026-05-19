/**
 * @vitest-environment jsdom
 *
 * v3.39 T6 review fix (M-1/M-2/M-3): entityMatchesInterest wiring 회귀 가드.
 *
 * Spec reviewer가 P0-2 흡수 불완전 발견:
 *   - M-1 rerenderList: predicate 정의됐지만 list filter에 적용 안 됨
 *   - M-2 getEntityCounts: chip count가 stale (currentInterestId 무시)
 *   - M-3 updateSearchSummary: token search count가 분야 무시
 *
 * 본 spec은 위 3건 모두 회귀 차단:
 *   1. currentInterestId 설정 후 rerenderList → list가 해당 분야만 표시
 *   2. currentInterestId 설정 후 getEntityCounts → 분야 매칭 count만 반환
 *   3. currentInterestId + token search 동시 적용 → dual filter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setCurrentInterestId,
  getEntityCounts,
  resetArchiveHandlersForTest,
  handleArchiveSearch,
} from '../../../src/ui/handlers/archive';
import { saveAnswers } from '../../../src/state/persistence';
import { saveBriefings, type Briefing } from '../../../src/state/briefings';
import { saveUser, type Insight } from '../../../src/state/user';
import { mkUser } from '../../unit/state/userFixture';
import type { Answer } from '../../../src/state/schema';

const mkAnswer = (over: Partial<Answer> = {}): Answer => ({
  schemaVersion: 1 as Answer['schemaVersion'],
  id: over.id ?? 'a1',
  questionId: 'q1',
  text: 'answer body',
  authorId: 'self',
  createdAt: '2026-05-19T09:00:00Z',
  pinned: false,
  interestId: 'unknown',
  ...over,
});

const mkBriefing = (over: Partial<Briefing> = {}): Briefing => ({
  id: over.id ?? 'b1',
  date: '2026-05-19',
  url: 'https://example.com/',
  title: 'title',
  summary: 'summary',
  scrapped: true,
  read: false,
  memo: '',
  pinned: false,
  interestId: 'unknown',
  ...over,
});

const mkInsight = (over: Partial<Insight> = {}): Insight => ({
  id: over.id ?? 'i1',
  text: 'insight text',
  interestId: 'unknown',
  createdAt: '2026-05-19T09:00:00Z',
  pinned: false,
  ...over,
});

function setupDom(): void {
  // jsdom fixture: 모든 노드를 createElement로 빌드 (no innerHTML, no user interpolation).
  document.body.replaceChildren();
  const tab = document.createElement('div');
  tab.id = 'archiveTab';
  const search = document.createElement('input');
  search.id = 'archiveSearch';
  search.type = 'search';
  const summary = document.createElement('div');
  summary.id = 'archiveSearchSummary';
  const list = document.createElement('div');
  list.id = 'archiveList';
  const filters = document.createElement('div');
  filters.id = 'archiveEntityFilters';
  for (const entity of ['all', 'answer', 'scrap', 'insight'] as const) {
    const btn = document.createElement('button');
    btn.className = 'archive-entity-chip';
    btn.dataset['entity'] = entity;
    if (entity === 'all') btn.setAttribute('aria-checked', 'true');
    const span = document.createElement('span');
    span.dataset['entityCount'] = entity;
    span.textContent = '0';
    btn.appendChild(span);
    filters.appendChild(btn);
  }
  tab.append(search, summary, list, filters);
  document.body.appendChild(tab);
}

describe('v3.39 T6 review fix — M-1 rerenderList currentInterestId filter', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.replaceChildren();
    resetArchiveHandlersForTest();
    setCurrentInterestId(null);
  });

  it("currentInterestId='ai_ml' 설정 후 rerenderList → ai_ml 매칭 entity만 list 표시", () => {
    saveAnswers([
      mkAnswer({ id: 'a-ml', interestId: 'ai_ml', text: 'ml answer' }),
      mkAnswer({ id: 'a-hr', interestId: 'hr_system', text: 'hr answer' }),
    ]);
    setupDom();

    setCurrentInterestId('ai_ml'); // rerenderList 내부 트리거

    const cards = document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]');
    const ids = [...cards].map((c) => c.dataset['answerId']);
    expect(ids).toContain('a-ml');
    expect(ids).not.toContain('a-hr');
  });

  it("currentInterestId='ai_ml' + 'unknown' legacy entity → matchesInterest fallback 매칭", () => {
    saveAnswers([
      mkAnswer({ id: 'a-legacy', interestId: 'unknown', text: 'AI 모델 학습 내용' }),
      mkAnswer({ id: 'a-unrelated', interestId: 'unknown', text: '오늘 점심 뭐 먹을까' }),
    ]);
    setupDom();

    setCurrentInterestId('ai_ml');

    const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
      .map((c) => c.dataset['answerId']);
    expect(ids).toContain('a-legacy');
    expect(ids).not.toContain('a-unrelated');
  });

  it("currentInterestId=null (전체) → 모든 entity 표시", () => {
    saveAnswers([
      mkAnswer({ id: 'a-ml', interestId: 'ai_ml' }),
      mkAnswer({ id: 'a-hr', interestId: 'hr_system' }),
    ]);
    setupDom();

    setCurrentInterestId(null);

    const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
      .map((c) => c.dataset['answerId']);
    expect(ids).toEqual(expect.arrayContaining(['a-ml', 'a-hr']));
  });

  it("currentInterestId='ai_ml' → scrap entity도 분야 필터 적용", () => {
    saveBriefings([
      mkBriefing({ id: 'b-ml', interestId: 'ai_ml', title: 'ML 동향' }),
      mkBriefing({ id: 'b-hr', interestId: 'hr_system', title: 'HR 시스템' }),
    ]);
    setupDom();
    // entity chip을 scrap으로 전환 위해 rerenderList trigger + currentEntity 전환
    setCurrentInterestId('ai_ml');
    // scrap entity branch는 currentEntity === 'scrap' 일 때만 — 본 spec은 'all' merge branch 검증.
    // 'all' merge branch에서 scrap 카드도 ai_ml만 노출되어야 함.

    const list = document.getElementById('archiveList');
    const text = list?.textContent ?? '';
    expect(text).toContain('ML 동향');
    expect(text).not.toContain('HR 시스템');
  });

  it("currentInterestId='ai_ml' → insight도 분야 필터 적용", () => {
    saveUser(
      mkUser({
        insights: [
          mkInsight({ id: 'i-ml', interestId: 'ai_ml', text: 'ML 인사이트' }),
          mkInsight({ id: 'i-hr', interestId: 'hr_system', text: 'HR 인사이트' }),
        ],
      }),
    );
    setupDom();
    setCurrentInterestId('ai_ml');

    const text = document.getElementById('archiveList')?.textContent ?? '';
    expect(text).toContain('ML 인사이트');
    expect(text).not.toContain('HR 인사이트');
  });
});

describe('v3.39 T6 review fix — M-2 getEntityCounts currentInterestId filter', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.replaceChildren();
    resetArchiveHandlersForTest();
    setCurrentInterestId(null);
  });

  it("currentInterestId=null → raw 총량 반환 (기존 동작)", () => {
    saveAnswers([
      mkAnswer({ id: 'a1', interestId: 'ai_ml' }),
      mkAnswer({ id: 'a2', interestId: 'hr_system' }),
    ]);
    const counts = getEntityCounts();
    expect(counts.answer).toBe(2);
    expect(counts.all).toBe(2);
  });

  it("currentInterestId='ai_ml' → ai_ml 매칭 entity만 count", () => {
    saveAnswers([
      mkAnswer({ id: 'a1', interestId: 'ai_ml' }),
      mkAnswer({ id: 'a2', interestId: 'ai_ml' }),
      mkAnswer({ id: 'a3', interestId: 'hr_system' }),
    ]);
    setCurrentInterestId('ai_ml');
    const counts = getEntityCounts();
    expect(counts.answer).toBe(2);
    expect(counts.all).toBe(2);
  });

  it("currentInterestId='ai_ml' + briefing/insight 분야 혼합 → entity별 정확", () => {
    saveAnswers([mkAnswer({ id: 'a1', interestId: 'ai_ml' })]);
    saveBriefings([
      mkBriefing({ id: 'b1', interestId: 'ai_ml' }),
      mkBriefing({ id: 'b2', interestId: 'hr_system' }),
    ]);
    saveUser(
      mkUser({
        insights: [
          mkInsight({ id: 'i1', interestId: 'ai_ml' }),
          mkInsight({ id: 'i2', interestId: 'ai_ml' }),
          mkInsight({ id: 'i3', interestId: 'hr_system' }),
        ],
      }),
    );

    setCurrentInterestId('ai_ml');
    const counts = getEntityCounts();
    expect(counts.answer).toBe(1);
    expect(counts.scrap).toBe(1);
    expect(counts.insight).toBe(2);
    expect(counts.all).toBe(4);
  });

  it("currentInterestId='hr_system' → 매칭 없으면 0", () => {
    saveAnswers([mkAnswer({ id: 'a1', interestId: 'ai_ml' })]);
    setCurrentInterestId('hr_system');
    const counts = getEntityCounts();
    expect(counts.answer).toBe(0);
    expect(counts.all).toBe(0);
  });
});

describe('v3.39 T6 review fix — M-3 updateSearchSummary dual filter (분야 + 토큰)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.replaceChildren();
    resetArchiveHandlersForTest();
    setCurrentInterestId(null);
  });

  it("currentInterestId='ai_ml' + token search → 분야 + 토큰 dual 적용된 hit count", () => {
    saveAnswers([
      // ai_ml + token match: hit
      mkAnswer({ id: 'a-ml-hit', interestId: 'ai_ml', text: 'transformer 모델 답변' }),
      // ai_ml + token miss: not hit
      mkAnswer({ id: 'a-ml-miss', interestId: 'ai_ml', text: '다른 내용' }),
      // hr_system + token match (분야 다름, 토큰만 매치): 분야 필터로 제외
      mkAnswer({ id: 'a-hr-hit', interestId: 'hr_system', text: 'transformer 채용' }),
    ]);
    setupDom();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = 'transformer';

    setCurrentInterestId('ai_ml');
    handleArchiveSearch(); // currentTokens 갱신 + rerenderList

    // updateSearchSummary 결과 — summary slot 내부 hit count 검증.
    // renderArchiveSearchSummary는 hit count 0 이상 entity를 chip으로 표시.
    const summary = document.getElementById('archiveSearchSummary');
    expect(summary).not.toBeNull();
    const summaryText = summary?.textContent ?? '';
    // ai_ml + 'transformer' 매치는 1건만 (a-ml-hit) — a-hr-hit는 분야 필터로 제외.
    // hit count 텍스트 검증 — chip 내부 "1" 노출 가정 (renderArchiveSearchSummary 계약).
    expect(summaryText).toMatch(/1/);
    // 토큰만 매치하는 hr_system 카드는 list에도 미노출.
    const cards = document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]');
    const ids = [...cards].map((c) => c.dataset['answerId']);
    expect(ids).toContain('a-ml-hit');
    expect(ids).not.toContain('a-hr-hit');
  });

  it("currentInterestId=null + token search → 토큰만 적용 (분야 무관)", () => {
    saveAnswers([
      mkAnswer({ id: 'a-ml', interestId: 'ai_ml', text: 'transformer ml' }),
      mkAnswer({ id: 'a-hr', interestId: 'hr_system', text: 'transformer hr' }),
    ]);
    setupDom();
    const input = document.getElementById('archiveSearch') as HTMLInputElement;
    input.value = 'transformer';

    setCurrentInterestId(null);
    handleArchiveSearch();

    const cards = document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]');
    const ids = [...cards].map((c) => c.dataset['answerId']);
    expect(ids).toContain('a-ml');
    expect(ids).toContain('a-hr');
  });
});
