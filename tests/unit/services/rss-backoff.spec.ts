import { describe, it, expect } from 'vitest';
import { computeBackoffDelay } from '../../../src/services/rss';

// v3.20 T6 (B2): 보수적 시드 [500, 1500] + jitter ±20%.
// 외부 API 부담 ↓ + 429/503 회복력 ↑. timeout 5s 내 3 attempt 보장.

describe('v3.20 T6: computeBackoffDelay', () => {
  it('attempt 0 base = 500ms, range [400, 600] (jitter ±20%)', () => {
    // Math.random() = 0 → jitter = -20% (최저)
    expect(computeBackoffDelay(0, () => 0)).toBe(400);
    // Math.random() = 1 → jitter = +20% (최고)
    expect(computeBackoffDelay(0, () => 1)).toBe(600);
    // Math.random() = 0.5 → jitter = 0 (중앙)
    expect(computeBackoffDelay(0, () => 0.5)).toBe(500);
  });

  it('attempt 1 base = 1500ms, range [1200, 1800]', () => {
    expect(computeBackoffDelay(1, () => 0)).toBe(1200);
    expect(computeBackoffDelay(1, () => 1)).toBe(1800);
    expect(computeBackoffDelay(1, () => 0.5)).toBe(1500);
  });

  it('attempt out-of-range falls back to 1500ms ±20% (defensive default)', () => {
    expect(computeBackoffDelay(99, () => 0.5)).toBe(1500);
  });

  it('returned delay is never negative', () => {
    // jitter ratio 0.2 < 1 → base + jitter > 0 always. Math.max(0, ...) defensive.
    for (let i = 0; i < 100; i++) {
      expect(computeBackoffDelay(0)).toBeGreaterThanOrEqual(0);
      expect(computeBackoffDelay(1)).toBeGreaterThanOrEqual(0);
    }
  });

  it('5s timeout budget 충족 — 최악(jitter +20%) 누적 < 5000ms', () => {
    // attempt 0 max 600 + attempt 1 max 1800 = 2400ms. 5s 내 3 attempt 가능.
    // 실제 fetch latency 200~500ms 추가 고려해도 2400 + 1500 = 3900 < 5000.
    const max0 = computeBackoffDelay(0, () => 1);
    const max1 = computeBackoffDelay(1, () => 1);
    expect(max0 + max1).toBeLessThan(5000);
  });
});
