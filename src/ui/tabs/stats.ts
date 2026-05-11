/**
 * Stats 탭 정적 마크업을 container에 렌더링한다.
 * 인라인 핸들러 없이 CustomEvent를 dispatch하여 Task 18에서 연결한다.
 */
import { loadAnswers } from '../../state/persistence';
import { openPlantDetailModal } from '../modals/plant-detail';
import { getXpHistory } from '../../state/user';
import { renderXpChart } from '../components/xp-chart';

export function renderStats(container: HTMLElement): void {
  // v3.24 T3: indent 압축 (production-safe).
  // eslint-disable-next-line no-restricted-syntax -- trusted static template, no interpolation
  container.innerHTML = `<div class="stats-section" id="statsTab"><h2 style="margin-bottom:16px;">📊 나의 성장</h2><div class="level-card" id="levelCard"><div class="level-icon" id="levelIcon">🌱</div><div class="level-name" id="levelName">새싹</div><div class="level-xp" id="levelXpText">0 / 50 XP</div><div class="xp-progress"><div class="xp-progress-fill" id="xpProgressFill" style="width:0%"></div></div></div><div class="stat-grid"><div class="stat-card"><div class="stat-value" id="statStreak">0</div><div class="stat-label">🔥 연속 참여</div></div><div class="stat-card"><div class="stat-value" id="statAnswers">0</div><div class="stat-label">💬 총 답변</div></div><div class="stat-card"><div class="stat-value" id="statArticles">0</div><div class="stat-label">📰 스크랩</div></div><div class="stat-card"><div class="stat-value" id="statXp">0</div><div class="stat-label">⭐ 총 XP</div></div></div><div id="growthSummary" style="background:linear-gradient(135deg,var(--accent-light),var(--primary-ultra-light));border-radius:var(--radius-md);padding:14px 16px;margin-bottom:16px;font-size:0.85rem;line-height:1.6;color:var(--text-primary);"></div><div style="background:var(--bg-card);border-radius:var(--radius-lg);padding:16px;border:1px solid var(--border);margin-bottom:16px;"><h3 style="font-size:0.95rem;margin-bottom:12px;">🎯 질문 유형별 답변</h3><div id="categoryBreakdown" style="display:flex;flex-direction:column;gap:8px;"></div></div><div class="heatmap-wrap"><h3>📅 최근 4주 활동</h3><div class="heatmap-layout"><ol class="heatmap-weekday-labels" aria-hidden="true"><li>월</li><li>화</li><li>수</li><li>목</li><li>금</li><li class="weekend-label">토</li><li class="weekend-label">일</li></ol><div class="heatmap-grid" id="heatmapGrid" aria-label="최근 4주 활동 히트맵. 화살표 키로 탐색, Enter로 상세 보기"></div></div><p class="heatmap-info" id="heatmapInfo" aria-live="polite"></p><div class="heatmap-legend" aria-hidden="true"><span class="legend-item"><i class="legend-dot level-0"></i>없음</span><span class="legend-item"><i class="legend-dot level-1"></i>적음</span><span class="legend-item"><i class="legend-dot level-2"></i>보통</span><span class="legend-item"><i class="legend-dot level-3"></i>많음</span></div></div><div id="xpChartMount" class="xp-chart-wrap" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:16px;border:1px solid var(--border);margin-bottom:16px;"><h3 style="font-size:0.95rem;margin-bottom:12px;">📈 최근 30일 XP 추이</h3></div><div class="badges-section" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:16px;border:1px solid var(--border);margin-bottom:16px;"><h3 style="margin-bottom:12px;font-size:0.95rem;">🏆 뱃지</h3><div id="badgesGrid"></div></div><section id="gardenSection" class="garden-section" aria-label="내 정원" data-scroll-target><h2 class="section-title">내 정원</h2><div id="gardenContainer"></div></section><div style="display:flex;gap:8px;margin-bottom:16px;"><button class="btn btn-primary" id="weeklyReportBtn" style="flex:1;">📊 주간 리포트</button><button class="btn btn-secondary" id="growthAnalysisBtn" style="flex:1;">🔮 성장 분석</button></div></div>`;

  // categoryBreakdown에 누적 답변 수 표시
  const total = loadAnswers().length;
  const breakdown = container.querySelector<HTMLDivElement>('#categoryBreakdown');
  if (breakdown) breakdown.textContent = `누적 답변 ${total}개`;

  bindHandlers(container);

  // v3.27 T7: XP 추이 30d SVG 마운트 — heatmap-wrap 직후 #xpChartMount.
  mountXpChart(container);

  // v3.21 T9: garden-grid card click → plant-detail modal (delegation, idempotent).
  wireGardenGridClicks(container);
}

function mountXpChart(container: HTMLElement): void {
  const mount = container.querySelector('#xpChartMount');
  if (!mount) return;
  mount.appendChild(renderXpChart(getXpHistory(30)));
}

/**
 * stats 탭 mount 시 1회 호출 — garden card click delegation.
 * `dataset.gridWired` flag로 중복 등록 가드 (idempotency).
 *
 * @param rootEl stats 탭 컨테이너 (또는 garden card를 포함하는 ancestor).
 */
export function wireGardenGridClicks(rootEl: HTMLElement): void {
  if (rootEl.dataset['gridWired'] === 'true') return;
  rootEl.dataset['gridWired'] = 'true';
  rootEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.garden-card[data-interest-id]');
    if (!target) return;
    const id = target.dataset['interestId'];
    if (id) openPlantDetailModal(id);
  });
}

/** CustomEvent 핸들러를 등록한다. Task 18에서 실제 로직으로 교체 예정. */
function bindHandlers(container: HTMLElement): void {
  // weeklyReportBtn click → dg:stats:weekly-report
  const weeklyReportBtn = container.querySelector<HTMLButtonElement>('#weeklyReportBtn');
  if (weeklyReportBtn) weeklyReportBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:stats:weekly-report'));
  });

  // growthAnalysisBtn click → dg:stats:growth-analysis
  const growthAnalysisBtn = container.querySelector<HTMLButtonElement>('#growthAnalysisBtn');
  if (growthAnalysisBtn) growthAnalysisBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('dg:stats:growth-analysis'));
  });
}
