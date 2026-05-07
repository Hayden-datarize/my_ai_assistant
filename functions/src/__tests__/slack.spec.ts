import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendDmAsBot, buildAnswerBlocks } from '../slack';

global.fetch = vi.fn();

describe('buildAnswerBlocks', () => {
  it('produces header + question + answer + context blocks', () => {
    const payload = buildAnswerBlocks({
      email: 'me@datarize.ai',
      question: 'Q?',
      answer: 'A.',
      streak: 5,
      xp: 100,
    });
    expect(payload.blocks[0].type).toBe('header');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(payload.blocks.find((b: any) => b.type === 'context')).toBeDefined();
  });

  it('includes insight block when provided', () => {
    const payload = buildAnswerBlocks({
      email: 'me@datarize.ai',
      question: 'Q?',
      answer: 'A.',
      insight: 'I!',
      streak: 0,
      xp: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(payload.blocks.some((b: any) => b.text?.text?.includes('I!'))).toBe(true);
  });
});

describe('sendDmAsBot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws user_not_found when lookupByEmail returns users_not_found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'users_not_found' }),
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendDmAsBot('xoxb-x', 'me@datarize.ai', { blocks: [] } as any),
    ).rejects.toThrow('user_not_found');
  });

  it('throws lookup_failed when lookup error is server-side (missing_scope/invalid_auth/etc)', async () => {
    // T4 quality review I1: missing_scope를 user_not_found로 오진하지 않도록 분기
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'missing_scope' }),
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendDmAsBot('xoxb-x', 'me@datarize.ai', { blocks: [] } as any),
    ).rejects.toThrow('lookup_failed');
  });

  it('throws dm_open_failed when conversations.open fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, user: { id: 'U1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false, error: 'cannot_open_dm' }) });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendDmAsBot('xoxb-x', 'me@datarize.ai', { blocks: [] } as any),
    ).rejects.toThrow('dm_open_failed');
  });

  it('completes when all 3 steps return ok', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, user: { id: 'U1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, channel: { id: 'D1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendDmAsBot('xoxb-x', 'me@datarize.ai', { blocks: [] } as any),
    ).resolves.toBeUndefined();
  });
});
