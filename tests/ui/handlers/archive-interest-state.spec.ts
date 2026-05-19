/**
 * @vitest-environment jsdom
 *
 * v3.39 T6 (Codex P0-2): archive currentInterestId state + entityMatchesInterest single predicate.
 *
 * - currentInterestId 모듈 scope state (default null = '전체')
 * - setCurrentInterestId(id | null) — validateInterestId 통과 의무 + rerenderList trigger
 * - applyInterestFilter(id) — setCurrentInterestId + search input reset (plant-detail/insight-detail nav 진입점)
 * - getCurrentInterestId() — read-only
 * - entityMatchesInterest(entity, id) — exact match 1순위 + 'unknown' legacy + matchesInterest fallback
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setCurrentInterestId,
  getCurrentInterestId,
  applyInterestFilter,
  entityMatchesInterest,
  resetArchiveHandlersForTest,
} from '../../../src/ui/handlers/archive';
import type { Answer } from '../../../src/state/schema';
import type { Briefing } from '../../../src/state/briefings';
import type { Insight } from '../../../src/state/user';

const mkAnswer = (overrides: Partial<Answer> = {}): Answer => ({
  schemaVersion: 1,
  id: overrides.id ?? 'a1',
  questionId: 'q1',
  text: overrides.text ?? 'sample answer',
  authorId: 'self',
  createdAt: overrides.createdAt ?? '2026-05-19T09:00:00Z',
  pinned: false,
  interestId: 'unknown',
  ...overrides,
});

const mkBriefing = (overrides: Partial<Briefing> = {}): Briefing => ({
  id: overrides.id ?? 'b1',
  date: '2026-05-19',
  url: 'https://example.com/',
  title: overrides.title ?? '브리핑 제목',
  summary: overrides.summary ?? '브리핑 요약',
  scrapped: true,
  read: false,
  memo: '',
  pinned: false,
  interestId: 'unknown',
  ...overrides,
});

const mkInsight = (overrides: Partial<Insight> = {}): Insight => ({
  id: overrides.id ?? 'i1',
  text: overrides.text ?? '인사이트 텍스트',
  interestId: 'unknown',
  createdAt: '2026-05-19T09:00:00Z',
  pinned: false,
  ...overrides,
});

describe('currentInterestId state (v3.39 T6 — Codex P0-2)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    resetArchiveHandlersForTest();
    // 매 spec 시작 시 state 초기화 — module 캐시 공유 회피.
    setCurrentInterestId(null);
  });

  it('초기 state는 null (전체)', () => {
    expect(getCurrentInterestId()).toBe(null);
  });

  it('setCurrentInterestId(valid id) → 저장', () => {
    setCurrentInterestId('ai_ml');
    expect(getCurrentInterestId()).toBe('ai_ml');
  });

  it('setCurrentInterestId(null) → null 유지 (전체 진입)', () => {
    setCurrentInterestId('ai_ml');
    setCurrentInterestId(null);
    expect(getCurrentInterestId()).toBe(null);
  });

  it('setCurrentInterestId(invalid id) → null로 정정 + warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setCurrentInterestId('fake_id');
    expect(getCurrentInterestId()).toBe(null);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('applyInterestFilter (v3.39 T6 — Codex P0-2)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    resetArchiveHandlersForTest();
    setCurrentInterestId(null);
  });

  it('search input + currentInterestId 동시 적용', () => {
    const input = document.createElement('input');
    input.id = 'archiveSearch';
    input.value = '이전 검색어';
    document.body.appendChild(input);

    applyInterestFilter('ai_ml');

    expect(getCurrentInterestId()).toBe('ai_ml');
    expect((document.getElementById('archiveSearch') as HTMLInputElement).value).toBe('');
  });

  it('search input 없을 때도 currentInterestId 적용', () => {
    applyInterestFilter('hr_system');
    expect(getCurrentInterestId()).toBe('hr_system');
  });
});

describe('entityMatchesInterest (v3.39 T6 — Codex P0-2)', () => {
  it('null id (전체) → 모든 entity true', () => {
    const a = mkAnswer({ interestId: 'ai_ml' });
    const b = mkBriefing({ interestId: 'unknown' });
    const i = mkInsight({ interestId: 'hr_system' });
    expect(entityMatchesInterest(a, null)).toBe(true);
    expect(entityMatchesInterest(b, null)).toBe(true);
    expect(entityMatchesInterest(i, null)).toBe(true);
  });

  it('Answer exact match', () => {
    const a = mkAnswer({ interestId: 'ai_ml' });
    expect(entityMatchesInterest(a, 'ai_ml')).toBe(true);
    expect(entityMatchesInterest(a, 'hr_system')).toBe(false);
  });

  it("Answer legacy 'unknown' + text matchesInterest fallback", () => {
    const a = mkAnswer({ interestId: 'unknown', text: 'AI 모델 학습에 대한 답변' });
    // 'AI', '학습' 등 ai_ml 키워드 매칭 기대
    expect(entityMatchesInterest(a, 'ai_ml')).toBe(true);
  });

  it("Answer 'unknown' + text 무관 분야 → false", () => {
    const a = mkAnswer({ interestId: 'unknown', text: '오늘 점심 뭐 먹지' });
    expect(entityMatchesInterest(a, 'ai_ml')).toBe(false);
  });

  it("Briefing exact match", () => {
    const b = mkBriefing({ interestId: 'hr_system' });
    expect(entityMatchesInterest(b, 'hr_system')).toBe(true);
    expect(entityMatchesInterest(b, 'ai_ml')).toBe(false);
  });

  it("Briefing legacy 'unknown' + title/summary fallback", () => {
    const b = mkBriefing({ interestId: 'unknown', title: 'AI/ML 동향', summary: '머신러닝 최신' });
    expect(entityMatchesInterest(b, 'ai_ml')).toBe(true);
  });

  it("Insight exact match", () => {
    const i = mkInsight({ interestId: 'ai_ml' });
    expect(entityMatchesInterest(i, 'ai_ml')).toBe(true);
    expect(entityMatchesInterest(i, 'hr_system')).toBe(false);
  });

  it("Insight 'unknown' + text fallback", () => {
    const i = mkInsight({ interestId: 'unknown', text: '리더십에 대한 통찰' });
    expect(entityMatchesInterest(i, 'leadership')).toBe(true);
  });
});
