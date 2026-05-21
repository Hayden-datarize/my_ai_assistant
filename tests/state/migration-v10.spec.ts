import { describe, it, expect } from 'vitest';
import {
  migrateUserToV10,
  migrateUserToV2, migrateUserToV3, migrateUserToV4, migrateUserToV5,
  migrateUserToV6, migrateUserToV7, migrateUserToV8, migrateUserToV9,
} from '../../src/state/migration';

describe('migrateUserToV10 (v3.48)', () => {
  it('v9 user → v10 + freezeHistory []', () => {
    const v9 = { schemaVersion: 9, streakFreeze: { count: 2, lastEarnedAt: '2026-05-20' } };
    const out = migrateUserToV10(v9) as unknown as Record<string, unknown>;
    expect(out.schemaVersion).toBe(10);
    expect(out.freezeHistory).toEqual([]);
  });

  it('idempotent — v10 user 그대로 (freezeHistory 보존)', () => {
    const v10 = { schemaVersion: 10, freezeHistory: [{ date: '2026-05-20', kind: 'earned', amount: 1 }] };
    const out = migrateUserToV10(v10) as unknown as Record<string, unknown>;
    expect(out.schemaVersion).toBe(10);
    expect(out.freezeHistory).toEqual([{ date: '2026-05-20', kind: 'earned', amount: 1 }]);
  });

  it('손상 freezeHistory(non-array) → []', () => {
    const v9 = { schemaVersion: 9, freezeHistory: 'corrupt' };
    const out = migrateUserToV10(v9) as unknown as Record<string, unknown>;
    expect(out.freezeHistory).toEqual([]);
  });

  it('chain superset — v5 user도 v10 도달 + freezeHistory []', () => {
    const v5 = { schemaVersion: 5, streakFreeze: { count: 1, lastEarnedAt: '2026-05-01' } };
    const out = migrateUserToV10(v5) as unknown as Record<string, unknown>;
    expect(out.schemaVersion).toBe(10);
    expect(Array.isArray(out.freezeHistory)).toBe(true);
  });
});

describe('v10 chain superset — V2~V9 same-reference (사전 review P0-1)', () => {
  const v10 = {
    schemaVersion: 10,
    freezeHistory: [{ date: '2026-05-20', kind: 'earned', amount: 1 }],
    missions: { active: [{ x: 1 }] },
  };
  it.each([
    ['V2', migrateUserToV2], ['V3', migrateUserToV3], ['V4', migrateUserToV4],
    ['V5', migrateUserToV5], ['V6', migrateUserToV6], ['V7', migrateUserToV7],
    ['V8', migrateUserToV8], ['V9', migrateUserToV9],
  ])('%s(v10 user) → same reference (downgrade 차단)', (_n, fn) => {
    const out = fn(v10) as unknown as Record<string, unknown>;
    expect(out.schemaVersion).toBe(10);
    expect(out.freezeHistory).toEqual([{ date: '2026-05-20', kind: 'earned', amount: 1 }]);
    expect(out.missions).toEqual({ active: [{ x: 1 }] });  // missions reset 안 됨
  });
});
