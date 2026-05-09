/**
 * Insights 탭 — v3.23 T9: grid render + dg:insights:added/removed wiring.
 * v3.25 T5: 카드 안 chip + 상단 chip 필터 row (≥6) + dg:insights:updated wiring.
 */
import { on } from '../events';
import { getCachedUser } from '../../state/user';
import type { Insight } from '../../state/user';
import { openInsightDetailModal } from '../modals/insight-detail';
import { formatRelative } from '../../utils/dates';
import { escapeHtml } from '../../utils/escapeHtml';
import { INTERESTS, getCategoryLabel } from '../../utils/categories';

/**
 * insights 탭 grid 렌더 (작성일 desc — 신규 카드 좌상단).
 * container 는 탭 래퍼 element (nav.ts가 넘기는 div).
 *
 * v3.25 T5: `activeFilter` (interestId 또는 '' = 전체)에 따라 카드 필터링.
 *   - insights.length >= 6일 때만 chip 필터 row 노출.
 *   - 카드마다 분야 chip 1개 노출 (interestId='unknown' 시 muted variant).
 */
export function renderInsights(container: HTMLElement, activeFilter: string = ''): void {
  const user = getCachedUser();
  const insights = (user?.insights ?? []).slice().sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  if (insights.length === 0) {
    // v3.24 T3: indent 압축 (production-safe).
    // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
    container.innerHTML = `<div class="insights-section" id="insightsTab"><h2 style="margin-bottom:16px;">💡 인사이트</h2><div id="insightContent" style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;">아직 인사이트가 없어요. 대화를 나누고 인사이트 카드를 만들어보세요.</div></div>`;
    return;
  }

  // v3.25 T5: activeFilter='' (전체) → 전건. 아니면 interestId 매칭만.
  const filtered = activeFilter
    ? insights.filter(i => i.interestId === activeFilter)
    : insights;

  // v3.25 T5: insights.length >= 6 일 때만 chip 필터 row 렌더.
  const filterRowHtml = insights.length >= 6 ? buildFilterRow(insights, activeFilter) : '';

  const cardsHtml = filtered.map(i => {
    const isUnknown = i.interestId === 'unknown';
    const chipLabel = isUnknown ? '📰 미분류' : escapeHtml(getCategoryLabel(i.interestId));
    const chipClass = isUnknown ? 'insight-chip insight-chip--muted' : 'insight-chip';
    return `<button type="button" class="insight-card" data-insight-id="${escapeHtml(i.id)}"><span class="${chipClass}">${chipLabel}</span><span class="insight-text">${escapeHtml(i.text)}</span><span class="insight-date">${escapeHtml(formatRelative(i.createdAt))}</span></button>`;
  }).join('');

  // v3.24 T3: indent 압축 (production-safe).
  // eslint-disable-next-line no-restricted-syntax -- escapeHtml applied to all dynamic strings
  container.innerHTML = `<div class="insights-section" id="insightsTab"><h2 style="margin-bottom:16px;">💡 인사이트</h2>${filterRowHtml}<div class="insights-grid">${cardsHtml}</div></div>`;

  container.querySelectorAll<HTMLButtonElement>('.insight-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.insightId!;
      openInsightDetailModal(id);
    });
  });

  // v3.25 T5: chip 클릭 시 해당 분야로 re-render.
  container.querySelectorAll<HTMLButtonElement>('.insight-filter-row .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const newFilter = chip.dataset.interestId ?? '';
      renderInsights(container, newFilter);
    });
  });
}

/**
 * v3.25 T5: distinct interestId chip을 INTERESTS catalog 순서로 정렬.
 * - '전체' chip 항상 첫번째 (data-interest-id="").
 * - 'unknown' 인사이트가 1개 이상 있을 때만 '📰 미분류' chip을 마지막에.
 */
function buildFilterRow(insights: Insight[], activeFilter: string): string {
  const distinctIds = new Set(insights.map(i => i.interestId));

  const sortedIds: string[] = [
    '',
    ...INTERESTS.filter(int => distinctIds.has(int.id)).map(int => int.id),
    ...(distinctIds.has('unknown') ? ['unknown'] : []),
  ];

  const chips = sortedIds.map(id => {
    const label = id === '' ? '전체' : id === 'unknown' ? '📰 미분류' : escapeHtml(getCategoryLabel(id));
    const activeClass = id === activeFilter ? ' active' : '';
    return `<button type="button" class="filter-chip${activeClass}" data-interest-id="${escapeHtml(id)}">${label}</button>`;
  }).join('');

  return `<div class="insight-filter-row">${chips}</div>`;
}

/**
 * v3.23 T9: dg:insights:added/removed 이벤트 수신 시 grid 갱신.
 * v3.25 T5: dg:insights:updated 추가 + 모든 이벤트에서 '전체' 필터로 reset.
 * @internal
 */
export function mountInsightsHandlers(): void {
  const refresh = (): void => {
    // insightsTab이 DOM에 존재하면 탭이 활성화된 상태 → re-render.
    // tab 전환 시 main.ts → renderInsights 자동 호출되므로 비활성 시엔 no-op.
    const tabEl = document.getElementById('insightsTab')?.parentElement;
    if (tabEl) renderInsights(tabEl as HTMLElement, '');  // v3.25 T5: '전체'로 reset
  };
  on('dg:insights:added', refresh);
  on('dg:insights:removed', refresh);
  on('dg:insights:updated', refresh);  // v3.25 T5: 분야 dropdown 변경 시 refresh
}
