import { describe, it, expect, beforeEach } from 'vitest';
import { getTodayCount, checkAndIncrement } from '../../../src/state/usage';
import { getDateStr } from '../../../src/utils/dates';

describe('usage.count numeric guard (v3.14.4 T1)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('NaN count → 0으로 normalize (silent corruption 차단)', () => {
    const today = getDateStr();
    localStorage.setItem(
      'dg_translate_usage',
      JSON.stringify({ date: today, count: Number.NaN }),
    );
    expect(getTodayCount()).toBe(0);
  });

  it('Infinity count → 0으로 normalize', () => {
    const today = getDateStr();
    localStorage.setItem(
      'dg_translate_usage',
      `{"date":"${today}","count":1e9999}`,
    );
    expect(getTodayCount()).toBe(0);
  });

  it('정상 count round-trip 보존', () => {
    const today = getDateStr();
    localStorage.setItem(
      'dg_translate_usage',
      JSON.stringify({ date: today, count: 5 }),
    );
    expect(getTodayCount()).toBe(5);
    expect(checkAndIncrement()).toBe(true);
    expect(getTodayCount()).toBe(6);
  });
});
