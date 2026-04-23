/**
 * Home tab handlers. Listens for all dg:home:* CustomEvents dispatched by
 * src/ui/tabs/home.ts markup and wires them to services + state.
 *
 * hydrateHome(container) repopulates dynamic content (greeting, streak, question,
 * chat history). It is called at the end of renderHome() so every re-render
 * gets fresh data.
 */

import { on, V32_DEFERRED_EVENTS } from '../events';
import { switchTab } from '../nav';
import { toKoType } from '../../utils/typeLabel';
import { appendAnswer, aggregateAnswerStats, setAnswerEvaluation } from '../../state/persistence';
import { makeAnswer } from '../../state/schema';
import { loadBriefings, saveBriefings, type Briefing } from '../../state/briefings';
import { loadChatHistory, appendChatMessage } from '../../state/chat';
import { fetchFeed, type FeedItem, type FeedResult } from '../../services/rss';
import { generateQuestion, chat, evaluateAnswer } from '../../services/gemini';
import { autoSendAnswer } from '../../services/slack';
import { escapeHtml } from '../../utils/escapeHtml';
import { getDateStr } from '../../utils/dates';
import { showToast } from '../../utils/toast';
import { INTERESTS } from '../../utils/categories';

const API_KEY_STORAGE = 'dg_gemini_key';
const USER_STORAGE = 'user';
const THEME_STORAGE = 'theme';
const TODAY_QUESTION_PREFIX = 'dg.todayQuestion.';

/**
 * Round-robin across feeds, deduping by link, stopping at `target`.
 * Pure function — exported for unit testing.
 * @internal
 */
export function pickBriefings(
  feeds: FeedResult[],
  target: number,
): Array<{ item: FeedItem; sourceTitle: string }> {
  const seen = new Set<string>();
  const picked: Array<{ item: FeedItem; sourceTitle: string }> = [];
  const maxPerFeed = feeds.reduce((m, f) => Math.max(m, f.items.length), 0);
  outer: for (let i = 0; i < maxPerFeed; i++) {
    for (const feed of feeds) {
      const item = feed.items[i];
      if (!item) continue;
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      picked.push({ item, sourceTitle: feed.sourceTitle });
      if (picked.length >= target) break outer;
    }
  }
  return picked;
}

interface LegacyUser {
  name: string;
  interests: string[];
  onboardedAt: string;
  streak: number;
  lastActiveDate: string;
  xp: number;
  level: number;
}

function loadUser(): LegacyUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE);
    return raw ? (JSON.parse(raw) as LegacyUser) : null;
  } catch { return null; }
}

function saveUser(u: LegacyUser): void {
  try { localStorage.setItem(USER_STORAGE, JSON.stringify(u)); } catch { /* ignore */ }
}

function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

function applyTheme(): void {
  const t = localStorage.getItem(THEME_STORAGE) === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset['theme'] = t;
  document.body.classList.toggle('dark', t === 'dark');
}

export function mountHomeHandlers(): void {
  applyTheme();

  on('dg:home:toggle-theme', () => {
    const current = localStorage.getItem(THEME_STORAGE) === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_STORAGE, next); } catch { /* ignore */ }
    applyTheme();
  });

  on('dg:home:export-data', () => {
    void exportData();
  });

  on('dg:home:dismiss-backup', () => {
    const banner = document.getElementById('backupBanner');
    banner?.classList.add('hidden');
  });

  on('dg:home:switch-tab', ({ tab }) => {
    if (tab === 'home' || tab === 'archive' || tab === 'stats' || tab === 'insights' || tab === 'settings') {
      switchTab(tab);
    }
  });

  on('dg:home:refresh-briefings', () => {
    void refreshBriefings();
  });

  on('dg:home:update-char-count', () => {
    const area = document.getElementById('answerArea') as HTMLTextAreaElement | null;
    const count = document.getElementById('charCount');
    if (!area || !count) return;
    count.textContent = `${area.value.length}자`;
  });

  on('dg:home:toggle-hint', () => {
    const hint = document.getElementById('hintBox');
    // .hint-box uses .show (display:block) — not .hidden — per home.css
    hint?.classList.toggle('show');
  });

  on('dg:home:submit-answer', () => {
    void submitAnswer();
  });

  on('dg:home:send-chat', () => {
    void sendChatMessage();
  });

  // v3.2 deferred — register no-op stubs so gap-detector sees a listener.
  const stubToast = (label: string) => () => showToast(`${label} 기능은 v3.2에서 준비 중입니다`);
  on('dg:home:summarize-chat', stubToast('대화 요약'));
  on('dg:home:generate-insight-card', stubToast('인사이트 카드'));

  // Re-hydrate home whenever the user navigates back to it.
  on('dg:nav:tab-changed', ({ tab }) => {
    if (tab === 'home') void hydrateHome(document.getElementById('homeTab') ?? document.body);
  });

  void V32_DEFERRED_EVENTS; // referenced for future use (per-domain stub audit)
}

export async function hydrateHome(container: HTMLElement): Promise<void> {
  void container; // accepted for API symmetry with handlers/stats.ts etc
  hydrateGreetingAndStreak();
  hydrateBriefings();
  await hydrateQuestion();
  hydrateChatHistory();
  applyTheme();
}

function hydrateGreetingAndStreak(): void {
  const user = loadUser();
  const greetingEl = document.getElementById('greetingText');
  if (greetingEl) {
    if (user) {
      const h = new Date().getHours();
      const period = h < 5 ? '늦은 밤' : h < 12 ? '좋은 아침' : h < 18 ? '좋은 오후' : '좋은 저녁';
      greetingEl.textContent = `${period}, ${user.name}님`;
    } else {
      greetingEl.textContent = '환영합니다';
    }
  }

  const streakCount = document.getElementById('streakCount');
  if (streakCount && user) streakCount.textContent = String(user.streak);

  const xpBadge = document.getElementById('xpBadge');
  if (xpBadge && user) xpBadge.textContent = `${user.xp} XP`;
}

function hydrateBriefings(): void {
  const list = loadBriefings();
  const scroll = document.getElementById('briefingScroll');
  if (!scroll) return;
  if (list.length === 0) return; // leave skeletons; user can click refresh
  scroll.replaceChildren();
  list.forEach((b, i) => scroll.append(renderBriefingCard(b, i)));
}

function renderBriefingCard(b: Briefing, idx: number): HTMLElement {
  const card = document.createElement('article');
  card.className = 'briefing-card';
  if (b.read) card.classList.add('read');

  const title = document.createElement('a');
  title.href = b.url;
  title.target = '_blank';
  title.rel = 'noopener';
  title.className = 'briefing-title';
  title.textContent = b.title;
  card.append(title);

  if (b.sourceTitle) {
    const chip = document.createElement('span');
    chip.className = 'briefing-source';
    chip.textContent = b.sourceTitle;
    card.append(chip);
  }

  const summary = document.createElement('p');
  summary.className = 'briefing-summary';
  summary.textContent = b.summary;
  card.append(summary);

  const actions = document.createElement('div');
  actions.className = 'briefing-actions';

  const scrap = document.createElement('button');
  scrap.type = 'button';
  scrap.textContent = b.scrapped ? '⭐ 스크랩됨' : '☆ 스크랩';
  scrap.addEventListener('click', () => {
    const all = loadBriefings();
    const target = all[idx];
    if (!target) return;
    target.scrapped = !target.scrapped;
    saveBriefings(all);
    hydrateBriefings();
  });
  actions.append(scrap);

  const memoBtn = document.createElement('button');
  memoBtn.type = 'button';
  memoBtn.textContent = b.memo ? '📝 메모 있음' : '📝 메모';
  actions.append(memoBtn);

  const memoBox = document.createElement('div');
  memoBox.className = 'briefing-memo';
  memoBox.classList.toggle('hidden', !b.memo);

  const memoInput = document.createElement('textarea');
  memoInput.value = b.memo;
  memoInput.placeholder = '이 기사에서 떠오른 생각을 기록해요';

  const memoSave = document.createElement('button');
  memoSave.type = 'button';
  memoSave.textContent = '저장';
  memoSave.addEventListener('click', () => {
    const all = loadBriefings();
    const target = all[idx];
    if (!target) return;
    target.memo = memoInput.value;
    saveBriefings(all);
    hydrateBriefings();
  });

  memoBox.append(memoInput, memoSave);
  memoBtn.addEventListener('click', () => memoBox.classList.toggle('hidden'));

  card.append(actions, memoBox);

  // mark-read on title click
  title.addEventListener('click', () => {
    const all = loadBriefings();
    const target = all[idx];
    if (!target) return;
    target.read = true;
    saveBriefings(all);
  });

  return card;
}

async function refreshBriefings(): Promise<void> {
  const user = loadUser();
  if (!user || user.interests.length === 0) {
    showToast('관심 분야를 먼저 설정해 주세요');
    return;
  }
  const scroll = document.getElementById('briefingScroll');
  if (scroll) {
    scroll.replaceChildren();
    const loading = document.createElement('div');
    loading.textContent = '브리핑을 불러오는 중…';
    scroll.append(loading);
  }

  // v3.2b-ui: dedup via pickBriefings + surface sourceTitle chip
  const picks = user.interests.slice(0, 3);
  const feedUrls = Array.from(
    new Set(picks.map(interestToFeed).filter((u): u is string => !!u)),
  );
  const fetched = await Promise.all(
    feedUrls.map((u) => fetchFeed(u, { timeoutMs: 5000 })),
  );
  const chosen = pickBriefings(fetched, 3);

  const today = getDateStr();
  const stored: Briefing[] = chosen.map(({ item, sourceTitle }, i) => ({
    id: `b_${Date.now()}_${i}`,
    date: today,
    url: item.link,
    title: item.title,
    summary: stripTags(item.description).slice(0, 200),
    scrapped: false,
    read: false,
    memo: '',
    ...(sourceTitle ? { sourceTitle } : {}),
  }));
  saveBriefings(stored);
  hydrateBriefings();

  if (stored.length === 0) {
    // Replace the "브리핑을 불러오는 중…" loading text with an explicit
    // empty state so the UI does not appear permanently stuck when every
    // RSS source returns an error (e.g. rate limit, source down).
    const scrollEl = document.getElementById('briefingScroll');
    if (scrollEl) {
      scrollEl.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'briefing-empty';
      empty.textContent = '오늘 표시할 브리핑을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.';
      scrollEl.append(empty);
    }
    showToast('브리핑을 가져오지 못했어요. 잠시 후 다시 시도해 주세요');
  }
}

function stripTags(s: string): string { return s.replace(/<[^>]*>/g, '').trim(); }

// Verified working RSS sources (2026-04-20). brunch.co.kr/* and
// wanted.co.kr/events/tech/rss returned 4xx/5xx via rss2json and were
// removed in v3.2a-hotfix3. Keep this list in sync with
// tests/lint/rss-source-allowlist.spec.ts so the lint catches drift.
function interestToFeed(interestId: string): string | null {
  const map: Record<string, string> = {
    recruiting: 'https://medium.com/feed/daangn',
    onboarding: 'https://medium.com/feed/daangn',
    culture: 'https://medium.com/feed/daangn',
    hr_system: 'https://outstanding.kr/feed',
    labor_law: 'https://outstanding.kr/feed',
    leadership: 'https://medium.com/feed/daangn',
    pm: 'https://toss.tech/rss.xml',
    ai_ml: 'https://tech.kakao.com/feed/',
    data: 'https://d2.naver.com/d2.atom',
    startup: 'https://outstanding.kr/feed',
    marketing: 'https://www.mobiinside.co.kr/feed',
    productivity: 'https://www.lifehacker.co.kr/feed',
    career: 'https://www.lifehacker.co.kr/feed',
    communication: 'https://www.lifehacker.co.kr/feed',
    self_dev: 'https://www.lifehacker.co.kr/feed',
  };
  return map[interestId] ?? null;
}

async function hydrateQuestion(): Promise<void> {
  const content = document.getElementById('questionContent');
  if (!content) return;

  const today = getDateStr();
  const cacheKey = `${TODAY_QUESTION_PREFIX}${today}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const q = JSON.parse(cached) as { type?: string; question: string; hint: string };
      renderQuestion(content, q);
      return;
    } catch { /* fall-through */ }
  }

  const user = loadUser();
  const key = getApiKey();
  if (!user || !key) {
    content.replaceChildren();
    const p = document.createElement('p');
    p.textContent = !key
      ? 'AI 질문을 보려면 설정에서 API 키를 입력하세요.'
      : '온보딩을 먼저 완료해 주세요.';
    content.append(p);
    return;
  }

  const stats = aggregateAnswerStats();
  const preferType = stats.total > 0 ? stats.weakestType : '분석';

  try {
    const q = await generateQuestion({ apiKey: key, interests: user.interests, preferType });
    try { localStorage.setItem(cacheKey, JSON.stringify(q)); } catch { /* ignore */ }
    renderQuestion(content, q);
  } catch {
    renderQuestion(content, { type: preferType, question: fallbackQuestion(preferType), hint: '구체적인 상황을 떠올려 적어 보세요.' });
  }
}

function renderQuestion(content: HTMLElement, q: { type?: string; question: string; hint: string }): void {
  content.replaceChildren();
  if (q.type) {
    const typeEl = document.createElement('span');
    typeEl.className = 'question-type';
    typeEl.textContent = toKoType(q.type);
    content.append(typeEl);
  }
  const qEl = document.createElement('h3');
  qEl.className = 'question-text';
  qEl.textContent = q.question;
  qEl.dataset['questionId'] = `q_${Date.now()}`;
  qEl.dataset['type'] = q.type ?? 'unknown';
  content.append(qEl);

  const hint = document.getElementById('hintBox');
  if (hint) hint.textContent = q.hint;
}

function fallbackQuestion(type: string): string {
  const map: Record<string, string> = {
    '분석': '오늘 하루 중 예상과 가장 다르게 흘러간 순간은 무엇이었나요?',
    '전환': '지금 방식을 뒤집어 볼 만한 한 가지는 무엇인가요?',
    '실무': '내일 한 가지 행동을 바꿔본다면 무엇부터 시도하시겠어요?',
    '성장': '이번 주 스스로 새로 배운 것 하나를 정리한다면?',
    '트렌드': '최근 관심 업계에서 눈에 띈 변화 하나는 무엇인가요?',
  };
  return map[type] ?? '오늘 하루를 돌아보며 기록으로 남기고 싶은 한 가지는 무엇인가요?';
}

function hydrateChatHistory(): void {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  msgs.replaceChildren();
  const today = getDateStr();
  const history = loadChatHistory(today);
  for (const m of history) addBubble(m.role, m.text);
  updateTurnCounter(history.length);
}

export interface BubbleAction {
  label: string;
  onClick: () => void;
}

export function addBubble(
  role: 'user' | 'ai',
  text: string,
  action?: BubbleAction,
): void {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;

  const b = document.createElement('div');
  b.className = `chat-bubble chat-${role}`;

  const textNode = document.createElement('span');
  textNode.textContent = text; // XSS-safe
  b.append(textNode);

  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-bubble-action';
    btn.textContent = action.label; // XSS-safe
    btn.addEventListener('click', action.onClick);
    b.append(btn);
  }

  msgs.append(b);
  msgs.scrollTop = msgs.scrollHeight;
}

function updateTurnCounter(msgCount: number): void {
  const el = document.getElementById('turnCounter');
  if (!el) return;
  // each turn = user+ai pair
  const turns = Math.floor(msgCount / 2);
  el.textContent = `턴 ${turns}/5`;
}

async function submitAnswer(): Promise<void> {
  const area = document.getElementById('answerArea') as HTMLTextAreaElement | null;
  const content = document.getElementById('questionContent');
  if (!area || !content) return;
  const text = area.value.trim();
  if (text.length < 10) { showToast('10자 이상 작성해 주세요'); return; }

  const qTextEl = content.querySelector<HTMLElement>('.question-text');
  const questionText = qTextEl?.textContent ?? '';
  const questionId = qTextEl?.dataset['questionId'] ?? 'q_unknown';
  const questionType = qTextEl?.dataset['type'] ?? 'unknown';

  const answer = makeAnswer({
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    questionId,
    text,
    authorId: 'self',
    type: questionType,
    date: getDateStr(),
  });
  const id = appendAnswer(answer);

  // record activity
  const user = loadUser();
  if (user) {
    user.xp += 10;
    user.level = 1 + Math.floor(user.xp / 100);
    user.lastActiveDate = getDateStr();
    saveUser(user);
    hydrateGreetingAndStreak();
  }

  area.value = '';
  const cc = document.getElementById('charCount');
  if (cc) cc.textContent = '0자';

  // Always surface the user's answer as a chat bubble so it is not "lost"
  // after the textarea is cleared. This runs before API-key gating below.
  addBubble('user', text);
  appendChatMessage(getDateStr(), { role: 'user', text, at: Date.now() });
  document.getElementById('chatContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('답변이 저장되었어요');

  // AI feedback via chat — requires API key
  const key = getApiKey();
  if (!key) {
    addBubble('ai', 'AI 피드백을 받으려면 설정에서 API 키를 등록해 주세요.');
    return;
  }

  try {
    const reply = await chat({
      apiKey: key,
      turns: [
        { role: 'user', text: `질문: ${questionText}\n답변: ${text}\n따뜻하고 구체적인 짧은 피드백 한 단락으로 답해 주세요.` },
      ],
    });
    addBubble('ai', reply);
    appendChatMessage(getDateStr(), { role: 'ai', text: reply, at: Date.now() });
  } catch {
    const msg = '지금은 AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.';
    addBubble('ai', msg);
  }

  // Background evaluation + Slack auto-send (fire and forget; never blocks UX).
  void evaluateAnswer({ apiKey: key, question: questionText, answer: text })
    .then((ev) => {
      setAnswerEvaluation(id, ev);
      void autoSendAnswer({ question: questionText, answer: text, insight: ev.feedback });
    })
    .catch(() => {
      // evaluation 실패 시에도 Slack 자동 전송은 시도 (insight 없이)
      void autoSendAnswer({ question: questionText, answer: text });
    });

  updateTurnCounter(loadChatHistory(getDateStr()).length);
}

async function sendChatMessage(): Promise<void> {
  const input = document.getElementById('chatInput') as HTMLInputElement | null;
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  addBubble('user', text);
  appendChatMessage(getDateStr(), { role: 'user', text, at: Date.now() });

  const key = getApiKey();
  if (!key) { addBubble('ai', 'API 키가 설정되지 않았어요. 설정에서 등록해 주세요.'); return; }

  const history = loadChatHistory(getDateStr()).map((m) => ({ role: m.role, text: m.text }));
  try {
    const reply = await chat({ apiKey: key, turns: history });
    addBubble('ai', reply);
    appendChatMessage(getDateStr(), { role: 'ai', text: reply, at: Date.now() });
  } catch {
    addBubble('ai', '지금은 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  updateTurnCounter(loadChatHistory(getDateStr()).length);
}

async function exportData(): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k);
    if (v == null) continue;
    try { payload[k] = JSON.parse(v); } catch { payload[k] = v; }
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dg-backup-${getDateStr()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('백업 파일을 다운로드했어요');
  void escapeHtml; // keep util referenced to avoid unused-import nit
  void INTERESTS; // reserved for future recommendation personalisation
}
