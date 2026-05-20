/**
 * v3.39 T4: submitAnswer + handleSummarizeChat interestId wiring
 *
 * 검증:
 *  - submitAnswer: qTextEl.dataset.interestId → makeAnswer 전달 ('unknown' 폴백 포함)
 *  - handleSummarizeChat: chat history user 메시지 matchesInterest 첫 match → inferredInterestId
 *
 * 전략: mock factory 패턴 (home-chat-wiring.spec.ts와 동일). makeAnswer를 mock으로 두어 input
 * spread 결과를 검증. matchesInterest는 vi.fn으로 mock하여 시나리오별 반환값 제어.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// 모듈 mock 선언 — hoisted
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
const mockMakeAnswer = vi.fn();
const mockMatchesInterest = vi.fn();
const mockRecordDailyAnswer = vi.fn().mockResolvedValue(undefined);

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
  recordDailyAnswer: (...a: unknown[]) => mockRecordDailyAnswer(...a),
  validateInsightText: (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.length === 0) throw new Error('Insight text empty');
    return trimmed.slice(0, 200);
  },
  validateInterestId: (id: string): string => {
    const ids = new Set([
      'recruiting', 'onboarding', 'culture', 'hr_system', 'labor_law',
      'leadership', 'pm', 'ai_ml', 'data', 'startup', 'marketing',
      'productivity', 'career', 'communication', 'self_dev',
    ]);
    return ids.has(id) ? id : 'unknown';
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
vi.mock('../../../../src/ui/handlers/stats-shared', () => ({ scrollToGardenSection: vi.fn() }));
vi.mock('../../../../src/state/seen', () => ({
  loadActiveSeenUrls: vi.fn().mockReturnValue([]),
  recordSeen: vi.fn(),
  purgeExpiredSeen: vi.fn(),
}));
vi.mock('../../../../src/ui/messages', () => ({
  MSG: {
    ANSWER_SAVED: '답변 저장됨',
    DEMO_API_KEY_PROMPT: 'API 키 안내',
    AI_RESPONSE_FAIL: 'AI 응답 실패',
  },
}));
vi.mock('../../../../src/state/missionEngine', () => ({
  getActiveMissions: vi.fn().mockReturnValue([]),
  getKSTDateIso: vi.fn().mockReturnValue('2026-05-19'),
}));
vi.mock('../../../../src/ui/missions-section', () => ({ renderMissionsSection: vi.fn() }));
vi.mock('../../../../src/ui/handlers/missions-triggers', () => ({
  fireBriefingViewTrigger: vi.fn(),
  fireCrossInterestTrigger: vi.fn(),
}));
vi.mock('../../../../src/utils/interestKeywords', () => ({
  interestKeywords: vi.fn().mockReturnValue([]),
  matchKeyword: vi.fn().mockReturnValue(false),
  matchesInterest: (...a: unknown[]) => mockMatchesInterest(...a),
}));
vi.mock('../../../../src/ui/nav', () => ({ switchTab: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../../src/utils/typeLabel', () => ({ toKoType: vi.fn().mockReturnValue('유형') }));
vi.mock('../../../../src/state/briefings', () => ({
  loadBriefings: vi.fn().mockReturnValue([]),
  saveBriefings: vi.fn(),
  toggleScrap: vi.fn(),
  setRead: vi.fn(),
  setTranslation: vi.fn(),
}));
vi.mock('../../../../src/state/schema', () => ({
  makeAnswer: (...a: unknown[]) => mockMakeAnswer(...a),
}));
vi.mock('../../../../src/utils/dates', () => ({
  getKstDateStr: vi.fn().mockReturnValue('2026-05-19'),
}));

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
  insights: unknown[];
  schemaVersion: number;
}

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    name: '테스터',
    interests: [],
    onboardedAt: '2026-01-01T00:00:00.000Z',
    streak: 0,
    lastActiveDate: '2026-05-19',
    answers: [],
    streakFreeze: 0,
    insights: [],
    schemaVersion: 9,
    ...overrides,
  };
}

function setupChatContainer(): void {
  ['chatMessages', 'chatContainer', 'turnCounter', 'answerArea', 'questionContent', 'charCount'].forEach((id) => {
    document.getElementById(id)?.remove();
  });
  const div = document.createElement('div');
  div.id = 'chatMessages';
  document.body.appendChild(div);
}

function setupQuestionDom(opts: { interestId?: string; type?: string; questionId?: string; answerText?: string } = {}): void {
  setupChatContainer();
  const area = document.createElement('textarea');
  area.id = 'answerArea';
  area.value = opts.answerText ?? '열두자이상의답변텍스트작성';
  document.body.appendChild(area);

  const content = document.createElement('div');
  content.id = 'questionContent';
  const qText = document.createElement('div');
  qText.className = 'question-text';
  qText.textContent = '예시 질문 한 줄';
  qText.dataset['questionId'] = opts.questionId ?? 'q1';
  qText.dataset['type'] = opts.type ?? '분석';
  if (opts.interestId !== undefined) {
    qText.dataset['interestId'] = opts.interestId;
  }
  content.appendChild(qText);
  document.body.appendChild(content);

  const cc = document.createElement('div');
  cc.id = 'charCount';
  document.body.appendChild(cc);
}

// ---------------------------------------------------------------------------
describe('submitAnswer interestId (v3.39 T4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiKey.mockReturnValue(''); // skip Gemini chat path (interestId 검증만 목표)
    mockGetCachedUser.mockReturnValue(makeUser());
    mockLoadChatHistory.mockReturnValue([]);
    mockMakeAnswer.mockImplementation((input: Record<string, unknown>) => ({
      ...input,
      schemaVersion: 9,
      createdAt: new Date().toISOString(),
    }));
    mockAppendAnswer.mockImplementation((a: { id: string }) => a.id);
  });

  it('question DOM의 data-interest-id를 makeAnswer에 전달', async () => {
    setupQuestionDom({ interestId: 'ai_ml' });
    const { submitAnswer } = await import('../../../../src/ui/handlers/home');
    await submitAnswer();

    expect(mockMakeAnswer).toHaveBeenCalledOnce();
    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('ai_ml');
  });

  it('data-interest-id 부재 → unknown 폴백', async () => {
    setupQuestionDom({}); // interestId attribute 미설정
    const { submitAnswer } = await import('../../../../src/ui/handlers/home');
    await submitAnswer();

    expect(mockMakeAnswer).toHaveBeenCalledOnce();
    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('unknown');
  });

  // v3.40 T5 C2 (Codex P2-1): dataset corrupt → validateInterestId double-close → unknown
  it('data-interest-id corrupt(__invalid__) → validateInterestId 통과 후 unknown 폴백', async () => {
    setupQuestionDom({ interestId: '__invalid__' });
    const { submitAnswer } = await import('../../../../src/ui/handlers/home');
    await submitAnswer();

    expect(mockMakeAnswer).toHaveBeenCalledOnce();
    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('unknown');
  });

  it('data-interest-id 빈 문자열 → unknown 폴백', async () => {
    setupQuestionDom({ interestId: '' });
    const { submitAnswer } = await import('../../../../src/ui/handlers/home');
    await submitAnswer();

    expect(mockMakeAnswer).toHaveBeenCalledOnce();
    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
describe('handleSummarizeChat interestId (v3.39 T4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChatContainer();
    mockGetApiKey.mockReturnValue('test-key');
    mockCheckAndIncrementGemini.mockReturnValue(true);
    mockGenerateText.mockResolvedValue('대화 요약 결과');
    mockRenderChatPreviewBubble.mockReturnValue(document.createElement('div'));
    mockMakeAnswer.mockImplementation((input: Record<string, unknown>) => ({
      ...input,
      schemaVersion: 9,
      createdAt: new Date().toISOString(),
    }));
    mockAppendAnswer.mockImplementation((a: { id: string }) => a.id);
    mockMatchesInterest.mockReturnValue(false);
  });

  it("chat history user 메시지에 ai_ml keyword → inferredInterestId='ai_ml'", async () => {
    mockGetCachedUser.mockReturnValue(makeUser({ interests: ['ai_ml', 'hr_system'] }));
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: 'AI 모델 학습 어떻게 시작하지', at: 1 },
      { role: 'ai', text: '먼저 데이터셋부터…', at: 2 },
    ]);
    // matchesInterest 시나리오: ai_ml에 대해 true, 나머지 false.
    mockMatchesInterest.mockImplementation((_text: string, id: string) => id === 'ai_ml');

    let captured: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      captured = opts;
      return document.createElement('div');
    });

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    expect(captured).not.toBeNull();
    captured!.onPrimary();

    expect(mockMakeAnswer).toHaveBeenCalledOnce();
    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('ai_ml');
  });

  it("user.interests 우선순위: 첫 매칭 id가 선택됨 (hr_system 먼저, ai_ml은 뒤)", async () => {
    mockGetCachedUser.mockReturnValue(makeUser({ interests: ['hr_system', 'ai_ml'] }));
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '인사 시스템 + AI 모델 학습 융합', at: 1 },
      { role: 'ai', text: '응답', at: 2 },
    ]);
    // 두 id 모두 true → 첫 번째(hr_system) 우선.
    mockMatchesInterest.mockImplementation((_text: string, id: string) =>
      id === 'hr_system' || id === 'ai_ml',
    );

    let captured: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      captured = opts;
      return document.createElement('div');
    });

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    captured!.onPrimary();

    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('hr_system');
  });

  it("chat history 매칭 0건 → unknown", async () => {
    mockGetCachedUser.mockReturnValue(makeUser({ interests: ['ai_ml', 'hr_system'] }));
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: '오늘 날씨 좋네요', at: 1 },
      { role: 'ai', text: '맑은 하루', at: 2 },
    ]);
    mockMatchesInterest.mockReturnValue(false); // 어느 id도 매칭 X

    let captured: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      captured = opts;
      return document.createElement('div');
    });

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    captured!.onPrimary();

    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('unknown');
  });

  it("user.interests=[] → unknown (검사할 id 없음)", async () => {
    mockGetCachedUser.mockReturnValue(makeUser({ interests: [] }));
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: 'AI 모델 학습', at: 1 },
      { role: 'ai', text: '응답', at: 2 },
    ]);
    mockMatchesInterest.mockReturnValue(true); // 호출되지 않아야 정상

    let captured: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      captured = opts;
      return document.createElement('div');
    });

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    captured!.onPrimary();

    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('unknown');
    // user.interests=[] → matchesInterest 호출조차 안 일어남
    expect(mockMatchesInterest).not.toHaveBeenCalled();
  });

  it("getCachedUser null → unknown (defensive)", async () => {
    mockGetCachedUser.mockReturnValue(null);
    mockLoadChatHistory.mockReturnValue([
      { role: 'user', text: 'AI 모델', at: 1 },
      { role: 'ai', text: '응답', at: 2 },
    ]);

    let captured: ChatPreviewBubbleOpts | null = null;
    mockRenderChatPreviewBubble.mockImplementation((opts: ChatPreviewBubbleOpts) => {
      captured = opts;
      return document.createElement('div');
    });

    const { handleSummarizeChat } = await import('../../../../src/ui/handlers/home');
    await handleSummarizeChat();

    captured!.onPrimary();

    const passed = mockMakeAnswer.mock.calls[0]![0] as Record<string, unknown>;
    expect(passed['interestId']).toBe('unknown');
  });
});
