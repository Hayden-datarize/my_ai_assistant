import { describe, it, expect } from 'vitest';
import { migrateAnswer, migrateUserSettings, migrateUnknown } from '../../src/state/migration';

describe('migration v0 → v1', () => {
  it('migrates legacy answer (no schemaVersion) to v1', () => {
    const legacy = { id: 'a1', questionId: 'q1', text: 'old', authorId: 'u1', createdAt: '2025-12-01T00:00:00Z' };
    const v1 = migrateAnswer(legacy);
    expect(v1.schemaVersion).toBe(1);
    expect(v1.id).toBe('a1');
    expect(v1.createdAt).toBe('2025-12-01T00:00:00Z');
  });
  it('passes through v1 answer unchanged (copy + pinned + interestId backfill, v3.28 T2 P0-3 idempotency / v3.39 T2 interestId)', () => {
    const already = { id: 'a1', questionId: 'q1', text: 'new', authorId: 'u1', createdAt: '2026-04-18T00:00:00Z', schemaVersion: 1 as const };
    // v3.28 T2 (P2-2): pass-through 분기도 copy + pinned 정규화 — 원본 mutation 없이 pinned 필드만 보강.
    // v3.39 T2: interestId 'unknown' default 백필 (Codex 사전 P1-1).
    expect(migrateAnswer(already)).toEqual({ ...already, pinned: false, interestId: 'unknown' });
    // P0-3 invariant: 원본 raw 객체는 mutate되지 않아야 한다.
    expect((already as { pinned?: boolean; interestId?: string }).pinned).toBeUndefined();
    expect((already as { pinned?: boolean; interestId?: string }).interestId).toBeUndefined();
  });
  it('migrates legacy user settings, defaulting optIns to {}', () => {
    const legacy = { userId: 'u1' };
    expect(migrateUserSettings(legacy)).toEqual({ userId: 'u1', optIns: {}, schemaVersion: 1 });
  });
  it('migrateUnknown stamps unknown shapes as v1 without losing fields', () => {
    expect(migrateUnknown({ foo: 'bar' })).toEqual({ foo: 'bar', schemaVersion: 1 });
  });
});

describe('migrateAnswer interestId backfill (v3.39 T2 — Codex 사전 P1-1)', () => {
  it('legacy Answer (interestId 부재) → "unknown" 백필', () => {
    const raw = {
      id: 'a_old', questionId: 'q', text: 'hi', authorId: 'self',
      createdAt: '2026-04-01T00:00:00Z', pinned: false, schemaVersion: 1,
    };
    const result = migrateAnswer(raw);
    expect(result.interestId).toBe('unknown');
  });
  it('이미 interestId 있는 Answer → 그대로 (idempotent value invariant)', () => {
    const raw = {
      id: 'a_new', questionId: 'q', text: 'hi', authorId: 'self',
      createdAt: '2026-05-19T00:00:00Z', pinned: false, schemaVersion: 1,
      interestId: 'ai_ml',
    };
    const result = migrateAnswer(raw);
    expect(result.interestId).toBe('ai_ml');
  });
  it('legacy v2.0 분기 (no schemaVersion, no interestId) → "unknown" 백필', () => {
    const legacy = { id: 'a1', questionId: 'q1', text: 'old', authorId: 'u1', createdAt: '2025-12-01T00:00:00Z' };
    const result = migrateAnswer(legacy);
    expect(result.interestId).toBe('unknown');
    expect(result.schemaVersion).toBe(1);
  });
  it('이중 migrate (이미 v1 + interestId="ai_ml") → idempotent same value', () => {
    const raw = {
      id: 'a1', questionId: 'q', text: 'hi', authorId: 'self',
      createdAt: '2026-05-19T00:00:00Z', pinned: true, schemaVersion: 1,
      interestId: 'ai_ml',
    };
    const once = migrateAnswer(raw);
    const twice = migrateAnswer(once);
    expect(twice.interestId).toBe('ai_ml');
    expect(twice.pinned).toBe(true);
  });
  it('원본 raw는 mutate되지 않는다 (P0-3 idempotency invariant)', () => {
    const raw: Record<string, unknown> = {
      id: 'a1', questionId: 'q', text: 'hi', authorId: 'self',
      createdAt: '2026-05-19T00:00:00Z', pinned: false, schemaVersion: 1,
    };
    migrateAnswer(raw);
    expect(raw.interestId).toBeUndefined();
  });
});

// v3.41 T2 fix (Codex 최종 P1-B): current-schema fast path도 evaluation normalize
describe('migrateAnswer current-schema evaluation normalize (v3.41 T2 fix)', () => {
  const baseAnswer = {
    id: 'a1', questionId: 'q', text: 'hi', authorId: 'self',
    createdAt: '2026-05-20T00:00:00Z', pinned: false, interestId: 'unknown',
    schemaVersion: 1,
  };

  it('current-schema branch에서도 string score → integer normalize', () => {
    const raw = { ...baseAnswer, evaluation: { score: '5', feedback: 'good' } };
    const result = migrateAnswer(raw);
    expect(result.evaluation).toEqual({ score: 5, feedback: 'good' });
  });

  it('current-schema branch에서 out-of-range score → fallback 3', () => {
    const raw = { ...baseAnswer, evaluation: { score: 99, feedback: 'x' } };
    const result = migrateAnswer(raw);
    expect(result.evaluation?.score).toBe(3);
  });

  it('current-schema branch에서 negative score → fallback 3', () => {
    const raw = { ...baseAnswer, evaluation: { score: -1, feedback: 'bad' } };
    const result = migrateAnswer(raw);
    expect(result.evaluation?.score).toBe(3);
  });

  it('current-schema branch에서 non-integer (소수) score → fallback 3', () => {
    const raw = { ...baseAnswer, evaluation: { score: 2.7, feedback: 'half' } };
    const result = migrateAnswer(raw);
    expect(result.evaluation?.score).toBe(3);
  });

  it('current-schema branch에서 feedback non-string → empty string', () => {
    const raw = { ...baseAnswer, evaluation: { score: 4, feedback: null } };
    const result = migrateAnswer(raw);
    expect(result.evaluation).toEqual({ score: 4, feedback: '' });
  });

  it('current-schema branch에서 evaluation 없으면 undefined 유지', () => {
    const raw = baseAnswer;
    const result = migrateAnswer(raw);
    expect(result.evaluation).toBeUndefined();
  });

  it('current-schema branch에서 valid evaluation은 그대로', () => {
    const raw = { ...baseAnswer, evaluation: { score: 3, feedback: 'ok' } };
    const result = migrateAnswer(raw);
    expect(result.evaluation).toEqual({ score: 3, feedback: 'ok' });
  });

  it('current-schema branch에서 evaluation이 non-object면 undefined로 drop', () => {
    const raw = { ...baseAnswer, evaluation: 'corrupt-string' as unknown };
    const result = migrateAnswer(raw);
    expect(result.evaluation).toBeUndefined();
  });
});
