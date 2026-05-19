import { describe, it, expect, beforeEach } from 'vitest';
import { getAnswerCountByInterest, getScrapCountByInterest } from '../../src/utils/interestCounts';
import { saveAnswers } from '../../src/state/persistence';
import { saveBriefings } from '../../src/state/briefings';
import type { Answer } from '../../src/state/schema';
import type { Briefing } from '../../src/state/briefings';

describe('interestCounts', () => {
  beforeEach(() => localStorage.clear());

  it('Answer text에 키워드 포함 시 count', () => {
    saveAnswers([
      { id: '1', text: '리더십에 대한 답변', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z', pinned: false, interestId: 'unknown' },
      { id: '2', text: 'AI/ML 관련', schemaVersion: 1, questionId: 'q2', authorId: 'self', createdAt: '2026-05-08T00:00:00Z', pinned: false, interestId: 'unknown' },
    ] satisfies Answer[]);
    expect(getAnswerCountByInterest('leadership')).toBeGreaterThan(0);
    expect(getAnswerCountByInterest('ai_ml')).toBeGreaterThan(0);
  });

  it('Briefing scrapped + 키워드 포함 시 count', () => {
    saveBriefings([
      { id: 'b1', date: '2026-05-08', url: 'https://x.com/1', title: '리더십 trend', summary: 'leadership tips', scrapped: true, read: false, memo: '', pinned: false, interestId: 'unknown' },
      { id: 'b2', date: '2026-05-08', url: 'https://x.com/2', title: 'AI news', summary: 'machine learning', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown' },
    ] satisfies Briefing[]);
    expect(getScrapCountByInterest('leadership')).toBe(1);
    expect(getScrapCountByInterest('ai_ml')).toBe(0);  // not scrapped
  });

  it('0건 — 빈 storage', () => {
    expect(getAnswerCountByInterest('leadership')).toBe(0);
    expect(getScrapCountByInterest('leadership')).toBe(0);
  });

  it('다중 interest 매칭 — 둘 다 count', () => {
    saveAnswers([
      { id: '1', text: '리더십과 AI를 둘 다 다룬 답변', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z', pinned: false, interestId: 'unknown' },
    ] satisfies Answer[]);
    expect(getAnswerCountByInterest('leadership')).toBe(1);
    expect(getAnswerCountByInterest('ai_ml')).toBe(1);
  });

  it('사용자 정의 분야 (interestKeywords 빈 배열) → count 0', () => {
    saveAnswers([
      { id: '1', text: '리더십', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z', pinned: false, interestId: 'unknown' },
    ] satisfies Answer[]);
    expect(getAnswerCountByInterest('user_custom_interest')).toBe(0);
  });

  describe('v3.22 T3 — INTERESTS.find guard (P2-3)', () => {
    it('catalog 외 id가 답변 텍스트에 우연 매칭되어도 count 0', () => {
      // text에 'leadership_v2' 우연 포함 — guard 없으면 keywords=['leadership_v2']로 매칭 가능
      saveAnswers([
        { id: '1', text: 'leadership_v2 spec 검토', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z', pinned: false, interestId: 'unknown' },
      ] satisfies Answer[]);
      expect(getAnswerCountByInterest('leadership_v2')).toBe(0);
    });

    it('catalog 외 id 스크랩 — title/summary 매칭되어도 count 0', () => {
      saveBriefings([
        { id: 'b1', date: '2026-05-08', url: 'https://x.com/1', title: 'custom_topic 동향', summary: 'custom_topic update', scrapped: true, read: false, memo: '', pinned: false, interestId: 'unknown' },
      ] satisfies Briefing[]);
      expect(getScrapCountByInterest('custom_topic')).toBe(0);
    });
  });

  describe('v3.39 T6 (Codex P1-3) — exact match + legacy unknown fallback', () => {
    it('Answer exact match (interestId === id) → text 무관 count', () => {
      saveAnswers([
        // text는 ai_ml 키워드 0건이지만 interestId 'ai_ml' → exact 매칭
        { id: '1', text: '오늘 점심 메뉴 고민', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z', pinned: false, interestId: 'ai_ml' },
      ] satisfies Answer[]);
      expect(getAnswerCountByInterest('ai_ml')).toBe(1);
    });

    it('Answer exact match — 다른 분야 id 매칭 0', () => {
      saveAnswers([
        { id: '1', text: 'AI 모델 학습', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z', pinned: false, interestId: 'hr_system' },
      ] satisfies Answer[]);
      // interestId가 hr_system이지만 ai_ml로 카운트 요청 → 0 (exact + 'unknown' 모두 fail)
      expect(getAnswerCountByInterest('ai_ml')).toBe(0);
      expect(getAnswerCountByInterest('hr_system')).toBe(1);
    });

    it("Answer 'unknown' + text fallback (legacy)", () => {
      saveAnswers([
        { id: '1', text: '리더십에 대한 답변', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z', pinned: false, interestId: 'unknown' },
      ] satisfies Answer[]);
      expect(getAnswerCountByInterest('leadership')).toBe(1);
    });

    it('Briefing exact match (interestId === id) → title/summary 무관 count', () => {
      saveBriefings([
        { id: 'b1', date: '2026-05-08', url: 'https://x.com/1', title: '오늘 날씨', summary: '맑음', scrapped: true, read: false, memo: '', pinned: false, interestId: 'ai_ml' },
      ] satisfies Briefing[]);
      expect(getScrapCountByInterest('ai_ml')).toBe(1);
    });

    it("Briefing 'unknown' + title/summary/memo fallback", () => {
      saveBriefings([
        { id: 'b1', date: '2026-05-08', url: 'https://x.com/1', title: '리더십 동향', summary: '리더의 자질', scrapped: true, read: false, memo: '', pinned: false, interestId: 'unknown' },
      ] satisfies Briefing[]);
      expect(getScrapCountByInterest('leadership')).toBe(1);
    });

    it("Briefing exact 다른 분야 → 카운트 0 (legacy fallback 차단)", () => {
      saveBriefings([
        // title='리더십'이지만 interestId='ai_ml' → exact 'ai_ml' 매칭만, leadership은 0.
        { id: 'b1', date: '2026-05-08', url: 'https://x.com/1', title: '리더십 동향', summary: '...', scrapped: true, read: false, memo: '', pinned: false, interestId: 'ai_ml' },
      ] satisfies Briefing[]);
      expect(getScrapCountByInterest('leadership')).toBe(0);
      expect(getScrapCountByInterest('ai_ml')).toBe(1);
    });
  });
});
