import { migrateAnswer, migrateUserSettings } from './migration';
import { makeUserSettings, type Answer, type UserSettings } from './schema';

const KEYS = {
  answers: 'dg.answers',
  legacyAnswers: 'answers', // v2.0 legacy key — migrated on first load
  userSettings: (userId: string) => `dg.userSettings.${userId}`,
} as const;

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Load all answers. On first call for a v2.0 user, the legacy `answers` key is
 * read, migrated to Phase B shape, written to `dg.answers`, and the legacy key
 * is deleted. Subsequent calls read only from `dg.answers`.
 */
export function loadAnswers(): Answer[] {
  const phaseB = readJson<unknown[]>(KEYS.answers, []);
  if (Array.isArray(phaseB) && phaseB.length > 0) {
    return phaseB.map(migrateAnswer);
  }
  const legacy = readJson<unknown[]>(KEYS.legacyAnswers, []);
  if (!Array.isArray(legacy) || legacy.length === 0) return [];
  const migrated = legacy.map(migrateAnswer);
  saveAnswers(migrated);
  try { localStorage.removeItem(KEYS.legacyAnswers); } catch { /* ignore */ }
  return migrated;
}

export function saveAnswers(answers: Answer[]): void {
  localStorage.setItem(KEYS.answers, JSON.stringify(answers));
}

/**
 * Append a new answer. Returns the stored id. Handlers use this for the submit
 * flow; prefer this over constructing + saveAnswers(...) from callers.
 */
export function appendAnswer(answer: Answer): string {
  const list = loadAnswers();
  list.unshift(answer);
  saveAnswers(list);
  return answer.id;
}

export function deleteAnswerById(id: string): void {
  const next = loadAnswers().filter((a) => a.id !== id);
  saveAnswers(next);
}

export function deleteAnswersByIds(ids: string[]): void {
  if (ids.length === 0) return;
  const set = new Set(ids);
  const next = loadAnswers().filter((a) => !set.has(a.id));
  saveAnswers(next);
}

export function deleteAllAnswers(): void {
  saveAnswers([]);
}

export function findAnswer(id: string): Answer | undefined {
  return loadAnswers().find(a => a.id === id);
}

export function setAnswerEvaluation(id: string, evaluation: { score: number; feedback: string }): void {
  const list = loadAnswers();
  const idx = list.findIndex(a => a.id === id);
  if (idx < 0) return;
  const target = list[idx];
  if (!target) return;
  target.evaluation = evaluation;
  saveAnswers(list);
}

/**
 * Aggregate stats across all answers. `byType` counts each `type` label;
 * `weakestType` picks the type with the lowest count among types that have
 * at least one answer (falls back to 'reflection' when empty).
 */
export function aggregateAnswerStats(): {
  total: number;
  byType: Record<string, number>;
  weakestType: string;
} {
  const list = loadAnswers();
  const byType: Record<string, number> = {};
  for (const a of list) {
    const t = a.type ?? 'unknown';
    byType[t] = (byType[t] ?? 0) + 1;
  }
  const seen = Object.keys(byType);
  let weakestType = 'reflection';
  if (seen.length > 0) {
    weakestType = seen.reduce((min, t) => ((byType[t] ?? 0) < (byType[min] ?? Infinity) ? t : min), seen[0] ?? 'reflection');
  }
  return { total: list.length, byType, weakestType };
}

export function loadUserSettings(userId: string): UserSettings {
  const raw = readJson<unknown>(KEYS.userSettings(userId), null);
  if (raw == null) return makeUserSettings({ userId });
  return migrateUserSettings(raw);
}

export function saveUserSettings(settings: UserSettings): void {
  localStorage.setItem(KEYS.userSettings(settings.userId), JSON.stringify(settings));
}
