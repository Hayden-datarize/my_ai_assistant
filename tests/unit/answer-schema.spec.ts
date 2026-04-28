import { describe, it, expect } from 'vitest';
import { makeAnswer, type Answer } from '../../src/state/schema';

describe('Answer.questionText optional', () => {
  it('makeAnswer accepts and persists questionText field', () => {
    const a: Answer = makeAnswer({
      id: 'a1',
      questionId: 'q1',
      text: 'my answer',
      authorId: 'self',
      questionText: '오늘의 채용 미스매치 원인은?',
      type: '분석',
      date: '2026-04-28',
    });
    expect(a.questionText).toBe('오늘의 채용 미스매치 원인은?');
    expect(a.schemaVersion).toBe(1);
  });

  it('makeAnswer omits questionText when not provided (graceful for legacy)', () => {
    const a: Answer = makeAnswer({
      id: 'a2',
      questionId: 'q2',
      text: 'old answer',
      authorId: 'self',
    });
    expect(a.questionText).toBeUndefined();
  });
});
