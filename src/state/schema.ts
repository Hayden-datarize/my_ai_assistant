export const CURRENT_SCHEMA_VERSION = 1 as const;

export type SchemaVersion = 0 | 1;

export interface Versioned {
  schemaVersion: SchemaVersion;
}

export interface Answer extends Versioned {
  id: string;
  questionId: string;
  text: string;
  authorId: string;
  createdAt: string;
}

export interface UserSettings extends Versioned {
  userId: string;
  optIns: Record<string, boolean>;
  policyVersion?: string;
}

export interface ArchiveEntry extends Versioned {
  id: string;
  date: string;
  category: string;
  payload: Record<string, unknown>;
}

export function makeAnswer(input: Omit<Answer, 'schemaVersion' | 'createdAt'>): Answer {
  return { ...input, schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: new Date().toISOString() };
}

export function makeUserSettings(input: { userId: string }): UserSettings {
  return { userId: input.userId, optIns: {}, schemaVersion: CURRENT_SCHEMA_VERSION };
}

export function makeArchiveEntry(input: Omit<ArchiveEntry, 'schemaVersion'>): ArchiveEntry {
  return { ...input, schemaVersion: CURRENT_SCHEMA_VERSION };
}

export function isVersioned(value: unknown): value is Versioned {
  return typeof value === 'object' && value !== null && typeof (value as Versioned).schemaVersion === 'number';
}
