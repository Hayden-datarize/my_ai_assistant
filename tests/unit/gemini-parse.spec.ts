import { describe, it, expect } from 'vitest';
import { parseJsonText } from '../../src/utils/gemini-parse';

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
