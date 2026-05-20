/**
 * @vitest-environment jsdom
 *
 * v3.38 T5b: archive 검색 fuzzy 통합 — exact match 0건 degrade fallback + entity scope + archive-wide guard.
 * - exact match가 있는 record는 그대로 노출 (degrade 우아).
 * - exact match 0건이면 per-record fuzzy 시도.
 * - archive-wide guard: 전체 pool > 5000이면 fuzzy off (UI freeze 차단).
 * - entity scope: 각 entity 분기는 자기 pool에서만 매칭 (구조적 자연 분리).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderArchive } from '../../src/ui/tabs/archive';
import {
  mountArchiveHandlers,
  handleArchiveSearch,
  resetArchiveHandlersForTest,
} from '../../src/ui/handlers/archive';
import { saveUser, type Insight } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';
import { saveAnswers } from '../../src/state/persistence';
import { saveBriefings, type Briefing } from '../../src/state/briefings';
import type { Answer } from '../../src/state/schema';

function mkAnswer(over: Partial<Answer>): Answer {
  return {
    id: 'a',
    questionId: '',
    text: 'answer',
    authorId: 'self',
    createdAt: '2026-05-15T10:00:00.000Z',
    pinned: false,
    interestId: 'unknown', // v3.39 T2
    schemaVersion: 1 as Answer['schemaVersion'],
    ...over,
  };
}

function mkInsight(over: Partial<Insight>): Insight {
  return {
    id: 'i',
    text: 'insight body',
    interestId: 'ai_ml',
    createdAt: '2026-05-15T10:00:00.000Z',
    pinned: false,
    ...over,
  };
}

function mkBriefing(over: Partial<Briefing>): Briefing {
  return {
    id: 'b',
    date: '2026-05-15',
    // v3.41 T4: isSafeUrl 검증 (write boundary).
    url: 'https://example.com/scrap',
    title: 'title',
    summary: 'summary',
    scrapped: true,
    read: false,
    memo: '',
    pinned: false,
    interestId: 'unknown', // v3.39 T2
    ...over,
  };
}

function setup(): void {
  // eslint-disable-next-line no-restricted-syntax -- jsdom fixture, no user interpolation
  document.body.innerHTML = '<div id="archiveTab"></div>';
  const container = document.getElementById('archiveTab')!;
  renderArchive(container);
  mountArchiveHandlers();
}

function clickEntity(entity: 'all' | 'answer' | 'scrap' | 'insight'): void {
  document.querySelector<HTMLButtonElement>(`.archive-entity-chip[data-entity="${entity}"]`)!.click();
}

function search(query: string): void {
  const input = document.querySelector<HTMLInputElement>('#archiveSearch')!;
  input.value = query;
  handleArchiveSearch();
}

describe('v3.38 T5b: archive fuzzy integration', () => {
  beforeEach(() => {
    resetArchiveHandlersForTest();
    localStorage.clear();
    sessionStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture cleanup, no user interpolation
    document.body.innerHTML = '';
  });

  describe('answer entity — fuzzy fallback', () => {
    it('exact 0건일 때 1-typo Korean fuzzy fallback hit (3-char token)', () => {
      saveAnswers([
        mkAnswer({ id: 'a1', questionText: '리더십 회고', text: '오늘 리더십 정리' }),
      ]);
      setup();
      clickEntity('answer');
      // 토큰 '리덥십' (length 3, threshold 1) — '리더십' 1-substitution. exact 0건이므로 fuzzy fallback.
      search('리덥십');

      const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
        .map((c) => c.dataset['answerId']);
      expect(ids).toEqual(['a1']);
    });

    it('exact match 있을 때 fuzzy 없이도 hit (degrade only on 0건 not affect exact)', () => {
      saveAnswers([
        mkAnswer({ id: 'a1', questionText: '리더십 워크숍', text: '리더십 강의 정리' }),
      ]);
      setup();
      clickEntity('answer');
      search('리더십'); // exact

      const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
        .map((c) => c.dataset['answerId']);
      expect(ids).toEqual(['a1']);
    });

    it('완전 무관 쿼리는 fuzzy로도 false', () => {
      saveAnswers([
        mkAnswer({ id: 'a1', questionText: '리더십 회고', text: '오늘 리더십 정리' }),
      ]);
      setup();
      clickEntity('answer');
      search('zzzzzzz'); // far from anything

      expect(document.querySelectorAll('#archiveList .archive-card[data-answer-id]').length).toBe(0);
    });
  });

  describe('entity scope', () => {
    it('currentEntity=answer면 answer pool만 fuzzy 적용 (scrap에 동일 텍스트 있어도 entity filter로 미렌더)', () => {
      saveAnswers([
        mkAnswer({ id: 'a1', questionText: '리더십 워크숍', text: '리더십 강의' }),
      ]);
      saveBriefings([
        mkBriefing({ id: 'b1', title: '리더십 자료', summary: '리더십 가이드' }),
      ]);
      setup();
      clickEntity('answer');
      // 토큰 '리덥십' (length 3, threshold 1) — '리더십' 1-substitution fuzzy fallback.
      search('리덥십');

      // answer 카드 hit, briefing 카드는 entity filter로 미렌더.
      const answerCards = document.querySelectorAll('#archiveList .archive-card[data-answer-id]');
      const scrapCards = document.querySelectorAll('#archiveList .archive-card--scrap');
      expect(answerCards.length).toBe(1);
      expect(scrapCards.length).toBe(0);
    });

    it('currentEntity=insight면 insight pool만 fuzzy 적용', () => {
      saveAnswers([
        mkAnswer({ id: 'a1', text: '리더십 노트' }),
      ]);
      saveUser(mkUser({
        insights: [mkInsight({ id: 'i1', text: '리더십 인사이트' })],
      }));
      setup();
      clickEntity('insight');
      search('리덥십'); // 1-typo of '리더십' (length 3)

      const insightCards = document.querySelectorAll('#archiveList .archive-insight-card');
      const answerCards = document.querySelectorAll('#archiveList .archive-card[data-answer-id]');
      expect(insightCards.length).toBe(1);
      expect(answerCards.length).toBe(0);
    });
  });

  describe('scrap entity — fuzzy fallback (title+summary)', () => {
    it('summary에 1-typo fuzzy match (3-char token)', () => {
      saveBriefings([
        mkBriefing({ id: 'b1', title: '뉴스', summary: '리액트 가이드' }),
      ]);
      setup();
      clickEntity('scrap');
      search('리액드'); // 1-typo (length 3, threshold 1) of '리액트'

      const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card--scrap')]
        .map((c) => c.dataset['briefingId']);
      expect(ids).toEqual(['b1']);
    });
  });

  describe('all merge — fuzzy fallback across entities', () => {
    it('answer + scrap + insight 각각 fuzzy fallback 적용 (per-entry kind)', () => {
      saveAnswers([
        mkAnswer({ id: 'a1', questionText: '리더십 회고', text: 'x', createdAt: '2026-05-10T00:00:00.000Z' }),
      ]);
      saveBriefings([
        mkBriefing({ id: 'b1', title: '리더십 자료', summary: 'y', date: '2026-05-11' }),
      ]);
      saveUser(mkUser({
        insights: [mkInsight({ id: 'i1', text: '리더십 인사이트', createdAt: '2026-05-12T00:00:00.000Z' })],
      }));
      setup();
      clickEntity('all');
      search('리덥십'); // 1-typo of '리더십' (3-char token)

      const answerCount = document.querySelectorAll('#archiveList .archive-card[data-answer-id]').length;
      const scrapCount = document.querySelectorAll('#archiveList .archive-card--scrap').length;
      const insightCount = document.querySelectorAll('#archiveList .archive-insight-card').length;
      expect(answerCount).toBe(1);
      expect(scrapCount).toBe(1);
      expect(insightCount).toBe(1);
    });
  });

  describe('archive-wide guard — pool > 5000', () => {
    it('전체 pool > 5000이면 fuzzy off (exact only, UI freeze 차단)', () => {
      // 5001 answer entries (mostly distinct) — fuzzy disabled regardless of query.
      const many: Answer[] = Array.from({ length: 5001 }, (_, i) => mkAnswer({
        id: `a${i}`,
        questionText: `unique-q-${i}`,
        text: `body-${i}`,
        // ascending timestamp so sort order stable
        createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      }));
      // Inject one '리더십' record so fuzzy *could* match '리덥십' if guard absent.
      many[0] = mkAnswer({ id: 'a-target', questionText: '리더십 보고', text: 'x' });
      saveAnswers(many);
      setup();
      clickEntity('answer');
      search('리덥십'); // would fuzzy-hit a-target if guard absent

      const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
        .map((c) => c.dataset['answerId']);
      // exact-only mode → '리덥십' substring 없음 → 0건.
      expect(ids.length).toBe(0);
    });

    it('전체 pool ≤ 5000이면 fuzzy 가능', () => {
      // 5000 answer entries → fuzzy enabled.
      const many: Answer[] = Array.from({ length: 5000 }, (_, i) => mkAnswer({
        id: `a${i}`,
        questionText: `unique-q-${i}`,
        text: `body-${i}`,
        createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      }));
      many[0] = mkAnswer({ id: 'a-target', questionText: '리더십 보고', text: 'x' });
      saveAnswers(many);
      setup();
      clickEntity('answer');
      search('리덥십');

      const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
        .map((c) => c.dataset['answerId']);
      // fuzzy on → a-target hit.
      expect(ids).toContain('a-target');
    });
  });
});
