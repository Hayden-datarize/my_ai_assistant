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
 * @param counts entity별 count map. `null` (default) 시 카운트 span 비표시 — R1 race 방어
 *   (데이터 load 전 첫 렌더에서 placeholder 0 깜빡임 회피). v3.30 T2.
 */
export function renderEntityChipRow(
  active: EntityFilter = 'all',
  counts: Record<EntityFilter, number> | null = null,
): string {
  const chips = ENTITY_ORDER.map((id) => {
    const checked = id === active ? 'true' : 'false';
    const activeClass = id === active ? ' active' : '';
    // v3.30 T2: counts === null 일 때만 span 생략. count === 0 (정상값) 은 출력.
    const countSpan = counts !== null
      ? `<span class="archive-entity-count" data-entity-count="${id}">${counts[id]}</span>`
      : '';
    return `<button type="button" role="radio" class="archive-entity-chip${activeClass}" data-entity="${id}" aria-checked="${checked}">${ENTITY_LABELS[id]}${countSpan}</button>`;
  }).join('');
  return `<div id="archiveEntityFilters" role="radiogroup" aria-label="아카이브 카테고리" class="archive-entity-row">${chips}</div>`;
}
