import { describe, it, expect, beforeEach } from 'vitest';
import { getAnswerCountByInterest, getScrapCountByInterest } from '../../src/utils/interestCounts';
import { saveAnswers } from '../../src/state/persistence';
import { saveBriefings } from '../../src/state/briefings';

describe('interestCounts', () => {
  beforeEach(() => localStorage.clear());

  it('Answer text에 키워드 포함 시 count', () => {
    saveAnswers([
      { id: '1', text: '리더십에 대한 답변', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z' },
      { id: '2', text: 'AI/ML 관련', schemaVersion: 1, questionId: 'q2', authorId: 'self', createdAt: '2026-05-08T00:00:00Z' },
    ] as any);
    expect(getAnswerCountByInterest('leadership')).toBeGreaterThan(0);
    expect(getAnswerCountByInterest('ai_ml')).toBeGreaterThan(0);
  });

  it('Briefing scrapped + 키워드 포함 시 count', () => {
    saveBriefings([
      { id: 'b1', date: '2026-05-08', url: 'https://x.com/1', title: '리더십 trend', summary: 'leadership tips', scrapped: true, read: false, memo: '' },
      { id: 'b2', date: '2026-05-08', url: 'https://x.com/2', title: 'AI news', summary: 'machine learning', scrapped: false, read: false, memo: '' },
    ] as any);
    expect(getScrapCountByInterest('leadership')).toBe(1);
    expect(getScrapCountByInterest('ai_ml')).toBe(0);  // not scrapped
  });

  it('0건 — 빈 storage', () => {
    expect(getAnswerCountByInterest('leadership')).toBe(0);
    expect(getScrapCountByInterest('leadership')).toBe(0);
  });

  it('다중 interest 매칭 — 둘 다 count', () => {
    saveAnswers([
      { id: '1', text: '리더십과 AI를 둘 다 다룬 답변', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z' },
    ] as any);
    expect(getAnswerCountByInterest('leadership')).toBe(1);
    expect(getAnswerCountByInterest('ai_ml')).toBe(1);
  });

  it('사용자 정의 분야 (interestKeywords 빈 배열) → count 0', () => {
    saveAnswers([
      { id: '1', text: '리더십', schemaVersion: 1, questionId: 'q1', authorId: 'self', createdAt: '2026-05-08T00:00:00Z' },
    ] as any);
    expect(getAnswerCountByInterest('user_custom_interest')).toBe(0);
  });
});
