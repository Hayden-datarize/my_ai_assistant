import { loadUserData } from '../state/user';
import { getDateStr } from '../utils/dates';

export interface AnswerData {
  question: string;
  answer: string;
  insight?: string;
}

type SlackBlock =
  | { type: 'header'; text: { type: 'plain_text'; text: string } }
  | { type: 'section'; text: { type: 'mrkdwn'; text: string } }
  | { type: 'divider' }
  | { type: 'context'; elements: Array<{ type: 'mrkdwn'; text: string }> };

export interface SlackPayload {
  text: string;
  blocks: SlackBlock[];
}

// Product choice (not Slack's 3000-char section cap): 500 keeps Slack messages scannable.
const ANSWER_CAP = 500;

function escapeMrkdwn(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/~/g, '\\~');
}

export function buildAnswerBlocks(data: AnswerData): SlackPayload {
  const date = getDateStr();
  const user = loadUserData();
  const streak = user?.streak ?? 0;
  const xp = user?.xp ?? 0;
  const cappedAnswer = data.answer.length > ANSWER_CAP ? data.answer.slice(0, ANSWER_CAP) : data.answer;
  const headerText = `🌱 Daily Growth — ${date}`;
  const blocks: SlackBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: headerText } },
    { type: 'section', text: { type: 'mrkdwn', text: `❓ *오늘의 질문*\n${escapeMrkdwn(data.question)}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `✍️ *나의 답변*\n${escapeMrkdwn(cappedAnswer)}` } },
  ];
  if (data.insight && data.insight.trim().length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `💡 *인사이트*\n${escapeMrkdwn(data.insight)}` } });
  }
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `🔥 연속 ${streak}일 · ⭐ ${xp} XP` }] });
  return { text: headerText, blocks };
}

export async function sendToSlack(webhook: string, payload: SlackPayload): Promise<void> {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}`);
}
