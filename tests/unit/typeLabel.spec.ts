import { describe, it, expect } from 'vitest';
import { toKoType } from '../../src/utils/typeLabel';

describe('toKoType', () => {
  it('maps known English types to Korean', () => {
    expect(toKoType('reflection')).toBe('성찰');
    expect(toKoType('action')).toBe('실행');
    expect(toKoType('observation')).toBe('관찰');
    expect(toKoType('planning')).toBe('계획');
  });
  it('returns "기타" for undefined or empty input', () => {
    expect(toKoType(undefined)).toBe('기타');
    expect(toKoType('')).toBe('기타');
  });
  it('passes unknown types through unchanged', () => {
    expect(toKoType('foo')).toBe('foo');
    expect(toKoType('성찰')).toBe('성찰');
  });
});
