/**
 * Insights 탭 — Task 13에서는 shell만 생성한다.
 * 실제 인사이트 카드 렌더링 로직은 Task 18에서 wiring된다.
 */
export function renderInsights(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `
    <div class="insights-section" id="insightsTab">
      <h2 style="margin-bottom:16px;">💡 인사이트</h2>
      <div id="insightContent" style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;">아직 인사이트가 없어요. 대화를 나누고 인사이트 카드를 만들어보세요.</div>
    </div>
  `;
}
