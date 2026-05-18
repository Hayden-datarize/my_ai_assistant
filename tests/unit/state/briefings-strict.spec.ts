import { describe, it, expect, beforeEach } from 'vitest';
import { saveBriefings, loadBriefings, type Briefing } from '../../../src/state/briefings';

/**
 * v3.38 T4: briefings write-side schema strict + NFC normalize.
 *
 * - required field (title/summary/memo): redundant `?? ''` 제거 (interface는 string이므로).
 * - write path (saveBriefings): 단일 entry point에 invariant + NFC normalize 통합.
 *   - title/summary가 비문자열(undefined/null/number 등)인 경우 거절(throw or skip) — 데이터 무결성.
 *   - 한국어 NFC normalize 적용 — search/highlight/fuzzy 정합 (NFD 입력도 NFC로 저장).
 *
 * Codex 사전 review P1-3 ripple 확장 흡수 — rss.ts/home.ts/archive.ts/memo.ts 모두 영향.
 *
 * 신규 spec:
 *   1. NFD 한국어 title은 saveBriefings 시점에 NFC로 정규화되어 저장된다.
 *   2. 비문자열 title/summary는 거절(throw)된다 — 무결성 invariant.
 *   3. NFC가 이미 적용된 한국어 title은 idempotent (변경 없음).
 */
describe('v3.38 T4: briefings write-side strict + NFC normalize', () => {
  beforeEach(() => localStorage.clear());

  it('NFD 한국어 title을 NFC로 normalize하여 저장한다', () => {
    // '한글'을 NFD로 분해: ㅎ + ㅏ + ㄴ + ㄱ + ㅡ + ㄹ (각 자모 분해)
    const nfdTitle = '한글'.normalize('NFD');
    const nfdSummary = '요약'.normalize('NFD');
    // 사전 조건: NFD와 NFC는 다른 string
    expect(nfdTitle).not.toBe('한글');
    expect(nfdTitle.normalize('NFC')).toBe('한글');

    const briefing: Briefing = {
      id: 'b1', date: '2026-05-18', url: 'https://x', title: nfdTitle, summary: nfdSummary,
      scrapped: false, read: false, memo: '', pinned: false,
    };
    saveBriefings([briefing]);

    const loaded = loadBriefings();
    expect(loaded[0]?.title).toBe('한글');
    expect(loaded[0]?.summary).toBe('요약');
  });

  it('NFC가 이미 적용된 title은 idempotent (변경 없음)', () => {
    const briefing: Briefing = {
      id: 'b1', date: '2026-05-18', url: 'https://x', title: '이미 NFC', summary: 'NFC 요약',
      scrapped: false, read: false, memo: '', pinned: false,
    };
    saveBriefings([briefing]);
    expect(loadBriefings()[0]?.title).toBe('이미 NFC');
    expect(loadBriefings()[0]?.summary).toBe('NFC 요약');
  });

  it('비문자열 title을 가진 briefing은 거절된다 (무결성 invariant)', () => {
    // 외부 데이터(JSON.parse 결과 등)로부터 비문자열이 흘러들어올 경우.
    const malformed = {
      id: 'b1', date: '2026-05-18', url: 'https://x', title: undefined, summary: 's',
      scrapped: false, read: false, memo: '', pinned: false,
    } as unknown as Briefing;
    expect(() => saveBriefings([malformed])).toThrow(/title|invalid|string/i);
  });

  it('비문자열 summary를 가진 briefing은 거절된다', () => {
    const malformed = {
      id: 'b1', date: '2026-05-18', url: 'https://x', title: 't', summary: 123,
      scrapped: false, read: false, memo: '', pinned: false,
    } as unknown as Briefing;
    expect(() => saveBriefings([malformed])).toThrow(/summary|invalid|string/i);
  });

  it('비문자열 memo를 가진 briefing은 거절된다 (required string)', () => {
    const malformed = {
      id: 'b1', date: '2026-05-18', url: 'https://x', title: 't', summary: 's',
      scrapped: false, read: false, memo: null, pinned: false,
    } as unknown as Briefing;
    expect(() => saveBriefings([malformed])).toThrow(/memo|invalid|string/i);
  });

  it('sourceTitle (optional)는 NFD인 경우에도 NFC로 normalize', () => {
    const nfdSource = '출처'.normalize('NFD');
    const briefing: Briefing = {
      id: 'b1', date: '2026-05-18', url: 'https://x', title: 't', summary: 's',
      scrapped: false, read: false, memo: '', pinned: false, sourceTitle: nfdSource,
    };
    saveBriefings([briefing]);
    expect(loadBriefings()[0]?.sourceTitle).toBe('출처');
  });
});
