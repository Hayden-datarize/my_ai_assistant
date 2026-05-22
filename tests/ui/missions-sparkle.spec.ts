import { describe, it, expect, beforeEach } from 'vitest';
import { dispatch } from '../../src/ui/events';
import {
  mountMissionsSparkleListener,
  consumeSparkleQueue,
  isReducedMotion,
  __resetSparkleState,
} from '../../src/ui/missions-sparkle';

describe('missions-sparkle (event-based queue)', () => {
  beforeEach(() => __resetSparkleState());

  it('listener 등록 후 mission-complete dispatch → queue에 defId push', () => {
    mountMissionsSparkleListener();
    dispatch('dg:reward:mission-complete', { defId: 'a', period: 'daily', rewardXp: 10, at: 0 });
    const q = consumeSparkleQueue();
    expect(q.has('a')).toBe(true);
    expect(q.size).toBe(1);
  });

  it('consume 두 번째 호출은 빈 Set (소비 1회)', () => {
    mountMissionsSparkleListener();
    dispatch('dg:reward:mission-complete', { defId: 'a', period: 'daily', rewardXp: 10, at: 0 });
    consumeSparkleQueue();
    expect(consumeSparkleQueue().size).toBe(0);
  });

  it('idempotent: mountMissionsSparkleListener 2회 호출에도 listener 1개만 wired', () => {
    mountMissionsSparkleListener();
    mountMissionsSparkleListener();
    dispatch('dg:reward:mission-complete', { defId: 'a', period: 'daily', rewardXp: 10, at: 0 });
    const q = consumeSparkleQueue();
    expect(q.size).toBe(1); // 2면 listener 2회 등록된 것
  });

  it('mount 전 dispatch는 queue에 안 들어감 (listener 미등록)', () => {
    dispatch('dg:reward:mission-complete', { defId: 'a', period: 'daily', rewardXp: 10, at: 0 });
    expect(consumeSparkleQueue().size).toBe(0);
  });

  it('여러 미션 완수 → queue에 모두 push (mix)', () => {
    mountMissionsSparkleListener();
    dispatch('dg:reward:mission-complete', { defId: 'a', period: 'daily', rewardXp: 10, at: 0 });
    dispatch('dg:reward:mission-complete', { defId: 'b', period: 'weekly', rewardXp: 50, at: 1 });
    const q = consumeSparkleQueue();
    expect(q.size).toBe(2);
    expect(q.has('a')).toBe(true);
    expect(q.has('b')).toBe(true);
  });

  it('__resetSparkleState 후 listenerWired=false → 재 mount 가능', () => {
    mountMissionsSparkleListener();
    __resetSparkleState();
    mountMissionsSparkleListener();
    dispatch('dg:reward:mission-complete', { defId: 'a', period: 'daily', rewardXp: 10, at: 0 });
    expect(consumeSparkleQueue().has('a')).toBe(true);
  });

  it('isReducedMotion: matchMedia mock에 따라 boolean 반환', () => {
    const origMM = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
      media: q, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      onchange: null,
    })) as typeof window.matchMedia;
    try {
      expect(isReducedMotion()).toBe(true);
    } finally {
      window.matchMedia = origMM;
    }
  });
});
