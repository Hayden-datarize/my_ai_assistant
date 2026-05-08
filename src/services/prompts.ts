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
    maxOutputTokens: 80,
    build(input: ChatInput): string {
      return [
        '아래 대화에서 가장 중요한 통찰을 한국어 1줄(최대 80자)로 추출. 문장형.',
        '---',
        turnsToText(input.chatTurns),
      ].join('\n');
    },
  } satisfies PromptTemplate,
} as const;
