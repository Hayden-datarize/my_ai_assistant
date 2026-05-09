import type { ChatMessage } from '../state/chat';

export interface PromptTemplate {
  maxOutputTokens: number;
  build(input: unknown): string;
}

interface StatsInput {
  totalAnswers: number;
  longestStreak: number;
  activeInterests: number;
  byInterest: Array<{ id: string; count: number }>;
  daily?: number[];
}

interface ChatInput {
  chatTurns: Pick<ChatMessage, 'role' | 'text'>[];
}

const turnsToText = (turns: Pick<ChatMessage, 'role' | 'text'>[]): string =>
  turns.map(t => `${t.role === 'user' ? '사용자' : 'AI'}: ${t.text}`).join('\n');

export const PROMPTS = {
  statsHighlight: {
    maxOutputTokens: 60,
    build(input: StatsInput): string {
      const top = input.byInterest[0];
      return [
        '아래 7일 활동 데이터를 보고 한국어 1줄(최대 50자)로 요약. 숫자 강조.',
        `- 총 답변: ${input.totalAnswers}`,
        `- 최장 streak: ${input.longestStreak}일`,
        `- 활성 분야: ${input.activeInterests}개`,
        top ? `- top 분야: ${top.id} (${top.count}개)` : '',
      ].filter(Boolean).join('\n');
    },
  } satisfies PromptTemplate,

  statsNarrative: {
    maxOutputTokens: 200,
    build(input: StatsInput): string {
      return [
        '아래 30일 활동 데이터를 보고 한국어 1~2 문장(최대 100자)으로 narrative 요약. 격려 톤.',
        `- 총 답변: ${input.totalAnswers}`,
        `- 최장 streak: ${input.longestStreak}일`,
        `- 활성 분야: ${input.activeInterests}개`,
        `- top 분야: ${input.byInterest.slice(0, 3).map(i => `${i.id}(${i.count})`).join(', ')}`,
      ].join('\n');
    },
  } satisfies PromptTemplate,

  conversationSummary: {
    maxOutputTokens: 400,
    build(input: ChatInput): string {
      return [
        '아래 대화를 한국어로 요약. 핵심 통찰/액션 포함, 3~5 문장.',
        '---',
        turnsToText(input.chatTurns),
      ].join('\n');
    },
  } satisfies PromptTemplate,

  insight: {
    maxOutputTokens: 110,
    build(input: ChatInput): string {
      return [
        '아래 대화에서 가장 중요한 통찰을 추출.',
        '반드시 다음 형식의 1줄로만 출력 (다른 설명/마크다운 금지):',
        '<통찰 한국어 1문장 (최대 80자)>|<interestId>',
        '',
        '<interestId>는 아래 16개 중 하나만 사용. 어떤 분야인지 매칭이 어려우면 unknown.',
        'recruiting, onboarding, culture, hr_system, labor_law, leadership,',
        'pm, ai_ml, data, startup, marketing, productivity,',
        'career, communication, self_dev, unknown',
        '---',
        turnsToText(input.chatTurns),
      ].join('\n');
    },
  } satisfies PromptTemplate,
} as const;
