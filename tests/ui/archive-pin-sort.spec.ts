import { describe, it, expect, beforeEach } from 'vitest';
import { renderArchive } from '../../src/ui/tabs/archive';
import { mountArchiveHandlers } from '../../src/ui/handlers/archive';
import { saveUser, type Insight } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';
import { saveAnswers } from '../../src/state/persistence';
import type { Answer } from '../../src/state/schema';

/**
 * v3.27 T4: pinned-first 정렬 + 다른 카테고리 핀 가시성 보호.
 */

function mkAnswer(over: Partial<Answer> = {}): Answer {
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

function mkInsight(over: Partial<Insight> = {}): Insight {
  return {
    id: 'i',
    text: 'insight body',
    interestId: 'ai_ml',
    createdAt: '2026-05-10T10:00:00.000Z',
    pinned: false,
    ...over,
  };
}

function setup(): HTMLElement {
  // eslint-disable-next-line no-restricted-syntax -- jsdom fixture, no user interpolation
  document.body.innerHTML = '<div id="archiveTab"></div>';
  const container = document.getElementById('archiveTab')!;
  renderArchive(container);
  mountArchiveHandlers();
  return container;
}

describe('v3.27 T4: pinned-first 정렬', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture cleanup, no user interpolation
    document.body.innerHTML = '';
  });

  it('pinned-first 정렬 + 그룹 내 createdAt desc', () => {
    saveAnswers([
      mkAnswer({ id: 'old-pin', pinned: true, createdAt: '2026-05-01T00:00:00.000Z', text: 'old pin' }),
      mkAnswer({ id: 'new-unpin', pinned: false, createdAt: '2026-05-10T00:00:00.000Z', text: 'new unpin' }),
      mkAnswer({ id: 'new-pin', pinned: true, createdAt: '2026-05-09T00:00:00.000Z', text: 'new pin' }),
    ]);
    setup();
    // entity = 'answer' chip click
    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();

    const ids = [...document.querySelectorAll<HTMLElement>('#archiveList .archive-card[data-answer-id]')]
      .map(c => c.dataset['answerId']);
    // pinned-first → new-pin (2026-05-09), old-pin (2026-05-01), then unpinned → new-unpin
    expect(ids).toEqual(['new-pin', 'old-pin', 'new-unpin']);
  });

  it('chip="답변" 시 인사이트 핀 항목 미노출 + "다른 카테고리에 핀 N개" 카운터', () => {
    saveAnswers([mkAnswer({ pinned: false })]);
    saveUser(mkUser({ insights: [mkInsight({ pinned: true })] }));
    setup();
    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();

    // 인사이트 카드는 미노출
    expect(document.querySelector('.archive-insight-card')).toBeNull();
    // 카운터 노출 (다른 카테고리 핀 1개)
    const counter = document.querySelector<HTMLButtonElement>('.other-pin-counter');
    expect(counter).not.toBeNull();
    expect(counter!.textContent ?? '').toMatch(/1/);
  });

  it('카운터 click → entity chip "전체" 전환 + 핀 항목 노출', () => {
    saveAnswers([mkAnswer({ pinned: false })]);
    saveUser(mkUser({ insights: [mkInsight({ pinned: true })] }));
    setup();
    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();

    const counter = document.querySelector<HTMLButtonElement>('.other-pin-counter');
    counter!.click();

    const allChip = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="all"]');
    expect(allChip?.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('.archive-insight-card')).not.toBeNull();
  });

  it('Codex P1-2 회귀: 질문 chip 활성 상태에서 counter click → currentFilter도 리셋 (핀 항목 노출 보장)', () => {
    saveAnswers([mkAnswer({ pinned: false, type: '분석' })]);
    saveUser(mkUser({ insights: [mkInsight({ pinned: true })] }));
    setup();

    // 답변 entity + 분석 chip 활성 (다른 카테고리 핀 미노출 상태)
    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();
    document.querySelector<HTMLButtonElement>('.filter-chip[data-filter="분석"]')!.click();

    // counter click → currentFilter='all' 리셋 보장 (else 'all' merge skip → insight 여전히 숨김)
    document.querySelector<HTMLButtonElement>('.other-pin-counter')!.click();
    expect(document.querySelector('.archive-insight-card')).not.toBeNull();

    const allFilterChip = document.querySelector<HTMLButtonElement>('.filter-chip[data-filter="all"]');
    expect(allFilterChip?.classList.contains('active')).toBe(true);
  });

  it('Codex P1-1 회귀: pin button click은 카드 detail 모달 / select 토글을 trigger 안 함', () => {
    saveAnswers([mkAnswer({ pinned: false })]);
    setup();
    document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!.click();

    const pinBtn = document.querySelector<HTMLButtonElement>('.archive-pin-toggle');
    expect(pinBtn).not.toBeNull();

    // 답변 detail 모달이 열려서는 안 됨 (handleCardClick에서 .archive-pin-toggle 조기 return).
    // 모달 import는 dynamic이라 import 자체를 막아야 하므로 modal DOM이 생기지 않음으로 검증.
    const modalCountBefore = document.querySelectorAll('.modal-backdrop').length;
    pinBtn!.click();
    const modalCountAfter = document.querySelectorAll('.modal-backdrop').length;
    expect(modalCountAfter).toBe(modalCountBefore);
  });
});
