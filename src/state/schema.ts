export const CURRENT_SCHEMA_VERSION = 1 as const;

export type SchemaVersion = 0 | 1;

export interface Versioned {
  schemaVersion: SchemaVersion;
}

export interface Answer extends Versioned {
  id: string;
  questionId: string;
  text: string;          // primary answer body (was legacy `answer`)
  authorId: string;      // 'self' for single-user v3.1
  createdAt: string;     // ISO string
  /** v3.11: 답변 시점의 질문 본문. 기존 답변엔 없음(undefined → archive에서 graceful degrade). */
  questionText?: string;
  /** legacy: question type label ('분석' | '전환' | '실무' | '성장' | '트렌드' | etc.). optional, kept for archive filter + stats breakdown. */
  type?: string;
  /** legacy AI evaluation score + feedback. optional. */
  evaluation?: { score: number; feedback: string };
  /** legacy 'YYYY-MM-DD'. optional, kept for archive daily grouping. */
  date?: string;
  /** v3.27 T1: archive 핀(즐겨찾기). default false. lazy migration — undefined인 기존 entry는 unpinned로 처리. */
  pinned?: boolean;
}

export interface UserSettings extends Versioned {
  userId: string;
  optIns: Record<string, boolean>;
  policyVersion?: string;
}

export function makeAnswer(input: Omit<Answer, 'schemaVersion' | 'createdAt'>): Answer {
  return { ...input, schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: new Date().toISOString() };
}

export function makeUserSettings(input: { userId: string }): UserSettings {
  return { userId: input.userId, optIns: {}, schemaVersion: CURRENT_SCHEMA_VERSION };
}

export function isVersioned(value: unknown): value is Versioned {
  return typeof value === 'object' && value !== null && typeof (value as Versioned).schemaVersion === 'number';
}
