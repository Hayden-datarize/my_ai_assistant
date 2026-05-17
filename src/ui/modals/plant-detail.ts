import { openModal, closeModal } from './shared';
import { loadUserData } from '../../state/user';
import { INTEREST_LABEL } from '../components/garden-grid';
import { getPlantIcon, STAGE_LABEL, STAGE_THRESHOLDS, TROPHY_MARK } from '../../state/plantCatalog';
import { checkWilting } from '../../state/plantEngine';
import { escapeHtml } from '../../utils/escapeHtml';
import { getAnswerCountByInterest, getScrapCountByInterest } from '../../utils/interestCounts';
import { getKstDateStr, formatRelative } from '../../utils/dates';
import { interestKeywords } from '../../utils/interestKeywords';
import { switchTab } from '../nav';
import type { User } from '../../state/user';
import type { PlantState } from '../../state/plantTypes';

/**
 * Plant detail modal — stats 탭 garden card 클릭 시 표시.
 * v3.36 T1: bodyHtml → bodyNode migration (v3.26 T3 contract) + action chip + navigateToInterestArchive.
 */
export function openPlantDetailModal(interestId: string): void {
  const u = loadUserData();
  if (!u) return;
  const plant = u.plantStateByInterest[interestId];
  if (!plant) return;

  const title = INTEREST_LABEL[interestId] ?? interestId;
  const bodyNode = renderBody(u, interestId, plant);

  openModal({
    title: `${title} 정원`,
    bodyNode,
  });
}

function renderBody(_u: User, interestId: string, plant: PlantState): HTMLElement {
  const icon = escapeHtml(getPlantIcon(interestId, plant.stage));
  const stageLabel = escapeHtml(STAGE_LABEL[plant.stage]);
  const cum = Number.isFinite(plant.cumulativeActivity) ? Math.floor(plant.cumulativeActivity) : 0;

  const stageHtml = `
    <div class="plant-detail-stage">
      <span class="plant-detail-emoji">${icon}</span>
      <span class="plant-detail-stage-label">${stageLabel}</span>
    </div>`;

  const progressHtml = plant.stage === 5
    ? `<div class="plant-detail-progress">만개 ${escapeHtml(TROPHY_MARK)}</div>`
    : `<div class="plant-detail-progress">${cum} / ${STAGE_THRESHOLDS[plant.stage - 1]}</div>`;

  const unlockedHtml = plant.unlockedAt
    ? `<div class="plant-detail-unlocked">✨ ${escapeHtml(formatKoreanDate(plant.unlockedAt))} 도달</div>`
    : '';

  const engagedHtml = plant.lastEngagedAt
    ? `<div class="plant-detail-engaged">마지막 활동 ${escapeHtml(formatRelative(plant.lastEngagedAt))}</div>`
    : `<div class="plant-detail-engaged">활동 기록 없음</div>`;

  const wilting = checkWilting(plant, new Date());
  const wiltingHtml = wilting
    ? `<div class="plant-detail-wilting">🥀 7일 이상 활동이 없어요. 다시 가꿔주세요</div>`
    : '';

  const answers = getAnswerCountByInterest(interestId);
  const scraps = getScrapCountByInterest(interestId);
  const countsHtml = `<div class="plant-detail-counts">${answers}개 답변 · ${scraps}개 스크랩</div>`;

  const root = document.createElement('div');
  root.className = 'plant-detail-modal';
  // eslint-disable-next-line no-restricted-syntax -- bodyNode 내부 static HTML, 각 sub-string은 escapeHtml 적용 끝
  root.innerHTML = stageHtml + progressHtml + unlockedHtml + engagedHtml + wiltingHtml + countsHtml;

  // v3.36 T1: action chip (DOM element + onclick listener)
  root.append(makeActionChip(interestId));

  return root;
}

function makeActionChip(interestId: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'plant-action-chip';
  btn.textContent = '📚 이 분야로 archive 탐색';
  btn.setAttribute('aria-label', '이 분야 키워드로 archive 검색');
  btn.addEventListener('click', () => {
    void navigateToInterestArchive(interestId).catch((err) => {
      console.warn('[plant-action] navigate failed', err);
    });
  });
  return btn;
}

/**
 * Codex P1-3 흡수: 한국어 token 우선 추출 (interestKeywords[0]은 영문 id이라 한국어 archive 매칭 거의 안 됨).
 */
function pickSearchKeyword(interestId: string): string | undefined {
  const tokens = interestKeywords(interestId);
  return tokens.find((t) => /[가-힯]/.test(t)) ?? tokens[0];
}

async function navigateToInterestArchive(interestId: string): Promise<void> {
  const keyword = pickSearchKeyword(interestId);
  if (!keyword) return;

  closeModal();
  await switchTab('archive');

  const input = document.querySelector<HTMLInputElement>('#archiveSearch');
  if (!input) return;
  input.value = keyword;

  // Codex P1-1 흡수: 동적 import — plant-detail이 stats chunk이라 archive handler를 끌어오지 않도록
  const { handleArchiveSearch } = await import('../handlers/archive');
  handleArchiveSearch();
}

/**
 * ISO → "YYYY년 M월 D일" (KST anchor).
 * v3.22 T4 (P2-4): 머신 TZ 무관 — getKstDateStr (Intl Asia/Seoul) 재사용.
 * @internal — spec 직접 호출용 export.
 */
export function formatKoreanDate(iso: string): string {
  const [y, m, d] = getKstDateStr(new Date(iso)).split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

