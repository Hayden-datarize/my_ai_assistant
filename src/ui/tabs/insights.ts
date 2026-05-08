/**
 * Insights 탭 — v3.23 T8 시점: shell 유지 + placeholder listener.
 * v3.23 T9에서 grid render + detail 모달로 wiring 완성.
 */
import { on } from '../events';

export function renderInsights(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `
    <div class="insights-section" id="insightsTab">
      <h2 style="margin-bottom:16px;">💡 인사이트</h2>
      <div id="insightContent" style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;">아직 인사이트가 없어요. 대화를 나누고 인사이트 카드를 만들어보세요.</div>
    </div>
  `;
}

/**
 * v3.23 T8 placeholder — `dg:insights:added` dispatch와의 wiring-gap 차단.
 * `dg:insights:removed`는 T9에서 dispatch + listener 함께 추가.
 * @internal
 */
export function mountInsightsHandlers(): void {
  on('dg:insights:added', () => { /* T9 wiring 대기 */ });
}
