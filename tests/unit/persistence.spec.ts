import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAnswers,
  saveAnswers,
  loadUserSettings,
  saveUserSettings,
  appendAnswer,
  findAnswer,
  setAnswerEvaluation,
  aggregateAnswerStats,
} from '../../src/state/persistence';
import { makeAnswer } from '../../src/state/schema';

beforeEach(() => localStorage.clear());

describe('persistence — existing Phase B behaviour', () => {
  it('round-trips answers', () => {
    const answers = [{ id: 'a1', questionId: 'q1', text: 'hi', authorId: 'u1', createdAt: '2026-04-18T00:00:00Z', schemaVersion: 1 as const }];
    saveAnswers(answers);
    expect(loadAnswers()).toEqual(answers);
  });
  it('migrates Phase B answers stored without schemaVersion', () => {
    localStorage.setItem('dg.answers', JSON.stringify([{ id: 'a1', questionId: 'q1', text: 'old', authorId: 'u1', createdAt: '2025-12-01T00:00:00Z' }]));
    const loaded = loadAnswers();
    expect(loaded[0]?.schemaVersion).toBe(1);
  });
  it('returns empty array on missing key', () => {
    expect(loadAnswers()).toEqual([]);
  });
  it('returns default settings on missing key', () => {
    expect(loadUserSettings('u1')).toEqual({ userId: 'u1', optIns: {}, schemaVersion: 1 });
  });
  it('round-trips user settings', () => {
    const s = { userId: 'u1', optIns: { topicCloud: true }, schemaVersion: 1 as const };
    saveUserSettings(s);
    expect(loadUserSettings('u1')).toEqual(s);
  });
});

describe('persistence — Phase G-2 extensions', () => {
  it('appendAnswer prepends (most-recent first)', () => {
    const a1 = makeAnswer({ id: 'a1', questionId: 'q1', text: 'older', authorId: 'self' });
    const a2 = makeAnswer({ id: 'a2', questionId: 'q2', text: 'newer', authorId: 'self' });
    appendAnswer(a1);
    appendAnswer(a2);
    expect(loadAnswers()[0]?.id).toBe('a2');
  });

  it('findAnswer + setAnswerEvaluation', () => {
    const a = makeAnswer({ id: 'a1', questionId: 'q1', text: 'x', authorId: 'self' });
    appendAnswer(a);
    setAnswerEvaluation('a1', { score: 4, feedback: 'ok' });
    expect(findAnswer('a1')?.evaluation).toEqual({ score: 4, feedback: 'ok' });
  });

  it('aggregateAnswerStats picks weakest type among seen', () => {
    appendAnswer(makeAnswer({ id: '1', questionId: '', text: 'a', authorId: 'self', type: '분석' }));
    appendAnswer(makeAnswer({ id: '2', questionId: '', text: 'b', authorId: 'self', type: '분석' }));
    appendAnswer(makeAnswer({ id: '3', questionId: '', text: 'c', authorId: 'self', type: '실무' }));
    const s = aggregateAnswerStats();
    expect(s.total).toBe(3);
    expect(s.byType['분석']).toBe(2);
    expect(s.byType['실무']).toBe(1);
    expect(s.weakestType).toBe('실무');
  });
});

describe('persistence — legacy v2.0 answers auto-migration', () => {
  it('migrates legacy `answers` key to `dg.answers` on first load + deletes legacy', () => {
    const legacy = [
      { id: 'a1', date: '2026-04-18', questionId: 'q1', type: '분석', answer: '레거시 내용1', evaluation: { score: 4, feedback: 'ok' } },
      { id: 'a2', date: '2026-04-17', questionId: 'q2', type: '실무', answer: '레거시 내용2' },
    ];
    localStorage.setItem('answers', JSON.stringify(legacy));

    const loaded = loadAnswers();

    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.text).toBe('레거시 내용1');
    expect(loaded[0]?.type).toBe('분석');
    expect(loaded[0]?.evaluation).toEqual({ score: 4, feedback: 'ok' });
    expect(loaded[0]?.createdAt).toContain('2026-04-18');
    expect(loaded[0]?.schemaVersion).toBe(1);
    expect(loaded[0]?.authorId).toBe('self');

    expect(localStorage.getItem('answers')).toBeNull();
    expect(localStorage.getItem('dg.answers')).toBeTruthy();
  });

  it('prefers Phase B key when both exist (no double-migration)', () => {
    localStorage.setItem('answers', JSON.stringify([{ id: 'legacy', date: '2026-04-01', answer: 'legacy' }]));
    const phaseB = makeAnswer({ id: 'phaseB', questionId: '', text: 'phase B value', authorId: 'self' });
    saveAnswers([phaseB]);

    const loaded = loadAnswers();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('phaseB');
    expect(localStorage.getItem('answers')).toBeTruthy();
  });

  it('empty legacy → returns [] without writing dg.answers', () => {
    expect(loadAnswers()).toEqual([]);
    expect(localStorage.getItem('dg.answers')).toBeNull();
  });
});
