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
  it('passes through v1 answer unchanged (copy + pinned backfill, v3.28 T2 P0-3 idempotency)', () => {
    const already = { id: 'a1', questionId: 'q1', text: 'new', authorId: 'u1', createdAt: '2026-04-18T00:00:00Z', schemaVersion: 1 as const };
    // v3.28 T2 (P2-2): pass-through 분기도 copy + pinned 정규화 — 원본 mutation 없이 pinned 필드만 보강.
    expect(migrateAnswer(already)).toEqual({ ...already, pinned: false });
    // P0-3 invariant: 원본 raw 객체는 mutate되지 않아야 한다.
    expect((already as { pinned?: boolean }).pinned).toBeUndefined();
  });
  it('migrates legacy user settings, defaulting optIns to {}', () => {
    const legacy = { userId: 'u1' };
    expect(migrateUserSettings(legacy)).toEqual({ userId: 'u1', optIns: {}, schemaVersion: 1 });
  });
  it('migrateUnknown stamps unknown shapes as v1 without losing fields', () => {
    expect(migrateUnknown({ foo: 'bar' })).toEqual({ foo: 'bar', schemaVersion: 1 });
  });
});
