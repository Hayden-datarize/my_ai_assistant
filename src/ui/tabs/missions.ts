/**
 * Missions 탭 정적 마크업.
 * v3.14: 홈에서 분리. handlers/missions.ts가 dg:nav:tab-changed 수신 시 hydrate.
 */
export function renderMissions(container: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `
    <div id="missionsTab">
      <div class="header">
        <div class="header-left">
          <h1>🎯 미션</h1>
        </div>
      </div>
      <div id="missionsContainer"></div>
    </div>
  `;
}
