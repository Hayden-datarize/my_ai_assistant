import { getDateStr } from '../utils/dates';
import { MSG } from '../ui/messages';
import { migrateUserToV2 } from './migration';
import { takeSnapshot, runSweep } from './achievements';

export interface User {
  name: string;
  interests: string[];
  onboardedAt: string;
  streak: number;
  lastActiveDate: string;
  xp: number;
  // ❌ removed: level (computed via getCurrentTier(xp).id)
  earnedBadges: Record<string, number>;     // badgeId → unlockedAt epoch ms
  gamificationMigrated: boolean;            // 환영 모달 1회 보장 flag
  schemaVersion: 2;
}

/** home.ts / stats.ts 레거시 호환 alias */
export type LegacyUser = User;

const KEY = 'user';

export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.schemaVersion === 2) return parsed as User;
    // lazy migrate v1 → v2 (or partial shape)
    const migrated = migrateUserToV2(parsed);
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
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
 * 답변 제출 1회의 사용자 활동을 atomic single-write로 기록한다.
 * - streak: 어제 활동했으면 +1, 아니면 1로 리셋. 같은 날 재제출은 idempotent.
 * - xp: xpDelta 누적. tier는 getCurrentTier(xp)로 derive (level 필드 X).
 * - lastActiveDate: 오늘로 갱신.
 *
 * v3.12: prev/curr Snapshot 사이 saveUser → runSweep으로 reward events emit.
 * saveUser throw 시 in-memory 변경은 persist 안 됨 → sweep 안 함 (false-fire 방지).
 *
 * @throws {DOMException} 저장 공간 초과 시 (QuotaExceededError) — caller에서 처리
 */
export function recordDailyAnswer(xpDelta: number): void {
  const u = loadUserData();
  if (!u) return;
  const today = getDateStr();
  const prev = takeSnapshot();

  if (u.lastActiveDate !== today) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const yesterday = getDateStr(y);
    u.streak = u.lastActiveDate === yesterday ? u.streak + 1 : 1;
  }

  u.xp += xpDelta;
  u.lastActiveDate = today;

  saveUser(u);  // throws on Quota — sweep 안 함 (false-fire 방지)

  const curr = takeSnapshot();
  runSweep(prev, curr);
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
 * saveUser / recordDailyAnswer 에서 던져진 에러를
 * 사용자 표시용 메시지로 변환한다 (단일 진입점).
 */
export function getSaveErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    return MSG.SAVE_QUOTA_EXCEEDED;
  }
  return MSG.SAVE_FAILED;
}
