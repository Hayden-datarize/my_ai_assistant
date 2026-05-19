import { describe, it, expect } from 'vitest';
import {
  parseJsonText,
  parseQuestionResponse,
  resolveQuestionInterestId,
} from '../../src/utils/gemini-parse';

describe('parseJsonText', () => {
  it('extracts JSON object from preamble', () => {
    const input = '응답: 다음과 같습니다 {"text":"hello"}';
    expect(parseJsonText<{ text: string }>(input)).toEqual({ text: 'hello' });
  });

  it('strips control chars from LLM output', () => {
    const input = '{"text":"helloworld"}';
    expect(parseJsonText<{ text: string }>(input)).toEqual({ text: 'hello world' });
  });

  it('removes trailing comma before closing brace', () => {
    const input = '{"a":1,"b":2,}';
    expect(parseJsonText<{ a: number; b: number }>(input)).toEqual({ a: 1, b: 2 });
  });

  it('throws when no JSON object found', () => {
    expect(() => parseJsonText<unknown>('plain text')).toThrow('no JSON object');
  });
});

describe('parseQuestionResponse (v3.39 T3 — Codex P1-2)', () => {
  it('valid JSON + valid id → 그대로', () => {
    const raw = JSON.stringify({ type: '분석', question: 'Q', hint: 'H', interestId: 'ai_ml' });
    expect(parseQuestionResponse(raw, ['ai_ml', 'hr_system'])).toEqual({
      type: '분석', question: 'Q', hint: 'H', targetInterestId: 'ai_ml',
    });
  });
  it('invalid interestId → user.interests[0] fallback', () => {
    const raw = JSON.stringify({ type: '분석', question: 'Q', hint: 'H', interestId: 'fake_id' });
    expect(parseQuestionResponse(raw, ['ai_ml', 'hr_system']).targetInterestId).toBe('ai_ml');
  });
  it('interestId 누락 → user.interests[0] fallback', () => {
    const raw = JSON.stringify({ type: '분석', question: 'Q', hint: 'H' });
    expect(parseQuestionResponse(raw, ['ai_ml']).targetInterestId).toBe('ai_ml');
  });
  it('user.interests=[] + invalid → unknown', () => {
    const raw = JSON.stringify({ type: '분석', question: 'Q', hint: 'H' });
    expect(parseQuestionResponse(raw, []).targetInterestId).toBe('unknown');
  });
  it('JSON parse fail → throw (caller가 fallbackQuestion으로 catch)', () => {
    expect(() => parseQuestionResponse('not json', ['ai_ml'])).toThrow();
  });
});

describe('resolveQuestionInterestId (v3.39 T3)', () => {
  it('valid rawId → 그대로', () => {
    expect(resolveQuestionInterestId('ai_ml', ['ai_ml', 'hr_system'])).toBe('ai_ml');
  });
  it('invalid rawId → user.interests[0]', () => {
    expect(resolveQuestionInterestId('fake', ['ai_ml'])).toBe('ai_ml');
  });
  it('undefined/empty rawId → user.interests[0]', () => {
    expect(resolveQuestionInterestId(undefined, ['ai_ml'])).toBe('ai_ml');
    expect(resolveQuestionInterestId('', ['ai_ml'])).toBe('ai_ml');
  });
  it('empty user.interests → unknown', () => {
    expect(resolveQuestionInterestId(undefined, [])).toBe('unknown');
    expect(resolveQuestionInterestId('fake', [])).toBe('unknown');
  });
});
