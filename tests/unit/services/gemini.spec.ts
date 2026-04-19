import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText, generateQuestion, chat, evaluateAnswer } from '../../../src/services/gemini';

beforeEach(() => {
  global.fetch = vi.fn();
});

function stubResponse(text: string): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  });
}

describe('gemini.generateText', () => {
  it('throws if no api key', async () => {
    await expect(generateText({ apiKey: '', prompt: 'hi' })).rejects.toThrow(/api key/i);
  });

  it('posts to Gemini endpoint with prompt body', async () => {
    stubResponse('response');
    const out = await generateText({ apiKey: 'k', prompt: 'hi' });
    expect(out).toBe('response');
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('returns empty string on malformed response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    expect(await generateText({ apiKey: 'k', prompt: 'hi' })).toBe('');
  });
});

describe('gemini.generateQuestion', () => {
  it('parses JSON text into QuestionOut', async () => {
    stubResponse('{"type":"reflection","question":"Q?","hint":"H"}');
    const q = await generateQuestion({ apiKey: 'k', interests: ['ai_ml'], preferType: 'reflection' });
    expect(q).toEqual({ type: 'reflection', question: 'Q?', hint: 'H' });
  });

  it('tolerates leading/trailing prose around the JSON object', async () => {
    stubResponse('설명 텍스트...\n```json\n{"type":"action","question":"Q","hint":"H"}\n```\n뒷부분');
    const q = await generateQuestion({ apiKey: 'k', interests: [], preferType: 'action' });
    expect(q.type).toBe('action');
  });
});

describe('gemini.chat', () => {
  it('returns plain text reply from AI turn', async () => {
    stubResponse('답변입니다');
    const reply = await chat({ apiKey: 'k', turns: [{ role: 'user', text: '안녕' }] });
    expect(reply).toBe('답변입니다');
  });
});

describe('gemini.evaluateAnswer', () => {
  it('parses JSON score + feedback', async () => {
    stubResponse('{"score":4,"feedback":"ok"}');
    const e = await evaluateAnswer({ apiKey: 'k', question: 'Q', answer: 'A' });
    expect(e).toEqual({ score: 4, feedback: 'ok' });
  });
});
