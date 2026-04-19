import { describe, it, expect, beforeEach } from 'vitest';
import { saveAnswer, listAnswers, findAnswer, setAnswerEvaluation, aggregateStats } from '../../src/state/answers';

describe('state/answers', () => {
  beforeEach(() => localStorage.clear());

  it('saveAnswer persists and returns id', () => {
    const id = saveAnswer({ date: '2026-04-19', questionId: 'q1', type: 'reflection', answer: 'text' });
    expect(id).toBeTruthy();
    expect(listAnswers()).toHaveLength(1);
  });

  it('setAnswerEvaluation attaches score/feedback', () => {
    const id = saveAnswer({ date: '2026-04-19', questionId: 'q1', type: 'reflection', answer: 'text' });
    setAnswerEvaluation(id, { score: 4, feedback: 'ok' });
    expect(findAnswer(id)?.evaluation).toEqual({ score: 4, feedback: 'ok' });
  });

  it('aggregateStats returns totals + weak-type pick', () => {
    saveAnswer({ date: '2026-04-19', questionId: 'q1', type: 'reflection', answer: 'a' });
    saveAnswer({ date: '2026-04-18', questionId: 'q2', type: 'action', answer: 'b' });
    saveAnswer({ date: '2026-04-17', questionId: 'q3', type: 'reflection', answer: 'c' });
    const s = aggregateStats();
    expect(s.total).toBe(3);
    expect(s.byType.reflection).toBe(2);
    expect(s.weakestType).toBe('action');
  });

  it('listAnswers returns most-recent first', () => {
    const id1 = saveAnswer({ date: '2026-04-18', questionId: 'q1', type: 'reflection', answer: 'older' });
    const id2 = saveAnswer({ date: '2026-04-19', questionId: 'q2', type: 'action', answer: 'newer' });
    const list = listAnswers();
    expect(list[0]?.id).toBe(id2);
    expect(list[1]?.id).toBe(id1);
  });
});
