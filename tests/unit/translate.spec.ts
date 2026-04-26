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

describe('translate service fallback + session block', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    // reset session block (테스트 격리)
    const m = await import('../../src/services/translate');
    m.__resetSessionBlockForTest();
  });

  function mockSequence(responses: Array<{ ok: boolean; status: number; text?: string }>) {
    let i = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      const r = responses[i++];
      if (!r) throw new Error('mock exhausted');
      return {
        ok: r.ok,
        status: r.status,
        json: async () => r.text ? ({ candidates: [{ content: { parts: [{ text: r.text }] } }] }) : ({}),
      } as unknown as Response;
    });
  }

  it('falls back to model 2 on 429 from model 1', async () => {
    mockSequence([
      { ok: false, status: 429 },
      { ok: true, status: 200, text: '{"text":"두 번째 모델 응답"}' },
    ]);
    const out = await (await import('../../src/services/translate')).translateTitle('hello', 'KEY');
    expect(out).toBe('두 번째 모델 응답');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back on 503', async () => {
    mockSequence([
      { ok: false, status: 503 },
      { ok: true, status: 200, text: '{"text":"ok"}' },
    ]);
    const out = await (await import('../../src/services/translate')).translateTitle('hello', 'KEY');
    expect(out).toBe('ok');
  });

  it('falls back on network error', async () => {
    let i = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      if (i++ === 0) throw new TypeError('network down');
      return {
        ok: true, status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"text":"recovered"}' }] } }] }),
      } as unknown as Response;
    });
    const out = await (await import('../../src/services/translate')).translateTitle('hello', 'KEY');
    expect(out).toBe('recovered');
  });

  it('does NOT fall back on 400 (immediate fail)', async () => {
    mockSequence([{ ok: false, status: 400 }]);
    await expect((await import('../../src/services/translate')).translateTitle('hello', 'KEY')).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('blocks subsequent calls in session after 401', async () => {
    mockSequence([{ ok: false, status: 401 }]);
    const mod = await import('../../src/services/translate');
    await expect(mod.translateTitle('hello', 'KEY')).rejects.toThrow();
    // 다음 호출은 fetch 자체가 호출되지 않아야 함
    await expect(mod.translateTitle('world', 'KEY')).rejects.toThrow(/session blocked/i);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when both models fail with retryable errors', async () => {
    mockSequence([
      { ok: false, status: 429 },
      { ok: false, status: 503 },
    ]);
    await expect((await import('../../src/services/translate')).translateTitle('hello', 'KEY')).rejects.toThrow();
  });

  it('isSessionBlocked reflects state and blocks subsequent calls', async () => {
    const mod = await import('../../src/services/translate');
    expect(mod.isSessionBlocked()).toBe(false);
    mockSequence([{ ok: false, status: 401 }]);
    await expect(mod.translateTitle('hello', 'KEY')).rejects.toThrow();
    expect(mod.isSessionBlocked()).toBe(true);
    // 다음 호출은 fetch 호출 없이 즉시 throw
    await expect(mod.translateTitle('world', 'KEY')).rejects.toThrow(/session blocked/i);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
