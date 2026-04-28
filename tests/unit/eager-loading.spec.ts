import { describe, it, expect } from 'vitest';
import { renderBriefingCard } from '../../src/ui/handlers/home';
import type { Briefing } from '../../src/state/briefings';

const sample = (id: string, withImg: boolean): Briefing => ({
  id,
  date: '2026-04-28',
  url: `https://example.com/${id}`,
  title: `t-${id}`,
  summary: 's',
  scrapped: false,
  read: false,
  memo: '',
  sourceTitle: 'src',
  ...(withImg ? { imageUrl: 'https://img.example.com/x.jpg' } : {}),
});

describe('renderBriefingCard image loading attr', () => {
  it('idx 0,1,2 → loading=eager (with imageUrl)', () => {
    for (let idx = 0; idx < 3; idx++) {
      const card = renderBriefingCard(sample(`b${idx}`, true), idx);
      const img = card.querySelector<HTMLImageElement>('img.card-thumb');
      expect(img?.getAttribute('loading')).toBe('eager');
    }
  });

  it('idx >= 3 → loading=lazy (with imageUrl)', () => {
    const card = renderBriefingCard(sample('b3', true), 3);
    const img = card.querySelector<HTMLImageElement>('img.card-thumb');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('no imageUrl → no img element regardless of idx', () => {
    const card = renderBriefingCard(sample('b0', false), 0);
    expect(card.querySelector('img.card-thumb')).toBeNull();
  });
});
