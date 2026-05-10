/**
 * v3.27 T2b: Entity chip 1차 row (ARIA radiogroup pattern).
 * - chip filter [전체 / 답변 / 스크랩 / 인사이트] (1차 분류).
 * - 2차 row (question type chip) 조건부 노출 — entity ∈ {all, answer} 시만.
 * - Codex 사전 review P0-4 흡수: currentEntity === 'scrap' 단일 source.
 */

export type EntityFilter = 'all' | 'answer' | 'scrap' | 'insight';

export const ENTITY_LABELS: Record<EntityFilter, string> = {
  all: '전체',
  answer: '답변',
  scrap: '스크랩',
  insight: '인사이트',
};

const ENTITY_ORDER: EntityFilter[] = ['all', 'answer', 'scrap', 'insight'];

/**
 * entity chip row HTML 생성.
 * @param active 현재 선택된 entity ('all' default).
 */
export function renderEntityChipRow(active: EntityFilter = 'all'): string {
  const chips = ENTITY_ORDER.map((id) => {
    const checked = id === active ? 'true' : 'false';
    const activeClass = id === active ? ' active' : '';
    return `<button type="button" role="radio" class="archive-entity-chip${activeClass}" data-entity="${id}" aria-checked="${checked}">${ENTITY_LABELS[id]}</button>`;
  }).join('');
  return `<div id="archiveEntityFilters" role="radiogroup" aria-label="아카이브 카테고리" class="archive-entity-row">${chips}</div>`;
}

/**
 * 2차 row (question type chip) 노출 여부 — entity가 'all' 또는 'answer'일 때만.
 * 'scrap' / 'insight'는 question type 무의미 → 숨김.
 */
export function show2ndRow(entity: EntityFilter): boolean {
  return entity === 'all' || entity === 'answer';
}
