export interface AnswerData {
  email: string;
  question: string;
  answer: string;
  insight?: string;
  streak: number;
  xp: number;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text: string }>;
}

export interface SlackPayload {
  text: string;
  blocks: SlackBlock[];
}

const ANSWER_CAP = 500;

function escapeMrkdwn(s: string): string {
  return s
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/~/g, '\\~');
}

function getKstDateStr(now = new Date()): string {
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 60 * 60_000);
  return kst.toISOString().slice(0, 10);
}

export function buildAnswerBlocks(data: AnswerData): SlackPayload {
  const date = getKstDateStr();
  const cappedAnswer =
    data.answer.length > ANSWER_CAP ? data.answer.slice(0, ANSWER_CAP) : data.answer;
  const headerText = `🌱 Daily Growth — ${date}`;
  const blocks: SlackBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: headerText } },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `❓ *오늘의 질문*\n${escapeMrkdwn(data.question)}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `✍️ *나의 답변*\n${escapeMrkdwn(cappedAnswer)}` },
    },
  ];
  if (data.insight && data.insight.trim().length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `💡 *인사이트*\n${escapeMrkdwn(data.insight)}` },
    });
  }
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `🔥 연속 ${data.streak}일 · ⭐ ${data.xp} XP` },
    ],
  });
  return { text: headerText, blocks };
}

const SLACK_API_TIMEOUT_MS = 5000;

interface SlackResponse {
  ok: boolean;
  error?: string;
  user?: { id: string };
  channel?: { id: string };
}

async function slackFetch(url: string, init: RequestInit): Promise<SlackResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return (await res.json()) as SlackResponse;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendDmAsBot(
  botToken: string,
  email: string,
  payload: SlackPayload,
): Promise<void> {
  const auth = `Bearer ${botToken}`;

  // Step 1: users.lookupByEmail (GET, scope: users:read.email)
  const lookup = await slackFetch(
    `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    { method: 'GET', headers: { Authorization: auth } },
  );
  if (!lookup.ok || !lookup.user?.id) {
    // Slack lookup error 분류 (T4 quality review I1):
    // - users_not_found: 사용자가 워크스페이스 멤버 아님 (사용자 오타 가능성) → 404
    // - missing_scope / invalid_auth / account_inactive / ratelimited 등: 서버 설정 issue → 502
    if (lookup.error === 'users_not_found') throw new Error('user_not_found');
    throw new Error('lookup_failed');
  }
  const userId = lookup.user.id;

  // Step 2: conversations.open (POST, scope: im:write)
  const open = await slackFetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: userId }),
  });
  if (!open.ok || !open.channel?.id) throw new Error('dm_open_failed');
  const channelId = open.channel.id;

  // Step 3: chat.postMessage (POST, scope: chat:write)
  const post = await slackFetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channelId, ...payload }),
  });
  if (!post.ok) throw new Error('post_message_failed');
}
