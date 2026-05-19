/**
 * Home tab handlers. Listens for all dg:home:* CustomEvents dispatched by
 * src/ui/tabs/home.ts markup and wires them to services + state.
 *
 * hydrateHome(container) repopulates dynamic content (greeting, streak, question,
 * chat history). It is called at the end of renderHome() so every re-render
 * gets fresh data.
 */

import { on, dispatch, V32_DEFERRED_EVENTS } from '../events';
import { switchTab } from '../nav';
import { toKoType } from '../../utils/typeLabel';
import { appendAnswer, aggregateAnswerStats, setAnswerEvaluation } from '../../state/persistence';
import { makeAnswer } from '../../state/schema';
import { loadBriefings, saveBriefings, toggleScrap, setRead, setTranslation, type Briefing } from '../../state/briefings';
import { loadChatHistory, appendChatMessage, type ChatMessage } from '../../state/chat';
import { fetchFeed, type FeedItem, type FeedResult } from '../../services/rss';
import { generateQuestion, chat, evaluateAnswer, generateText } from '../../services/gemini';
import { resolveQuestionInterestId } from '../../utils/gemini-parse';
import { autoSendAnswer } from '../../services/slack';
import { summarizeOrTranslateBody, translateTitle, isSessionBlocked } from '../../services/translate';
import { TranslateQueue } from '../translateQueue';
import { getKstDateStr } from '../../utils/dates';
import { showToast } from '../../utils/toast';
import { detectLanguage } from '../../utils/lang';
import { openMemoModal } from '../modals/memo';
import { createLangToggle, type LangToggleEl, type LangState } from '../components/cardLangToggle';
import { checkAndIncrement, getCap, getTodayCount } from '../../state/usage';
import { showCapToast, showTranslateError, showPartialTranslateFail } from '../translateToast';
import { getCachedUser, getSaveErrorMessage, recordDailyAnswer, saveUser, type Insight } from '../../state/user';
import { parseInsightResponse } from '../../utils/gemini-parse';
import { renderGardenMini } from '../components/garden-grid';
import { scrollToGardenSection } from './stats-shared';
import { loadActiveSeenUrls, recordSeen, purgeExpiredSeen } from '../../state/seen';
import { MSG } from '../messages';
import { getActiveMissions, getKSTDateIso } from '../../state/missionEngine';
import { renderMissionsSection } from '../missions-section';
import { fireBriefingViewTrigger, fireCrossInterestTrigger } from './missions-triggers';
import { interestKeywords, matchKeyword, matchesInterest } from '../../utils/interestKeywords';
import { getApiKey } from '../../utils/apiKey';
import { checkAndIncrementGemini } from '../../state/geminiUsage';
import { PROMPTS } from '../../services/prompts';
import { renderChatPreviewBubble } from '../chat-bubble';

const THEME_STORAGE = 'theme';
const TODAY_QUESTION_PREFIX = 'dg.todayQuestion.';

/**
 * Round-robin across feeds, deduping by link, stopping at `target`.
 * Pure function — exported for unit testing.
 *
 * v3.39 T5: 각 feed에 optional `feedUrl`이 있으면 picked entry에도 전파.
 * caller가 `feedUrl`을 안 넣으면 결과에 미포함 — 기존 caller 영향 0.
 * @internal
 */
export function pickBriefings(
  feeds: Array<FeedResult & { feedUrl?: string }>,
  target: number,
): Array<{ item: FeedItem; sourceTitle: string; feedUrl?: string }> {
  const seen = new Set<string>();
  const picked: Array<{ item: FeedItem; sourceTitle: string; feedUrl?: string }> = [];
  const maxPerFeed = feeds.reduce((m, f) => Math.max(m, f.items.length), 0);
  outer: for (let i = 0; i < maxPerFeed; i++) {
    for (const feed of feeds) {
      const item = feed.items[i];
      if (!item) continue;
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      picked.push({
        item,
        sourceTitle: feed.sourceTitle,
        ...(feed.feedUrl ? { feedUrl: feed.feedUrl } : {}),
      });
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

/** @internal — exported for unit testing the pending UX (v3.11.1 hotfix). */
export async function handleLangToggle(
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
  // v3.11.1 hotfix — async API 동안 button 잠금 + summary placeholder.
  // 버튼만 즉시 flip되고 summary는 1~2초 후 도착하던 race로 사용자가 다중 클릭
  // 하면 state 토글이 꼬였음. pending state로 입력 자연 차단.
  toggle.disabled = true;
  toggle.setAttribute('aria-disabled', 'true');
  summaryEl.textContent = '번역 중…';
  try {
    const ko = await summarizeOrTranslateBody(originalBody, apiKey);
    setTranslation(briefing.id, { summaryKo: ko });
    briefing.summaryKo = ko;
    summaryEl.textContent = ko;
  } catch (err) {
    summaryEl.textContent = originalBody;
    showTranslateError(err);
    toggle.setLangState('en');
  } finally {
    toggle.disabled = false;
    toggle.removeAttribute('aria-disabled');
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

  on('dg:home:switch-tab', async ({ tab }) => {
    // v3.27 T2a: 'insights' 제거 (tab 폐기, archive 통합).
    if (tab === 'home' || tab === 'archive' || tab === 'stats' || tab === 'settings') {
      // v3.30 T6 (v3.29 C4): .catch() → async/await 가독성.
      // v3.29 T3 review fix (I2): chunk load fail 진단 가능화.
      try {
        await switchTab(tab);
      } catch (err) {
        console.warn('[home] switchTab failed', tab, err);
      }
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

  // v3.23 T8 — 대화 정리 / 인사이트 카드 (v3.2 deferred → 실 구현)
  on('dg:home:summarize-chat', () => { void handleSummarizeChat(); });
  on('dg:home:generate-insight-card', () => { void handleGenerateInsight(); });

  // Re-hydrate home whenever the user navigates back to it.
  on('dg:nav:tab-changed', ({ tab }) => {
    if (tab === 'home') {
      void hydrateHome(document.getElementById('homeTab') ?? document.body);
      // v3.12 T13: 첫 진입(answers>=1 && !gamificationMigrated) 시 backfill + 환영 모달.
      void import('../modals/welcome-gamification').then(({ maybeShowWelcomeGamification }) => {
        void maybeShowWelcomeGamification();
      });
    }
  });

  void V32_DEFERRED_EVENTS; // referenced for future use (per-domain stub audit)
}

export async function hydrateHome(container: HTMLElement): Promise<void> {
  void container; // accepted for API symmetry with handlers/stats.ts etc
  hydrateGreetingAndStreak();
  hydrateGardenMini();
  void hydrateBriefings();
  await hydrateQuestion();
  hydrateChatHistory();
  applyTheme();
}

/**
 * 홈 탭 #gardenMini placeholder에 mini preview를 렌더링하고
 * cell 클릭 시 stats 탭 + gardenSection scroll을 연결한다.
 * renderHome() 호출 시 DOM이 완전 교체되므로 listener 누적 없음.
 * @internal
 */
function hydrateGardenMini(): void {
  const root = document.getElementById('gardenMini');
  const user = getCachedUser();
  if (!root || !user) return;
  renderGardenMini(root, user);
  root.addEventListener('click', (ev) => {
    const cell = (ev.target as HTMLElement)?.closest('.garden-mini-cell');
    if (!cell) return;
    // switchTab은 nav.ts에서 import 가능하나, 홈 핸들러는 이미 dg:home:switch-tab 이벤트 패턴을 사용.
    // 일관성을 위해 동일 패턴 유지 (on handler → switchTab 내부 호출).
    document.dispatchEvent(new CustomEvent('dg:home:switch-tab', { detail: { tab: 'stats' } }));
    // stats 탭 hydrate 후 scroll — requestAnimationFrame으로 paint 안정 보장
    requestAnimationFrame(() => scrollToGardenSection());
  });
}

/**
 * @internal — exported for unit test (v3.13.1 T9 / P2-1 Quota guard).
 * production caller는 missions 탭의 dg:nav:tab-changed 핸들러 + submitAnswer (v3.14 T5: home에서 제거).
 */
export function hydrateMissions(): void {
  const u = getCachedUser();
  if (!u) return;
  const { active, dirty } = getActiveMissions(new Date(), u);
  if (dirty) {
    try {
      saveUser(u);  // lazy regen이 발생한 경우에만 저장
    } catch (err) {
      // saveUser 실패해도 active는 in-memory mutate된 상태 → 렌더는 진행
      // (다음 진입 시 재시도). v3.7 패턴 (archive.ts / settings.ts / interests.ts).
      showToast(getSaveErrorMessage(err));
    }
  }
  const root = document.getElementById('missionsContainer');
  if (root) renderMissionsSection(root, active);
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

// v3.19 T7 review fix (Important #1): hydrateBriefings는 hydrateHome(초기+탭 네비)
// + scrap toggle + refreshBriefings end + auto-refresh path 4 site에서 호출됨.
// 진단 신호는 첫 호출(initial load)만 의미 있음 → module-level guard로 1회만 fire.
// SPA module 재초기화는 hard reload 시 발생 — 그게 reproduce scope과 일치.
let diagLogged = false;

async function hydrateBriefings(): Promise<void> {
  const list = loadBriefings();
  const scroll = document.getElementById('briefingScroll');
  if (!scroll) return;

  const today = getKstDateStr();
  const firstDate = list[0]?.date;
  const isStale = list.length === 0 || (firstDate !== undefined && firstDate !== today);

  if (!diagLogged) {
    diagLogged = true;
    // v3.19 T7 진단 정보 1회 출력 — v3.20 H3 본질 fix(SW image pass-through) 후
    // 1주 production 모니터링 시점에 별도 sunset 결정 (spec §1.5).
    // sample은 sourceTitle + imageUrl 50자 prefix만 — PII 0건.
    console.info('[dg.briefings.diag]', {
      swState: navigator.serviceWorker?.controller ? 'controlled' : 'no-controller',
      itemCount: list.length,
      sample: list[0] ? {
        source: list[0].sourceTitle,
        hasImage: !!list[0].imageUrl,
        imageUrlPrefix: list[0].imageUrl?.slice(0, 50),
      } : null,
      today,
      isStale,
    });
  }

  if (isStale) {
    const user = getCachedUser();
    const hasInterests = !!user && user.interests.length > 0;
    if (hasInterests && !sessionStorage.getItem(AUTO_REFRESH_SESSION_KEY)) {
      sessionStorage.setItem(AUTO_REFRESH_SESSION_KEY, '1');
      // v3.19 T9: void → await (race 차단 + 단일 paint).
      // refreshBriefings 끝에서 hydrateBriefings()를 다시 호출(line 651)하므로
      // 여기서는 early return — 그 시점에는 list가 today로 갱신되어 isStale=false.
      await refreshBriefings();
      return;
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

/**
 * v3.20.1 H3: source name 기반 deterministic 그라디언트 variant 0~5.
 * 같은 source는 항상 같은 색상 — image 없는 카드도 시각 다양성 확보.
 */
function bgVariant(source: string | undefined): string {
  if (!source) return '0';
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash) % 6);
}

export function renderBriefingCard(b: Briefing, idx: number): HTMLElement {
  const card = document.createElement('article');
  card.className = 'briefing-card';
  card.dataset['read'] = b.read ? 'true' : 'false';
  // v3.20.1 H3: source 기반 그라디언트 variant (image 없을 때 fallback UI 풍부화)
  card.dataset['bg'] = bgVariant(b.sourceTitle);
  // v3.19 T7: tier-reason 진단 dataset (영구 자산화)
  if (b.imageUrl) {
    card.dataset['tier'] = '1';
    card.dataset['tierReason'] = 'loading';
  } else {
    card.dataset['tier'] = '2';
    card.dataset['tierReason'] = 'no-image-url';
  }
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
    img.alt = '';
    img.setAttribute('loading', idx < 3 ? 'eager' : 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('referrerpolicy', 'no-referrer');
    // v3.19 T7 P1-5: listener 등록 후 src 할당 (cache hit 시 동기 fire race 차단)
    img.addEventListener('load', () => {
      card.dataset['tierReason'] = 'image-loaded';
    });
    img.addEventListener('error', () => {
      // Transition tier 1 → tier 2 on load failure
      card.dataset['tier'] = '2';
      card.dataset['tierReason'] = 'image-error';
      img.remove();
    });
    img.src = b.imageUrl;
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

    // v3.14 T6/T7: 두 trigger가 같은 KST window를 공유하도록 single-now 캡처 (codex P1-7).
    // archive 패턴 (archive.ts:194-201) — 성공 후에만 sessionStorage flag 세팅, 실패 시 retry 허용.
    const now = new Date();
    const todayIso = getKSTDateIso(now);

    // briefing-view trigger (daily-briefing-5, target=5) — 카드별 1회/일 dedup
    const viewKey = `briefing-view-fired-${todayIso}-${idx}`;
    if (!sessionStorage.getItem(viewKey)) {
      try {
        fireBriefingViewTrigger(now);                                                // saveUser 내부 호출 — 성공 후에만 flag 세팅
        sessionStorage.setItem(viewKey, '1');
      } catch (err) {
        showToast(getSaveErrorMessage(err));                                         // Quota 등 — flag 미세팅 → 다음 click 재시도
      }
    }

    // v3.14 T7: cross-interest-view trigger — 일별 1회 dedup.
    // 카드 텍스트(sourceTitle/title/summary)가 user.interests 어느 것과도 매칭 안 되면 cross-interest 판정.
    // interests.length === 0 인 신규 사용자는 항상 mismatch가 되므로 guard로 차단.
    const crossKey = `cross-interest-fired-${todayIso}`;
    if (!sessionStorage.getItem(crossKey)) {
      const u = getCachedUser();
      const interests = u?.interests ?? [];
      if (interests.length > 0) {
        const hay = `${b.sourceTitle ?? ''} ${b.title} ${b.summary}`.toLowerCase();
        const matched = interests.some((i) => interestKeywords(i).some((k) => matchKeyword(hay, k)));
        if (!matched) {
          try {
            fireCrossInterestTrigger(now);                                           // shared `now` (codex P1-7)
            sessionStorage.setItem(crossKey, '1');
          } catch (err) {
            showToast(getSaveErrorMessage(err));                                     // Quota 등 — flag 미세팅 → 다음 click 재시도
          }
        }
      }
    }
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
    void hydrateBriefings();
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

export async function refreshBriefings(): Promise<void> {
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

  // v3.18.1 H2 T0 P1-1: retry budget 수용 (1s base + 200+800ms backoff = 6s) — spec §3 R2 cap 일치
  const fetched = await Promise.all(
    feedUrls.map((u) => fetchFeed(u, { timeoutMs: 6000 })),
  );

  // dedup: 30d retention 안에 있는 url을 사전에 제거
  const now = Date.now();
  purgeExpiredSeen(now);
  const activeSeenUrls = loadActiveSeenUrls(now);
  // v3.39 T5: feedUrl을 picked entry에 전파하기 위해 filtered/fetched 각 항목에 feedUrl 보존.
  const filtered = fetched.map((f, idx) => ({
    ...f,
    feedUrl: feedUrls[idx],
    items: f.items.filter((it) => !activeSeenUrls.has(it.link)),
  }));
  const fetchedWithUrl = fetched.map((f, idx) => ({ ...f, feedUrl: feedUrls[idx] }));

  // pick: unseen 우선, 부족하면 원본으로 fallback (expired-seen 자동 허용)
  let chosen = pickBriefings(filtered, 5);
  if (chosen.length < 5) {
    chosen = pickBriefings(fetchedWithUrl, 5);
  }

  const today = getKstDateStr();
  const userInterests = user.interests;
  const stored: Briefing[] = chosen.map(({ item, sourceTitle, feedUrl }, i) => {
    // v3.39 T5: Briefing interestId 3-step 폴백
    //   1) matchesInterest(title, id) || matchesInterest(summary, id) — user.interests 순서
    //   2) feedToInterests(feedUrl, user.interests)[0] — origin feed → user의 첫 매핑 interest
    //   3) 'unknown'
    let interestId = 'unknown';
    const summary = stripTags(item.description);
    for (const id of userInterests) {
      if (matchesInterest(item.title, id) || matchesInterest(summary, id)) {
        interestId = id;
        break;
      }
    }
    if (interestId === 'unknown' && feedUrl) {
      const origins = feedToInterests(feedUrl, userInterests);
      if (origins.length > 0) interestId = origins[0]!;
    }

    return {
      id: `b_${Date.now()}_${i}`,
      date: today,
      url: item.link,
      title: item.title,
      summary: summary.slice(0, 200),
      scrapped: false,
      read: false,
      memo: '',
      pinned: false, // v3.28 T2 (P2-2): write-side normalize — Briefing.pinned 필수 boolean.
      interestId,
      ...(sourceTitle ? { sourceTitle } : {}),
      ...(item.image ? { imageUrl: item.image } : {}),
    };
  });
  saveBriefings(stored);
  recordSeen(stored.map((b) => b.url), now);
  // v3.19 T9: 함수 시그니처가 async로 변경 — 이 시점 list는 today로 갱신되어
  // isStale=false 분기로 빠지므로 재귀 위험 0. await로 paint 완료 보장.
  await hydrateBriefings();

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

/**
 * v3.39 T5: interestToFeeds 역매핑. 1 feed → N user.interests (user.interests 순서 보존).
 *
 * @param feedUrl — fetchFeed에 전달한 url (interestToFeeds 결과 중 하나여야 매핑됨).
 * @param userInterests — 현재 user.interests (우선순위 순서).
 * @returns 매핑되는 user.interests subset, 입력 순서대로. 매핑 없으면 [].
 *
 * @internal Caller: refreshBriefings storage 단계 interestId 결정 2순위 폴백.
 */
export function feedToInterests(feedUrl: string, userInterests: string[]): string[] {
  return userInterests.filter((id) => interestToFeeds(id).includes(feedUrl));
}

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

  const today = getKstDateStr();
  const cacheKey = `${TODAY_QUESTION_PREFIX}${today}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const q = JSON.parse(cached) as { type?: string; question: string; hint: string; targetInterestId?: string };
      // v3.39 T3 (Codex 사전 P1-2): cached question에 targetInterestId 없거나 invalid → user.interests[0] 폴백
      const cachedUser = getCachedUser();
      const cachedInterestId = resolveQuestionInterestId(q.targetInterestId, cachedUser?.interests ?? []);
      renderQuestion(content, { ...q, targetInterestId: cachedInterestId });
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
    // v3.39 T3 (Codex 사전 P1-2): fallbackQuestion path도 user.interests[0] 폴백 (resolveQuestionInterestId(undefined, …))
    const fallbackInterestId = resolveQuestionInterestId(undefined, user.interests);
    renderQuestion(content, {
      type: preferType,
      question: fallbackQuestion(preferType),
      hint: '구체적인 상황을 떠올려 적어 보세요.',
      targetInterestId: fallbackInterestId,
    });
  }
}

function renderQuestion(
  content: HTMLElement,
  q: { type?: string; question: string; hint: string; targetInterestId?: string },
): void {
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
  // v3.39 T3 (Codex 사전 P1-2): submitAnswer flow에서 Answer.interestId 채울 때 사용
  qEl.dataset['interestId'] = q.targetInterestId ?? 'unknown';
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
  const today = getKstDateStr();
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
    // v3.29 T3: switchTab now async (dynamic import) — await render before rAF scroll.
    // v3.29 T3 review fix (I2): chunk load fail 진단 가능화.
    switchTab('settings')
      .then(() => {
        requestAnimationFrame(scrollToField);
      })
      .catch((err) => {
        console.warn('[home] switchTab settings failed', err);
      });
  }
}

/** @internal — exported for unit tests; production caller는 mountHomeHandlers 내부 wiring */
export async function submitAnswer(): Promise<void> {
  const area = document.getElementById('answerArea') as HTMLTextAreaElement | null;
  const content = document.getElementById('questionContent');
  if (!area || !content) return;
  const text = area.value.trim();
  if (text.length < 10) { showToast('10자 이상 작성해 주세요'); return; }

  const qTextEl = content.querySelector<HTMLElement>('.question-text');
  const questionText = qTextEl?.textContent ?? '';
  const questionId = qTextEl?.dataset['questionId'] ?? 'q_unknown';
  const questionType = qTextEl?.dataset['type'] ?? 'unknown';
  // v3.39 T4: data-interest-id (T3 renderQuestion에서 채움) → makeAnswer.interestId.
  // dataset 값이 빈 문자열인 경우도 'unknown' 폴백 (`||` short-circuit).
  const interestId = qTextEl?.dataset['interestId'] || 'unknown';

  const answer = makeAnswer({
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    questionId,
    text,
    questionText: questionText || undefined, // v3.11: persist question text alongside answer
    authorId: 'self',
    type: questionType,
    date: getKstDateStr(),
    interestId,
  });
  const id = appendAnswer(answer);

  // record daily answer activity (streak + XP)
  applyAnswerActivity();
  hydrateGreetingAndStreak();
  hydrateMissions();  // v3.14: missions 탭이 mounted 안 된 경우 no-op (null guard). 데이터 sweep만 수행.

  area.value = '';
  const cc = document.getElementById('charCount');
  if (cc) cc.textContent = '0자';

  // Always surface the user's answer as a chat bubble so it is not "lost"
  // after the textarea is cleared. This runs before API-key gating below.
  addBubble('user', text);
  appendChatMessage(getKstDateStr(), { role: 'user', text, at: Date.now() });
  document.getElementById('chatContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(MSG.ANSWER_SAVED);

  // AI feedback via chat — requires API key
  const key = getApiKey();
  if (!key) {
    addBubble('ai', MSG.DEMO_API_KEY_PROMPT, {
      label: '⚙ 설정 열기',
      onClick: openSettingsWithFocus,
    });
    updateTurnCounter(loadChatHistory(getKstDateStr()).length);
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
    appendChatMessage(getKstDateStr(), { role: 'ai', text: reply, at: Date.now() });
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

  updateTurnCounter(loadChatHistory(getKstDateStr()).length);
}

async function sendChatMessage(): Promise<void> {
  const input = document.getElementById('chatInput') as HTMLInputElement | null;
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  addBubble('user', text);
  appendChatMessage(getKstDateStr(), { role: 'user', text, at: Date.now() });

  const key = getApiKey();
  if (!key) {
    addBubble('ai', MSG.DEMO_API_KEY_PROMPT, {
      label: '⚙ 설정 열기',
      onClick: openSettingsWithFocus,
    });
    updateTurnCounter(loadChatHistory(getKstDateStr()).length);
    return;
  }

  const history = loadChatHistory(getKstDateStr()).map((m) => ({ role: m.role, text: m.text }));
  try {
    const reply = await chat({ apiKey: key, turns: history });
    addBubble('ai', reply);
    appendChatMessage(getKstDateStr(), { role: 'ai', text: reply, at: Date.now() });
  } catch {
    addBubble('ai', MSG.AI_RESPONSE_FAIL);
  }

  updateTurnCounter(loadChatHistory(getKstDateStr()).length);
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
  a.download = `dg-backup-${getKstDateStr()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('백업 파일을 다운로드했어요');
}

// ---------------------------------------------------------------------------
// v3.23 T8: 대화 정리 / 인사이트 카드 helpers
// ---------------------------------------------------------------------------

/**
 * P1-5 fix: history.length >= 2 만으로는 user 메시지 2개(AI 0) 통과 위험.
 * user role 과 ai role 이 각 1개 이상 있어야 실제 대화가 있는 것으로 판정.
 * @internal — unit test 직접 호출용
 */
export function hasUserAndAiPair(history: ChatMessage[]): boolean {
  return history.some(m => m.role === 'user') && history.some(m => m.role === 'ai');
}

/** 대화 정리: Gemini로 chat history 요약 → bubble → 답변 저장
 * @internal — unit test 직접 호출용
 */
export async function handleSummarizeChat(): Promise<void> {
  const today = getKstDateStr();
  const history = loadChatHistory(today);
  if (!hasUserAndAiPair(history)) {
    showToast('대화를 먼저 나눠보세요');
    return;
  }
  if (!getApiKey()) {
    showToast('Gemini API 키가 필요해요. 설정에서 등록해 주세요');
    return;
  }
  if (!checkAndIncrementGemini()) {
    showToast('오늘 AI 분석 quota 소진, 내일 다시');
    return;
  }

  // v3.39 T4: chat-summary interestId 결정 — Gemini 추가 호출 0 (matchesInterest 사용).
  // user.interests를 순서대로 검사, 첫 매칭 id가 inferredInterestId. 매칭 0건 또는 user 없음 → 'unknown'.
  // closure 시점에 캡처 → onPrimary 클릭 시점에 일관 (race-free).
  const cachedUser = getCachedUser();
  const userInterests = cachedUser?.interests ?? [];
  const userMsgs = history.filter(m => m.role === 'user').map(m => m.text);
  let inferredInterestId = 'unknown';
  for (const id of userInterests) {
    if (userMsgs.some(t => matchesInterest(t, id))) {
      inferredInterestId = id;
      break;
    }
  }

  try {
    const tmpl = PROMPTS.conversationSummary;
    const text = await generateText({
      apiKey: getApiKey()!,
      prompt: tmpl.build({ chatTurns: history.map(m => ({ role: m.role, text: m.text })) }),
      maxOutputTokens: tmpl.maxOutputTokens,
    });
    const trimmed = text.trim();
    if (!trimmed) {
      showToast('AI 분석에 실패했어요');
      return;
    }
    renderChatPreviewBubble({
      text: trimmed,
      primaryLabel: '답변으로 저장',
      secondaryLabel: '닫기',
      onPrimary: () => {
        // T8 review fix C2: appendAnswer (saveAnswers throw on Quota) try/catch + getSaveErrorMessage 토스트 (v3.7 정책)
        try {
          const answer = makeAnswer({
            id: crypto.randomUUID(),
            questionId: 'chat-summary',
            text: trimmed,
            authorId: 'self',
            interestId: inferredInterestId,  // v3.39 T4: closure-bind 추론값
          });
          appendAnswer(answer);
          showToast('요약을 답변으로 저장했어요');
        } catch (e) {
          showToast(getSaveErrorMessage(e));
        }
      },
      onSecondary: () => {},
    });
  } catch {
    showToast('AI 분석에 실패했어요');
  }
}

/** 인사이트 카드 생성: Gemini로 통찰 추출 → bubble → User.insights[] 저장
 * @internal — unit test 직접 호출용
 */
export async function handleGenerateInsight(): Promise<void> {
  const today = getKstDateStr();
  const history = loadChatHistory(today);
  if (!hasUserAndAiPair(history)) {
    showToast('대화를 먼저 나눠보세요');
    return;
  }
  if (!getApiKey()) {
    showToast('Gemini API 키가 필요해요. 설정에서 등록해 주세요');
    return;
  }
  if (!checkAndIncrementGemini()) {
    showToast('오늘 AI 분석 quota 소진, 내일 다시');
    return;
  }
  try {
    const tmpl = PROMPTS.insight;
    const raw = await generateText({
      apiKey: getApiKey()!,
      prompt: tmpl.build({ chatTurns: history.map(m => ({ role: m.role, text: m.text })) }),
      maxOutputTokens: tmpl.maxOutputTokens,
    });
    // v3.25 T4: parseInsightResponse로 text + interestId 함께 추출 (T1 임시 'unknown' 교체).
    // 내부적으로 validateInsightText 호출 (trim + non-empty + max-200 cap 일원화 — v3.24 T5 정책 유지).
    let parsed: { text: string; interestId: string };
    try {
      parsed = parseInsightResponse(raw);
    } catch {
      showToast('AI 분석에 실패했어요');
      return;
    }
    const insightText = parsed.text;
    const insightInterestId = parsed.interestId;
    renderChatPreviewBubble({
      text: insightText,
      primaryLabel: '저장',
      secondaryLabel: '폐기',
      onPrimary: () => {
        const u = getCachedUser();
        if (!u) {
          showToast('사용자 정보를 불러올 수 없어요');
          return;
        }
        const insight: Insight = {
          id: crypto.randomUUID(),
          text: insightText,
          interestId: insightInterestId,  // v3.25 T4: parseInsightResponse 결과 (Gemini 분류 또는 'unknown' 폴백)
          createdAt: new Date().toISOString(),
          pinned: false, // v3.28 T2 (P2-2): write-side normalize — Insight.pinned 필수 boolean.
        };
        // T8 review fix C2: saveUser throw on Quota → in-memory pop rollback (v3.7 정책 + v3.10 atomic single-write idiom).
        u.insights.push(insight);
        try {
          saveUser(u);
          dispatch('dg:insights:added', { id: insight.id });
          showToast('인사이트 카드 1장 추가');
        } catch (e) {
          u.insights.pop();  // rollback in-memory mutate
          showToast(getSaveErrorMessage(e));
        }
      },
      onSecondary: () => {},
    });
  } catch {
    showToast('AI 분석에 실패했어요');
  }
}
