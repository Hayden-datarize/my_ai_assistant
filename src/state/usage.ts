import { getDateStr } from '../utils/dates';

const USAGE_KEY = 'dg_translate_usage';
const CAP_KEY = 'dg_translate_cap';
const DEFAULT_CAP = 100;
const CAP_MIN = 30;
const CAP_MAX = 500;

interface Usage { date: string; count: number; }

function clampCap(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_CAP;
  return Math.max(CAP_MIN, Math.min(CAP_MAX, Math.round(n)));
}

export function getCap(): number {
  const raw = localStorage.getItem(CAP_KEY);
  if (raw === null) return DEFAULT_CAP;
  const n = Number(raw);
  return clampCap(n);
}

export function setCap(n: number): void {
  const clamped = clampCap(n);
  localStorage.setItem(CAP_KEY, String(clamped));
}

function load(): Usage {
  const today = getDateStr();
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: today, count: 0 };
    const parsed = JSON.parse(raw) as Usage;
    if (parsed.date !== today) return { date: today, count: 0 };
    // v3.14.4 T1 + v3.14.5 T2: count가 NaN/Infinity/negative이면 silent corruption — 오늘 카운트로 reset
    // (hand-edited LS 또는 future migration JSON-bypass 대비, seen.ts firstSeenAt와 동일 패턴).
    // v3.14.5: negative (cap bypass 차단) + fractional (Math.floor 정수화).
    if (typeof parsed.count !== 'number' || !Number.isFinite(parsed.count) || parsed.count < 0) {
      return { date: today, count: 0 };
    }
    return { date: parsed.date, count: Math.floor(parsed.count) };
  } catch {
    return { date: today, count: 0 };
  }
}

function save(u: Usage): void {
  localStorage.setItem(USAGE_KEY, JSON.stringify(u));
}

export function getTodayCount(): number {
  return load().count;
}

export function checkAndIncrement(): boolean {
  const u = load();
  if (u.count >= getCap()) return false;
  u.count += 1;
  save(u);
  return true;
}

// Test-only escape hatch (no production caller)
export function resetForTest(): void {
  localStorage.removeItem(USAGE_KEY);
  localStorage.removeItem(CAP_KEY);
}
