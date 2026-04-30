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
  return v2 as unknown as User;
}

/**
 * v3.13: schema v2 → v3 — missions 필드 추가.
 * - active 빈 배열, cumulative 0, ISO 필드 빈 문자열.
 * - shape guard: missions 필드 NaN/잘못된 타입 차단 (silent corruption 방지).
 * - idempotent: 이미 v3이고 missions.active가 배열이면 필드만 보강 후 반환.
 */
export function migrateUserToV3(raw: unknown): User {
  const v = (raw as User & { schemaVersion?: number });
  if (v?.schemaVersion === 3 && v.missions && Array.isArray(v.missions.active)) {
    const m = v.missions;
    m.cumulative = m.cumulative ?? { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 };
    if (typeof m.cumulative.dailyCount !== 'number') m.cumulative.dailyCount = 0;
    if (typeof m.cumulative.weeklyCount !== 'number') m.cumulative.weeklyCount = 0;
    if (typeof m.cumulative.monthlyCount !== 'number') m.cumulative.monthlyCount = 0;
    if (typeof m.lastDailySeed !== 'string') m.lastDailySeed = '';
    if (typeof m.currentWeekIso !== 'string') m.currentWeekIso = '';
    if (typeof m.currentMonthIso !== 'string') m.currentMonthIso = '';
    return v as User;
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
