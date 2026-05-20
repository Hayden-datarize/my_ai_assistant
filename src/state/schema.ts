export const CURRENT_SCHEMA_VERSION = 1 as const;

type SchemaVersion = 0 | 1;

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
  /** v3.27 T1 → v3.28 T2: archive 핀(즐겨찾기). default false. write-side normalize (P2-2) — `makeAnswer` + `migrateAnswer` 모두 boolean 보장. */
  pinned: boolean;
  /** v3.39 T2: 사용자 관심분야 id (INTERESTS.id 또는 'unknown'). validateInterestId 통과 의무. boundary normalize (loadAnswers → migrateAnswer + normalizeAnswerInterestIds). */
  interestId: string;
}

export interface UserSettings extends Versioned {
  userId: string;
  optIns: Record<string, boolean>;
  policyVersion?: string;
}

export function makeAnswer(
  input: Omit<Answer, 'schemaVersion' | 'createdAt' | 'pinned' | 'interestId'> & {
    pinned?: boolean;
    interestId?: string;
  },
): Answer {
  // v3.28 T2 (P2-2): pinned default false (input.pinned 명시 시 override). spread 앞에 두어 input override 허용 패턴.
  // v3.39 T2: interestId 기본값 'unknown' (caller가 chat-summary inferredInterestId 등으로 명시 권장; 미지정 edge 대비).
  return {
    pinned: false,
    interestId: 'unknown',
    ...input,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
  };
}

export function makeUserSettings(input: { userId: string }): UserSettings {
  return { userId: input.userId, optIns: {}, schemaVersion: CURRENT_SCHEMA_VERSION };
}

export function isVersioned(value: unknown): value is Versioned {
  return typeof value === 'object' && value !== null && typeof (value as Versioned).schemaVersion === 'number';
}
