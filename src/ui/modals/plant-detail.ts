import { openModal } from './shared';
import { loadUserData } from '../../state/user';
import { INTEREST_LABEL } from '../components/garden-grid';

/**
 * Plant detail modal — stats 탭 garden card 클릭 시 표시.
 * shared.openModal이 Esc/focus-trap/aria-modal 처리 (R5).
 * T7 = shell only. T8에서 Standard 6 항목 (stage/progress/unlockedAt/lastEngagedAt/wilting/counts) bodyHtml 채움.
 */
export function openPlantDetailModal(interestId: string): void {
  const u = loadUserData();
  if (!u) return;
  const plant = u.plantStateByInterest[interestId];
  if (!plant) return;

  const title = INTEREST_LABEL[interestId] ?? interestId;
  // T8 placeholder — renderBody는 다음 task에서 추가.
  const bodyHtml = '';

  openModal({
    title: `${title} 정원`,
    bodyHtml: `<div class="plant-detail-modal">${bodyHtml}</div>`,
  });
}
