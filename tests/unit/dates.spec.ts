import { describe, it, expect } from 'vitest';
import { getDateStr } from '../../src/utils/dates';

describe('getDateStr', () => {
  it('returns YYYY-MM-DD for given Date', () => {
    expect(getDateStr(new Date('2026-04-19T15:30:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('pads single-digit month and day', () => {
    expect(getDateStr(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
  it('defaults to today when no arg', () => {
    expect(getDateStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
