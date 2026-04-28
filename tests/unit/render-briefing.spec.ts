import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Briefing } from '../../src/state/briefings';

// openMemoModal will be provided in C6; stub it globally here for C5 tests.
// Note: C5's renderBriefingCard uses an in-file stub, so this mock is
// preemptive — once C6 wires the real import, these tests still pass.
vi.mock('../../src/ui/modals/memo', () => ({
  openMemoModal: vi.fn(),
}));

describe('renderBriefingCard (v3.3.3 cardnews)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  function mkBriefing(overrides: Partial<Briefing> = {}): Briefing {
    return {
      id: 'b1', date: '2026-04-23', url: 'https://x.com/a',
      title: '테스트 제목', summary: '요약 문구',
      scrapped: false, read: false, memo: '',
      sourceTitle: 'TechCrunch',
      ...overrides,
    };
  }

  it('data-tier="1" when imageUrl present', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing({ imageUrl: 'https://img.com/a.jpg' }), 0);
    expect(card.getAttribute('data-tier')).toBe('1');
    const img = card.querySelector<HTMLImageElement>('img.card-thumb');
    expect(img?.getAttribute('src')).toBe('https://img.com/a.jpg');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('decoding')).toBe('async');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('data-tier="2" when imageUrl absent', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing({ sourceTitle: 'Medium' }), 0);
    expect(card.getAttribute('data-tier')).toBe('2');
    expect(card.querySelector('img.card-thumb')).toBeNull();
    const initial = card.querySelector('.card-initial');
    expect(initial?.textContent).toBe('M');
  });

  it('img onerror transitions to data-tier="2" and sets initial letter', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(
      mkBriefing({ sourceTitle: 'ArsTechnica', imageUrl: 'https://bad.com/nope.jpg' }),
      0,
    );
    const img = card.querySelector<HTMLImageElement>('img.card-thumb');
    expect(img).not.toBeNull();
    img!.dispatchEvent(new Event('error'));
    expect(card.getAttribute('data-tier')).toBe('2');
    expect(card.querySelector('.card-initial')?.textContent).toBe('A');
  });

  it('action buttons are OUTSIDE the <a> (nested interactive rule)', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing(), 0);
    const main = card.querySelector('.card-main');
    const actions = card.querySelector('.card-actions');
    expect(main).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(main?.contains(actions!)).toBe(false);
  });

  it('read state → data-read="true"', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing({ read: true }), 0);
    expect(card.getAttribute('data-read')).toBe('true');
  });

  it('unread state → data-read="false"', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing({ read: false }), 0);
    expect(card.getAttribute('data-read')).toBe('false');
  });

  it('scrapped state applied to scrap button', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing({ scrapped: true }), 0);
    const scrap = card.querySelector<HTMLButtonElement>('[data-action="scrap"]');
    expect(scrap?.classList.contains('is-scrapped')).toBe(true);
    expect(scrap?.textContent).toBe('♥');
  });

  it('unscrapped uses ♡', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing({ scrapped: false }), 0);
    const scrap = card.querySelector<HTMLButtonElement>('[data-action="scrap"]');
    expect(scrap?.classList.contains('is-scrapped')).toBe(false);
    expect(scrap?.textContent).toBe('♡');
  });

  it('card-main has aria-label with title and source', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing({ title: '헤드라인', sourceTitle: 'NYT' }), 0);
    const main = card.querySelector('.card-main');
    expect(main?.getAttribute('aria-label')).toContain('헤드라인');
    expect(main?.getAttribute('aria-label')).toContain('NYT');
  });

  it('title and summary use textContent (no XSS via innerHTML)', async () => {
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(mkBriefing({
      title: '<script>alert(1)</script>',
      summary: '<img src=x onerror=alert(1)>',
    }), 0);
    expect(card.querySelector('script')).toBeNull();
    expect(card.querySelector('.card-title')?.textContent).toBe('<script>alert(1)</script>');
  });
});
