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

const ANSWER_CAP = 500;

export function buildAnswerBlocks(data: AnswerData): SlackPayload {
  const date = getDateStr();
  const user = loadUserData();
  const streak = user?.streak ?? 0;
  const xp = user?.xp ?? 0;
  const cappedAnswer = data.answer.length > ANSWER_CAP ? data.answer.slice(0, ANSWER_CAP) : data.answer;
  const headerText = `🌱 Daily Growth — ${date}`;
  const blocks: SlackBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: headerText } },
    { type: 'section', text: { type: 'mrkdwn', text: `❓ *오늘의 질문*\n${data.question}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `✍️ *나의 답변*\n${cappedAnswer}` } },
  ];
  if (data.insight && data.insight.trim().length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `💡 *인사이트*\n${data.insight}` } });
  }
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `🔥 연속 ${streak}일 · ⭐ ${xp} XP` }] });
  return { text: headerText, blocks };
}
