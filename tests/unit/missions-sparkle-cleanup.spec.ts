import { describe, it, expect, beforeEach } from 'vitest';
import {
  mountMissionsSparkleListener,
  consumeSparkleQueue,
  __resetSparkleState,
} from '../../src/ui/missions-sparkle';
import { dispatch } from '../../src/ui/events';

describe('mountMissionsSparkleListener cleanup symmetry', () => {
  beforeEach(() => {
    __resetSparkleState();
  });

  it('returns a cleanup function that detaches the listener', () => {
    const cleanup = mountMissionsSparkleListener();
    expect(typeof cleanup).toBe('function');

    dispatch('dg:reward:mission-complete', {
      defId: 'before-cleanup',
      period: 'daily',
      rewardXp: 10,
      at: Date.now(),
    });
    expect(consumeSparkleQueue().has('before-cleanup')).toBe(true);

    cleanup();

    dispatch('dg:reward:mission-complete', {
      defId: 'after-cleanup',
      period: 'daily',
      rewardXp: 10,
      at: Date.now(),
    });
    expect(consumeSparkleQueue().has('after-cleanup')).toBe(false);
  });

  it('idempotent: second mount returns no-op cleanup (only first cleanup detaches)', () => {
    const first = mountMissionsSparkleListener();
    const second = mountMissionsSparkleListener();

    expect(typeof first).toBe('function');
    expect(typeof second).toBe('function');
    second();   // no-op

    dispatch('dg:reward:mission-complete', {
      defId: 'after-no-op',
      period: 'daily',
      rewardXp: 10,
      at: Date.now(),
    });
    expect(consumeSparkleQueue().has('after-no-op')).toBe(true);

    first();    // 실제 detach
    dispatch('dg:reward:mission-complete', {
      defId: 'after-real-cleanup',
      period: 'daily',
      rewardXp: 10,
      at: Date.now(),
    });
    expect(consumeSparkleQueue().has('after-real-cleanup')).toBe(false);
  });

  it('stale cleanup after remount does not detach the new listener', () => {
    // Codex P1-4: local disposer capture + cleaned guard 검증.
    const firstCleanup = mountMissionsSparkleListener();
    firstCleanup();  // 첫 listener detach

    const secondCleanup = mountMissionsSparkleListener();  // 새 listener wire
    firstCleanup();  // stale cleanup 재호출 — 새 listener 떼면 안 됨

    dispatch('dg:reward:mission-complete', {
      defId: 'after-stale-cleanup',
      period: 'daily',
      rewardXp: 10,
      at: Date.now(),
    });
    expect(consumeSparkleQueue().has('after-stale-cleanup')).toBe(true);

    secondCleanup();
  });

  it('double cleanup() is safe (no throw)', () => {
    const cleanup = mountMissionsSparkleListener();
    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
  });
});
