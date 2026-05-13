import { describe, it, expect, beforeEach } from 'vitest';
import { renderArchive } from '../../src/ui/tabs/archive';
import { mountArchiveHandlers, handleArchiveSearch, resetArchiveHandlersForTest } from '../../src/ui/handlers/archive';
import { saveUser, type Insight } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';
import { saveAnswers } from '../../src/state/persistence';
import { saveBriefings, type Briefing } from '../../src/state/briefings';
import type { Answer } from '../../src/state/schema';

/**
 * v3.34 T3: archive ranking 통합 DOM-level 5-case spec.
 * Codex 사전 P1 흡수 — 4 filter spot (scrap/insight/all/answer) ranking 결과 순서 보장.
 */

function mkAnswer(over: Partial<Answer>): Answer {
  return {
    id: 'a',
    questionId: '',
    text: 'answer',
    authorId: 'self',
    createdAt: '2026-05-10T10:00:00.000Z',
    pinned: false,
    schemaVersion: 1 as Answer['schemaVersion'],
    ...over,
  };
}

function mkInsight(over: Partial<Insight>): Insight {
  return {
    id: 'i',
    text: 'insight body',
    interestId: 'ai_ml',
    createdAt: '2026-05-10T10:00:00.000Z',
    pinned: false,
    ...over,
  };
}

function mkBriefing(over: Partial<Briefing>): Briefing {
  return {
    id: 'b',
    date: '2026-05-10',
    url: '',
    title: 'title',
    summary: 'summary',
    scrapped: true,
    read: false,
    memo: '',
    pinned: false,
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
  // archive-listeners 없이도 직접 handleArchiveSearch 호출 (unit test 단순화).
  const input = document.querySelector<HTMLInputElement>('#archiveSearch')!;
  input.value = query;
  handleArchiveSearch();
}

describe('v3.34 T3: archive ranking integration (DOM-level)', () => {
  beforeEach(() => {
    resetArchiveHandlersForTest(); // __archiveMounted + 핸들러 재등록 허용
    localStorage.clear();
    sessionStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture cleanup, no user interpolation
    document.body.innerHTML = '';
  });

  it('answer entity — questionText hit(weight 2) > text hit(weight 1)', () => {
    saveAnswers([
      mkAnswer({ id: 'q-hit', questionText: '리액트 훅 학습', text: '오늘 공부', createdAt: '2026-05-08T00:00:00.000Z' }),
      mkAnswer({ id: 't-hit', questionText: '오늘 학습',     text: '리액트 훅 정리', createdAt: '2026-05-12T00:00:00.000Z' }),
    ]);
    setup();
    clickEntity('answer');
    search('리액트 훅');

    const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
      .map((c) => c.dataset['answerId']);
    expect(ids).toEqual(['q-hit', 't-hit']);
  });

  it('answer — 기존 text-only hit 결과 보존 (questionText 확장이 regression 아님)', () => {
    saveAnswers([
      mkAnswer({ id: 'text-only', questionText: '오늘 작업', text: '리액트 훅 정리' }),
    ]);
    setup();
    clickEntity('answer');
    search('리액트');

    const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
      .map((c) => c.dataset['answerId']);
    expect(ids).toEqual(['text-only']);
  });

  it('insight entity — AND filter + 단일 field score', () => {
    saveUser(mkUser({
      insights: [
        mkInsight({ id: 'i-both', text: '리액트 훅 정리', createdAt: '2026-05-08T00:00:00.000Z' }),
        mkInsight({ id: 'i-one',  text: '리액트만',       createdAt: '2026-05-12T00:00:00.000Z' }),
      ],
    }));
    setup();
    clickEntity('insight');
    search('리액트 훅');

    const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-insight-card')]
      .map((c) => c.dataset['insightId']);
    expect(ids).toEqual(['i-both']);
  });

  it('scrap entity — title hit(weight 2) > summary hit(weight 1)', () => {
    saveBriefings([
      mkBriefing({ id: 'b-title',   title: '리액트 가이드', summary: '튜토리얼',     date: '2026-05-08' }),
      mkBriefing({ id: 'b-summary', title: '튜토리얼',     summary: '리액트 가이드', date: '2026-05-12' }),
    ]);
    setup();
    clickEntity('scrap');
    search('리액트');

    const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card--scrap')]
      .map((c) => c.dataset['briefingId']);
    expect(ids).toEqual(['b-title', 'b-summary']);
  });

  it('all merge — pinned > score > date 3-tier', () => {
    saveAnswers([
      mkAnswer({ id: 'pin-low',    pinned: true, questionText: '메모',      text: '리액트', createdAt: '2026-05-08T00:00:00.000Z' }),
      mkAnswer({ id: 'unpin-high',              questionText: '리액트 훅', text: 'x',      createdAt: '2026-05-10T00:00:00.000Z' }),
      mkAnswer({ id: 'unpin-low',               questionText: 'x',         text: '리액트', createdAt: '2026-05-13T00:00:00.000Z' }),
    ]);
    setup();
    clickEntity('all');
    search('리액트');

    const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
      .map((c) => c.dataset['answerId']);
    expect(ids).toEqual(['pin-low', 'unpin-high', 'unpin-low']);
  });
});
