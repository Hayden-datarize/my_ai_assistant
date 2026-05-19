import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadBriefings, saveBriefings, setTranslation, clearAllTranslations,
} from '../../src/state/briefings';

const seed = (): void => {
  saveBriefings([
    { id: 'a', date: '2026-04-26', url: 'https://example.com/a', title: 'Hello', summary: 'Body', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown' },
    { id: 'b', date: '2026-04-26', url: 'https://example.com/b', title: '안녕', summary: '본문', scrapped: false, read: false, memo: '', pinned: false, interestId: 'unknown' },
  ]);
};

describe('briefings translation cache', () => {
  beforeEach(() => { localStorage.clear(); seed(); });

  it('setTranslation updates titleKo on matching id', () => {
    setTranslation('a', { titleKo: '안녕하세요' });
    const got = loadBriefings().find(b => b.id === 'a');
    expect(got?.titleKo).toBe('안녕하세요');
  });

  it('setTranslation merges multiple fields without clobbering', () => {
    setTranslation('a', { titleKo: '안녕' });
    setTranslation('a', { summaryKo: '요약' });
    setTranslation('a', { detectedLang: 'en' });
    const got = loadBriefings().find(b => b.id === 'a');
    expect(got?.titleKo).toBe('안녕');
    expect(got?.summaryKo).toBe('요약');
    expect(got?.detectedLang).toBe('en');
  });

  it('setTranslation no-op when id not found', () => {
    setTranslation('zzz', { titleKo: 'x' });
    const list = loadBriefings();
    expect(list.find(b => b.id === 'zzz')).toBeUndefined();
    expect(list.find(b => b.id === 'a')?.titleKo).toBeUndefined();
  });

  it('clearAllTranslations removes only *Ko + detectedLang fields, preserves briefings', () => {
    setTranslation('a', { titleKo: '안녕', summaryKo: '요약', detectedLang: 'en' });
    setTranslation('b', { detectedLang: 'ko' });
    clearAllTranslations();
    const list = loadBriefings();
    expect(list.length).toBe(2);
    const a = list.find(b => b.id === 'a');
    const b = list.find(x => x.id === 'b');
    expect(a?.titleKo).toBeUndefined();
    expect(a?.summaryKo).toBeUndefined();
    expect(a?.detectedLang).toBeUndefined();
    expect(a?.title).toBe('Hello'); // 본 데이터 유지
    expect(b?.detectedLang).toBeUndefined();
    expect(b?.title).toBe('안녕');
  });
});
