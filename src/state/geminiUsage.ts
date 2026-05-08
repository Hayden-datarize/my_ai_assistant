// v3.23: Gemini API 일일 cap 인프라.
// usage.ts (translate)와 LS key를 분리 — dg_gemini_usage / dg_gemini_cap.
// alias rename으로 translate usage.ts의 checkAndIncrement / getCap 등과 충돌 방지 (P1-1).
import { getKstDateStr } from '../utils/dates';

const USAGE_KEY = 'dg_gemini_usage';
const CAP_KEY = 'dg_gemini_cap';
const DEFAULT_CAP = 50;
const CAP_MIN = 10;
const CAP_MAX = 200;

interface Usage { date: string; count: number; }

function clampCap(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_CAP;
  return Math.max(CAP_MIN, Math.min(CAP_MAX, Math.round(n)));
}

export function getGeminiCap(): number {
  const raw = localStorage.getItem(CAP_KEY);
  if (raw === null) return DEFAULT_CAP;
  return clampCap(Number(raw));
}

export function setGeminiCap(n: number): void {
  localStorage.setItem(CAP_KEY, String(clampCap(n)));
}

function load(): Usage {
  const today = getKstDateStr();
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: today, count: 0 };
    const parsed = JSON.parse(raw) as Usage;
    if (parsed.date !== today) return { date: today, count: 0 };
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

export function getGeminiTodayCount(): number {
  return load().count;
}

export function checkAndIncrementGemini(): boolean {
  const u = load();
  if (u.count >= getGeminiCap()) return false;
  u.count += 1;
  save(u);
  return true;
}

// Test-only escape hatch (no production caller)
export function resetForTest(): void {
  localStorage.removeItem(USAGE_KEY);
  localStorage.removeItem(CAP_KEY);
}
