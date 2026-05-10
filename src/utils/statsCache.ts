import { getKstDateStr } from './dates';

const KEY_PREFIX = 'dg.statsCache.';

export interface StatsFingerprint {
  totalAnswers: number;
  longestStreak: number;
  byInterestTopKey: string;   // codex P1-4: '' if no interests
  byInterestTopCount: number; // codex P1-4
}

export interface StatsCacheEntry {
  range: 7 | 30;
  fingerprint: StatsFingerprint;
  highlight?: string;
  narrative?: string;
  /** 진단 필드 — write 시각 ISO. 캐시 hit 결정에는 사용하지 않음 (key의 KST date + fingerprint가 결정). v3.23 T6 mid P2-3 명확화 (v3.26 T5). */
  cachedAt: string;
}

function key(range: 7 | 30): string {
  return `${KEY_PREFIX}${getKstDateStr()}.${range}`;
}

/** KST date + range + 4-field fingerprint 모두 일치 시 entry 반환, 불일치/없음 시 null */
export function getStatsCache(range: 7 | 30, fp: StatsFingerprint): StatsCacheEntry | null {
  try {
    const raw = localStorage.getItem(key(range));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StatsCacheEntry;
    if (parsed.range !== range) return null;
    // codex P1-4: 4 fingerprint field 모두 비교 (byInterest 변화로 narrative stale 방지)
    if (
      parsed.fingerprint.totalAnswers !== fp.totalAnswers ||
      parsed.fingerprint.longestStreak !== fp.longestStreak ||
      parsed.fingerprint.byInterestTopKey !== fp.byInterestTopKey ||
      parsed.fingerprint.byInterestTopCount !== fp.byInterestTopCount
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** entry 저장 + 오늘 이외의 날짜 prefix 키 일괄 cleanup */
export function setStatsCache(
  range: 7 | 30,
  fp: StatsFingerprint,
  data: { highlight?: string; narrative?: string },
): void {
  const todayPrefix = `${KEY_PREFIX}${getKstDateStr()}.`;
  // cleanup: 오늘 날짜가 아닌 statsCache 키 일괄 삭제
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX) && !k.startsWith(todayPrefix)) {
      localStorage.removeItem(k);
    }
  }
  const entry: StatsCacheEntry = {
    range,
    fingerprint: fp,
    ...data,
    cachedAt: new Date().toISOString(),
  };
  localStorage.setItem(key(range), JSON.stringify(entry));
}

/** KEY_PREFIX로 시작하는 모든 캐시 키 삭제 */
export function clearStatsCache(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(KEY_PREFIX)) localStorage.removeItem(k);
  }
}
