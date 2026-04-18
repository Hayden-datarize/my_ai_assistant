import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION, makeAnswer, makeUserSettings, isVersioned } from '../../src/state/schema';

describe('schema', () => {
  it('CURRENT_SCHEMA_VERSION is 1', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
  it('makeAnswer attaches schemaVersion=1 and createdAt ISO', () => {
    const a = makeAnswer({ id: 'a1', questionId: 'q1', text: 'hello', authorId: 'u1' });
    expect(a.schemaVersion).toBe(1);
    expect(a.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(a.text).toBe('hello');
  });
  it('makeUserSettings attaches schemaVersion=1', () => {
    const s = makeUserSettings({ userId: 'u1' });
    expect(s.schemaVersion).toBe(1);
    expect(s.optIns).toEqual({});
  });
  it('isVersioned narrows correctly', () => {
    expect(isVersioned({ schemaVersion: 1 })).toBe(true);
    expect(isVersioned({})).toBe(false);
    expect(isVersioned(null)).toBe(false);
  });
});
