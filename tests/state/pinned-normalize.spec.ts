import { describe, it, expect, beforeEach } from 'vitest';
import { makeAnswer } from '../../src/state/schema';
import { migrateAnswer } from '../../src/state/migration';
import { saveBriefings, loadBriefings } from '../../src/state/briefings';

/**
 * v3.28 T2: pinned write-side normalize — Option A (P2-2).
 *
 * - Answer.pinned / Briefing.pinned / Insight.pinned: optional → required boolean.
 * - makeAnswer: pinned default false (input override 허용).
 * - migrateAnswer: pass-through + legacy 분기 모두 copy-based backfill (P0-3 idempotency).
 * - loadBriefings: map 단계에 copy-based pinned 정규화.
 *
 * Codex 사전 review P0-3: copy-based만 (in-place mutation 절대 금지) — 원본 raw 객체의 pinned는
 * undefined로 보존되어야 한다.
 */
describe('v3.28 T2: pinned write-side normalize (P2-2)', () => {
  beforeEach(() => localStorage.clear());

  it('makeAnswer should default pinned to false when not provided', () => {
    const a = makeAnswer({
      id: 'a1',
      questionId: 'q1',
      text: '답변',
      authorId: 'self',
    });
    expect(a.pinned).toBe(false);
  });

  it('makeAnswer should respect explicit pinned=true', () => {
    const a = makeAnswer({
      id: 'a2',
      questionId: 'q1',
      text: '답변',
      authorId: 'self',
      pinned: true,
    });
    expect(a.pinned).toBe(true);
  });

  it('migrateAnswer pass-through branch should backfill pinned to false (copy-based, no mutation)', () => {
    const v1 = {
      schemaVersion: 1 as const,
      id: 'a3',
      questionId: 'q',
      text: 't',
      authorId: 'self',
      createdAt: '2026-05-11T00:00:00.000Z',
    };
    const out = migrateAnswer(v1);
    expect(out.pinned).toBe(false);
    // P0-3 idempotency: 원본 raw 객체는 mutate되지 않아야 한다.
    expect((v1 as { pinned?: boolean }).pinned).toBeUndefined();
  });

  it('migrateAnswer pass-through should preserve explicit pinned=true', () => {
    const v1 = {
      schemaVersion: 1 as const,
      id: 'a4',
      questionId: 'q',
      text: 't',
      authorId: 'self',
      createdAt: '2026-05-11T00:00:00.000Z',
      pinned: true,
    };
    const out = migrateAnswer(v1);
    expect(out.pinned).toBe(true);
  });

  it('migrateAnswer legacy branch should backfill pinned to false', () => {
    const legacy = {
      id: 'a5',
      questionId: 'q',
      answer: 'legacy 본문',
      authorId: 'self',
      date: '2026-05-10',
    };
    const out = migrateAnswer(legacy);
    expect(out.pinned).toBe(false);
    expect(out.schemaVersion).toBe(1);
    expect(out.text).toBe('legacy 본문');
  });

  it('loadBriefings should backfill pinned to false for legacy entries (copy-based, idempotent across roundtrip)', () => {
    localStorage.setItem(
      'briefings',
      JSON.stringify([
        {
          id: 'b1',
          date: '2026-05-11',
          url: 'https://x',
          title: 't',
          summary: 's',
          scrapped: false,
          read: false,
          memo: '',
        },
      ]),
    );
    const list = loadBriefings();
    expect(list[0]?.pinned).toBe(false);
    saveBriefings(list);
    const list2 = loadBriefings();
    expect(list2[0]?.pinned).toBe(false);
  });

  it('loadBriefings should preserve explicit pinned=true', () => {
    localStorage.setItem(
      'briefings',
      JSON.stringify([
        {
          id: 'b2',
          date: '2026-05-11',
          url: 'https://x',
          title: 't',
          summary: 's',
          scrapped: false,
          read: false,
          memo: '',
          pinned: true,
        },
      ]),
    );
    const list = loadBriefings();
    expect(list[0]?.pinned).toBe(true);
  });
});
