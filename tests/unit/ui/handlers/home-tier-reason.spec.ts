import { describe, it, expect, vi } from 'vitest';
import type { Briefing } from '../../../../src/state/briefings';

// renderBriefingCard imports openMemoModal at module load via the C6 wiring.
// Stub it preemptively (mirror render-briefing.spec.ts pattern).
vi.mock('../../../../src/ui/modals/memo', () => ({
  openMemoModal: vi.fn(),
}));

describe('renderBriefingCard tier-reason (v3.19 T7)', () => {
  const base: Briefing = {
    id: 'b1',
    date: '2026-05-07',
    url: 'https://x.com',
    title: 't',
    summary: 's',
    scrapped: false,
    read: false,
    memo: '',
    pinned: false,
    sourceTitle: 'Src',
  };

  it('imageUrl 없으면 tier=2 + reason=no-image-url', async () => {
    const { renderBriefingCard } = await import('../../../../src/ui/handlers/home');
    const card = renderBriefingCard(base, 0);
    expect(card.dataset['tier']).toBe('2');
    expect(card.dataset['tierReason']).toBe('no-image-url');
  });

  it('imageUrl 있으면 tier=1 + reason=loading', async () => {
    const { renderBriefingCard } = await import('../../../../src/ui/handlers/home');
    const card = renderBriefingCard({ ...base, imageUrl: 'https://x.com/i.jpg' }, 0);
    expect(card.dataset['tier']).toBe('1');
    expect(card.dataset['tierReason']).toBe('loading');
  });

  it('img onerror 시 tier=2 + reason=image-error', async () => {
    const { renderBriefingCard } = await import('../../../../src/ui/handlers/home');
    const card = renderBriefingCard({ ...base, imageUrl: 'https://x.com/i.jpg' }, 0);
    const img = card.querySelector('img');
    expect(img).not.toBeNull();
    img!.dispatchEvent(new Event('error'));
    expect(card.dataset['tier']).toBe('2');
    expect(card.dataset['tierReason']).toBe('image-error');
  });

  it('img onload 시 reason=image-loaded', async () => {
    const { renderBriefingCard } = await import('../../../../src/ui/handlers/home');
    const card = renderBriefingCard({ ...base, imageUrl: 'https://x.com/i.jpg' }, 0);
    const img = card.querySelector('img');
    expect(img).not.toBeNull();
    img!.dispatchEvent(new Event('load'));
    expect(card.dataset['tierReason']).toBe('image-loaded');
  });
});
