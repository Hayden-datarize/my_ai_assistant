import { describe, it, expect, beforeEach } from 'vitest';
import { buildAnswerBlocks } from '../../../src/services/slack';

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
