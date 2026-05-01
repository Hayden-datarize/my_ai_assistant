import { getDateStr } from '../utils/dates';
import { MSG } from '../ui/messages';
import { migrateUserToV2, migrateUserToV3 } from './migration';
import { takeSnapshot, runSweep } from './achievements';
import type { MissionInstance } from './missionTypes';
import { getActiveMissions, tickMissionProgress } from './missionEngine';

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
  schemaVersion: 3;
  missions: {
    active: MissionInstance[];
    cumulative: { dailyCount: number; weeklyCount: number; monthlyCount: number };
    lastDailySeed: string;
    currentWeekIso: string;
    currentMonthIso: string;
  };
}

/** home.ts / stats.ts 레거시 호환 alias */
export type LegacyUser = User;

const KEY = 'user';

export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    let user = (parsed?.schemaVersion === 2 || parsed?.schemaVersion === 3)
      ? parsed
      : migrateUserToV2(parsed);
    user = migrateUserToV3(user);
    if (!isValidUserShape(user)) return null;
    if (parsed?.schemaVersion !== 3) {
      // lazy migrate v1/v2 → v3 (정상 데이터만 persist; 손상 데이터는 위에서 null)
      // setItem 실패(Quota 등)는 무시 — in-memory 변환 결과는 그대로 반환
      try { localStorage.setItem(KEY, JSON.stringify(user)); } catch { /* ignore */ }
    }
    return user as User;
  } catch {
    return null;
  }
}

/**
 * v3.12.1 (P2-NEW-2): localStorage 외부 손상으로 인한 silent NaN 차단.
 * 5개 핵심 필드 type-check만 — earnedBadges/gamificationMigrated/schemaVersion은
 * migrateUserToV2가 nullish 가드로 채워주므로 검증 불필요.
 */
function isValidUserShape(u: unknown): u is User {
  if (!u || typeof u !== 'object') return false;
  const r = u as Record<string, unknown>;
  return typeof r.name === 'string'
    && Array.isArray(r.interests)
    && r.interests.every((i) => typeof i === 'string')                            // ✅ v3.13.1 T11 (P2-NEW-3 graduation)
    && typeof r.streak === 'number' && Number.isFinite(r.streak)
    && typeof r.lastActiveDate === 'string'
    && typeof r.xp === 'number' && Number.isFinite(r.xp);
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
  const now = new Date();                                                         // single now capture (v3.13.1 T14 / codex P1-1)
  const today = getDateStr();

  // lazy regen (in-memory only — saveUser 는 caller 책임, 아래 단일 호출)
  getActiveMissions(now, u);

  // prev snapshot은 localStorage 기준 — lazy regen 결과는 saveUser 이후에야 persist됨.
  // detectEvents (T5/T9 guard) 가 새 instance + 즉시 완수 케이스를 정확히 처리한다.
  const prev = takeSnapshot();

  if (u.lastActiveDate !== today) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const yesterday = getDateStr(y);
    u.streak = u.lastActiveDate === yesterday ? u.streak + 1 : 1;
  }

  u.xp += xpDelta;
  u.lastActiveDate = today;

  // mission progress tick (xp 보너스 포함) — saveUser 이전에 in-memory 변경
  tickMissionProgress(u, 'answer', now);

  saveUser(u);  // single saveUser: xp/streak/missions 모두 커버. throws on Quota — sweep 안 함

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
