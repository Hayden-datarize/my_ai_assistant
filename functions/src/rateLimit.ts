const BURST_WINDOW_MS = 60_000;
const DAILY_WINDOW_MS = 24 * 60 * 60_000;
const BURST_MAX = 3;
const DAILY_MAX = 10;

interface Record {
  burst: number[]; // ts list within last 60s
  daily: number[]; // ts list within last 24h
}

const records = new Map<string, Record>();

export type RateLimitResult = 'ok' | 'burst' | 'daily';

export function checkRateLimit(email: string, now: number): RateLimitResult {
  const rec = records.get(email) ?? { burst: [], daily: [] };
  rec.burst = rec.burst.filter((t) => now - t < BURST_WINDOW_MS);
  rec.daily = rec.daily.filter((t) => now - t < DAILY_WINDOW_MS);
  if (rec.burst.length >= BURST_MAX) {
    records.set(email, rec);
    return 'burst';
  }
  if (rec.daily.length >= DAILY_MAX) {
    records.set(email, rec);
    return 'daily';
  }
  rec.burst.push(now);
  rec.daily.push(now);
  records.set(email, rec);
  return 'ok';
}

export function resetRateLimit(): void {
  records.clear();
}
