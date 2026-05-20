import { loadSlackSettings } from '../state/slack';
import { loadUserData } from '../state/user';
// v3.42 T3 (Codex 최종 P2-1): App Check SDK는 sendAnswerDm 함수 내부에서 dynamic import.
// 정적 import 시 home dynamic chain이 firebase deps를 translateToast lazy chunk에 흡수 —
// first-paint 영향 0이지만 home tab load 시 ~15 KB chunk fetch. 첫 Slack 호출
// 시점에만 fetch하여 home chunk 분리 명확화. (사용자 가시 latency ~100ms 추가 / 후속 호출 캐싱).

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
  // v3.42 T3: App Check token dynamic import (Phase A monitor). null이면 header 미포함.
  // dynamic import 실패 (SDK 로드 fail / 네트워크 불가) 시 silent fallback — Phase A는
  // enforce OFF라 token 없어도 Slack DM 정상 동작.
  let token: string | null = null;
  try {
    const { getAppCheckToken } = await import('./appCheck');
    token = await getAppCheckToken();
  } catch (err) {
    console.warn('[slack] App Check SDK load failed', err);
  }
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
