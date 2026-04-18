import { migrateAnswer, migrateUserSettings } from './migration';
import { makeUserSettings, type Answer, type UserSettings } from './schema';

const KEYS = {
  answers: 'dg.answers',
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

export function loadAnswers(): Answer[] {
  const raw = readJson<unknown[]>(KEYS.answers, []);
  return Array.isArray(raw) ? raw.map(migrateAnswer) : [];
}

export function saveAnswers(answers: Answer[]): void {
  localStorage.setItem(KEYS.answers, JSON.stringify(answers));
}

export function loadUserSettings(userId: string): UserSettings {
  const raw = readJson<unknown>(KEYS.userSettings(userId), null);
  if (raw == null) return makeUserSettings({ userId });
  return migrateUserSettings(raw);
}

export function saveUserSettings(settings: UserSettings): void {
  localStorage.setItem(KEYS.userSettings(settings.userId), JSON.stringify(settings));
}
