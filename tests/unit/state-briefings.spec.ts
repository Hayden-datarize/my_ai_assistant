import { describe, it, expect, beforeEach } from 'vitest';
import { saveBriefings, loadBriefings, toggleScrap, setRead, saveMemo, type Briefing } from '../../src/state/briefings';

const seed = (): Briefing[] => [
  { id: 'b1', date: '2026-04-19', url: 'u', title: 't', summary: 's', scrapped: false, read: false, memo: '' },
];

describe('state/briefings', () => {
  beforeEach(() => localStorage.clear());

  it('save/load roundtrip', () => {
    saveBriefings(seed());
    expect(loadBriefings()).toHaveLength(1);
    expect(loadBriefings()[0]?.title).toBe('t');
  });

  it('toggleScrap flips the flag', () => {
    saveBriefings(seed());
    toggleScrap(0);
    expect(loadBriefings()[0]?.scrapped).toBe(true);
    toggleScrap(0);
    expect(loadBriefings()[0]?.scrapped).toBe(false);
  });

  it('setRead marks true; saveMemo persists text', () => {
    saveBriefings(seed());
    setRead(0);
    saveMemo(0, 'hello');
    const b = loadBriefings()[0];
    expect(b?.read).toBe(true);
    expect(b?.memo).toBe('hello');
  });

  it('out-of-range index is a no-op', () => {
    saveBriefings(seed());
    toggleScrap(99);
    expect(loadBriefings()[0]?.scrapped).toBe(false);
  });
});

describe('v3.3.3 Briefing.imageUrl', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is optional — legacy briefings without imageUrl still load', () => {
    const legacy = {
      id: '1', date: '2026-04-23', url: 'https://x.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '',
    };
    localStorage.setItem('briefings', JSON.stringify([legacy]));
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBeUndefined();
    expect(loaded[0]?.title).toBe('t');
  });

  it('persists imageUrl when set', () => {
    const b: Briefing = {
      id: '1', date: '2026-04-23', url: 'https://x.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '',
      imageUrl: 'https://x.com/img.jpg',
    };
    saveBriefings([b]);
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBe('https://x.com/img.jpg');
  });
});
