import { describe, it, expect } from 'vitest';
import {
  migrateUserToV8,
  migrateUserToV2,
  migrateUserToV3,
  migrateUserToV4,
  migrateUserToV5,
  migrateUserToV6,
  migrateUserToV7,
} from '../../src/state/migration';

/**
 * v3.27 T1: schema v7→v8 lazy migration spec.
 * - Insight.pinned default false (기존 .pinned=true 보존)
 * - xpHistory: { date: string; xpEarned: number }[] 신설 (default [])
 * - chain superset (Codex 사전 review P0-1): V2~V7 모든 함수 + getCachedUser allowlist에 schemaVersion >= 8 early-return guard
 */

const baseV6Insight = { id: 'i1', text: '통찰', createdAt: '2026-05-08T09:00:00Z' };
const baseV7Insight = { ...baseV6Insight, interestId: 'tech' };

describe('migrateUserToV8 (v3.27 T1)', () => {
  it('v7 user → v8 stamp + Insight.pinned default false + xpHistory default []', () => {
    const v7 = {
      schemaVersion: 7,
      insights: [baseV7Insight],
    };
    const v8 = migrateUserToV8(v7);
    expect(v8.schemaVersion).toBe(8);
    expect(v8.insights[0]?.pinned).toBe(false);
    expect(v8.xpHistory).toEqual([]);
  });

  it('기존 .pinned=true forward-compat 보존', () => {
    const v7 = {
      schemaVersion: 7,
      insights: [{ ...baseV7Insight, pinned: true }],
    };
    const v8 = migrateUserToV8(v7);
    expect(v8.insights[0]?.pinned).toBe(true);
  });

  it('v8 user → v8 idempotent (same reference)', () => {
    const v8In = {
      schemaVersion: 8,
      insights: [{ ...baseV7Insight, pinned: false }],
      xpHistory: [{ date: '2026-05-10', xpEarned: 10 }],
    };
    const v8Out = migrateUserToV8(v8In);
    expect(v8Out).toBe(v8In as unknown);
  });

  it('v6 user → migrateUserToV8 통과 시 insights/streakFreeze 보존 (chain superset 흡수)', () => {
    const v6 = {
      schemaVersion: 6,
      streakFreeze: { count: 1, lastEarnedAt: '2026-05-08' },
      insights: [baseV6Insight],
    };
    const v8 = migrateUserToV8(v6);
    expect(v8.schemaVersion).toBe(8);
    expect(v8.insights[0]?.pinned).toBe(false);
    expect(v8.insights[0]?.id).toBe('i1');
    expect(v8.xpHistory).toEqual([]);
  });

  it('v8 user with insight.pinned: undefined → 백필 copy (P1 흡수)', () => {
    const v8In = {
      schemaVersion: 8,
      insights: [{ ...baseV7Insight }], // pinned 키 누락
      xpHistory: [],
    };
    const v8Out = migrateUserToV8(v8In);
    expect(v8Out).not.toBe(v8In as unknown); // copy
    expect(v8Out.insights[0]?.pinned).toBe(false); // 백필
    expect(v8Out.insights[0]?.id).toBe('i1'); // 보존
  });

  it('v8 user with mixed pinned (true + undefined) → true 보존 + 누락 false 백필', () => {
    const v8In = {
      schemaVersion: 8,
      insights: [
        { ...baseV7Insight, id: 'a', pinned: true },
        { ...baseV7Insight, id: 'b' }, // pinned 누락
      ],
      xpHistory: [],
    };
    const v8Out = migrateUserToV8(v8In);
    expect(v8Out.insights[0]?.pinned).toBe(true);
    expect(v8Out.insights[1]?.pinned).toBe(false);
  });

  it('v8 user with xpHistory non-array → [] 백필', () => {
    const v8In = {
      schemaVersion: 8,
      insights: [{ ...baseV7Insight, pinned: false }],
      xpHistory: 'corrupt' as unknown, // 손상
    };
    const v8Out = migrateUserToV8(v8In);
    expect(v8Out.xpHistory).toEqual([]);
  });

  it('v8 user with insights non-array → [] 백필 (per-task review fix)', () => {
    const v8In = {
      schemaVersion: 8,
      insights: 'corrupt' as unknown, // 손상
      xpHistory: [],
    };
    const v8Out = migrateUserToV8(v8In);
    expect(v8Out).not.toBe(v8In as unknown); // copy
    expect(v8Out.insights).toEqual([]); // 백필
  });

  // P0-1 (Codex 사전 review): V2~V7 모든 함수에 schemaVersion >= 8 early-return guard
  // — v8 user가 lower migration 블록에 재진입하면 forward-compat 깨짐 (silent corruption risk)
  it('v8 user → V2~V7 모든 함수 same reference (chain superset, P0-1)', () => {
    const v8 = {
      schemaVersion: 8,
      insights: [{ ...baseV7Insight, pinned: false }],
      xpHistory: [{ date: '2026-05-10', xpEarned: 10 }],
    };
    expect(migrateUserToV2(v8)).toBe(v8 as unknown);
    expect(migrateUserToV3(v8)).toBe(v8 as unknown);
    expect(migrateUserToV4(v8)).toBe(v8 as unknown);
    expect(migrateUserToV5(v8)).toBe(v8 as unknown);
    expect(migrateUserToV6(v8)).toBe(v8 as unknown);
    expect(migrateUserToV7(v8)).toBe(v8 as unknown);
  });
});
