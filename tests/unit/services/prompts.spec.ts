import { describe, it, expect } from 'vitest';
import { PROMPTS } from '../../../src/services/prompts';

describe('PROMPTS — 4 template keys 존재', () => {
  it('statsHighlight / statsNarrative / conversationSummary / insight 모두 존재', () => {
    expect(PROMPTS).toHaveProperty('statsHighlight');
    expect(PROMPTS).toHaveProperty('statsNarrative');
    expect(PROMPTS).toHaveProperty('conversationSummary');
    expect(PROMPTS).toHaveProperty('insight');
  });
});

describe('PROMPTS — maxOutputTokens 차등', () => {
  it('statsHighlight < statsNarrative < conversationSummary', () => {
    expect(PROMPTS.statsHighlight.maxOutputTokens).toBeLessThan(PROMPTS.statsNarrative.maxOutputTokens);
    expect(PROMPTS.statsNarrative.maxOutputTokens).toBeLessThan(PROMPTS.conversationSummary.maxOutputTokens);
  });

  it('insight는 60~120 범위 (v3.25 T3: 80→110, interestId+구분자 30 여유)', () => {
    expect(PROMPTS.insight.maxOutputTokens).toBeGreaterThanOrEqual(60);
    expect(PROMPTS.insight.maxOutputTokens).toBeLessThanOrEqual(120);
  });
});

describe('PROMPTS — build() 한국어 강제 + input 보간', () => {
  const statsInput = {
    totalAnswers: 42,
    longestStreak: 7,
    activeInterests: 3,
    byInterest: [{ id: 'ai_ml', count: 15 }, { id: 'startup', count: 8 }],
  };

  it('statsHighlight build — 총 답변/streak 수치 포함', () => {
    const prompt = PROMPTS.statsHighlight.build(statsInput);
    expect(prompt).toContain('42');
    expect(prompt).toContain('7');
    expect(prompt).toContain('한국어');
  });

  it('statsNarrative build — top 분야 포함', () => {
    const prompt = PROMPTS.statsNarrative.build(statsInput);
    expect(prompt).toContain('ai_ml');
    expect(prompt).toContain('한국어');
  });

  it('statsHighlight build — byInterest 빈 배열이어도 오류 없음', () => {
    const emptyInput = { totalAnswers: 0, longestStreak: 0, activeInterests: 0, byInterest: [] };
    expect(() => PROMPTS.statsHighlight.build(emptyInput)).not.toThrow();
  });
});

describe('PROMPTS — chatTurns 변환', () => {
  const turns = [
    { role: 'user' as const, text: '오늘 배운 것' },
    { role: 'ai' as const, text: '좋은 질문입니다' },
  ];

  it('conversationSummary build — 사용자/AI 역할 변환', () => {
    const prompt = PROMPTS.conversationSummary.build({ chatTurns: turns });
    expect(prompt).toContain('사용자: 오늘 배운 것');
    expect(prompt).toContain('AI: 좋은 질문입니다');
  });

  it('insight build — 핵심 통찰 추출 안내 포함', () => {
    const prompt = PROMPTS.insight.build({ chatTurns: turns });
    expect(prompt).toContain('통찰');
    expect(prompt).toContain('한국어');
  });

  it('conversationSummary build — 빈 turns이어도 오류 없음', () => {
    expect(() => PROMPTS.conversationSummary.build({ chatTurns: [] })).not.toThrow();
  });
});
