import { CURRENT_SCHEMA_VERSION, isVersioned, type Answer, type UserSettings } from './schema';

/**
 * Normalize a raw value into a Phase B Answer.
 * Handles three input shapes:
 *   - Already-migrated Phase B shape (schemaVersion === 1 with `text` field) — pass-through
 *   - Legacy v2.0 shape: { id?, date, type, answer, evaluation?, questionId? } — map to Phase B
 *   - Anything else — best-effort coerce
 */
export function migrateAnswer(raw: unknown): Answer {
  const r = (raw ?? {}) as Partial<Answer> & Record<string, unknown>;

  // Already Phase B + has text → pass-through
  if (isVersioned(r) && r.schemaVersion === CURRENT_SCHEMA_VERSION && typeof r.text === 'string') {
    return r as Answer;
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

import type { User } from './user';
import type { MissionInstance } from './missionTypes';

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
 */
export function migrateUserToV3(raw: unknown): User {
  const v = raw as Partial<User> & {
    schemaVersion?: number;
    missions?: Partial<User['missions']>;
  };
  if (v?.schemaVersion === 3 && v.missions && Array.isArray(v.missions.active)) {
    const m = v.missions;
    const cumulative = {
      dailyCount: Number.isFinite(m.cumulative?.dailyCount) ? (m.cumulative!.dailyCount as number) : 0,
      weeklyCount: Number.isFinite(m.cumulative?.weeklyCount) ? (m.cumulative!.weeklyCount as number) : 0,
      monthlyCount: Number.isFinite(m.cumulative?.monthlyCount) ? (m.cumulative!.monthlyCount as number) : 0,
    };
    return {
      ...(v as User),
      missions: {
        // v3.14.4 T2: 각 MissionInstance의 windowStart/progress NaN/Infinity 차단.
        // 새 outer 배열 + 새 inner 객체를 생성 (이전 v3.13.1의 reference passthrough invariant
        // 의도적으로 완화 — sanitize는 마이그레이션 시점 one-shot, 이후 tickMissionProgress의
        // in-place mutation은 새 인스턴스 위에서 정상 동작).
        // v3.14.5 T3: shape guard로 malformed element (missing/non-string defId) 차단,
        // 이후 numeric/progressDates sanitize 적용.
        active: (m.active as unknown[]).filter(isValidMissionInstance).map(sanitizeMissionInstance),
        cumulative,
        lastDailySeed: typeof m.lastDailySeed === 'string' ? m.lastDailySeed : '',
        currentWeekIso: typeof m.currentWeekIso === 'string' ? m.currentWeekIso : '',
        currentMonthIso: typeof m.currentMonthIso === 'string' ? m.currentMonthIso : '',
      },
    };
  }
  return {
    ...(v as User),
    schemaVersion: 3,
    missions: {
      active: [] as MissionInstance[],
      cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '',
      currentWeekIso: '',
      currentMonthIso: '',
    },
  };
}
