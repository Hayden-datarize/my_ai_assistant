/**
 * v3.38 T7a (C1): archive 검색 결과 위쪽에 entity별 hit count chip 묶음.
 *
 * 사용자가 검색 후 결과를 entity별로 빠르게 필터링.
 * - hit count 0인 entity는 chip 숨김.
 * - 전체 hit 0이면 null return (caller는 summary 자체 미표시).
 *
 * **EntityFilter 정합 (Codex P1-6)**: `'all' | 'answer' | 'scrap' | 'insight'` (v3.27 graduated).
 * summary chip은 `all` 제외 3종.
 */

import type { EntityFilter } from './archive-entity-chip';

type ArchiveSummaryEntity = Exclude<EntityFilter, 'all'>;

export type ArchiveSearchCounts = Record<ArchiveSummaryEntity, number>;

const ENTITY_LABEL: Record<ArchiveSummaryEntity, string> = {
  answer: '답변',
  scrap: '스크랩',
  insight: '인사이트',
};

const ENTITY_ORDER: readonly ArchiveSummaryEntity[] = ['answer', 'scrap', 'insight'] as const;

export function renderArchiveSearchSummary(counts: ArchiveSearchCounts): HTMLElement | null {
  const total = ENTITY_ORDER.reduce((sum, key) => sum + counts[key], 0);
  if (total === 0) return null;

  const root = document.createElement('div');
  root.className = 'archive-search-summary';

  const prefix = document.createElement('span');
  prefix.className = 'archive-search-summary-label';
  prefix.textContent = '검색 결과:';
  root.append(prefix);

  for (const key of ENTITY_ORDER) {
    if (counts[key] === 0) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'entity-summary-chip';
    btn.dataset.entity = key;
    btn.setAttribute('aria-label', `${ENTITY_LABEL[key]} ${counts[key]}개로 필터`);
    btn.textContent = `${ENTITY_LABEL[key]} ${counts[key]}`;
    root.append(btn);
  }

  return root;
}
