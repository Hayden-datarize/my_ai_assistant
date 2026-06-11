/**
 * Missions 탭 정적 마크업.
 * v3.14: 홈에서 분리. missions-listeners.ts가 dg:nav:tab-changed 수신 시 home.hydrateMissions로 hydrate (v3.50 C3 rewire).
 */
export function renderMissions(container: HTMLElement): void {
  // v3.24 T3: indent 압축 (production-safe).
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `<div id="missionsTab"><div class="header"><div class="header-left"><h1>🎯 미션</h1></div></div><div id="missionsContainer"></div></div>`;
}
