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
import { loadBriefings, saveBriefings, toggleScrap, setRead, setTranslation, type Briefing } from '../../state/briefings';
import { loadChatHistory, appendChatMessage } from '../../state/chat';
import { fetchFeed, type FeedItem, type FeedResult } from '../../services/rss';
import { generateQuestion, chat, evaluateAnswer } from '../../services/gemini';
import { autoSendAnswer } from '../../services/slack';
import { summarizeOrTranslateBody, translateTitle, isSessionBlocked } from '../../services/translate';
import { TranslateQueue } from '../translateQueue';
import { escapeHtml } from '../../utils/escapeHtml';
import { getDateStr } from '../../utils/dates';
import { showToast } from '../../utils/toast';
import { INTERESTS } from '../../utils/categories';
import { detectLanguage } from '../../utils/lang';
import { openMemoModal } from '../modals/memo';
import { createLangToggle, type LangToggleEl, type LangState } from '../components/cardLangToggle';
import { checkAndIncrement, getCap, getTodayCount } from '../../state/usage';
import { showCapToast, showTranslateError, showPartialTranslateFail } from '../translateToast';
import { getCachedUser, getSaveErrorMessage, recordDailyAnswer } from '../../state/user';
import { loadActiveSeenUrls, recordSeen, purgeExpiredSeen } from '../../state/seen';
import { MSG } from '../messages';

const API_KEY_STORAGE = 'dg_gemini_key';
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

/**
 * 답변 제출 후 사용자 활동(streak + XP/level + lastActiveDate)을 적용한다.
 * 저장 실패 시 분기 토스트 표시 — atomic single-write이므로 in-memory와
 * persisted state 모두 변경되지 않아 별도 rollback이 필요 없다.
 *
 * @internal
 */
export function applyAnswerActivity(): void {
  try {
    recordDailyAnswer(10);
  } catch (e) {
    showToast(getSaveErrorMessage(e));
  }
}

/**
 * Returns the first grapheme of `sourceTitle`, uppercased, for the letter
 * fallback in briefing cards. Uses string-spread to avoid lone-surrogate
 * splits when the title starts with an emoji (e.g. '🚀TechCrunch').
 */
export function getInitialLetter(sourceTitle: string | undefined): string {
  return ([...(sourceTitle ?? '?')][0] ?? '?').toUpperCase();
}

function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

function ensureDetectedLang(briefing: Briefing): 'en' | 'ko' | 'unknown' {
  if (briefing.detectedLang) return briefing.detectedLang;
  const lang = detectLanguage(briefing.title, briefing.summary);
  setTranslation(briefing.id, { detectedLang: lang });
  briefing.detectedLang = lang;
  return lang;
}

// Background queue for auto-translating English titles. concurrency 3 + 200ms
// delay between dispatches keeps Gemini API call rate sane while still
// translating a 5-card briefing batch in well under a second of wall time
// (assuming the API responds promptly). Title-translation failures are
// silently swallowed (no toast) — auto-translation is opportunistic, and
// surfacing errors for an unrequested action would be noisy. Body translation
// (user-initiated via lang toggle) does surface errors via showTranslateError.
const titleQueue = new TranslateQueue(
  async (id: string): Promise<string> => {
    const list = loadBriefings();
    const b = list.find((x) => x.id === id);
    if (!b) return '';
    const apiKey = getApiKey();
    if (!apiKey) return '';
    // 세션이 401로 차단된 상태면 cap을 소비하지 않고 즉시 종료.
    // (그렇지 않으면 callWithFallback이 throw 전에 checkAndIncrement만 burn함)
    if (isSessionBlocked()) return '';
    if (!checkAndIncrement()) throw new Error('cap reached');
    const ko = await translateTitle(b.title, apiKey);
    setTranslation(id, { titleKo: ko });
    swapTitleInDOM(id, ko);
    return ko;
  },
  {
    concurrency: 3,
    delayMs: 200,
    onDrain: ({ failedCount }) => {
      showPartialTranslateFail(failedCount);
    },
  },
);

/**
 * @internal — 자기 모듈 내부 helper. 외부 caller(archive 등) 통합은 v3.7+ 실수요 발생 시.
 * Test가 import하기 위해 export 유지하되, 일반 사용은 home.ts 내부에서만.
 */
export function swapTitleInDOM(id: string, titleKo: string, root: ParentNode = document): void {
  const titleEl = root.querySelector(`[data-briefing-id="${id}"] .card-title`);
  if (titleEl) titleEl.textContent = titleKo;
}

function enqueueEnglishTitleTranslations(briefings: Briefing[]): void {
  if (!getApiKey()) return;
  for (const b of briefings) {
    const lang = b.detectedLang ?? ensureDetectedLang(b);
    if (lang !== 'en') continue;
    if (b.titleKo) continue; // 이미 캐시된 경우 skip
    titleQueue.enqueue(b.id);
  }
}

function attachLangToggle(card: HTMLElement, briefing: Briefing): void {
  const lang = ensureDetectedLang(briefing);
  if (lang !== 'en') return;
  const apiKey = getApiKey();
  if (!apiKey) return;

  const summaryEl = card.querySelector<HTMLElement>('.card-summary');
  if (!summaryEl) return;
  const originalBody = briefing.summary;

  const capReached = getTodayCount() >= getCap();
  const toggle: LangToggleEl = createLangToggle({
    initialState: 'en',
    disabled: capReached,
    disabledReason: capReached ? '오늘 번역 한도에 도달했어요' : undefined,
    onToggle: (next: LangState) => {
      void handleLangToggle(next, summaryEl, briefing, originalBody, toggle, apiKey);
    },
  });

  // Insert toggle BEFORE the anchor (.card-main) so it's outside the link
  // (HTML invalidity + accidental navigation prevented).
  const main = card.querySelector<HTMLElement>('.card-main');
  if (main) card.insertBefore(toggle, main);
}

async function handleLangToggle(
  next: LangState,
  summaryEl: HTMLElement,
  briefing: Briefing,
  originalBody: string,
  toggle: LangToggleEl,
  apiKey: string,
): Promise<void> {
  if (next === 'en') {
    summaryEl.textContent = originalBody;
    return;
  }
  // ko: cache 우선
  if (briefing.summaryKo) {
    summaryEl.textContent = briefing.summaryKo;
    return;
  }
  // 세션이 401로 차단된 상태면 cap을 소비하지 않고 토스트 + 토글 복원.
  if (isSessionBlocked()) {
    showTranslateError(new Error('translate session blocked'));
    toggle.setLangState('en');
    return;
  }
  if (!checkAndIncrement()) {
    showCapToast();
    toggle.setLangState('en');
    toggle.disabled = true;
    toggle.setAttribute('aria-disabled', 'true');
    return;
  }
  try {
    const ko = await summarizeOrTranslateBody(originalBody, apiKey);
    setTranslation(briefing.id, { summaryKo: ko });
    briefing.summaryKo = ko;
    summaryEl.textContent = ko;
  } catch (err) {
    showTranslateError(err);
    toggle.setLangState('en');
  }
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

/** @internal — exported for integration tests; production callers are hydrateHome + submitAnswer 내부 */
export function hydrateGreetingAndStreak(): void {
  const user = getCachedUser();
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

// v3.3.4.2: Session-scoped flag used to auto-trigger a briefing refresh at most
// once per tab visit. Prevents the "continuous skeleton" UX where a fresh user
// (or a user with stale briefings from a previous day) sees 3 gray skeleton
// cards indefinitely because refreshBriefings was only wired to a manual click.
const AUTO_REFRESH_SESSION_KEY = 'dg.briefings.auto-refresh-tried';

function hydrateBriefings(): void {
  const list = loadBriefings();
  const scroll = document.getElementById('briefingScroll');
  if (!scroll) return;

  const today = getDateStr();
  const firstDate = list[0]?.date;
  const isStale = list.length === 0 || (firstDate !== undefined && firstDate !== today);

  if (isStale) {
    const user = getCachedUser();
    const hasInterests = !!user && user.interests.length > 0;
    if (hasInterests && !sessionStorage.getItem(AUTO_REFRESH_SESSION_KEY)) {
      sessionStorage.setItem(AUTO_REFRESH_SESSION_KEY, '1');
      void refreshBriefings();
    }
    // If stale but we already auto-tried (or user has no interests), fall
    // through and render whatever we have — including nothing, in which case
    // the static skeletons remain until the user clicks 🔄 새로고침.
    if (list.length === 0) return;
  }

  scroll.replaceChildren();
  list.forEach((b, i) => scroll.append(renderBriefingCard(b, i)));
  enqueueEnglishTitleTranslations(list);
}

export function renderBriefingCard(b: Briefing, idx: number): HTMLElement {
  const card = document.createElement('article');
  card.className = 'briefing-card';
  card.dataset['read'] = b.read ? 'true' : 'false';
  card.dataset['tier'] = b.imageUrl ? '1' : '2';
  card.dataset['briefingId'] = b.id;

  // Main link: image (optional) + initial fallback + overlay (source/title/summary)
  const main = document.createElement('a');
  main.className = 'card-main';
  main.href = b.url;
  main.target = '_blank';
  main.rel = 'noopener noreferrer';
  main.setAttribute('aria-label', `${b.title} — ${b.sourceTitle ?? '기사'}`);

  const initialLetter = getInitialLetter(b.sourceTitle);

  if (b.imageUrl) {
    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.src = b.imageUrl;
    img.alt = '';
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.addEventListener('error', () => {
      // Transition tier 1 → tier 2 on load failure
      card.dataset['tier'] = '2';
      img.remove();
    });
    main.append(img);
  }

  const initial = document.createElement('div');
  initial.className = 'card-initial';
  initial.setAttribute('aria-hidden', 'true');
  initial.textContent = initialLetter;
  main.append(initial);

  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';

  const sourceBadge = document.createElement('span');
  sourceBadge.className = 'card-source';
  sourceBadge.textContent = b.sourceTitle ?? '기사';
  overlay.append(sourceBadge);

  const textBlock = document.createElement('div');
  textBlock.className = 'card-text';
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = (b.detectedLang === 'en' && b.titleKo) ? b.titleKo : b.title;
  const summary = document.createElement('p');
  summary.className = 'card-summary';
  summary.textContent = b.summary;
  textBlock.append(title, summary);
  overlay.append(textBlock);

  main.append(overlay);

  // Mark as read when the link is opened
  main.addEventListener('click', () => {
    setRead(idx);
    card.dataset['read'] = 'true';
  });

  card.append(main);

  // Actions OUTSIDE the anchor
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', '카드 액션');

  const scrapBtn = document.createElement('button');
  scrapBtn.type = 'button';
  scrapBtn.className = 'card-action-btn';
  scrapBtn.dataset['action'] = 'scrap';
  scrapBtn.setAttribute('aria-label', b.scrapped ? '스크랩 해제' : '스크랩');
  scrapBtn.textContent = b.scrapped ? '♥' : '♡';
  if (b.scrapped) scrapBtn.classList.add('is-scrapped');
  scrapBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleScrap(idx);
    hydrateBriefings();
  });

  const memoBtn = document.createElement('button');
  memoBtn.type = 'button';
  memoBtn.className = 'card-action-btn';
  memoBtn.dataset['action'] = 'memo';
  memoBtn.setAttribute('aria-label', '메모');
  memoBtn.textContent = '✎';
  memoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMemoModal(idx);
  });

  actions.append(scrapBtn, memoBtn);
  card.append(actions);

  attachLangToggle(card, b);

  return card;
}

async function refreshBriefings(): Promise<void> {
  const user = getCachedUser();
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
  // v3.11 T3: 1:N mapping + seen-dedup pre-filter + chosen url 기록
  const picks = user.interests.slice(0, 3);
  // 1:N 매핑 → flatMap → Set dedup → 최대 8개 cap (모바일 데이터 보호)
  const allFeedUrls = Array.from(new Set(picks.flatMap(interestToFeeds)));
  const feedUrls = allFeedUrls.slice(0, 8);

  const fetched = await Promise.all(
    feedUrls.map((u) => fetchFeed(u, { timeoutMs: 5000 })),
  );

  // dedup: 30d retention 안에 있는 url을 사전에 제거
  const now = Date.now();
  purgeExpiredSeen(now);
  const activeSeenUrls = loadActiveSeenUrls(now);
  const filtered = fetched.map((f) => ({
    ...f,
    items: f.items.filter((it) => !activeSeenUrls.has(it.link)),
  }));

  // pick: unseen 우선, 부족하면 원본으로 fallback (expired-seen 자동 허용)
  let chosen = pickBriefings(filtered, 5);
  if (chosen.length < 5) {
    chosen = pickBriefings(fetched, 5);
  }

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
    ...(item.image ? { imageUrl: item.image } : {}),
  }));
  saveBriefings(stored);
  recordSeen(stored.map((b) => b.url), now);
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
      empty.textContent = `오늘 표시할 브리핑을 가져오지 못했어요. ${MSG.TRY_AGAIN}`;
      scrollEl.append(empty);
    }
    showToast(`브리핑을 가져오지 못했어요. ${MSG.TRY_AGAIN}`);
  }
}

function stripTags(s: string): string { return s.replace(/<[^>]*>/g, '').trim(); }

// Verified working RSS sources (2026-04-20). brunch.co.kr/* and
// wanted.co.kr/events/tech/rss returned 4xx/5xx via rss2json and were
// removed in v3.2a-hotfix3. Keep this list in sync with
// tests/lint/rss-source-allowlist.spec.ts so the lint catches drift.
export function interestToFeeds(interestId: string): string[] {
  const map: Record<string, string[]> = {
    recruiting: ['https://medium.com/feed/daangn', 'https://www.lennysnewsletter.com/feed'],
    onboarding: ['https://medium.com/feed/daangn', 'https://www.lennysnewsletter.com/feed'],
    culture: ['https://medium.com/feed/daangn', 'https://blog.pragmaticengineer.com/rss/'],
    hr_system: ['https://outstanding.kr/feed', 'https://www.mckinsey.com/insights/rss'],
    labor_law: ['https://outstanding.kr/feed', 'https://www.mckinsey.com/insights/rss'],
    leadership: [
      'https://medium.com/feed/daangn',
      'https://blog.pragmaticengineer.com/rss/',
      'https://www.lennysnewsletter.com/feed',
    ],
    pm: [
      'https://toss.tech/rss.xml',
      'https://www.lennysnewsletter.com/feed',
      'https://blog.bytebytego.com/feed',
    ],
    ai_ml: [
      'https://tech.kakao.com/feed/',
      'https://openai.com/news/rss.xml',
      'https://news.hada.io/rss/news',
    ],
    data: [
      'https://d2.naver.com/d2.atom',
      'https://blog.bytebytego.com/feed',
      'https://news.hada.io/rss/news',
    ],
    startup: [
      'https://outstanding.kr/feed',
      'https://techcrunch.com/feed/',
      'https://news.hada.io/rss/news',
    ],
    marketing: ['https://www.mobiinside.co.kr/feed', 'https://www.lennysnewsletter.com/feed'],
    productivity: ['https://www.lifehacker.co.kr/feed', 'https://blog.pragmaticengineer.com/rss/'],
    career: [
      'https://www.lifehacker.co.kr/feed',
      'https://blog.pragmaticengineer.com/rss/',
      'https://www.lennysnewsletter.com/feed',
    ],
    communication: ['https://www.lifehacker.co.kr/feed', 'https://blog.pragmaticengineer.com/rss/'],
    self_dev: [
      'https://www.lifehacker.co.kr/feed',
      'https://martinfowler.com/feed.atom',
      'https://blog.pragmaticengineer.com/rss/',
    ],
  };
  return map[interestId] ?? [];
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

  const user = getCachedUser();
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

  // Ensure chat container is visible (fixes pre-existing .show toggle gap)
  document.getElementById('chatContainer')?.classList.add('show');
}

function updateTurnCounter(msgCount: number): void {
  const el = document.getElementById('turnCounter');
  if (!el) return;
  // each turn = user+ai pair
  const turns = Math.floor(msgCount / 2);
  el.textContent = `턴 ${turns}/5`;
}

export function openSettingsWithFocus(): void {
  const active = document.querySelector('.nav-item.active');
  const isAlreadySettings = active?.getAttribute('data-tab-id') === 'settings';

  const scrollToField = (): void => {
    const field = document.getElementById('apiKeyInput');
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (isAlreadySettings) {
    scrollToField();
  } else {
    switchTab('settings');
    // switchTab renders synchronously; rAF ensures post-paint DOM stability before scroll
    requestAnimationFrame(scrollToField);
  }
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
    questionText: questionText || undefined, // v3.11: persist question text alongside answer
    authorId: 'self',
    type: questionType,
    date: getDateStr(),
  });
  const id = appendAnswer(answer);

  // record daily answer activity (streak + XP)
  applyAnswerActivity();
  hydrateGreetingAndStreak();

  area.value = '';
  const cc = document.getElementById('charCount');
  if (cc) cc.textContent = '0자';

  // Always surface the user's answer as a chat bubble so it is not "lost"
  // after the textarea is cleared. This runs before API-key gating below.
  addBubble('user', text);
  appendChatMessage(getDateStr(), { role: 'user', text, at: Date.now() });
  document.getElementById('chatContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(MSG.ANSWER_SAVED);

  // AI feedback via chat — requires API key
  const key = getApiKey();
  if (!key) {
    addBubble('ai', MSG.DEMO_API_KEY_PROMPT, {
      label: '⚙ 설정 열기',
      onClick: openSettingsWithFocus,
    });
    updateTurnCounter(loadChatHistory(getDateStr()).length);
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
    addBubble('ai', MSG.AI_RESPONSE_FAIL);
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
  if (!key) {
    addBubble('ai', MSG.DEMO_API_KEY_PROMPT, {
      label: '⚙ 설정 열기',
      onClick: openSettingsWithFocus,
    });
    updateTurnCounter(loadChatHistory(getDateStr()).length);
    return;
  }

  const history = loadChatHistory(getDateStr()).map((m) => ({ role: m.role, text: m.text }));
  try {
    const reply = await chat({ apiKey: key, turns: history });
    addBubble('ai', reply);
    appendChatMessage(getDateStr(), { role: 'ai', text: reply, at: Date.now() });
  } catch {
    addBubble('ai', MSG.AI_RESPONSE_FAIL);
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
