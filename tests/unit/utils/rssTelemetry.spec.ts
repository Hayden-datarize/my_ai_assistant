import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordRetry,
  getRetryStats,
  __resetForTest,
} from '../../../src/utils/rssTelemetry';

describe('v3.20 T5: rssTelemetry — 24h rolling counter', () => {
  beforeEach(() => {
    __resetForTest();
  });

  it('first recordRetry initializes window with since/count=1/byStatus', () => {
    const now = 1_700_000_000_000;
    recordRetry(429, now);
    const stats = getRetryStats(now);
    expect(stats?.count).toBe(1);
    expect(stats?.byStatus['429']).toBe(1);
    expect(stats?.since).toBe(new Date(now).toISOString());
  });

  it('subsequent recordRetry within 24h increments count + byStatus', () => {
    const t0 = 1_700_000_000_000;
    recordRetry(429, t0);
    recordRetry(503, t0 + 60_000); // +1분
    recordRetry(429, t0 + 120_000); // +2분
    const stats = getRetryStats(t0 + 120_000);
    expect(stats?.count).toBe(3);
    expect(stats?.byStatus['429']).toBe(2);
    expect(stats?.byStatus['503']).toBe(1);
  });

  it('recordRetry after 24h+ resets the window', () => {
    const t0 = 1_700_000_000_000;
    recordRetry(429, t0);
    const after24h = t0 + 24 * 60 * 60 * 1000 + 1;
    recordRetry(503, after24h);
    const stats = getRetryStats(after24h);
    expect(stats?.count).toBe(1);
    expect(stats?.byStatus['503']).toBe(1);
    expect(stats?.byStatus['429']).toBeUndefined();
    expect(stats?.since).toBe(new Date(after24h).toISOString());
  });

  it('getRetryStats returns null when window expired (now query)', () => {
    recordRetry(429, Date.now() - 25 * 60 * 60 * 1000); // 25h ago
    const stats = getRetryStats();
    expect(stats).toBeNull();
  });

  it('getRetryStats returns null when no record exists', () => {
    expect(getRetryStats()).toBeNull();
  });
});
