import { getDateStr } from '../utils/dates';
import { MSG } from '../ui/messages';

export interface User {
  name: string;
  interests: string[];
  onboardedAt: string;
  streak: number;
  lastActiveDate: string;
  xp: number;
  level: number;
}

/** home.ts / stats.ts 레거시 호환 alias */
export type LegacyUser = User;

const KEY = 'user';

export function getCachedUser(): LegacyUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LegacyUser) : null;
  } catch {
    return null;
  }
}

export function loadUserData(): User | null {
  return getCachedUser();
}

/**
 * 사용자 데이터를 localStorage에 저장한다.
 * @throws {DOMException} 저장 공간 초과 시 (QuotaExceededError)
 */
export function saveUser(u: User): void {
  localStorage.setItem(KEY, JSON.stringify(u));
}

/**
 * XP를 누적하고 레벨을 갱신한 뒤 저장한다.
 * @throws {DOMException} 저장 공간 초과 시 (QuotaExceededError)
 */
export function recordActivity(xpDelta: number): void {
  const u = loadUserData();
  if (!u) return;
  u.xp += xpDelta;
  u.level = 1 + Math.floor(u.xp / 100);
  u.lastActiveDate = getDateStr();
  saveUser(u);
}

/**
 * 오늘 첫 접속 시 스트릭을 갱신하고 저장한다.
 * @throws {DOMException} 저장 공간 초과 시 (QuotaExceededError)
 */
export function checkAndUpdateStreak(): void {
  const u = loadUserData();
  if (!u) return;
  const today = getDateStr();
  if (u.lastActiveDate === today) return;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const yesterday = getDateStr(y);
  u.streak = u.lastActiveDate === yesterday ? u.streak + 1 : 1;
  u.lastActiveDate = today;
  saveUser(u);
}

export function updateGreeting(rootId = 'greeting'): void {
  const el = document.getElementById(rootId);
  const u = loadUserData();
  if (!el || !u) return;
  const h = new Date().getHours();
  const period = h < 5 ? '늦은 밤' : h < 12 ? '좋은 아침' : h < 18 ? '좋은 오후' : '좋은 저녁';
  el.textContent = `${period}, ${u.name}`;
}

export function updateStreakBanner(rootId = 'streakBanner'): void {
  const el = document.getElementById(rootId);
  const u = loadUserData();
  if (!el || !u) return;
  el.textContent = u.streak > 0 ? `🔥 ${u.streak}일 연속 성장 중` : '오늘부터 다시 시작해봐요';
}

/**
 * saveUser / recordActivity / checkAndUpdateStreak 에서 던져진 에러를
 * 사용자 표시용 메시지로 변환한다 (단일 진입점).
 */
export function getSaveErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    return MSG.SAVE_QUOTA_EXCEEDED;
  }
  return MSG.SAVE_FAILED;
}
