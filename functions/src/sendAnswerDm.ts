import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { checkRateLimit } from './rateLimit';
import { buildAnswerBlocks, sendDmAsBot } from './slack';

const SLACK_BOT_TOKEN = defineSecret('SLACK_BOT_TOKEN');

export interface AnswerDmRequest {
  email: string;
  question: string;
  answer: string;
  insight?: string;
  streak: number;
  xp: number;
}

const ALLOWED_DOMAIN = '@datarize.ai';
const ANSWER_CAP = 500;

// v3.20 T4 (A4): cors whitelist (옵션 B) — production 도메인 한정 + 의도치 않은
// cross-origin 호출 차단 안전망. same-origin rewrite (firebase.json `/api/sendAnswerDm`)
// 와 정합. 이전 옵션(모든 origin 허용)에서 격상.
const CORS_ORIGINS = [
  'https://my-ai-assistant-904f3.web.app',
  'https://my-ai-assistant-904f3.firebaseapp.com',
];

/** @public — Firebase Cloud Function HTTPS callable export. firebase deploy로 us-central1에 mounted, client는 same-origin rewrite (`/api/sendAnswerDm`)로 호출. v3.44.1 T4 audit 명령에서 unused로 잡힌 expected noise 차단 (Codex 최종 P3 in-cycle). */
export const sendAnswerDm = onRequest(
  { secrets: [SLACK_BOT_TOKEN], maxInstances: 1, cors: CORS_ORIGINS, region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }
    const body = req.body as Partial<AnswerDmRequest>;
    if (typeof body.email !== 'string' || !body.email.endsWith(ALLOWED_DOMAIN)) {
      res.status(400).json({ error: 'invalid_email' });
      return;
    }
    if (typeof body.answer !== 'string' || body.answer.length === 0 || body.answer.length > ANSWER_CAP) {
      res.status(400).json({ error: 'invalid_answer' });
      return;
    }
    if (typeof body.question !== 'string' || body.question.length === 0) {
      res.status(400).json({ error: 'invalid_question' });
      return;
    }
    const rl = checkRateLimit(body.email, Date.now());
    if (rl !== 'ok') {
      res.status(429).json({ error: 'rate_limited', kind: rl });
      return;
    }
    try {
      const payload = buildAnswerBlocks({
        email: body.email,
        question: body.question,
        answer: body.answer,
        insight: body.insight,
        streak: typeof body.streak === 'number' ? body.streak : 0,
        xp: typeof body.xp === 'number' ? body.xp : 0,
      });
      await sendDmAsBot(SLACK_BOT_TOKEN.value(), body.email, payload);
      res.status(200).json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      if (msg === 'user_not_found') {
        res.status(404).json({ error: 'user_not_found' });
      } else if (msg === 'dm_open_failed' || msg === 'post_message_failed' || msg === 'lookup_failed') {
        res.status(502).json({ error: msg });
      } else if (msg.startsWith('http_5')) {
        // T4 quality review I2: Slack upstream 5xx → 502 (정확한 의미)
        res.status(502).json({ error: 'slack_upstream' });
      } else {
        res.status(500).json({ error: 'internal' });
      }
    }
  },
);
