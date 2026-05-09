import { getKstDateStr } from '../utils/dates';
import { MSG } from '../ui/messages';
import { migrateUserToV2, migrateUserToV3, migrateUserToV4, migrateUserToV5, migrateUserToV6, migrateUserToV7 } from './migration';
import { takeSnapshot, runSweep } from './achievements';
import type { MissionInstance } from './missionTypes';
import { getActiveMissions, tickMissionProgress } from './missionEngine';
import type { PlantState } from './plantTypes';
import { backfillGarden } from './backfillGarden';
import { regenerateFreeze, consumeFreezeForGap } from './freezeEngine';
import { dispatch } from '../ui/events';
import { showToast } from '../utils/toast';
import { INTERESTS } from '../utils/categories';

/**
 * v3.23 NEW: Gemini 기반 통찰 항목.
 *
 * @invariant entry guard via `validateInsightText` (v3.24 T5 graduate).
 * - `text`: caller는 raw 입력에 대해 `validateInsightText`로 trim + max-200 cap 적용 의무.
 *   UI render 시점에 escapeHtml 의무.
 * - `isValidUserShape`는 `Array.isArray(insights)`만 검증 — entry-level shape 검증 없음.
 *   `validateInsightText` 호출 책임은 caller (Gemini 빈 응답 등 raw 텍스트 진입점).
 *
 * v3.25 T1 NEW: `interestId` 분야 메타.
 * - INTERESTS 15개 whitelist + 'unknown' sentinel 중 하나.
 * - default 'unknown' (caller 책임 — T1 임시, T4에서 parseInsightResponse 결과로 교체).
 * - entry guard via `validateInterestId` (T3+T4 wiring).
 * - shape 강화는 T2 migration 끝난 후 (T1은 v6 user 데이터 손실 방지 위해 강화 X).
 */
export interface Insight {
  id: string;        // crypto.randomUUID()
  text: string;      // Gemini 통찰 (caller invariant — 위 @invariant 참조)
  interestId: string; // v3.25 T1: INTERESTS id 또는 'unknown' (validateInterestId 통과 의무)
  createdAt: string; // ISO 8601
}

/**
 * v3.24 T5 (B1): Insight.text entry-level guard.
 * - trim 적용 후 반환
 * - 빈/공백-only 입력은 throw (caller 책임 — Gemini 빈 응답 등 raw 텍스트 진입점)
 * - 200자 max cap (storage bloat + UI overflow 차단)
 *
 * @throws Error 빈 / 공백-only 입력
 */
export function validateInsightText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error('Insight text empty (빈 또는 공백 only)');
  return trimmed.slice(0, 200);
}

/**
 * v3.25 T1: Insight.interestId entry-level guard.
 * - INTERESTS 15개 whitelist 매칭 → 그대로 반환
 * - 매칭 실패 또는 'unknown' sentinel → 'unknown'
 * - trim은 caller 책임 (parseInsightResponse가 처리)
 */
export function validateInterestId(id: string): string {
  return INTERESTS.some(i => i.id === id) ? id : 'unknown';
}

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
  schemaVersion: 7;
  missions: {
    active: MissionInstance[];
    cumulative: { dailyCount: number; weeklyCount: number; monthlyCount: number };
    lastDailySeed: string;
    currentWeekIso: string;
    currentMonthIso: string;
  };
  plantStateByInterest: Record<string, PlantState>;   // v3.15 NEW
  gardenIntroduced: boolean;                           // v3.15 NEW (환영 모달 1회)
  gardenBackfilled: boolean;                           // v3.15 NEW (backfill idempotent)
  streakFreeze: { count: number; lastEarnedAt: string };  // v3.21 NEW (Duolingo 정석)
  insights: Insight[];                                 // v3.23 NEW
}

const KEY = 'user';

function notifyCorruption(): void {
  // v3.14.2 T12 P1 (P2-NEW-4): 손상 v2 data 노출 (v3.7 silent-fail 정책 준수).
  // v3.14.3 T6 (P2-1): HR/GA 친화 텍스트 + 행동 가이드. 4000ms 유지(메시지 길이 + 행동 시간).
  // v3.14.3 T10 (P3-toast-const): 4000ms — default 2500ms보다 길게.
  //   메시지(~25자) + 행동("새로고침") 시간 확보. levelup(TOAST_DURATIONS.levelup=4000)과 동일 톤.
  // v3.24 T3: dynamic import → static (toast.ts 0 import, circular 0 — Vite split miss 회피).
  showToast('저장된 데이터를 다시 불러오지 못했어요. 새로고침해 주세요.', 4000);
}

export function getCachedUser(): User | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    let user = (parsed?.schemaVersion === 2 || parsed?.schemaVersion === 3 || parsed?.schemaVersion === 4 || parsed?.schemaVersion === 5 || parsed?.schemaVersion === 6 || parsed?.schemaVersion === 7)
      ? parsed
      : migrateUserToV2(parsed);
    user = migrateUserToV3(user);  // v4/v5/v6/v7 user는 early return (S5 fix + P0-1 fix + v3.25 chain superset)
    user = migrateUserToV4(user);
    user = migrateUserToV5(user);
    user = migrateUserToV6(user);  // v3.23 T1: v5→v6 lazy migration
    user = migrateUserToV7(user);  // v3.25 T2: v6→v7 lazy migration
    if (!isValidUserShape(user)) {
      // v3.14.2 T12 P1: JSON parse OK이지만 shape invalid도 corruption — 같은 toast.
      notifyCorruption();
      return null;
    }

    // T8: backfill 자동 (sweep 우회 — 환영 모달 highlight로만 통지)
    if (!user.gardenBackfilled) {
      backfillGarden(user);
      // P1-3 fix (v3.15 T16.1): backfill persist 실패 시 toast 통지 (v3.7 saveUser throw 정책과 정합).
      // best-effort: getCachedUser는 boot path이므로 throw 금지, 다음 진입 시 gardenBackfilled=false로 재시도.
      try { localStorage.setItem(KEY, JSON.stringify(user)); }
      catch (err) {
        // v3.24 T3: dynamic → static (위 notifyCorruption과 동일).
        showToast(getSaveErrorMessage(err));
      }
    } else if (parsed?.schemaVersion !== 7) {
      // lazy migrate v1/v2/v3/v4/v5/v6 → v7 (정상 데이터만 persist; 손상 데이터는 위에서 null)
      // setItem 실패(Quota 등)는 무시 — in-memory 변환 결과는 그대로 반환
      try { localStorage.setItem(KEY, JSON.stringify(user)); } catch { /* ignore */ }
    }
    return user as User;
  } catch {
    if (raw !== null) notifyCorruption();
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
  const baseValid = typeof r.name === 'string'
    && Array.isArray(r.interests)
    && r.interests.every((i) => typeof i === 'string')                            // ✅ v3.13.1 T11 (P2-NEW-3 graduation)
    && typeof r.streak === 'number' && Number.isFinite(r.streak)
    && typeof r.lastActiveDate === 'string'
    && typeof r.xp === 'number' && Number.isFinite(r.xp);
  if (!baseValid) return false;

  // S8 fix (Codex P1-2): v4 plantStateByInterest nested guard
  // v3.21 T1: v5도 동일 검증 (v5는 v4의 superset — streakFreeze 추가만)
  // v3.23 T1: v6도 동일 검증 (v6는 v5의 superset — insights 추가만)
  // v3.25 T2: v7도 동일 검증 (v7는 v6의 superset — Insight.interestId 추가만)
  if (r.schemaVersion === 4 || r.schemaVersion === 5 || r.schemaVersion === 6 || r.schemaVersion === 7) {
    if (typeof r.plantStateByInterest !== 'object' || r.plantStateByInterest === null) return false;
    for (const plant of Object.values(r.plantStateByInterest as Record<string, unknown>)) {
      if (!plant || typeof plant !== 'object') return false;
      const p = plant as Record<string, unknown>;
      const stage = p.stage;
      if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 1 || stage > 5) return false;
      if (typeof p.cumulativeActivity !== 'number' || !Number.isFinite(p.cumulativeActivity)) return false;
    }
  }

  // v3.21 T1: v5 신규 streakFreeze nested guard (silent NaN 차단, v3.12 lesson)
  // v3.23 T1: v6도 동일 검증 (v6는 v5의 superset)
  // v3.25 T2: v7도 동일 검증 (v7는 v6의 superset)
  if (r.schemaVersion === 5 || r.schemaVersion === 6 || r.schemaVersion === 7) {
    const sf = r.streakFreeze as { count?: unknown; lastEarnedAt?: unknown } | undefined | null;
    if (!sf || typeof sf !== 'object') return false;
    if (typeof sf.count !== 'number' || !Number.isFinite(sf.count) || sf.count < 0 || sf.count > 2) return false;
    if (typeof sf.lastEarnedAt !== 'string' || sf.lastEarnedAt.length === 0) return false;
  }

  // v3.23 T1: v6 신규 insights 배열 guard
  // v3.25 T2: v7도 동일 검증 (v7는 v6의 superset — array guard는 동일)
  if (r.schemaVersion === 6 || r.schemaVersion === 7) {
    if (!Array.isArray(r.insights)) return false;
  }

  // v3.25 T2 (Codex P0-A1 fix): Insight entry-level shape 강화.
  // migrate chain (V3→V4→V5→V6→V7) 끝난 후라 모든 user는 v7 — entry는 항상 v7 shape 보장.
  // v6 user는 migrateUserToV7에서 interestId='unknown' 채워지므로 데이터 손실 0.
  if (r.schemaVersion === 7) {
    if (Array.isArray(r.insights)) {
      for (const i of r.insights as unknown[]) {
        if (!i || typeof i !== 'object') return false;
        const ie = i as Record<string, unknown>;
        if (typeof ie.id !== 'string' || ie.id.length === 0) return false;
        if (typeof ie.text !== 'string') return false;
        if (typeof ie.createdAt !== 'string') return false;
        if (typeof ie.interestId !== 'string') return false;
      }
    }
  }

  return true;
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
  const today = getKstDateStr();

  // lazy regen (in-memory only — saveUser 는 caller 책임, 아래 단일 호출)
  getActiveMissions(now, u);

  // prev snapshot은 localStorage 기준 — lazy regen 결과는 saveUser 이후에야 persist됨.
  // detectEvents (T5/T9 guard) 가 새 instance + 즉시 완수 케이스를 정확히 처리한다.
  const prev = takeSnapshot();

  // v3.21 T5 (Option B): consume 결과 캡처 → saveUser 성공 후 dispatch (false-fire 방지).
  let freezeConsumed = 0;
  let freezePreserved = true;

  if (u.lastActiveDate !== today) {
    // v3.21 T3: Duolingo 정석 — regen 먼저 → consume → streak update.
    // 1주+ 결석한 사용자가 진입 시 regen 안 하면 freeze cover 못 함 (사전 review R2).
    regenerateFreeze(u, now);

    if (!u.lastActiveDate) {
      // 신규 user (lastActiveDate empty) → streak 1로 시작 (R10).
      // freeze 변경 없음 (consume 호출 안 함).
      u.streak = 1;
    } else {
      // gap = today와 lastActiveDate 차이 - 1 (KST anchor — Pattern A graduated v3.14.5).
      const lastMs = Date.parse(u.lastActiveDate + 'T00:00:00+09:00');
      const todayMs = Date.parse(today + 'T00:00:00+09:00');
      const gap = Math.max(0, Math.round((todayMs - lastMs) / 86400_000) - 1);
      const result = consumeFreezeForGap(u, gap);
      freezeConsumed = result.consumed;
      freezePreserved = result.preserved;
      u.streak = result.preserved ? u.streak + 1 : 1;
    }
  }

  u.xp += xpDelta;
  u.lastActiveDate = today;

  // mission progress tick (xp 보너스 포함) — saveUser 이전에 in-memory 변경
  tickMissionProgress(u, 'answer', now);

  saveUser(u);  // single saveUser: xp/streak/missions 모두 커버. throws on Quota — sweep 안 함

  // v3.21 T5 (사전 review P0-2 fix): saveUser 성공 후 caller-side direct dispatch.
  // sweep 우회 — Snapshot.freezeCount delta는 regen+1/consume−1 시 net=0 false-negative.
  // Option B: saveUser 이후에 dispatch → throw 시 dispatch 도달 안 함 (v3.12 false-fire invariant 정합).
  if (freezeConsumed > 0 && freezePreserved) {
    dispatch('dg:reward:streak-freeze-used', { days: freezeConsumed });
  }

  const curr = takeSnapshot();
  runSweep(prev, curr);
}

export function updateStreakBanner(rootId = 'streakBanner'): void {
  const el = document.getElementById(rootId);
  const u = loadUserData();
  if (!el || !u) return;
  if (u.streak <= 0) {
    el.textContent = '오늘부터 다시 시작해봐요';
    return;
  }
  // v3.21 T4: count > 0일 때만 ❄️ N suffix (Duolingo 정석 — freeze 0이면 숨김).
  const freezeSuffix = u.streakFreeze.count > 0 ? ` · ❄️ ${u.streakFreeze.count}` : '';
  el.textContent = `🔥 ${u.streak}일 연속 성장 중${freezeSuffix}`;
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
