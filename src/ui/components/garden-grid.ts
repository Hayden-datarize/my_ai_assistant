import type { User } from '../../state/user';
import { getPlantIcon, STAGE_LABEL, TROPHY_MARK } from '../../state/plantCatalog';
import { checkWilting } from '../../state/plantEngine';
import { escapeHtml } from '../../utils/escapeHtml';

/**
 * 분야 ID → 한국어 짧은 라벨 (emoji 제외 plain text).
 * 실제 INTERESTS catalog 15개 ID 기준 (`src/utils/categories.ts`).
 * 사용자 정의 분야는 id 그대로 fallback (escapeHtml 적용).
 */
export const INTEREST_LABEL: Record<string, string> = {
  recruiting:    '채용',
  onboarding:    '온보딩',
  culture:       '조직문화',
  hr_system:     '인사제도',
  labor_law:     '노무/법률',
  leadership:    '리더십',
  pm:            '프로덕트',
  ai_ml:         'AI/ML',
  data:          '데이터분석',
  startup:       '스타트업',
  marketing:     '마케팅',
  productivity:  '생산성',
  career:        '커리어',
  communication: '커뮤니케이션',
  self_dev:      '자기계발',
};

function shortLabel(interestId: string, full: boolean): string {
  // 사용자 정의 분야는 id 그대로 fallback
  const label = INTEREST_LABEL[interestId] ?? interestId;
  return full ? label : label.slice(0, 2);  // mini는 2자
}

/**
 * Stats 탭 full grid — 최대 3 col responsive (narrow = 1 col).
 * archived 식물 (user.interests 외) 은 grid에서 제외.
 */
export function renderGardenGrid(root: HTMLElement, user: User): void {
  const visible = user.interests.filter(id => user.plantStateByInterest[id]);
  if (visible.length === 0) {
    // eslint-disable-next-line no-restricted-syntax -- 고정 문자열, 사용자 입력 없음
    root.innerHTML = `<p class="garden-empty">관심분야를 추가하면 식물이 자라요</p>`;
    return;
  }
  const now = new Date();
  const cards = visible.map(id => {
    const plant = user.plantStateByInterest[id]!;
    const wilting = checkWilting(plant, now);
    const trophy = plant.unlockedAt
      ? `<span class="garden-trophy">${escapeHtml(TROPHY_MARK)}</span>`
      : '';
    // escapeHtml: shortLabel은 catalog 고정값이지만 사용자 정의 분야 fallback 대비
    const label = escapeHtml(shortLabel(id, true));
    const stageLabel = escapeHtml(STAGE_LABEL[plant.stage]);
    const icon = escapeHtml(getPlantIcon(id, plant.stage));
    const cumCount = Number.isFinite(plant.cumulativeActivity)
      ? Math.floor(plant.cumulativeActivity)
      : 0;
    const wiltClass = wilting ? ' wilting' : '';
    const bloomClass = plant.stage === 5 ? ' bloomed' : '';
    return `
      <div class="garden-card${wiltClass}${bloomClass}" data-interest-id="${escapeHtml(id)}">
        <span class="garden-emoji">${icon}</span>
        <span class="garden-name">${label}${trophy}</span>
        <span class="garden-stage-label">${stageLabel}</span>
        <span class="garden-cum-count">${cumCount}회</span>
      </div>`;
  }).join('');
  // eslint-disable-next-line no-restricted-syntax -- 위에서 escapeHtml 전처리 완료
  root.innerHTML = `<div class="garden-grid">${cards}</div>`;
}

/**
 * 홈 mini preview row — cell ~50px, emoji + 짧은 라벨, 가로 flex.
 * 클릭 시 stats 탭 navigate (caller가 handler attach).
 */
export function renderGardenMini(root: HTMLElement, user: User): void {
  const visible = user.interests.filter(id => user.plantStateByInterest[id]);
  if (visible.length === 0) {
    root.textContent = '';  // 신규 사용자 mini 미표시
    return;
  }
  const now = new Date();
  const cells = visible.map(id => {
    const plant = user.plantStateByInterest[id]!;
    const wilting = checkWilting(plant, now);
    const trophy = plant.unlockedAt
      ? `<span class="garden-mini-trophy">${escapeHtml(TROPHY_MARK)}</span>`
      : '';
    const fullLabel = escapeHtml(shortLabel(id, true));
    const miniLabel = escapeHtml(shortLabel(id, false));
    const icon = escapeHtml(getPlantIcon(id, plant.stage));
    const wiltClass = wilting ? ' wilting' : '';
    return `
      <button type="button" class="garden-mini-cell${wiltClass}" data-interest-id="${escapeHtml(id)}" aria-label="${fullLabel} 정원">
        <span class="garden-mini-emoji">${icon}</span>
        ${trophy}
        <span class="garden-mini-label">${miniLabel}</span>
      </button>`;
  }).join('');
  // eslint-disable-next-line no-restricted-syntax -- 위에서 escapeHtml 전처리 완료
  root.innerHTML = `<div class="garden-mini-row">${cells}</div>`;
}
