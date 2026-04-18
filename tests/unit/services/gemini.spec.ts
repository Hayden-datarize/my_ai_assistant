import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from '../../../src/services/gemini';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('gemini.generateText', () => {
  it('throws if no api key', async () => {
    await expect(generateText({ apiKey: '', prompt: 'hi' })).rejects.toThrow(/api key/i);
  });
  it('posts to Gemini endpoint with prompt body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'response' }] } }] }),
    });
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
