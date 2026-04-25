import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { translateTitle, summarizeOrTranslateBody } from '../../src/services/translate';

describe('translate service base', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockOk(text: string) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text }] } }],
      }),
    } as unknown as Response);
  }

  it('translateTitle returns Korean string from JSON response', async () => {
    mockOk('{"text":"OpenAI가 새 GPT 모델을 발표했어요"}');
    const out = await translateTitle('OpenAI launches new GPT model', 'KEY');
    expect(out).toBe('OpenAI가 새 GPT 모델을 발표했어요');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  function getCallBody(callIndex = 0): string {
    const mockFetch = global.fetch as unknown as { mock: { calls: Array<[unknown, RequestInit]> } };
    const call = mockFetch.mock.calls[callIndex];
    if (!call) throw new Error('fetch was not called');
    return call[1].body as string;
  }

  it('summarizeOrTranslateBody short input (≤80) uses translate prompt', async () => {
    mockOk('{"text":"짧은 본문 직역"}');
    const out = await summarizeOrTranslateBody('Short body.', 'KEY');
    expect(out).toBe('짧은 본문 직역');
    const callBody = getCallBody();
    expect(callBody).toContain('번역');
    expect(callBody).not.toContain('요약');
  });

  it('summarizeOrTranslateBody long input (>80) uses summarize prompt', async () => {
    mockOk('{"text":"긴 본문 3-4줄 요약입니다"}');
    const longInput = 'A'.repeat(200);
    const out = await summarizeOrTranslateBody(longInput, 'KEY');
    expect(out).toBe('긴 본문 3-4줄 요약입니다');
    const callBody = getCallBody();
    expect(callBody).toContain('요약');
  });

  it('summarizeOrTranslateBody truncates input at 1500 chars (token cap)', async () => {
    mockOk('{"text":"truncated"}');
    const huge = 'B'.repeat(3000);
    await summarizeOrTranslateBody(huge, 'KEY');
    const callBody = getCallBody();
    expect(callBody).toContain('B'.repeat(1500));
    expect(callBody).not.toContain('B'.repeat(1501));
  });

  it('throws when apiKey is empty', async () => {
    await expect(translateTitle('hello', '')).rejects.toThrow(/api key/i);
  });
});
