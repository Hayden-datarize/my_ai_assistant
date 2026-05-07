// v3.20 T5 (B1): RSS retry telemetry — 24h rolling counter (α)
// + DEV-guard console.warn (β, rss.ts에서 호출).
// production 1주 관측 시 retry 빈도 가시성 확보. v3.18.1 H2/N3/N4 carry-forward.
//
// localStorage 키 컨벤션 'dg.*' 일관 (project memory). schema 변경 아님 (client-side counter).
// author device 한정 가시성 — production-wide observability는 별도 설계 필요.

const KEY = 'dg.rss.retry_count_24h';
const TTL_MS = 24 * 60 * 60 * 1000;

interface RssTelemetry {
  since: string; // ISO timestamp — 24h window 시작점
  count: number;
  byStatus: Record<string, number>; // { '429': N, '503': M }
}

function readRaw(): RssTelemetry | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as RssTelemetry).since === 'string' &&
      typeof (parsed as RssTelemetry).count === 'number' &&
      typeof (parsed as RssTelemetry).byStatus === 'object'
    ) {
      return parsed as RssTelemetry;
    }
    return null;
  } catch {
    return null;
  }
}

function isExpired(since: string, now: number): boolean {
  const sinceMs = Date.parse(since);
  if (Number.isNaN(sinceMs)) return true;
  return now - sinceMs >= TTL_MS;
}

export function recordRetry(status: number, now: number = Date.now()): void {
  try {
    const existing = readRaw();
    const next: RssTelemetry =
      existing === null || isExpired(existing.since, now)
        ? { since: new Date(now).toISOString(), count: 0, byStatus: {} }
        : existing;
    next.count += 1;
    const key = String(status);
    next.byStatus[key] = (next.byStatus[key] ?? 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage Quota / 비허용 환경 — silent (telemetry는 best-effort)
  }
}

export function getRetryStats(now: number = Date.now()): RssTelemetry | null {
  const existing = readRaw();
  if (existing === null) return null;
  if (isExpired(existing.since, now)) return null;
  return existing;
}

/** @internal — test reset */
export function __resetForTest(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}
