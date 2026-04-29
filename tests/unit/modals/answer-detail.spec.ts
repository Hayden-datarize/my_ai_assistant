import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openAnswerDetail } from '../../../src/ui/modals/answer-detail';
import { closeModal } from '../../../src/ui/modals/shared';
import { makeAnswer } from '../../../src/state/schema';

describe('answer-detail modal (v3.11 T7)', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  afterEach(() => {
    closeModal();
  });

  it('renders question text + answer body', () => {
    const a = makeAnswer({
      id: 'a1',
      questionId: 'q1',
      text: 'full answer here',
      authorId: 'self',
      questionText: '오늘의 질문',
      type: '분석',
      date: '2026-04-28',
    });
    openAnswerDetail(a);
    expect(document.body.textContent).toContain('오늘의 질문');
    expect(document.body.textContent).toContain('full answer here');
  });

  it('shows "질문 정보 없음" for legacy answer (no questionText)', () => {
    const a = makeAnswer({
      id: 'a2',
      questionId: 'q2',
      text: 'legacy answer',
      authorId: 'self',
      type: '분석',
      date: '2026-04-28',
    });
    openAnswerDetail(a);
    expect(document.body.textContent).toContain('질문 정보 없음');
    expect(document.body.textContent).toContain('legacy answer');
  });

  it('renders evaluation feedback when present', () => {
    const a = makeAnswer({
      id: 'a3',
      questionId: 'q3',
      text: 'a',
      authorId: 'self',
      questionText: 'q',
      evaluation: { score: 8, feedback: 'great insight!' },
    });
    openAnswerDetail(a);
    expect(document.body.textContent).toContain('great insight!');
    expect(document.body.textContent).toContain('8점');
  });

  it('does not render evaluation marker (💡) when evaluation absent', () => {
    const a = makeAnswer({
      id: 'a4',
      questionId: 'q4',
      text: 'no eval here',
      authorId: 'self',
      questionText: 'q',
    });
    openAnswerDetail(a);
    expect(document.body.textContent).not.toContain('💡');
  });

  it('omits "점" suffix when evaluation has feedback but no numeric score', () => {
    const a = makeAnswer({
      id: 'a5',
      questionId: 'q5',
      text: 'a',
      authorId: 'self',
      questionText: 'q',
      // 런타임 edge case: 과거 데이터에 score 누락 가능. 타입은 number 강제이므로 cast.
      evaluation: { feedback: 'good without score' } as unknown as {
        score: number;
        feedback: string;
      },
    });
    openAnswerDetail(a);
    expect(document.body.textContent).toContain('good without score');
    expect(document.body.textContent).not.toContain('점');
  });
});
