import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// v3.14.3 P1-1: defensive Number.isFinite guard.
// `JSON.stringify(NaN)` → `"null"`, `JSON.stringify(Infinity)` → `"null"`이라
// localStorage round-trip만으로는 NaN/Infinity가 loadSeen filter까지 도달하지 못한다.
// 본 spec은 hand-edited LS / 미래 migration이 JSON 우회로 raw 객체를 주입할 가능성에 대비한
// 방어적 invariant를 검증한다. `vi.spyOn(JSON, 'parse')` 으로 raw NaN/Infinity 주입을 시뮬레이션.
describe('seen — firstSeenAt Number.isFinite guard (v3.14.3 P1-1)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects records with NaN firstSeenAt (defensive guard, JSON 우회 simulation)', async () => {
    vi.spyOn(JSON, 'parse').mockImplementationOnce(() => [
      { url: 'https://valid.example/1', firstSeenAt: 1735000000000 },
      { url: 'https://nan.example/2', firstSeenAt: NaN },
    ]);
    localStorage.setItem('seenBriefings', '[]');
    const { isSeen } = await import('../../../src/state/seen');
    expect(isSeen('https://valid.example/1', 1735000000000)).toBe(true);
    expect(isSeen('https://nan.example/2', 1735000000000)).toBe(false);
  });

  it('rejects records with Infinity firstSeenAt (defensive guard)', async () => {
    vi.spyOn(JSON, 'parse').mockImplementationOnce(() => [
      { url: 'https://inf.example/1', firstSeenAt: Infinity },
    ]);
    localStorage.setItem('seenBriefings', '[]');
    const { isSeen } = await import('../../../src/state/seen');
    expect(isSeen('https://inf.example/1', 1735000000000)).toBe(false);
  });

  it('LRU sort stable when one record is corrupted (JSON 우회 simulation)', async () => {
    vi.spyOn(JSON, 'parse').mockImplementationOnce(() => [
      { url: 'https://corrupt.example/x', firstSeenAt: NaN },
    ]);
    const { recordSeen, loadActiveSeenUrls } = await import('../../../src/state/seen');
    recordSeen(['https://normal.example/y'], 1735000000000);
    const active = loadActiveSeenUrls(1735000000000);
    expect(active.has('https://normal.example/y')).toBe(true);
    expect(active.has('https://corrupt.example/x')).toBe(false);
  });
});
