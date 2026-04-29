export interface Tier {
  id: number;        // 1..6
  icon: string;
  name: string;
  thresh: number;    // unlock xp
}

export const TIERS: readonly Tier[] = [
  { id: 1, icon: '🌱', name: '새싹', thresh: 0 },
  { id: 2, icon: '🌿', name: '새잎', thresh: 100 },
  { id: 3, icon: '🌳', name: '나무', thresh: 300 },
  { id: 4, icon: '🌲', name: '숲',   thresh: 600 },
  { id: 5, icon: '🏔️', name: '산',   thresh: 1000 },
  { id: 6, icon: '🌌', name: '하늘', thresh: 2000 },
] as const;

export function getCurrentTier(xp: number): Tier {
  // TIERS는 thresh asc 정렬. xp >= thresh 만족하는 가장 높은 tier 반환.
  let result: Tier = TIERS[0]!;
  for (const t of TIERS) {
    if (xp >= t.thresh) result = t;
    else break;
  }
  return result;
}

export function getNextTier(xp: number): Tier | null {
  return TIERS.find(t => t.thresh > xp) ?? null;
}

export function didLevelUp(prevXp: number, currXp: number): Tier | null {
  const prev = getCurrentTier(prevXp);
  const curr = getCurrentTier(currXp);
  return curr.id !== prev.id ? curr : null;
}
