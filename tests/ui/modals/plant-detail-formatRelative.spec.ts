import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelative } from '../../../src/ui/modals/plant-detail';

describe('formatRelative — 음수 ms / 정상 days / 경계 가드 (v3.22 T1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // KST 명시 instant — 2026-05-08 12:00 KST = 2026-05-08T03:00:00Z
    vi.setSystemTime(new Date('2026-05-08T12:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('미래 ISO (음수 ms) → "오늘"', () => {
    // 시계 역행 / 미래 데이터 → 음수 ms 가드 (v3.22 P2-1 fix)
    const futureIso = '2026-05-09T12:00:00+09:00'; // 24h 미래
    expect(formatRelative(futureIso)).toBe('오늘');
  });

  it('오늘 (0일) → "오늘"', () => {
    const todayIso = '2026-05-08T08:00:00+09:00'; // 4h 전
    expect(formatRelative(todayIso)).toBe('오늘');
  });

  it('어제 (1일) → "어제"', () => {
    const yesterdayIso = '2026-05-07T11:00:00+09:00'; // 25h 전
    expect(formatRelative(yesterdayIso)).toBe('어제');
  });

  it('5일 전 → "5일 전"', () => {
    const fiveDaysAgoIso = '2026-05-03T12:00:00+09:00';
    expect(formatRelative(fiveDaysAgoIso)).toBe('5일 전');
  });
});
