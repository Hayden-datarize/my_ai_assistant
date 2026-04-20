import { describe, it, expect, beforeEach, vi } from 'vitest';
import { autoSendAnswer, buildAnswerBlocks, sendToSlack } from '../../../src/services/slack';

function seedUser(overrides: Partial<{ streak: number; xp: number }> = {}): void {
  localStorage.setItem('user', JSON.stringify({
    name: 'T', interests: [], onboardedAt: '', lastActiveDate: '',
    streak: overrides.streak ?? 3, xp: overrides.xp ?? 120, level: 2,
  }));
}

describe('services/slack.buildAnswerBlocks', () => {
  beforeEach(() => localStorage.clear());

  it('produces 4 blocks when insight is absent', () => {
    seedUser();
    const p = buildAnswerBlocks({ question: 'Q?', answer: 'A.' });
    expect(p.blocks.map(b => b.type)).toEqual(['header', 'section', 'section', 'context']);
  });

  it('inserts divider + insight section when insight is present', () => {
    seedUser();
    const p = buildAnswerBlocks({ question: 'Q?', answer: 'A.', insight: 'I!' });
    expect(p.blocks.map(b => b.type)).toEqual(['header', 'section', 'section', 'divider', 'section', 'context']);
  });

  it('treats empty/whitespace insight as absent', () => {
    seedUser();
    const p = buildAnswerBlocks({ question: 'Q?', answer: 'A.', insight: '   ' });
    expect(p.blocks.map(b => b.type)).toEqual(['header', 'section', 'section', 'context']);
  });

  it('caps answer at 500 characters', () => {
    seedUser();
    const long = 'x'.repeat(600);
    const p = buildAnswerBlocks({ question: 'Q?', answer: long });
    const answerSection = p.blocks[2];
    if (answerSection?.type !== 'section') throw new Error('expected section at index 2');
    const t = answerSection.text.text;
    expect(t).toContain('x'.repeat(500));
    expect(t).not.toContain('x'.repeat(501));
  });

  it('header uses plain_text, sections use mrkdwn', () => {
    seedUser();
    const p = buildAnswerBlocks({ question: 'Q?', answer: 'A.' });
    const header = p.blocks[0];
    if (header?.type !== 'header') throw new Error('expected header at index 0');
    expect(header.text.type).toBe('plain_text');
    const s1 = p.blocks[1];
    if (s1?.type !== 'section') throw new Error('expected section at index 1');
    expect(s1.text.type).toBe('mrkdwn');
  });

  it('context uses streak + xp from loadUserData, defaults to 0 when no user', () => {
    const p = buildAnswerBlocks({ question: 'Q?', answer: 'A.' });
    const ctx = p.blocks.at(-1);
    if (ctx?.type !== 'context') throw new Error('expected context at last index');
    expect(ctx.elements[0]?.text).toMatch(/연속 0일/);
    expect(ctx.elements[0]?.text).toMatch(/⭐ 0 XP/);
  });

  it('context reflects saved user streak + xp', () => {
    seedUser({ streak: 7, xp: 450 });
    const p = buildAnswerBlocks({ question: 'Q?', answer: 'A.' });
    const ctx = p.blocks.at(-1);
    if (ctx?.type !== 'context') throw new Error('expected context at last index');
    expect(ctx.elements[0]?.text).toContain('연속 7일');
    expect(ctx.elements[0]?.text).toContain('⭐ 450 XP');
  });

  it('top-level text field matches header text (YYYY-MM-DD format)', () => {
    seedUser();
    const p = buildAnswerBlocks({ question: 'Q?', answer: 'A.' });
    expect(p.text).toMatch(/^🌱 Daily Growth — \d{4}-\d{2}-\d{2}$/);
    const header = p.blocks[0];
    if (header?.type !== 'header') throw new Error('expected header');
    expect(header.text.text).toBe(p.text);
  });
});

describe('services/slack.buildAnswerBlocks escaping', () => {
  beforeEach(() => {
    localStorage.clear();
    seedUser();
  });

  it('escapes HTML entities in question/answer/insight', () => {
    const p = buildAnswerBlocks({ question: 'Q <a&b>?', answer: 'A<>&', insight: 'I&amp;' });
    const qSection = p.blocks[1];
    const aSection = p.blocks[2];
    const iSection = p.blocks[4];
    if (qSection?.type !== 'section') throw new Error('expected section at index 1');
    if (aSection?.type !== 'section') throw new Error('expected section at index 2');
    if (iSection?.type !== 'section') throw new Error('expected section at index 4');

    const qText = qSection.text.text;
    const aText = aSection.text.text;
    const iText = iSection.text.text;

    // Expected escaped sequences present
    expect(qText).toContain('Q &lt;a&amp;b&gt;?');
    expect(aText).toContain('A&lt;&gt;&amp;');
    expect(iText).toContain('I&amp;amp;');

    // No raw user-supplied < > remain in the user-supplied portions
    // (header's `❓ *오늘의 질문*\n` is static/safe; the rest comes from user)
    const qUserPart = qText.substring(qText.indexOf('\n') + 1);
    const aUserPart = aText.substring(aText.indexOf('\n') + 1);
    const iUserPart = iText.substring(iText.indexOf('\n') + 1);
    expect(qUserPart).not.toMatch(/[<>]/);
    expect(aUserPart).not.toMatch(/[<>]/);
    expect(iUserPart).not.toMatch(/[<>]/);
    // Any '&' in user parts must be part of an entity (&amp;, &lt;, &gt;)
    expect(qUserPart).not.toMatch(/&(?!(amp|lt|gt);)/);
    expect(aUserPart).not.toMatch(/&(?!(amp|lt|gt);)/);
    expect(iUserPart).not.toMatch(/&(?!(amp|lt|gt);)/);
  });

  it('escapes mrkdwn formatting marks (* _ ` ~) in user fields', () => {
    const p = buildAnswerBlocks({
      question: 'Why *important*?',
      answer: '`code` and ~strike~ and _italic_',
      insight: '*bold*',
    });
    const qSection = p.blocks[1];
    const aSection = p.blocks[2];
    const iSection = p.blocks[4];
    if (qSection?.type !== 'section') throw new Error('expected section at index 1');
    if (aSection?.type !== 'section') throw new Error('expected section at index 2');
    if (iSection?.type !== 'section') throw new Error('expected section at index 4');

    const qUserPart = qSection.text.text.substring(qSection.text.text.indexOf('\n') + 1);
    const aUserPart = aSection.text.text.substring(aSection.text.text.indexOf('\n') + 1);
    const iUserPart = iSection.text.text.substring(iSection.text.text.indexOf('\n') + 1);

    expect(qUserPart).toBe('Why \\*important\\*?');
    expect(aUserPart).toBe('\\`code\\` and \\~strike\\~ and \\_italic\\_');
    expect(iUserPart).toBe('\\*bold\\*');
  });

  it('does not escape intentional mrkdwn prefixes added by the builder', () => {
    const p = buildAnswerBlocks({ question: 'plain Q', answer: 'plain A' });
    const qSection = p.blocks[1];
    const aSection = p.blocks[2];
    if (qSection?.type !== 'section') throw new Error('expected section at index 1');
    if (aSection?.type !== 'section') throw new Error('expected section at index 2');

    // Builder's own * must be intact
    expect(qSection.text.text).toContain('❓ *오늘의 질문*');
    expect(aSection.text.text).toContain('✍️ *나의 답변*');
    // And the user-supplied portions remain unchanged (no special chars to escape)
    expect(qSection.text.text).toContain('\nplain Q');
    expect(aSection.text.text).toContain('\nplain A');
  });

  it('runaway-bold protection: after 500-char cap, no unescaped * remains in answer section', () => {
    const p = buildAnswerBlocks({ question: 'Q', answer: 'prefix ' + '*' + 'x'.repeat(600) });
    const aSection = p.blocks[2];
    if (aSection?.type !== 'section') throw new Error('expected section at index 2');
    const aUserPart = aSection.text.text.substring(aSection.text.text.indexOf('\n') + 1);
    // All * must be backslash-escaped (no * not preceded by a backslash)
    expect(aUserPart).not.toMatch(/(^|[^\\])\*/);
    // And the escaped form is present
    expect(aUserPart).toContain('\\*');
  });
});

describe('services/slack.sendToSlack', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    localStorage.clear();
  });

  it('POSTs JSON payload with content-type header', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
    const payload = { text: 'hi', blocks: [] as Array<never> };
    await sendToSlack('https://hooks.slack.com/services/X/Y/Z', payload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toBe('https://hooks.slack.com/services/X/Y/Z');
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it('throws Error with status on non-200 response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });
    await expect(
      sendToSlack('https://hooks.slack.com/services/X', { text: '', blocks: [] as Array<never> })
    ).rejects.toThrow(/Slack webhook 404/);
  });

  it('propagates network errors (fetch rejection)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    await expect(
      sendToSlack('https://hooks.slack.com/services/X', { text: '', blocks: [] as Array<never> })
    ).rejects.toThrow(/offline/);
  });

  it('sets keepalive and AbortSignal timeout on fetch options', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
    await sendToSlack('https://hooks.slack.com/services/X/Y/Z', { text: 't', blocks: [] as Array<never> });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call?.[1] as RequestInit;
    expect(init.keepalive).toBe(true);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects with AbortError-shaped error when AbortSignal fires', async () => {
    // Simulate the abort path without actually waiting 5s — construct an already-aborted signal
    // by hand and verify the rejection propagates. We do this by having fetch throw
    // a DOMException-ish abort error, which is what AbortSignal.timeout triggers in real browsers.
    const abortErr = new DOMException('The operation was aborted due to timeout.', 'TimeoutError');
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortErr);
    await expect(
      sendToSlack('https://hooks.slack.com/services/X', { text: '', blocks: [] as Array<never> })
    ).rejects.toThrow(/aborted/);
  });
});

describe('services/slack.autoSendAnswer (gating)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    localStorage.clear();
  });

  it('does nothing when no slack settings saved', async () => {
    await autoSendAnswer({ question: 'Q', answer: 'A' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when autoSend is false', async () => {
    localStorage.setItem('dg_slack', JSON.stringify({ webhook: 'https://hooks.slack.com/services/X', autoSend: false }));
    await autoSendAnswer({ question: 'Q', answer: 'A' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when webhook is empty', async () => {
    localStorage.setItem('dg_slack', JSON.stringify({ webhook: '', autoSend: true }));
    await autoSendAnswer({ question: 'Q', answer: 'A' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends when autoSend=true and webhook present', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
    localStorage.setItem('dg_slack', JSON.stringify({ webhook: 'https://hooks.slack.com/services/X/Y/Z', autoSend: true }));
    localStorage.setItem('user', JSON.stringify({ name: 'T', interests: [], onboardedAt: '', lastActiveDate: '', streak: 1, xp: 10, level: 1 }));
    await autoSendAnswer({ question: 'Q', answer: 'A', insight: 'I' });
    expect(global.fetch).toHaveBeenCalledOnce();
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit).body as string) as { blocks: Array<{ type: string }> };
    expect(body.blocks.map((b) => b.type)).toEqual(['header', 'section', 'section', 'divider', 'section', 'context']);
  });

  it('swallows fetch failures (does not throw)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    localStorage.setItem('dg_slack', JSON.stringify({ webhook: 'https://hooks.slack.com/services/X', autoSend: true }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(autoSendAnswer({ question: 'Q', answer: 'A' })).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
