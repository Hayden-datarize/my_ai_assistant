import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { checkRateLimit } from './rateLimit';

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

export const sendAnswerDm = onRequest(
  { secrets: [SLACK_BOT_TOKEN], maxInstances: 1, cors: true, region: 'us-central1' },
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
    // T4에서 Slack API 호출 추가
    res.status(501).json({ error: 'not_implemented_yet' });
  },
);
