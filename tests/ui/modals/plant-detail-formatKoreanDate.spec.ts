import { describe, it, expect, afterEach, vi } from 'vitest';
import { formatKoreanDate } from '../../../src/ui/modals/plant-detail';

describe('formatKoreanDate — KST anchor (v3.22 T4 / P2-4)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('정상 ISO → "YYYY년 M월 D일" (KST 기준)', () => {
    // KST 2026-05-08T15:30 = UTC 2026-05-08T06:30
    expect(formatKoreanDate('2026-05-08T15:30:00+09:00')).toBe('2026년 5월 8일');
  });

  it('KST 자정 boundary — 머신 TZ 무관하게 KST date 반환', () => {
    // KST 2026-05-08T00:30 = UTC 2026-05-07T15:30 = NY 2026-05-07T11:30
    // 머신이 NY여도 KST 기준 2026-05-08
    expect(formatKoreanDate('2026-05-08T00:30:00+09:00')).toBe('2026년 5월 8일');
  });

  it('월/일 1자리 → leading zero 제거', () => {
    expect(formatKoreanDate('2026-01-05T12:00:00+09:00')).toBe('2026년 1월 5일');
  });
});
