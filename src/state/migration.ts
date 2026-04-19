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
