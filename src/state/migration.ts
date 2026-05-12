import { CURRENT_SCHEMA_VERSION, isVersioned, type Answer, type UserSettings } from './schema';
import { getKstDateStr } from '../utils/dates';

/**
 * Normalize a raw value into a Phase B Answer.
 * Handles three input shapes:
 *   - Already-migrated Phase B shape (schemaVersion === 1 with `text` field) — pass-through
 *   - Legacy v2.0 shape: { id?, date, type, answer, evaluation?, questionId? } — map to Phase B
 *   - Anything else — best-effort coerce
 */
export function migrateAnswer(raw: unknown): Answer {
  const r = (raw ?? {}) as Partial<Answer> & Record<string, unknown>;

  // Already Phase B + has text → COPY + pinned backfill (v3.28 T2 P0-3: no in-place mutation)
  if (isVersioned(r) && r.schemaVersion === CURRENT_SCHEMA_VERSION && typeof r.text === 'string') {
    return {
      ...(r as Answer),
      pinned: typeof r.pinned === 'boolean' ? r.pinned : false,
    };
  }

  // Legacy v2.0 had `answer` field and `date` as YYYY-MM-DD
  const legacyAnswer = typeof r['answer'] === 'string' ? (r['answer'] as string) : '';
  const legacyDate = typeof r['date'] === 'string' ? (r['date'] as string) : '';
  const legacyType = typeof r['type'] === 'string' ? (r['type'] as string) : undefined;
  const legacyEval = (r['evaluation'] && typeof r['evaluation'] === 'object')
    ? (r['evaluation'] as { score: number; feedback: string })
    : undefined;

  const createdAt = typeof r.createdAt === 'string'
    ? r.createdAt
    : legacyDate
      ? `${legacyDate}T00:00:00.000Z`
      : new Date().toISOString();

  return {
    id: String(r.id ?? `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    questionId: String(r.questionId ?? ''),
    text: String(r.text ?? legacyAnswer),
    authorId: String(r.authorId ?? 'self'),
    createdAt,
    type: legacyType ?? (typeof r.type === 'string' ? (r.type as string) : undefined),
    evaluation: legacyEval ?? (r.evaluation as { score: number; feedback: string } | undefined),
    date: legacyDate || (typeof r.date === 'string' ? (r.date as string) : undefined),
    // v3.28 T2 (P2-2): legacy 분기도 pinned 정규화 (raw가 pinned 가질 가능성 미미하지만 invariant 일관성).
    pinned: typeof r.pinned === 'boolean' ? r.pinned : false,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

export function migrateUserSettings(raw: unknown): UserSettings {
  const r = (raw ?? {}) as Partial<UserSettings> & Record<string, unknown>;
  if (isVersioned(r) && r.schemaVersion === CURRENT_SCHEMA_VERSION) return r as UserSettings;
  return {
    userId: String(r.userId ?? ''),
    optIns: (r.optIns as Record<string, boolean> | undefined) ?? {},
    policyVersion: r.policyVersion as string | undefined,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

export function migrateUnknown<T extends Record<string, unknown>>(raw: T): T & { schemaVersion: typeof CURRENT_SCHEMA_VERSION } {
  return { ...raw, schemaVersion: CURRENT_SCHEMA_VERSION };
}

import type { User, Insight } from './user';
import { validateInterestId } from './user';
import type { MissionInstance } from './missionTypes';
import type { PlantState } from './plantTypes';

/**
 * v3.12: User v1 → v2 마이그레이션.
 * - drop `level` (computed via getCurrentTier(xp).id)
 * - add earnedBadges / gamificationMigrated / schemaVersion: 2
 *
 * backfill (이미 자격 있는 뱃지 unlock)은 T13 환영 모달에서 처리.
 *
 * v3.12.1: `any` → `unknown` (sibling 컨벤션 일치, migrateAnswer/Settings와 동일).
 */
export function migrateUserToV2(raw: unknown): User {
  const r = (raw ?? {}) as Record<string, unknown>;
  // v3.27 T1 (Codex 사전 P0-1): chain superset — v8 user → same reference (forward-compat).
  if (r.schemaVersion === 8) return r as unknown as User;
  const v2 = { ...r, schemaVersion: 2 } as Record<string, unknown>;
  delete v2.level;
  v2.earnedBadges = v2.earnedBadges ?? {};
  v2.gamificationMigrated = v2.gamificationMigrated ?? false;
  // v3.14.2 T13 (P2-NEW-5): caller(getCachedUser)에서 isValidUserShape 가드로 검증되므로
  // 여기서는 partial → User 단일 cast로 narrow 의도 명시. 이중 cast(`as unknown as User`) 제거.
  // zod 등 schema validation 도입 시 cast 자체 제거 예정.
  return v2 as Partial<User> as User;
}

/**
 * v3.14.5 T3: MissionInstance shape guard — defId가 string이어야 유효한 인스턴스.
 * missing/non-string defId를 가진 element를 active 배열에서 차단한다.
 */
function isValidMissionInstance(m: unknown): m is MissionInstance {
  if (typeof m !== 'object' || m === null) return false;
  const r = m as Record<string, unknown>;
  return typeof r.defId === 'string';
}

/**
 * v3.14.4 T2: MissionInstance numeric field 가드.
 * windowStart/progress가 NaN/Infinity인 경우 0으로 normalize.
 * hand-edited LS 또는 future migration JSON-bypass로 인한 silent corruption 차단.
 * (seen.ts firstSeenAt / usage.ts와 동일 패턴.)
 *
 * v3.14.5 T3: progressDates array element guard.
 * codex 사전 P1-1: progressDates는 readonly string[] (missionTypes.ts:28) — 별도 할당 시
 * TS strict readonly 충돌. object literal 안에서 처리해야 함.
 */
function sanitizeMissionInstance(m: MissionInstance): MissionInstance {
  return {
    ...m,
    windowStart: typeof m.windowStart === 'number' && Number.isFinite(m.windowStart) ? m.windowStart : 0,
    progress: typeof m.progress === 'number' && Number.isFinite(m.progress) ? m.progress : 0,
    progressDates: Array.isArray(m.progressDates)
      ? m.progressDates.filter((d): d is string => typeof d === 'string')
      : m.progressDates,
  };
}

/**
 * v3.15 T16.1 (P0-1 fix): mission normalization 로직을 별도 helper로 추출.
 * v3 idempotent path와 v4 early return path 모두에서 호출하여
 * malformed mission 데이터를 가진 v4 user도 sanitize하도록 보장.
 *
 * @param v - Partial<User> with missions field — in-memory mutate 없이 normalized missions 반환
 * @returns normalized missions object
 */
function buildNormalizedMissions(v: { missions?: Partial<User['missions']> }): User['missions'] {
  const m = v.missions;
  if (!m || !Array.isArray(m.active)) {
    return {
      active: [] as MissionInstance[],
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '',
      currentWeekIso: '',
      currentMonthIso: '',
    };
  }
  const cumulative = {
    dailyCount: Number.isFinite(m.cumulative?.dailyCount) ? (m.cumulative!.dailyCount as number) : 0,
    weeklyCount: Number.isFinite(m.cumulative?.weeklyCount) ? (m.cumulative!.weeklyCount as number) : 0,
    monthlyCount: Number.isFinite(m.cumulative?.monthlyCount) ? (m.cumulative!.monthlyCount as number) : 0,
  };
  return {
    active: (m.active as unknown[]).filter(isValidMissionInstance).map(sanitizeMissionInstance),
    cumulative,
    lastDailySeed: typeof m.lastDailySeed === 'string' ? m.lastDailySeed : '',
    currentWeekIso: typeof m.currentWeekIso === 'string' ? m.currentWeekIso : '',
    currentMonthIso: typeof m.currentMonthIso === 'string' ? m.currentMonthIso : '',
  };
}

/**
 * v3.13: schema v2 → v3 — missions 필드 추가.
 * - active 빈 배열, cumulative 0, ISO 필드 빈 문자열.
 * - shape guard: missions 필드 NaN/잘못된 타입 차단 (silent corruption 방지).
 * - idempotent: 이미 v3이고 missions.active가 배열이면 필드만 보강 후 반환.
 *
 * v3.13.1 T3: idempotent path를 in-place mutation → immutable spread로 전환
 * (carry-forward T1, v3.12 #3 closeout). caller가 raw.missions 참조를 보유해도
 * 보강 작업이 그 객체로 leak 되지 않음 (missions 서브트리 atomic guarantee — 다른 사용자 필드는 spread shallow-share).
 *
 * v3.14.4 T2: `active` 배열은 sanitizeMissionInstance로 새 배열·새 인스턴스 객체를 생성하여 반환한다.
 * 이전(v3.13.1)에는 reference 유지가 invariant였으나, NaN/Infinity 차단을 위해 한 번만(one-shot)
 * 마이그레이션 시점에 새 객체로 대체한다. migrateUserToV3는 진입점이므로 caller는 반환값을 사용하고
 * 이후 tickMissionProgress의 in-place mutation은 새 인스턴스 위에서 정상 동작한다 (v3.13 spec C6
 * invariant — migration 이후 시점에는 동일하게 유지).
 *
 * raw 입력 narrowing: `Partial<User> & {…}` 형태로 좁혀, `unknown` 단일 cast
 * (`as User`)에서 발생하던 미정의 필드 접근 시 type-safety 약화를 보강.
 *
 * v3.15 T16.1 (P0-1 fix): v4 early return도 buildNormalizedMissions로 mission normalization 적용.
 * malformed mission 데이터를 가진 v4 user가 조용히 로드되는 문제 해소.
 */
export function migrateUserToV3(raw: unknown): User {
  // v3.21 T1: schemaVersion 비교를 위해 schemaVersion만 number로 좁히고 나머지는 Partial<User> narrowing.
  // (User.schemaVersion이 v5 literal이라 v3/v4 비교 시 TS2367 회피)
  const v = raw as Omit<Partial<User>, 'schemaVersion'> & {
    schemaVersion?: number;
    missions?: Partial<User['missions']>;
  };
  // v3.27 T1 (Codex 사전 P0-1): chain superset — v8 user → same reference (forward-compat).
  // v8을 v4~v7 superset 분기에 합류시키면 mission normalize로 NEW reference가 되어 invariant 위반.
  if (v?.schemaVersion === 8) return v as unknown as User;
  // S5 fix (Codex P0-1): v4 user는 v3 migrate 통과 — schemaVersion=3 덮어쓰고 missions reset 방지.
  // v4가 v3의 superset (plantStateByInterest + gardenIntroduced + gardenBackfilled 추가)이므로
  // 모든 v3 필드 보존되어 안전.
  // v3.15 T16.1 (P0-1 fix): plant 필드는 그대로 두고, missions만 normalize.
  // v3.21 T1: v5도 v4의 superset (streakFreeze 추가)이므로 동일 분기 적용.
  // v3.23 T1 (P0-1 fix): v6도 v5의 superset (insights 추가)이므로 동일 분기 적용.
  // v3.25 T2 (chain superset): v7도 v6의 superset (Insight.interestId 추가)이므로 동일 분기 적용.
  if (v?.schemaVersion === 4 || v?.schemaVersion === 5 || v?.schemaVersion === 6 || v?.schemaVersion === 7) {
    return {
      ...(v as User),
      missions: buildNormalizedMissions(v),
    };
  }

  if (v?.schemaVersion === 3 && v.missions && Array.isArray(v.missions.active)) {
    // v3.15 T16.1 (P0-1 fix): buildNormalizedMissions helper로 통합 (v4 path와 동일 sanitize 적용).
    return {
      ...(v as User),
      missions: buildNormalizedMissions(v),
    };
  }
  return {
    ...(v as User),
    schemaVersion: 3 as unknown as 4,   // intermediate v3 shape — migrateUserToV4가 곧바로 v4로 올림
    missions: {
      active: [] as MissionInstance[],
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '',
      currentWeekIso: '',
      currentMonthIso: '',
    },
  } as unknown as User;
}

/**
 * v3.15: schema v3 → v4 — 분야별 식물 정원(plantStateByInterest) 추가.
 * - plantStateByInterest: 빈 정원으로 초기화 (backfill은 별도 task에서).
 * - gardenIntroduced: 환영 모달 1회 flag.
 * - gardenBackfilled: backfill idempotent flag.
 * - idempotent: 이미 v4면 그대로 반환 (early return, same reference).
 */
export function migrateUserToV4(u: unknown): User {
  // 입력은 v2 또는 v3 사용자 (migrateUserToV3 통과 직후 호출 가정)
  const r = u as Record<string, unknown> & {
    schemaVersion?: number;
    plantStateByInterest?: unknown;
    gardenIntroduced?: unknown;
    gardenBackfilled?: unknown;
  };

  // v3.21 T1: v5 user도 v4의 superset이므로 plantStateByInterest 보존 위해 early return.
  // v3.23 T1 (P0-1 fix): v6도 v5의 superset이므로 동일 분기 적용.
  // v3.25 T2 (chain superset): v7도 v6의 superset이므로 동일 분기 적용.
  // v3.27 T1 (Codex 사전 P0-1): v8도 v7의 superset이므로 동일 분기 적용.
  if (r.schemaVersion === 4 || r.schemaVersion === 5 || r.schemaVersion === 6 || r.schemaVersion === 7 || r.schemaVersion === 8) return r as unknown as User;

  // v3 → v4 lazy: 빈 정원 + flag 0
  const migrated = {
    ...r,
    schemaVersion: 4 as const,
    plantStateByInterest:
      typeof r.plantStateByInterest === 'object' && r.plantStateByInterest !== null
        ? (r.plantStateByInterest as Record<string, PlantState>)
        : {},
    gardenIntroduced: typeof r.gardenIntroduced === 'boolean' ? r.gardenIntroduced : false,
    gardenBackfilled: typeof r.gardenBackfilled === 'boolean' ? r.gardenBackfilled : false,
  };
  return migrated as unknown as User;
}

/**
 * v3.21 T1: schema v4 → v5 — Streak Freeze 필드 추가.
 * - streakFreeze: { count: number; lastEarnedAt: string } 신규 필드 (default {count: 2, lastEarnedAt: today}).
 * - idempotent: 이미 v5면 그대로 반환 (early return, same reference).
 * - 손상된 streakFreeze (NaN/undefined/음수/cap 초과/empty string) → default 복구.
 *
 * 위험:
 *   - silent NaN (v3.12 lesson) → shape guard에서 isFinite + range check.
 *   - lazy migration race (v3.12 lesson) — caller(getCachedUser)가 isValidUserShape 가드로 검증.
 */
export function migrateUserToV5(u: unknown): User {
  const r = u as Record<string, unknown> & {
    schemaVersion?: number;
    streakFreeze?: unknown;
  };

  // v3.23 T1 (P0-1 fix): v6도 v5의 superset이므로 early return.
  // v3.25 T2 (chain superset): v7도 v6의 superset이므로 동일 분기 적용.
  // v3.27 T1 (Codex 사전 P0-1): v8도 v7의 superset이므로 동일 분기 적용.
  if (r.schemaVersion === 5 || r.schemaVersion === 6 || r.schemaVersion === 7 || r.schemaVersion === 8) return r as unknown as User;

  // v4 → v5 lazy: streakFreeze 신규 또는 손상 시 default.
  // v3.22 P2-2: 머신 TZ 무관하게 KST 자정 anchor (Intl.DateTimeFormat).
  const today = getKstDateStr();
  const sf = r.streakFreeze as { count?: unknown; lastEarnedAt?: unknown } | undefined | null;

  const validCount =
    sf !== undefined && sf !== null
    && typeof sf.count === 'number' && Number.isFinite(sf.count)
    && sf.count >= 0 && sf.count <= 2;
  const validDate =
    sf !== undefined && sf !== null
    && typeof sf.lastEarnedAt === 'string' && sf.lastEarnedAt.length > 0;

  const streakFreeze =
    validCount && validDate
      ? { count: sf!.count as number, lastEarnedAt: sf!.lastEarnedAt as string }
      : { count: 2, lastEarnedAt: today };

  return {
    ...r,
    schemaVersion: 5 as const,
    streakFreeze,
  } as unknown as User;
}

/**
 * v3.23 T1: schema v5 → v6 — Insight 필드 추가.
 * - insights: Insight[] 신규 필드 (default []).
 * - idempotent: 이미 v6이면 그대로 반환 (early return, same reference).
 * - 손상된 insights (non-array) → default [] 복구.
 *
 * @internal Caller invariant — 본 함수는 input이 ≥ v4 (또는 getCachedUser chain
 *   통과 후) 라고 가정하고 inner `migrateUserToV5(u)`만 호출한다. v3 user를
 *   직접 전달하면 `plantStateByInterest` / `gardenIntroduced` / `gardenBackfilled`
 *   default가 누락되어 `isValidUserShape`가 reject. production path는
 *   `getCachedUser`가 V3→V4→V5→V6 순서대로 호출하므로 안전.
 *
 * 정합성:
 *   - non-array insights (string/NaN/null 등) → isArray guard로 복구.
 *   - chain superset (P0-1 fix): V3/V4/V5 early-return에 v6 guard 추가됨.
 */
export function migrateUserToV6(u: unknown): User {
  const r = u as Record<string, unknown> & {
    schemaVersion?: number;
    insights?: unknown;
  };

  // v3.25 T2 (chain superset): v7도 v6의 superset이므로 동일 분기 적용.
  // v3.27 T1 (Codex 사전 P0-1): v8도 v7의 superset이므로 동일 분기 적용.
  if (r.schemaVersion === 6 || r.schemaVersion === 7 || r.schemaVersion === 8) return r as unknown as User;

  // v5까지 lift (V5 early-return이 v6 guard됨 — 불필요 이중 lift 없음)
  const v5 = migrateUserToV5(u);

  // insights: 기존 배열 보존, 손상(non-array) → default []
  const v5r = v5 as unknown as Record<string, unknown>;
  const insights: Insight[] = Array.isArray(v5r.insights)
    ? (v5r.insights as Insight[])
    : [];

  return {
    ...v5,
    schemaVersion: 6 as const,
    insights,
  } as unknown as User;
}

/**
 * v3.25 T2: schema v6 → v7 — Insight.interestId 필드 추가.
 * - 기존 insights[]에 interestId='unknown' default 채움.
 * - id/text 누락 entry는 silent drop (corruption 폴백, v3.25 spec §3 P0-A2).
 * - validateInterestId로 invalid id → 'unknown' 폴백 (case-sensitive whitelist).
 * - idempotent: 이미 v7이면 그대로 반환 (early return).
 *
 * @internal Caller invariant — `getCachedUser` chain (V3→V4→V5→V6→V7) 후 호출.
 *   chain superset 패턴 (v3.23 lesson): V3/V4/V5/V6 early-return에 v7 guard 추가됨.
 */
export function migrateUserToV7(u: unknown): User {
  const r = u as Record<string, unknown> & {
    schemaVersion?: number;
    insights?: unknown;
  };

  // v3.27 T1 (Codex 사전 P0-1): v8도 v7의 superset이므로 same reference.
  if (r.schemaVersion === 7 || r.schemaVersion === 8) return r as unknown as User;

  // v6까지 lift (V6 early-return이 v7 guard됨 — 불필요 이중 lift 없음)
  const v6 = migrateUserToV6(u);
  const v6r = v6 as unknown as Record<string, unknown>;

  // insights 마이그레이션 (id/text 누락 entry drop + interestId 폴백)
  const insightsIn = Array.isArray(v6r.insights) ? (v6r.insights as unknown[]) : [];
  const insights: Insight[] = insightsIn
    .map((i: unknown) => {
      const ie = (i ?? {}) as Record<string, unknown>;
      return {
        id: typeof ie.id === 'string' ? ie.id : '',
        text: typeof ie.text === 'string' ? ie.text : '',
        createdAt: typeof ie.createdAt === 'string' ? ie.createdAt : new Date().toISOString(),
        interestId: typeof ie.interestId === 'string'
          ? validateInterestId(ie.interestId)
          : 'unknown',
        // v3.28 T2 (P2-2): forward-compat pinned default — chain은 v7→v8에서 한 번 더 normalize.
        pinned: typeof ie.pinned === 'boolean' ? ie.pinned : false,
      };
    })
    .filter((i) => i.id.length > 0 && i.text.length > 0);  // 손상 entry drop

  return {
    ...v6,
    schemaVersion: 7 as const,
    insights,
  } as unknown as User;
}

/**
 * v3.27 T1: schema v7 → v8 — Insight.pinned default false + xpHistory 신설.
 * - Insight.pinned: undefined → false (기존 .pinned=true forward-compat 보존).
 * - xpHistory: { date: string; xpEarned: number }[] 신설 (default []).
 *   답변 entry 시점에 recordDailyAnswer가 push (KST date anchor).
 * - chain superset (Codex 사전 P0-1): V2~V7 + getCachedUser allowlist에 v8 early-return guard 추가됨.
 *   v8 user는 V2~V7 모두 same reference로 통과 (forward-compat 보장).
 *
 * @internal Caller invariant — `getCachedUser` chain (V3→V4→V5→V6→V7→V8) 후 호출.
 */
export function migrateUserToV8(u: unknown): User {
  const r = u as Record<string, unknown> & {
    schemaVersion?: number;
    insights?: unknown;
    xpHistory?: unknown;
  };

  if (r.schemaVersion === 8) {
    // 이미 v8이지만 already-v8 path에서도 insights/pinned/xpHistory invariant 보장 (P1 흡수 + per-task review fix)
    const insightsValid = Array.isArray(r.insights);
    const rawInsights = insightsValid ? (r.insights as unknown[]) : [];
    const xpHistoryValid = Array.isArray(r.xpHistory);

    // 모든 insight의 pinned가 boolean이고 insights/xpHistory가 array면 same-reference 유지 (idempotency)
    const allPinnedValid = rawInsights.every((i) => {
      const ie = (i ?? {}) as Record<string, unknown>;
      return typeof ie.pinned === 'boolean';
    });

    if (insightsValid && allPinnedValid && xpHistoryValid) {
      return r as unknown as User; // 진짜 idempotent
    }

    // Copy-based 백필 (in-place mutation 금지)
    const insights = rawInsights.map((i) => {
      const ie = (i ?? {}) as Record<string, unknown>;
      return {
        ...ie,
        pinned: typeof ie.pinned === 'boolean' ? ie.pinned : false,
      };
    });
    return {
      ...r,
      insights,
      xpHistory: xpHistoryValid ? r.xpHistory : [],
    } as unknown as User;
  }

  // v7까지 lift (V7 early-return이 v8 guard됨 — 불필요 이중 lift 없음)
  const v7 = migrateUserToV7(u);
  const v7r = v7 as unknown as Record<string, unknown>;

  // Insight.pinned default false (기존 .pinned=true forward-compat 보존)
  const insights = (Array.isArray(v7r.insights) ? v7r.insights : []).map((i: unknown) => {
    const ie = (i ?? {}) as Record<string, unknown>;
    return {
      ...ie,
      pinned: typeof ie.pinned === 'boolean' ? ie.pinned : false,
    };
  });

  // xpHistory default [] — 손상(non-array) → []
  const xpHistory = Array.isArray(v7r.xpHistory) ? v7r.xpHistory : [];

  return {
    ...v7,
    schemaVersion: 8 as const,
    insights,
    xpHistory,
  } as unknown as User;
}
