import { describe, it, expect, beforeEach } from 'vitest';
import { loadAnswers, saveAnswers, loadUserSettings, saveUserSettings } from '../../src/state/persistence';

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('round-trips answers', () => {
    const answers = [{ id: 'a1', questionId: 'q1', text: 'hi', authorId: 'u1', createdAt: '2026-04-18T00:00:00Z', schemaVersion: 1 as const }];
    saveAnswers(answers);
    expect(loadAnswers()).toEqual(answers);
  });
  it('migrates legacy answers stored without schemaVersion', () => {
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
