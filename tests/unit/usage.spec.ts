import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCap, setCap, getTodayCount, checkAndIncrement, resetForTest,
} from '../../src/state/usage';

describe('translate usage counter', () => {
  beforeEach(() => {
    localStorage.clear();
    resetForTest();
    vi.setSystemTime(new Date('2026-04-26T10:00:00Z'));
  });

  it('default cap is 100', () => {
    expect(getCap()).toBe(100);
  });

  it('persists cap to localStorage', () => {
    setCap(200);
    expect(getCap()).toBe(200);
    expect(localStorage.getItem('dg_translate_cap')).toBe('200');
  });

  it('clamps cap to [30, 500] range', () => {
    setCap(10); expect(getCap()).toBe(30);
    setCap(1000); expect(getCap()).toBe(500);
  });

  it('starts with count 0', () => {
    expect(getTodayCount()).toBe(0);
  });

  it('increments and persists', () => {
    expect(checkAndIncrement()).toBe(true);
    expect(getTodayCount()).toBe(1);
    expect(checkAndIncrement()).toBe(true);
    expect(getTodayCount()).toBe(2);
  });

  it('returns false when cap reached', () => {
    setCap(30);
    for (let i = 0; i < 30; i++) expect(checkAndIncrement()).toBe(true);
    expect(checkAndIncrement()).toBe(false);
    expect(getTodayCount()).toBe(30);
  });

  it('resets count at midnight (date change)', () => {
    expect(checkAndIncrement()).toBe(true);
    expect(getTodayCount()).toBe(1);
    vi.setSystemTime(new Date('2026-04-27T00:01:00Z'));
    expect(getTodayCount()).toBe(0);
    expect(checkAndIncrement()).toBe(true);
    expect(getTodayCount()).toBe(1);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('dg_translate_usage', 'not-json');
    expect(getTodayCount()).toBe(0);
    expect(checkAndIncrement()).toBe(true);
  });
});
