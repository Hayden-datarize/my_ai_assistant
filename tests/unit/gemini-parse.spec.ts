import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseEvaluationResponse,
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

  // v3.40 T5 C2 (Codex P2-1): userInterests에 invalid 섞여 있을 때 first valid fallback
  it('invalid rawId + userInterests에 invalid 섞여 있으면 first valid 반환', () => {
    expect(resolveQuestionInterestId('fake', ['__invalid__', 'ai_ml', 'hr_system'])).toBe('ai_ml');
  });
  it('undefined rawId + userInterests에 invalid 섞여 있으면 first valid', () => {
    expect(resolveQuestionInterestId(undefined, ['__bad__', 'ai_ml'])).toBe('ai_ml');
  });
  it('invalid rawId + userInterests 모두 invalid → unknown', () => {
    expect(resolveQuestionInterestId('fake', ['__invalid__', '__bad__'])).toBe('unknown');
  });
});

describe('parseEvaluationResponse (v3.41 T2 — Codex P1 F2)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('valid {score, feedback} 그대로', () => {
    const r = parseEvaluationResponse('{"score":4,"feedback":"good"}');
    expect(r).toEqual({ score: 4, feedback: 'good' });
  });

  it('string score → Number coerce 후 clamp', () => {
    const r = parseEvaluationResponse('{"score":"5","feedback":"x"}');
    expect(r).toEqual({ score: 5, feedback: 'x' });
  });

  it('score > 5 → fallback 3 + warn', () => {
    const r = parseEvaluationResponse('{"score":6,"feedback":"x"}');
    expect(r).toEqual({ score: 3, feedback: 'x' });
    expect(console.warn).toHaveBeenCalledWith('[parseEvaluationResponse] invalid score', 6);
  });

  it('score < 1 → fallback 3', () => {
    const r = parseEvaluationResponse('{"score":-1,"feedback":""}');
    expect(r.score).toBe(3);
  });

  it('non-integer (소수) → fallback 3', () => {
    const r = parseEvaluationResponse('{"score":2.5,"feedback":"half"}');
    expect(r.score).toBe(3);
  });

  it('feedback이 null이면 empty string', () => {
    const r = parseEvaluationResponse('{"score":3,"feedback":null}');
    expect(r.feedback).toBe('');
  });

  it('Gemini fenced code block (```json {...}```) 처리', () => {
    const r = parseEvaluationResponse('```json\n{"score":2,"feedback":"meh"}\n```');
    expect(r).toEqual({ score: 2, feedback: 'meh' });
  });

  it('garbage prefix + valid JSON', () => {
    const r = parseEvaluationResponse('응답: {"score":4,"feedback":"nice"}');
    expect(r).toEqual({ score: 4, feedback: 'nice' });
  });

  it('malformed JSON → fallback {3, ""} + warn', () => {
    const r = parseEvaluationResponse('{"score":4,"feedback":');
    expect(r).toEqual({ score: 3, feedback: '' });
    expect(console.warn).toHaveBeenCalled();
  });

  it('plain text (JSON 없음) → fallback', () => {
    const r = parseEvaluationResponse('5점 정도 됩니다');
    expect(r).toEqual({ score: 3, feedback: '' });
  });

  it('empty object → fallback', () => {
    const r = parseEvaluationResponse('{}');
    expect(r).toEqual({ score: 3, feedback: '' });
  });

  it('feedback이 500자 초과 시 slice', () => {
    const longFeedback = 'a'.repeat(600);
    const r = parseEvaluationResponse(`{"score":3,"feedback":"${longFeedback}"}`);
    expect(r.feedback.length).toBe(500);
  });

  it('XSS 시도 (script tag string) — feedback 그대로 보관 (render path에서 escape 의무)', () => {
    const r = parseEvaluationResponse('{"score":3,"feedback":"<script>alert(1)</script>"}');
    expect(r.feedback).toBe('<script>alert(1)</script>');
    // 렌더 path가 escapeHtml 책임 (보안 contract: parser는 정제 X, render가 escape O)
  });
});
