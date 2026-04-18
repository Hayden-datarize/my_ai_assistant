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
  it('passes through v1 answer unchanged', () => {
    const already = { id: 'a1', questionId: 'q1', text: 'new', authorId: 'u1', createdAt: '2026-04-18T00:00:00Z', schemaVersion: 1 as const };
    expect(migrateAnswer(already)).toEqual(already);
  });
  it('migrates legacy user settings, defaulting optIns to {}', () => {
    const legacy = { userId: 'u1' };
    expect(migrateUserSettings(legacy)).toEqual({ userId: 'u1', optIns: {}, schemaVersion: 1 });
  });
  it('migrateUnknown stamps unknown shapes as v1 without losing fields', () => {
    expect(migrateUnknown({ foo: 'bar' })).toEqual({ foo: 'bar', schemaVersion: 1 });
  });
});
