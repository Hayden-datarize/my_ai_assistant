import { describe, it, expect } from 'vitest';
import { TIERS, getCurrentTier, getNextTier, didLevelUp } from '../../../src/state/leveling';

describe('leveling', () => {
  it('TIERS는 6개 tier (id 1..6)', () => {
    expect(TIERS).toHaveLength(6);
    expect(TIERS.map(t => t.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('getCurrentTier(0) → 새싹 (id 1)', () => {
    expect(getCurrentTier(0).id).toBe(1);
    expect(getCurrentTier(0).name).toBe('새싹');
  });

  it('getCurrentTier(99) → 새싹 (boundary 미만)', () => {
    expect(getCurrentTier(99).id).toBe(1);
  });

  it('getCurrentTier(100) → 새잎 (boundary 정확)', () => {
    expect(getCurrentTier(100).id).toBe(2);
  });

  it('getCurrentTier(2500) → 하늘 (MAX 초과 시 MAX 유지)', () => {
    expect(getCurrentTier(2500).id).toBe(6);
  });

  it('getNextTier(0) → 새잎 (다음 tier)', () => {
    expect(getNextTier(0)?.id).toBe(2);
  });

  it('getNextTier(2500) → null (MAX는 다음 없음)', () => {
    expect(getNextTier(2500)).toBeNull();
  });

  it('didLevelUp(99, 100) → 새잎 (boundary 통과)', () => {
    expect(didLevelUp(99, 100)?.id).toBe(2);
  });

  it('didLevelUp(100, 200) → null (같은 tier 내 이동)', () => {
    expect(didLevelUp(100, 200)).toBeNull();
  });
});
