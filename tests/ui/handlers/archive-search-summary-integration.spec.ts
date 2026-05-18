/**
 * @vitest-environment jsdom
 *
 * v3.38 T7b (C1): archive 검색 summary chip 통합 spec.
 *
 * 검증 invariant:
 *   1. 검색 hit 있을 때 #archiveSearchSummary 안 summary 표시 + entity chip 묶음
 *   2. 검색 token 비어있으면 summary 비움 (slot empty)
 *   3. counts는 currentEntity filter 전 전체 query hits 기준 — entity 변경 시 stable
 *   4. summary chip click → applyEntity 호출 (currentEntity 변경 + main chip ARIA 동기화)
 *   5. main entity chip click → applyEntity 동일 invariant 회귀 (summary count stable)
 *
 * Codex 사전 P1-7 흡수: counts 계산 위치 + applyEntity 공용 helper 검증.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Answer } from '../../../src/state/schema';
import type { Briefing } from '../../../src/state/briefings';

/**
 * Archive 탭 fixture: tabs/archive.ts renderArchive와 동일한 구조 (subset).
 * - entity chip row (2종: all + answer)
 * - #archiveSearchSummary slot
 * - #archiveFilters (question type row)
 * - #archiveList
 *
 * 본 spec은 mountArchiveHandlers()를 호출하여 click delegation까지 검증한다.
 */
function setupArchiveDom(): void {
  const tab = document.createElement('div');
  tab.id = 'archiveTab';

  // Entity chip row
  const entityRow = document.createElement('div');
  entityRow.id = 'archiveEntityFilters';
  const entityAll = document.createElement('button');
  entityAll.className = 'archive-entity-chip active';
  entityAll.dataset['entity'] = 'all';
  entityAll.setAttribute('aria-checked', 'true');
  entityAll.textContent = '전체';
  const entityAnswer = document.createElement('button');
  entityAnswer.className = 'archive-entity-chip';
  entityAnswer.dataset['entity'] = 'answer';
  entityAnswer.setAttribute('aria-checked', 'false');
  entityAnswer.textContent = '답변';
  const entityScrap = document.createElement('button');
  entityScrap.className = 'archive-entity-chip';
  entityScrap.dataset['entity'] = 'scrap';
  entityScrap.setAttribute('aria-checked', 'false');
  entityScrap.textContent = '스크랩';
  const entityInsight = document.createElement('button');
  entityInsight.className = 'archive-entity-chip';
  entityInsight.dataset['entity'] = 'insight';
  entityInsight.setAttribute('aria-checked', 'false');
  entityInsight.textContent = '인사이트';
  entityRow.append(entityAll, entityAnswer, entityScrap, entityInsight);

  // Search input
  const search = document.createElement('input');
  search.type = 'search';
  search.id = 'archiveSearch';

  // Summary slot
  const summarySlot = document.createElement('div');
  summarySlot.id = 'archiveSearchSummary';

  // Question type row
  const filters = document.createElement('div');
  filters.id = 'archiveFilters';
  const filterAll = document.createElement('button');
  filterAll.className = 'filter-chip active';
  filterAll.dataset['filter'] = 'all';
  filterAll.textContent = '전체';
  filters.append(filterAll);

  // Archive list
  const list = document.createElement('div');
  list.id = 'archiveList';

  tab.append(entityRow, search, summarySlot, filters, list);
  document.body.appendChild(tab);
}

/** answer seed with required Answer schema fields */
function seedAnswer(id: string, questionText: string, text: string): Answer {
  return {
    id,
    questionText,
    text,
    createdAt: new Date('2026-05-18T00:00:00Z').toISOString(),
    pinned: false,
  } as Answer;
}

/** briefing seed (scrapped=true so it lands in scraps pool) */
function seedBriefing(id: string, title: string, summary: string): Briefing {
  return {
    id,
    title,
    summary,
    url: `https://example.com/${id}`,
    date: '2026-05-18',
    read: false,
    scrapped: true,
    pinned: false,
    memo: '',
  } as Briefing;
}

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('archive search summary integration (v3.38 T7b C1)', () => {
  it('검색 hit 시 #archiveSearchSummary 안 summary chip 묶음 표시', async () => {
    setupArchiveDom();

    // Seed: answer 2건 + scrap 1건 (모두 '리더십' 포함)
    const persistence = await import('../../../src/state/persistence');
    persistence.saveAnswers([
      seedAnswer('a1', '리더십이란 무엇인가?', '리더십은 영향력이다'),
      seedAnswer('a2', '팀 빌딩 방법', '리더십과 신뢰가 핵심'),
    ]);
    const briefings = await import('../../../src/state/briefings');
    briefings.saveBriefings([
      seedBriefing('b1', '리더십 토픽', '효과적 리더십 사례'),
    ]);

    const mod = await import('../../../src/ui/handlers/archive');
    mod.mountArchiveHandlers();

    // 검색 입력 + handleArchiveSearch 호출
    (document.getElementById('archiveSearch') as HTMLInputElement).value = '리더십';
    mod.handleArchiveSearch();

    const slot = document.getElementById('archiveSearchSummary')!;
    expect(slot.querySelector('.archive-search-summary')).not.toBeNull();
    expect(slot.querySelector('button[data-entity="answer"]')?.textContent).toContain('답변 2');
    expect(slot.querySelector('button[data-entity="scrap"]')?.textContent).toContain('스크랩 1');
    // insight 0건 → chip 숨김
    expect(slot.querySelector('button[data-entity="insight"]')).toBeNull();
  });

  it('검색 token 비어있으면 summary slot 비움 (chip 미표시)', async () => {
    setupArchiveDom();

    const persistence = await import('../../../src/state/persistence');
    persistence.saveAnswers([
      seedAnswer('a1', '리더십이란?', '리더십은 영향력이다'),
    ]);

    const mod = await import('../../../src/ui/handlers/archive');
    mod.mountArchiveHandlers();

    // 검색 input 비어있음
    (document.getElementById('archiveSearch') as HTMLInputElement).value = '';
    mod.handleArchiveSearch();

    const slot = document.getElementById('archiveSearchSummary')!;
    expect(slot.querySelector('.archive-search-summary')).toBeNull();
    expect(slot.children.length).toBe(0);
  });

  it('counts stable: currentEntity 변경해도 summary count 동일 (전체 entity hits 기준)', async () => {
    setupArchiveDom();

    const persistence = await import('../../../src/state/persistence');
    persistence.saveAnswers([
      seedAnswer('a1', '리더십이란?', '리더십은 영향력이다'),
      seedAnswer('a2', '팀워크', '리더십과 신뢰'),
    ]);
    const briefings = await import('../../../src/state/briefings');
    briefings.saveBriefings([
      seedBriefing('b1', '리더십 토픽', '효과적 리더십'),
    ]);

    const mod = await import('../../../src/ui/handlers/archive');
    mod.mountArchiveHandlers();

    (document.getElementById('archiveSearch') as HTMLInputElement).value = '리더십';
    mod.handleArchiveSearch();

    const slot = document.getElementById('archiveSearchSummary')!;
    const beforeAnswer = slot.querySelector('button[data-entity="answer"]')?.textContent;
    const beforeScrap = slot.querySelector('button[data-entity="scrap"]')?.textContent;
    expect(beforeAnswer).toContain('답변 2');
    expect(beforeScrap).toContain('스크랩 1');

    // currentEntity 변경 (answer chip click)
    const answerChip = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="answer"]')!;
    answerChip.click();

    // counts 동일 (entity 변경 무관)
    const afterAnswer = slot.querySelector('button[data-entity="answer"]')?.textContent;
    const afterScrap = slot.querySelector('button[data-entity="scrap"]')?.textContent;
    expect(afterAnswer).toBe(beforeAnswer);
    expect(afterScrap).toBe(beforeScrap);
  });

  it('summary chip click → currentEntity 변경 + main chip ARIA 동기화', async () => {
    setupArchiveDom();

    const persistence = await import('../../../src/state/persistence');
    persistence.saveAnswers([
      seedAnswer('a1', '리더십이란?', '리더십은 영향력이다'),
    ]);
    const briefings = await import('../../../src/state/briefings');
    briefings.saveBriefings([
      seedBriefing('b1', '리더십 토픽', '리더십 사례'),
    ]);

    const mod = await import('../../../src/ui/handlers/archive');
    mod.mountArchiveHandlers();

    (document.getElementById('archiveSearch') as HTMLInputElement).value = '리더십';
    mod.handleArchiveSearch();

    // Summary scrap chip click
    const slot = document.getElementById('archiveSearchSummary')!;
    const summaryScrap = slot.querySelector<HTMLButtonElement>('button[data-entity="scrap"]')!;
    summaryScrap.click();

    // Main entity chip ARIA 동기화
    const mainScrap = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="scrap"]')!;
    const mainAll = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="all"]')!;
    expect(mainScrap.classList.contains('active')).toBe(true);
    expect(mainScrap.getAttribute('aria-checked')).toBe('true');
    expect(mainAll.classList.contains('active')).toBe(false);
    expect(mainAll.getAttribute('aria-checked')).toBe('false');

    // Question type row 숨김 (entity=scrap)
    expect(document.getElementById('archiveFilters')!.style.display).toBe('none');
  });

  it('main entity chip click도 동일 applyEntity invariant 적용 (회귀)', async () => {
    setupArchiveDom();

    const persistence = await import('../../../src/state/persistence');
    persistence.saveAnswers([
      seedAnswer('a1', '리더십', '리더십'),
    ]);
    const briefings = await import('../../../src/state/briefings');
    briefings.saveBriefings([
      seedBriefing('b1', '리더십', '리더십'),
    ]);

    const mod = await import('../../../src/ui/handlers/archive');
    mod.mountArchiveHandlers();

    (document.getElementById('archiveSearch') as HTMLInputElement).value = '리더십';
    mod.handleArchiveSearch();

    // Main entity chip click (insight — 0 hits expected — chip 자체는 main row에 있음)
    const mainInsight = document.querySelector<HTMLButtonElement>('.archive-entity-chip[data-entity="insight"]')!;
    mainInsight.click();

    // Main chip ARIA 동기화
    expect(mainInsight.classList.contains('active')).toBe(true);
    expect(mainInsight.getAttribute('aria-checked')).toBe('true');

    // Question type row 숨김
    expect(document.getElementById('archiveFilters')!.style.display).toBe('none');

    // Summary counts 동일 (insight 0건 → chip 미표시 invariant 유지)
    const slot = document.getElementById('archiveSearchSummary')!;
    expect(slot.querySelector('button[data-entity="answer"]')?.textContent).toContain('답변 1');
    expect(slot.querySelector('button[data-entity="scrap"]')?.textContent).toContain('스크랩 1');
    expect(slot.querySelector('button[data-entity="insight"]')).toBeNull();
  });
});
