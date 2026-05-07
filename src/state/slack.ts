const KEY = 'dg_slack';

export interface SlackSettings {
  email: string;
  autoSend: boolean;
}

export function loadSlackSettings(): SlackSettings | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SlackSettings> & { webhook?: unknown };
    if (typeof parsed.email !== 'string' || parsed.email.length === 0) return null;
    return {
      email: parsed.email,
      autoSend: typeof parsed.autoSend === 'boolean' ? parsed.autoSend : false,
    };
  } catch {
    return null;
  }
}

export function saveSlackSettings(s: SlackSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSlackSettings(): void {
  localStorage.removeItem(KEY);
}
