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
  it('parses JSON text into QuestionOut (v3.39 T3: targetInterestId 포함)', async () => {
    stubResponse('{"type":"reflection","question":"Q?","hint":"H","interestId":"ai_ml"}');
    const q = await generateQuestion({ apiKey: 'k', interests: ['ai_ml'], preferType: 'reflection' });
    expect(q).toEqual({ type: 'reflection', question: 'Q?', hint: 'H', targetInterestId: 'ai_ml' });
  });

  it('tolerates leading/trailing prose around the JSON object', async () => {
    stubResponse('설명 텍스트...\n```json\n{"type":"action","question":"Q","hint":"H","interestId":"hr_system"}\n```\n뒷부분');
    const q = await generateQuestion({ apiKey: 'k', interests: ['hr_system'], preferType: 'action' });
    expect(q.type).toBe('action');
    expect(q.targetInterestId).toBe('hr_system');
  });

  it('v3.39 T3: invalid interestId from Gemini → user.interests[0] 폴백', async () => {
    stubResponse('{"type":"reflection","question":"Q","hint":"H","interestId":"fake_xyz"}');
    const q = await generateQuestion({ apiKey: 'k', interests: ['ai_ml', 'hr_system'], preferType: 'reflection' });
    expect(q.targetInterestId).toBe('ai_ml');
  });

  it('v3.39 T3: interestId 누락 + interests=[] → unknown 폴백', async () => {
    stubResponse('{"type":"action","question":"Q","hint":"H"}');
    const q = await generateQuestion({ apiKey: 'k', interests: [], preferType: 'action' });
    expect(q.targetInterestId).toBe('unknown');
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
