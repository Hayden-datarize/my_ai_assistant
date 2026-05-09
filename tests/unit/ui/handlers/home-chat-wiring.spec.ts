/**
 * v3.23 T8: handleSummarizeChat / handleGenerateInsight direct unit test
 * - chat history role pair guard (P1-5 fix)
 * - API key guard
 * - Gemini quota guard
 * - summarize primary → appendAnswer
 * - insight primary → User.insights[] push + dg:insights:added dispatch
 *
 * 전략: mountHomeHandlers 호출 없이 @internal export 직접 호출.
 * 모듈 mock은 vi.mock factory + vi.mocked 패턴 사용 (vi.resetModules 미사용으로 mock 안정성 확보).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// 모듈 mock 선언 — hoisted, factory 방식
// ---------------------------------------------------------------------------
const mockLoadChatHistory = vi.fn();
const mockAppendAnswer = vi.fn();
const mockGetCachedUser = vi.fn();
const mockSaveUser = vi.fn();
const mockGetApiKey = vi.fn();
const mockCheckAndIncrementGemini = vi.fn();
const mockGenerateText = vi.fn();
const mockShowToast = vi.fn();
const mockRenderChatPreviewBubble = vi.fn();

vi.mock('../../../../src/state/chat', () => ({
  loadChatHistory: (...a: unknown[]) => mockLoadChatHistory(...a),
  appendChatMessage: vi.fn(),
}));
vi.mock('../../../../src/state/persistence', () => ({
  appendAnswer: (...a: unknown[]) => mockAppendAnswer(...a),
  aggregateAnswerStats: vi.fn().mockReturnValue({}),
  setAnswerEvaluation: vi.fn(),
}));
vi.mock('../../../../src/state/user', () => ({
  getCachedUser: (...a: unknown[]) => mockGetCachedUser(...a),
  saveUser: (...a: unknown[]) => mockSaveUser(...a),
  getSaveErrorMessage: vi.fn().mockReturnValue('저장 실패'),
  recordDailyAnswer: vi.fn().mockResolvedValue(undefined),
  // v3.24 T5 (B1): handlers/home.ts now uses validateInsightText. Real-shape passthrough.
  validateInsightText: (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.length === 0) throw new Error('Insight text empty');
    return trimmed.slice(0, 200);
  },
}));
vi.mock('../../../../src/utils/apiKey', () => ({
  getApiKey: (...a: unknown[]) => mockGetApiKey(...a),
}));
vi.mock('../../../../src/state/geminiUsage', () => ({
  checkAndIncrementGemini: (...a: unknown[]) => mockCheckAndIncrementGemini(...a),
}));
vi.mock('../../../../src/services/gemini', () => ({
  generateText: (...a: unknown[]) => mockGenerateText(...a),
  generateQuestion: vi.fn().mockResolvedValue('질문'),
  chat: vi.fn().mockResolvedValue('응답'),
  evaluateAnswer: vi.fn().mockResolvedValue({ score: 5, feedback: '' }),
}));
vi.mock('../../../../src/utils/toast', () => ({
  showToast: (...a: unknown[]) => mockShowToast(...a),
}));
vi.mock('../../../../src/ui/chat-bubble', () => ({
  renderChatPreviewBubble: (...a: unknown[]) => mockRenderChatPreviewBubble(...a),
}));
// 기타 home.ts 의존 mock
vi.mock('../../../../src/services/rss', () => ({ fetchFeed: vi.fn() }));
vi.mock('../../../../src/services/slack', () => ({ autoSendAnswer: vi.fn() }));
vi.mock('../../../../src/services/translate', () => ({
  summarizeOrTranslateBody: vi.fn(),
  translateTitle: vi.fn(),
  isSessionBlocked: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../../src/ui/translateQueue', () => ({ TranslateQueue: class { enqueue = vi.fn(); } }));
vi.mock('../../../../src/utils/lang', () => ({ detectLanguage: vi.fn().mockReturnValue('ko') }));
vi.mock('../../../../src/ui/modals/memo', () => ({ openMemoModal: vi.fn() }));
vi.mock('../../../../src/ui/components/cardLangToggle', () => ({
  createLangToggle: vi.fn().mockReturnValue({ el: document.createElement('span') }),
}));
vi.mock('../../../../src/state/usage', () => ({
  checkAndIncrement: vi.fn().mockReturnValue(true),
  getCap: vi.fn().mockReturnValue(10),
  getTodayCount: vi.fn().mockReturnValue(0),
}));
vi.mock('../../../../src/ui/translateToast', () => ({
  showCapToast: vi.fn(),
  showTranslateError: vi.fn(),
  showPartialTranslateFail: vi.fn(),
}));
vi.mock('../../../../src/ui/components/garden-grid', () => ({ renderGardenMini: vi.fn() }));
vi.mock('../../../../src/ui/handlers/stats', () => ({ scrollToGardenSection: vi.fn() }));
vi.mock('../../../../src/state/seen', () => ({
  loadActiveSeenUrls: vi.fn().mockReturnValue([]),
  recordSeen: vi.fn(),
  purgeExpiredSeen: vi.fn(),
}));
vi.mock('../../../../src/ui/messages', () => ({ MSG: {} }));
vi.mock('../../../../src/state/missionEngine', () => ({
  getActiveMissions: vi.fn().mockReturnValue([]),
  getKSTDateIso: vi.fn().mockReturnValue('2026-05-08'),
}));
vi.mock('../../../../src/ui/missions-section', () => ({ renderMissionsSection: vi.fn() }));
vi.mock('../../../../src/ui/handlers/missions-triggers', () => ({
  fireBriefingViewTrigger: vi.fn(),
  fireCrossInterestTrigger: vi.fn(),
}));
vi.mock('../../../../src/utils/interestKeywords', () => ({
  interestKeywords: {},
  matchKeyword: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../../src/ui/nav', () => ({ switchTab: vi.fn() }));
vi.mock('../../../../src/utils/typeLabel', () => ({ toKoType: vi.fn().mockReturnValue('유형') }));
vi.mock('../../../../src/state/briefings', () => ({
  loadBriefings: vi.fn().mockReturnValue([]),
  saveBriefings: vi.fn(),
  toggleScrap: vi.fn(),
  setRead: vi.fn(),
  setTranslation: vi.fn(),
}));
vi.mock('../../../../src/state/schema', () => ({
  makeAnswer: vi.fn().mockImplementation((input: Record<string, unknown>) => ({
    ...input,
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
  })),
}));
vi.mock('../../../../src/utils/dates', () => ({
  getKstDateStr: vi.fn().mockReturnValue('2026-05-08'),
}));

// ---------------------------------------------------------------------------
// 타입 alias
// ---------------------------------------------------------------------------
interface ChatPreviewBubbleOpts {
  text: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

interface FakeUser {
  name: string;
  interests: string[];
  onboardedAt: string;
  streak: number;
  lastActiveDate: string;
  answers: unknown[];
  streakFreeze: number;
  insights: { id: string; text: string; createdAt: string }[];
  schemaVersion: number;
}

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    name: '테스터',
    interests: [],
    onboardedAt: '2026-01-01T00:00:00.000Z',
    streak: 0,
    lastActiveDate: '2026-05-08',
    answers: [],
    streakFreeze: 0,
    insights: [],
    schemaVersion: 6,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe('hasUserAndAiPair (v3.23 T8 P1-5 fix)', () => {
  it('빈 배열 → false', async () => {
    const { hasUserAndAiPair } = await import('../../../../src/ui/handlers/home');
    expect(hasUserAndAiPair([])).toBe(false);
  });

  it('user 메시지만 2개 → false', async () => {
    const { hasUserAndAiPair } = await import('../../../../src/ui/handlers/home');
    expect(hasUserAndAiPair([
      { role: 'user', text: '1', at: 1 },
      { role: 'user', text: '2', at: 2 },
    ])).toBe(false);
  });

  it('ai 메시지만 1개 → false', async () => {
    const { hasUserAndAiPair } = await import('../../../../src/ui/handlers/home');
    expect(hasUserAndAiPair([
      { role: 'ai', text: '응답', at: 1 },
    ])).toBe(false);
  });

  it('user 1 + ai 1 → true', async () => {
    const { hasUserAndAiPair } = await import('../../../../src/ui/handlers/home');
    expect(hasUserAndAiPair([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ])).toBe(true);
  });

  it('ai 먼저, user 나중 → true (순서 무관)', async () => {
    const { hasUserAndAiPair } = await import('../../../../src/ui/handlers/home');
    expect(hasUserAndAiPair([
      { role: 'ai', text: '시작', at: 1 },
      { role: 'user', text: '안녕', at: 2 },
    ])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
function setupChatContainer(): void {
  const existing = document.getElementById('chatMessages');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'chatMessages';
  document.body.appendChild(div);
}

describe('handleSummarizeChat (v3.23 T8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChatContainer();
    mockLoadChatHistory.mockReturnValue([]);
    mockGetApiKey.mockReturnValue('');
    mockCheckAndIncrementGemini.mockReturnValue(true);
    mockGenerateText.mockResolvedValue('테스트 요약');
    mockRenderChatPreviewBubble.mockReturnValue(document.createElement('div'));
    mockGetCachedUser.mockReturnValue(makeUser());
  });

  it('chat 빈: "대화를 먼저 나눠보세요" 토스트, generateText 미호출', async () => {
    mockLoadChatHistory.mockReturnValue([]);
    mockGetApiKey.mockReturnValue('test-key');

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    expect(mockShowToast).toHaveBeenCalledWith('대화를 먼저 나눠보세요');
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('P1-5: user 메시지만 2개, AI 0 → 가드 fail', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '질문1', at: 1 },
      { role: 'user', text: '질문2', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('test-key');

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    expect(mockShowToast).toHaveBeenCalledWith('대화를 먼저 나눠보세요');
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('빈 apiKey → "API 키" 안내 토스트, checkAndIncrementGemini 미호출', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('');

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('API 키'));
    expect(mockCheckAndIncrementGemini).not.toHaveBeenCalled();
  });

  it('quota 초과 → "quota" 포함 토스트', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('test-key');
    mockCheckAndIncrementGemini.mockReturnValue(false);

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('quota'));
  });

  it('user+ai pair → renderChatPreviewBubble 호출됨', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('test-key');
    mockGenerateText.mockResolvedValue('요약 결과');

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    expect(mockRenderChatPreviewBubble).toHaveBeenCalledOnce();
  });

  it('primary 클릭 → appendAnswer 호출', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('test-key');
    mockGenerateText.mockResolvedValue('멋진 요약');

    let capturedOpts: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      capturedOpts = opts;
      return document.createElement('div');
    });

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    expect(capturedOpts).not.toBeNull();
    capturedOpts!.onPrimary();

    expect(mockAppendAnswer).toHaveBeenCalledOnce();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('저장'));
  });
});

// ---------------------------------------------------------------------------
describe('handleGenerateInsight (v3.23 T8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChatContainer();
    mockLoadChatHistory.mockReturnValue([]);
    mockGetApiKey.mockReturnValue('');
    mockCheckAndIncrementGemini.mockReturnValue(true);
    mockGenerateText.mockResolvedValue('핵심 통찰 문장');
    mockRenderChatPreviewBubble.mockReturnValue(document.createElement('div'));
    mockGetCachedUser.mockReturnValue(makeUser());
  });

  it('insight primary 클릭 → User.insights[] push + dg:insights:added dispatch', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('test-key');
    mockGenerateText.mockResolvedValue('핵심 통찰 문장');

    const fakeUser = makeUser();
    mockGetCachedUser.mockReturnValue(fakeUser);

    let capturedOpts: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      capturedOpts = opts;
      return document.createElement('div');
    });

    const dispatchedEvents: CustomEvent[] = [];
    document.addEventListener('dg:insights:added', (e) => dispatchedEvents.push(e as CustomEvent));

    const { handleGenerateInsight } = await import('../../../../src/ui/handlers/home');
    await handleGenerateInsight();

    expect(capturedOpts).not.toBeNull();
    capturedOpts!.onPrimary();

    // saveUser 호출
    expect(mockSaveUser).toHaveBeenCalledOnce();

    // User.insights[] push 확인
    const savedUser = mockSaveUser.mock.calls[0][0] as FakeUser;
    expect(savedUser.insights).toHaveLength(1);
    const addedInsight = savedUser.insights[0];
    expect(addedInsight).toBeDefined();
    expect(addedInsight!.text).toBe('핵심 통찰 문장');
    expect(addedInsight!.createdAt).toMatch(/^\d{4}-/);  // ISO 형식

    // dg:insights:added dispatch 확인
    expect(dispatchedEvents).toHaveLength(1);
    const firstEvent = dispatchedEvents[0];
    expect(firstEvent).toBeDefined();
    expect(firstEvent!.detail.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  // T8 review fix C2: saveUser throw → in-memory rollback + getSaveErrorMessage 토스트
  it('insight: saveUser throw → User.insights[] pop rollback + 토스트, dispatch 미발생', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('test-key');
    mockGenerateText.mockResolvedValue('핵심 통찰 문장');

    const insightsArr: { id: string; text: string; createdAt: string }[] = [];
    mockGetCachedUser.mockReturnValue({ schemaVersion: 6, insights: insightsArr } as unknown as FakeUser);
    mockSaveUser.mockImplementation(() => { throw new Error('Quota exceeded'); });

    let capturedOpts: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      capturedOpts = opts;
      return document.createElement('div');
    });

    const dispatchedEvents: CustomEvent[] = [];
    document.addEventListener('dg:insights:added', (e) => dispatchedEvents.push(e as CustomEvent));

    const { handleGenerateInsight } = await import('../../../../src/ui/handlers/home');
    await handleGenerateInsight();

    expect(capturedOpts).not.toBeNull();
    capturedOpts!.onPrimary();

    // saveUser 호출됨 (throw)
    expect(mockSaveUser).toHaveBeenCalledOnce();
    // rollback: insights 배열 비어 있음 (pop()으로 push 직후 되돌림)
    expect(insightsArr).toHaveLength(0);
    // dispatch 도달 안 함
    expect(dispatchedEvents).toHaveLength(0);
    // getSaveErrorMessage 토스트
    expect(mockShowToast).toHaveBeenCalled();
  });

  it('summarize: appendAnswer throw → getSaveErrorMessage 토스트', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('test-key');
    mockGenerateText.mockResolvedValue('대화 요약 결과');
    mockAppendAnswer.mockImplementation(() => { throw new Error('Quota exceeded'); });

    let capturedOpts: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      capturedOpts = opts;
      return document.createElement('div');
    });

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    expect(capturedOpts).not.toBeNull();
    capturedOpts!.onPrimary();

    expect(mockAppendAnswer).toHaveBeenCalledOnce();
    expect(mockShowToast).toHaveBeenCalled();
  });

  it('getCachedUser null → "사용자 정보" 토스트, saveUser 미호출', async () => {
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '안녕', at: 1 },
      { role: 'ai', text: '반가워요', at: 2 },
    ]);
    mockGetApiKey.mockReturnValue('test-key');
    mockGetCachedUser.mockReturnValue(null);

    let capturedOpts: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      capturedOpts = opts;
      return document.createElement('div');
    });

    const { handleGenerateInsight } = await import('../../../../src/ui/handlers/home');
    await handleGenerateInsight();

    expect(capturedOpts).not.toBeNull();
    capturedOpts!.onPrimary();

    expect(mockSaveUser).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('사용자 정보'));
  });
});
