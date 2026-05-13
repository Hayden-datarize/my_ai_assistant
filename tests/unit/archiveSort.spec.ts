import { describe, it, expect } from 'vitest';
import { sortPinThenScoreDesc } from '../../src/utils/archiveSort';

interface Item { id: string; pinned: boolean; score: number; date: string }

describe('sortPinThenScoreDesc (v3.34 T2)', () => {
  const items: Item[] = [
    { id: 'a', pinned: false, score: 5, date: '2026-05-10' },
    { id: 'b', pinned: true,  score: 1, date: '2026-05-12' },
    { id: 'c', pinned: false, score: 5, date: '2026-05-13' },
    { id: 'd', pinned: false, score: 3, date: '2026-05-11' },
    { id: 'e', pinned: true,  score: 4, date: '2026-05-09' },
  ];

  it('pinned 항목이 모두 상단 (score 무관)', () => {
    const sorted = sortPinThenScoreDesc(
      items,
      (i) => i.pinned,
      (i) => i.score,
      (i) => i.date,
    );
    expect(sorted.slice(0, 2).map((i) => i.id).sort()).toEqual(['b', 'e']);
  });

  it('pinned group 내 score desc → date desc', () => {
    const sorted = sortPinThenScoreDesc(
      items,
      (i) => i.pinned,
      (i) => i.score,
      (i) => i.date,
    );
    // pinned: e (score 4) → b (score 1)
    expect(sorted.slice(0, 2).map((i) => i.id)).toEqual(['e', 'b']);
  });

  it('non-pinned group 내 score desc → date desc tie-break', () => {
    const sorted = sortPinThenScoreDesc(
      items,
      (i) => i.pinned,
      (i) => i.score,
      (i) => i.date,
    );
    // non-pinned: c (score 5, 2026-05-13) → a (score 5, 2026-05-10) → d (score 3)
    expect(sorted.slice(2).map((i) => i.id)).toEqual(['c', 'a', 'd']);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(
      sortPinThenScoreDesc<Item>([], (i) => i.pinned, (i) => i.score, (i) => i.date),
    ).toEqual([]);
  });

  it('원본 배열 mutate 하지 않음 (stable copy)', () => {
    const original = [...items];
    sortPinThenScoreDesc(items, (i) => i.pinned, (i) => i.score, (i) => i.date);
    expect(items).toEqual(original);
  });

  // Codex 사전 P2-1 흡수: 완전 동률 입력 순서 보존 (stable sort).
  it('완전 동률(pinned/score/date) — 입력 순서 보존 (ES2019 stable sort)', () => {
    const same: Item[] = [
      { id: 'x', pinned: false, score: 3, date: '2026-05-10' },
      { id: 'y', pinned: false, score: 3, date: '2026-05-10' },
      { id: 'z', pinned: false, score: 3, date: '2026-05-10' },
    ];
    const sorted = sortPinThenScoreDesc(
      same,
      (i) => i.pinned,
      (i) => i.score,
      (i) => i.date,
    );
    expect(sorted.map((i) => i.id)).toEqual(['x', 'y', 'z']);
  });
});
