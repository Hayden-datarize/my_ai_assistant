/**
 * Insights 탭 — v3.23 T9: grid render + dg:insights:added/removed wiring.
 */
import { on } from '../events';
import { getCachedUser } from '../../state/user';
import { openInsightDetailModal } from '../modals/insight-detail';
import { formatRelative } from '../modals/plant-detail';
import { escapeHtml } from '../../utils/escapeHtml';

/**
 * insights 탭 grid 렌더 (작성일 desc — 신규 카드 좌상단).
 * container 는 탭 래퍼 element (nav.ts가 넘기는 div).
 */
export function renderInsights(container: HTMLElement): void {
  const user = getCachedUser();
  const insights = (user?.insights ?? []).slice().sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  if (insights.length === 0) {
    // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
    container.innerHTML = `
      <div class="insights-section" id="insightsTab">
        <h2 style="margin-bottom:16px;">💡 인사이트</h2>
        <div id="insightContent" style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;">아직 인사이트가 없어요. 대화를 나누고 인사이트 카드를 만들어보세요.</div>
      </div>
    `;
    return;
  }

  // eslint-disable-next-line no-restricted-syntax -- escapeHtml applied to all dynamic strings
  container.innerHTML = `
    <div class="insights-section" id="insightsTab">
      <h2 style="margin-bottom:16px;">💡 인사이트</h2>
      <div class="insights-grid">
        ${insights.map(i => `
          <button type="button" class="insight-card" data-insight-id="${escapeHtml(i.id)}">
            <span class="insight-text">${escapeHtml(i.text)}</span>
            <span class="insight-date">${escapeHtml(formatRelative(i.createdAt))}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('.insight-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.insightId!;
      openInsightDetailModal(id);
    });
  });
}

/**
 * v3.23 T9: dg:insights:added/removed 이벤트 수신 시 grid 갱신.
 * @internal
 */
export function mountInsightsHandlers(): void {
  const refresh = (): void => {
    // insightsTab이 DOM에 존재하면 탭이 활성화된 상태 → re-render.
    // tab 전환 시 main.ts → renderInsights 자동 호출되므로 비활성 시엔 no-op.
    const tabEl = document.getElementById('insightsTab')?.parentElement;
    if (tabEl) renderInsights(tabEl as HTMLElement);
  };
  on('dg:insights:added', refresh);
  on('dg:insights:removed', refresh);
}
