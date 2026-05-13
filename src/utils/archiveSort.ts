/**
 * v3.34 T2: archive 검색 ranking 적용용 sort helper.
 * 3-tier: pinned desc → score desc → date desc.
 * Stable sort (ES2019).
 */
export function sortPinThenScoreDesc<T>(
  items: T[],
  getPinned: (t: T) => boolean,
  getScore: (t: T) => number,
  getDateKey: (t: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const pa = getPinned(a) ? 1 : 0;
    const pb = getPinned(b) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const sa = getScore(a);
    const sb = getScore(b);
    if (sa !== sb) return sb - sa;
    const da = getDateKey(a);
    const db = getDateKey(b);
    return db.localeCompare(da);
  });
}
