import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveBriefings, loadBriefings, toggleScrap, setRead, saveMemo, type Briefing } from '../../src/state/briefings';

const seed = (): Briefing[] => [
  { id: 'b1', date: '2026-04-19', url: 'u', title: 't', summary: 's', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown' },
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
      id: '1', date: '2026-04-23', url: 'https://example.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '',
    };
    localStorage.setItem('briefings', JSON.stringify([legacy]));
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBeUndefined();
    expect(loaded[0]?.title).toBe('t');
  });

  it('persists imageUrl when set', () => {
    const b: Briefing = {
      id: '1', date: '2026-04-23', url: 'https://example.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown',
      imageUrl: 'https://example.com/img.jpg',
    };
    saveBriefings([b]);
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBe('https://example.com/img.jpg');
  });
});

describe('v3.39 T2 Briefing.interestId boundary normalize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('legacy briefing (interestId 부재) → "unknown" 백필', () => {
    localStorage.setItem('briefings', JSON.stringify([
      { id: 'b_old', date: '2026-04-01', url: 'https://ex.com', title: 't', summary: 's', scrapped: false, read: false, memo: '', pinned: false }
    ]));
    const result = loadBriefings();
    expect(result[0]?.interestId).toBe('unknown');
  });

  it('이미 valid interestId 있는 briefing → 그대로 유지', () => {
    localStorage.setItem('briefings', JSON.stringify([
      { id: 'b_new', date: '2026-05-19', url: 'https://ex.com', title: 't', summary: 's', scrapped: false, read: false, memo: '', pinned: false, interestId: 'ai_ml' }
    ]));
    const result = loadBriefings();
    expect(result[0]?.interestId).toBe('ai_ml');
  });

  it('invalid interestId (INTERESTS 미존재) → "unknown" 정정 + console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('briefings', JSON.stringify([
      { id: 'b_corrupt', date: '2026-05-19', url: 'https://ex.com', title: 't', summary: 's', scrapped: false, read: false, memo: '', pinned: false, interestId: 'totally_fake_id' }
    ]));
    const result = loadBriefings();
    expect(result[0]?.interestId).toBe('unknown');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('totally_fake_id'));
    warnSpy.mockRestore();
  });
});

describe('v3.3.4 imageUrl runtime validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('drops imageUrl when value is a number (malformed cache)', () => {
    localStorage.setItem('briefings', JSON.stringify([{
      id: '1', date: '2026-04-24', url: 'https://example.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '',
      imageUrl: 12345,  // malformed — not a string
    }]));
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBeUndefined();
    expect(loaded[0]?.title).toBe('t'); // briefing itself preserved
  });

  it('drops imageUrl when value is an object', () => {
    localStorage.setItem('briefings', JSON.stringify([{
      id: '1', date: '2026-04-24', url: 'https://example.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '',
      imageUrl: { url: 'https://example.com/img.jpg' },
    }]));
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBeUndefined();
    expect(loaded[0]?.title).toBe('t');
  });

  it('drops imageUrl when value is non-https (e.g. http)', () => {
    localStorage.setItem('briefings', JSON.stringify([{
      id: '1', date: '2026-04-24', url: 'https://example.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '',
      imageUrl: 'http://insecure.example.com/img.jpg',  // http, not https
    }]));
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBeUndefined();
  });

  it('drops imageUrl when value is null', () => {
    localStorage.setItem('briefings', JSON.stringify([{
      id: '1', date: '2026-04-24', url: 'https://example.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '',
      imageUrl: null,
    }]));
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBeUndefined();
  });

  it('keeps valid https imageUrl untouched', () => {
    localStorage.setItem('briefings', JSON.stringify([{
      id: '1', date: '2026-04-24', url: 'https://example.com', title: 't',
      summary: 's', scrapped: false, read: false, memo: '',
      imageUrl: 'https://cdn.example.com/img.jpg',
    }]));
    const loaded = loadBriefings();
    expect(loaded[0]?.imageUrl).toBe('https://cdn.example.com/img.jpg');
  });
});
