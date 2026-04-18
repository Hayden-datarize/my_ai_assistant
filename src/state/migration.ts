import { CURRENT_SCHEMA_VERSION, isVersioned, type Answer, type UserSettings } from './schema';

export function migrateAnswer(raw: unknown): Answer {
  const r = (raw ?? {}) as Partial<Answer> & Record<string, unknown>;
  if (isVersioned(r) && r.schemaVersion === CURRENT_SCHEMA_VERSION) return r as Answer;
  return {
    id: String(r.id ?? ''),
    questionId: String(r.questionId ?? ''),
    text: String(r.text ?? ''),
    authorId: String(r.authorId ?? ''),
    createdAt: String(r.createdAt ?? new Date().toISOString()),
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
