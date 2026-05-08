import { openModal } from './shared';
import { loadUserData } from '../../state/user';
import { INTEREST_LABEL } from '../components/garden-grid';
import { getPlantIcon, STAGE_LABEL, STAGE_THRESHOLDS, TROPHY_MARK } from '../../state/plantCatalog';
import { checkWilting } from '../../state/plantEngine';
import { escapeHtml } from '../../utils/escapeHtml';
import { getAnswerCountByInterest, getScrapCountByInterest } from '../../utils/interestCounts';
import { getKstDateStr } from '../../utils/dates';
import type { User } from '../../state/user';
import type { PlantState } from '../../state/plantTypes';

/**
 * Plant detail modal — stats 탭 garden card 클릭 시 표시.
 * shared.openModal이 Esc/focus-trap/aria-modal 처리 (R5).
 * T8: Standard 6 항목 (stage/progress/unlockedAt/lastEngagedAt/wilting/counts) bodyHtml render.
 */
export function openPlantDetailModal(interestId: string): void {
  const u = loadUserData();
  if (!u) return;
  const plant = u.plantStateByInterest[interestId];
  if (!plant) return;

  const title = INTEREST_LABEL[interestId] ?? interestId;
  const bodyHtml = renderBody(u, interestId, plant);

  openModal({
    title: `${title} 정원`,
    bodyHtml: `<div class="plant-detail-modal">${bodyHtml}</div>`,
  });
}

function renderBody(_u: User, interestId: string, plant: PlantState): string {
  const icon = escapeHtml(getPlantIcon(interestId, plant.stage));
  const stageLabel = escapeHtml(STAGE_LABEL[plant.stage]);
  const cum = Number.isFinite(plant.cumulativeActivity) ? Math.floor(plant.cumulativeActivity) : 0;

  // 1. Stage badge — emoji + STAGE_LABEL
  const stageHtml = `
    <div class="plant-detail-stage">
      <span class="plant-detail-emoji">${icon}</span>
      <span class="plant-detail-stage-label">${stageLabel}</span>
    </div>`;

  // 2. Progress — cum / nextThreshold (stage 5 = 만개 ✨)
  const progressHtml = plant.stage === 5
    ? `<div class="plant-detail-progress">만개 ${escapeHtml(TROPHY_MARK)}</div>`
    : `<div class="plant-detail-progress">${cum} / ${STAGE_THRESHOLDS[plant.stage - 1]}</div>`;

  // 3. Unlocked — unlockedAt 있으면 한국 날짜, 없으면 hide
  const unlockedHtml = plant.unlockedAt
    ? `<div class="plant-detail-unlocked">✨ ${escapeHtml(formatKoreanDate(plant.unlockedAt))} 도달</div>`
    : '';

  // 4. Last engaged — 상대 시간, 없으면 "활동 기록 없음"
  const engagedHtml = plant.lastEngagedAt
    ? `<div class="plant-detail-engaged">마지막 활동 ${escapeHtml(formatRelative(plant.lastEngagedAt))}</div>`
    : `<div class="plant-detail-engaged">활동 기록 없음</div>`;

  // 5. Wilting — checkWilting true 시 표시
  const wilting = checkWilting(plant, new Date());
  const wiltingHtml = wilting
    ? `<div class="plant-detail-wilting">🥀 7일 이상 활동이 없어요. 다시 가꿔주세요</div>`
    : '';

  // 6. Counts — answers / scraps
  const answers = getAnswerCountByInterest(interestId);
  const scraps = getScrapCountByInterest(interestId);
  const countsHtml = `<div class="plant-detail-counts">${answers}개 답변 · ${scraps}개 스크랩</div>`;

  return stageHtml + progressHtml + unlockedHtml + engagedHtml + wiltingHtml + countsHtml;
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

/**
 * ISO → "오늘" / "어제" / "N일 전".
 * 음수 ms (시계 역행 / 미래 ISO)는 '오늘'으로 가드 (v3.22 T1).
 * @internal — spec 직접 호출용 export. plant-detail 외부에서 사용 금지.
 */
export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '오늘';
  const days = Math.floor(ms / 86400_000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}
