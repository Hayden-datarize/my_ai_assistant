import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// v3.14.3 P1-1: defensive Number.isFinite guard.
// `JSON.stringify(NaN)` → `"null"`, `JSON.stringify(Infinity)` → `"null"`이라
// localStorage round-trip만으로는 NaN/Infinity가 loadSeen filter까지 도달하지 못한다.
// 본 spec은 hand-edited LS / 미래 migration이 JSON 우회로 raw 객체를 주입할 가능성에 대비한
// 방어적 invariant를 검증한다. `vi.spyOn(JSON, 'parse')` 으로 raw NaN/Infinity 주입을 시뮬레이션.
//
// 강도 분류 (M-2 reviewer 권고):
//   - it-1 NaN reject + it-3 LRU sort: **defensive parity test** —
//     Infinity 케이스와 대칭/미래 drift 감지용. 현 시점엔 NaN arithmetic propagation
//     (`NaN + TTL_MS > now` → false)이 부수적으로 차단해 guard 부재 시에도 false 반환.
//   - it-2 Infinity reject: **strict invariant** — `Infinity + TTL_MS > now` → true이므로
//     guard 부재 시 isSeen이 true를 반환하는 진정한 RED→GREEN 신호.
describe('seen — firstSeenAt Number.isFinite guard (v3.14.3 P1-1)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('NaN firstSeenAt → isSeen false (JSON 우회 simulation, defensive guard)', async () => {
    vi.spyOn(JSON, 'parse').mockImplementationOnce(() => [
      { url: 'https://valid.example/1', firstSeenAt: 1735000000000 },
      { url: 'https://nan.example/2', firstSeenAt: NaN },
    ]);
    // `localStorage.setItem`은 mock된 JSON.parse가 무시하므로 생략 — loadSeen 내부 `getItem` 결과는
    // null → '[]' fallback이 되고 mockImplementationOnce가 우선 적용된다.
    const { isSeen } = await import('../../../src/state/seen');
    expect(
      isSeen('https://valid.example/1', 1735000000000),
      'valid finite firstSeenAt → seen',
    ).toBe(true);
    expect(
      isSeen('https://nan.example/2', 1735000000000),
      'NaN firstSeenAt should be filtered out by guard',
    ).toBe(false);
  });

  it('Infinity firstSeenAt → isSeen false (strict invariant, guard 부재 시 RED)', async () => {
    vi.spyOn(JSON, 'parse').mockImplementationOnce(() => [
      { url: 'https://inf.example/1', firstSeenAt: Infinity },
    ]);
    const { isSeen } = await import('../../../src/state/seen');
    expect(
      isSeen('https://inf.example/1', 1735000000000),
      'Infinity firstSeenAt should be filtered out by guard',
    ).toBe(false);
  });

  it('NaN-corrupted record 1건 + 정상 1건 → LRU sort stable (정상만 active)', async () => {
    vi.spyOn(JSON, 'parse').mockImplementationOnce(() => [
      { url: 'https://corrupt.example/x', firstSeenAt: NaN },
    ]);
    const { recordSeen, loadActiveSeenUrls } = await import('../../../src/state/seen');
    recordSeen(['https://normal.example/y'], 1735000000000);
    const active = loadActiveSeenUrls(1735000000000);
    expect(
      active.has('https://normal.example/y'),
      'normal record should remain active',
    ).toBe(true);
    expect(
      active.has('https://corrupt.example/x'),
      'NaN-corrupted record should be excluded',
    ).toBe(false);
  });
});
