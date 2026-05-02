const KEY = 'seenBriefings';
const MAX = 500;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface SeenRecord {
  url: string;
  firstSeenAt: number;
}

function loadSeen(): SeenRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is SeenRecord =>
        typeof r === 'object'
        && r !== null
        && typeof (r as SeenRecord).url === 'string'
        && typeof (r as SeenRecord).firstSeenAt === 'number'
        && Number.isFinite((r as SeenRecord).firstSeenAt),  // v3.14.3 P1-1: NaN/Infinity 차단 (LRU sort invariant)
    );
  } catch {
    return [];
  }
}

function saveSeen(list: SeenRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** 30일 retention 안에 있으면 true (= 노출 차단 신호). */
export function isSeen(url: string, now: number = Date.now()): boolean {
  const rec = loadSeen().find((r) => r.url === url);
  return !!rec && rec.firstSeenAt + TTL_MS > now;
}

/** chosen url 목록을 seen에 기록. 기존 url의 firstSeenAt은 보존(idempotent). LRU cap = 500. */
export function recordSeen(urls: string[], now: number = Date.now()): void {
  if (urls.length === 0) return;
  const existing = loadSeen();
  const existingMap = new Map<string, SeenRecord>(existing.map((r) => [r.url, r]));
  for (const url of urls) {
    if (!existingMap.has(url)) existingMap.set(url, { url, firstSeenAt: now });
  }
  const next = Array.from(existingMap.values())
    .sort((a, b) => b.firstSeenAt - a.firstSeenAt)
    .slice(0, MAX);
  saveSeen(next);
}

/** 배치 lookup용 — 30일 retention 안에 있는 url 집합. T3 hot-loop 회피용. */
export function loadActiveSeenUrls(now: number = Date.now()): Set<string> {
  return new Set(
    loadSeen()
      .filter((r) => r.firstSeenAt + TTL_MS > now)
      .map((r) => r.url),
  );
}

/** retention 만료된 항목 제거 (옵셔널 housekeeping). */
export function purgeExpiredSeen(now: number = Date.now()): void {
  const list = loadSeen();
  const next = list.filter((r) => r.firstSeenAt + TTL_MS > now);
  if (next.length !== list.length) saveSeen(next);
}
