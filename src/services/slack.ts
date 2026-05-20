import { loadSlackSettings } from '../state/slack';
import { loadUserData } from '../state/user';
// v3.41 T1 (Codex P0 F1): App Check token — Phase A monitor (enforce OFF),
// Phase B backend enforce ON 후 token 부재 시 401. lazy import으로 home chunk
// bundle 영향 최소화 (slack.ts → home.ts 정적 import 경로 cascade 차단).
import { getAppCheckToken } from './appCheck';

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
  // v3.41 T1: App Check token (Phase A monitor). null이면 header 미포함.
  const token = await getAppCheckToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Firebase-AppCheck'] = token;
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
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
