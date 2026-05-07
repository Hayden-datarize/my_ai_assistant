import { loadSlackSettings } from '../state/slack';
import { loadUserData } from '../state/user';

export interface AnswerData {
  question: string;
  answer: string;
  insight?: string;
}

const FUNCTION_URL = '/api/sendAnswerDm';

export async function sendAnswerDm(data: AnswerData): Promise<void> {
  const s = loadSlackSettings();
  if (!s) throw new Error('slack_settings_missing');
  const user = loadUserData();
  const streak = user?.streak ?? 0;
  const xp = user?.xp ?? 0;
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: s.email,
      question: data.question,
      answer: data.answer,
      ...(data.insight ? { insight: data.insight } : {}),
      streak,
      xp,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    const errCode: string | number = body.error ?? res.status;
    throw new Error(`slack_${errCode}`);
  }
}

export async function autoSendAnswer(data: AnswerData): Promise<void> {
  const s = loadSlackSettings();
  if (!s || !s.autoSend) return;
  try {
    await sendAnswerDm(data);
  } catch (e) {
    console.warn('Slack auto-send failed:', e);
  }
}
