import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStatsCache,
  setStatsCache,
  clearStatsCache,
  type StatsFingerprint,
} from '../../../src/utils/statsCache';

const fp: StatsFingerprint = {
  totalAnswers: 10,
  longestStreak: 5,
  byInterestTopKey: '커리어',
  byInterestTopCount: 6,
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  // KST 2026-05-08 18:00 (T09:00:00Z → KST +9 → 18:00 same day)
  vi.setSystemTime(new Date('2026-05-08T09:00:00Z'));
});

describe('statsCache', () => {
  it('miss: 캐시 없을 때 null', () => {
    expect(getStatsCache(7, fp)).toBeNull();
  });

  it('hit: 같은 KST date + range + 4 fingerprint 일치 시 entry 반환', () => {
    setStatsCache(7, fp, { highlight: '이번 주 10개' });
    expect(getStatsCache(7, fp)?.highlight).toBe('이번 주 10개');
  });

  it('mismatch: totalAnswers 다르면 null', () => {
    setStatsCache(7, fp, { highlight: 'old' });
    expect(getStatsCache(7, { ...fp, totalAnswers: 11 })).toBeNull();
  });

  it('mismatch: longestStreak 다르면 null', () => {
    setStatsCache(7, fp, { highlight: 'old' });
    expect(getStatsCache(7, { ...fp, longestStreak: 6 })).toBeNull();
  });

  // codex P1-4 fix 검증
  it('mismatch: byInterestTopKey 다르면 null (P1-4 narrative invalidation)', () => {
    setStatsCache(7, fp, { highlight: 'old' });
    expect(getStatsCache(7, { ...fp, byInterestTopKey: '건강' })).toBeNull();
  });

  it('mismatch: byInterestTopCount 다르면 null (P1-4 narrative invalidation)', () => {
    setStatsCache(7, fp, { highlight: 'old' });
    expect(getStatsCache(7, { ...fp, byInterestTopCount: 7 })).toBeNull();
  });

  it('range 다르면 null', () => {
    setStatsCache(7, fp, { highlight: 'r7' });
    expect(getStatsCache(30, fp)).toBeNull();
  });

  it('cleanup: setStatsCache 시 다른 KST date prefix 키 일괄 삭제, unrelated 키 보존', () => {
    localStorage.setItem('dg.statsCache.2026-05-07.7', 'old1');
    localStorage.setItem('dg.statsCache.2026-05-06.30', 'old2');
    localStorage.setItem('dg.unrelated.key', 'keep');
    setStatsCache(7, fp, { highlight: 'new' });
    expect(localStorage.getItem('dg.statsCache.2026-05-07.7')).toBeNull();
    expect(localStorage.getItem('dg.statsCache.2026-05-06.30')).toBeNull();
    expect(localStorage.getItem('dg.unrelated.key')).toBe('keep');
  });

  it('range=30 narrative 저장 및 조회', () => {
    setStatsCache(30, fp, { narrative: '지난 30일' });
    expect(getStatsCache(30, fp)?.narrative).toBe('지난 30일');
  });

  it('clearStatsCache: 모든 prefix 키 삭제', () => {
    setStatsCache(7, fp, { highlight: 'a' });
    setStatsCache(30, fp, { narrative: 'b' });
    clearStatsCache();
    expect(getStatsCache(7, fp)).toBeNull();
    expect(getStatsCache(30, fp)).toBeNull();
  });

  it('JSON parse 실패 시 null 반환', () => {
    localStorage.setItem('dg.statsCache.2026-05-08.7', '{invalid json');
    expect(getStatsCache(7, fp)).toBeNull();
  });
});
