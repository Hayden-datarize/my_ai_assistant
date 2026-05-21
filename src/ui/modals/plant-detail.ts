import { openModal } from './shared';
import { loadUserData } from '../../state/user';
import { INTEREST_LABEL } from '../components/garden-grid';
import { getPlantIcon, STAGE_LABEL, STAGE_THRESHOLDS, TROPHY_MARK } from '../../state/plantCatalog';
import { checkWilting } from '../../state/plantEngine';
import { escapeHtml } from '../../utils/escapeHtml';
import { getAnswerCountByInterest, getScrapCountByInterest } from '../../utils/interestCounts';
import { getKstDateStr, formatRelative } from '../../utils/dates';
// v3.39 T8 review (Codex 최종 P1-1): interestKeywords import 제거 — pickSearchKeyword path 폐기로 dead-code.
// v3.40 T8 (C4): navigateToInterestArchive 공용 helper로 이동 — archive-nav.ts (switchTab import 함께 이동).
import { navigateToInterestArchive } from '../handlers/archive-nav';
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

  // v3.47: 다음 단계 nudge (stage 1~4). remaining clamp≥1 — 손상 데이터(cum≥threshold인데 미진화) 방어.
  const nudgeHtml = plant.stage === 5
    ? ''
    : (() => {
        // STAGE_THRESHOLDS는 4-tuple(idx 0~3) — stage 1~4만 이 branch라 항상 정의되나, noUncheckedIndexedAccess 대비 ?? 0.
        const threshold = STAGE_THRESHOLDS[plant.stage - 1] ?? 0;
        const remaining = Math.max(1, threshold - cum);
        const copy = remaining <= 3
          ? `🎯 다음 단계까지 딱 ${remaining}번!`
          : `🎯 다음 단계까지 ${remaining}번 더 가꾸면 돼요`;
        return `<div class="plant-detail-nudge">${copy}</div>`;
      })();

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
  root.innerHTML = stageHtml + progressHtml + nudgeHtml + unlockedHtml + engagedHtml + wiltingHtml + countsHtml;

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
 * v3.39 T8 review (Codex 최종 P1-1): 한국어/영문 interestKeyword가 entity filter SoT를 깨뜨려
 * pickSearchKeyword + #archiveSearch prefill path 제거. interestKeywords import도 dead-code화.
 *
 * 이전 동작 (v3.39 T6까지):
 *   pickSearchKeyword('ai_ml') → 'ai_ml' (영문 id fallback) → input.value='ai_ml' →
 *   handleArchiveSearch → currentTokens=['ai_ml'] → entityMatchesInterest && text.includes('ai_ml').
 *   결과: 'AI/ML', 'OpenAI' 본문은 'ai_ml' literal 없어 false negative.
 *
 * 신규 동작 (T8 review fix):
 *   applyInterestFilter(id)가 currentInterestId state 단독 SoT — entityMatchesInterest로만
 *   필터. handleArchiveSearch는 호출 안 함 → currentTokens=[] 유지.
 */

/**
 * v3.37 T2: action chip → archive 진입 시 stale filter reset + focus 부여.
 * v3.39 T6 (Codex P0-2): applyInterestFilter 단일 진입점 추가 — currentInterestId 설정.
 * v3.39 T8 review (Codex 최종 P1-1): 검색어 prefill + handleArchiveSearch 제거 (exact filter SoT).
 *
 * 시퀀스 (신규):
 *   closeModal → (dynamic import) resetArchiveFilters → applyInterestFilter(id) →
 *   switchTab → tryFocusWithPreventScroll
 *
 * @internal — spec 직접 호출용 export.
 */
// v3.40 T8 (C4): navigateToInterestArchive + tryFocusWithPreventScroll → src/ui/handlers/archive-nav.ts 이동.
// insight-detail.ts와 공유 helper (3 callsite). Codex 사전 P1-3 흡수: 내부 dynamic import 유지.
// 본 위치는 closeModal/switchTab 한 줄 wrapper 역할 → 직접 caller가 archive-nav에서 import.

/**
 * ISO → "YYYY년 M월 D일" (KST anchor).
 * v3.22 T4 (P2-4): 머신 TZ 무관 — getKstDateStr (Intl Asia/Seoul) 재사용.
 * @internal — spec 직접 호출용 export.
 */
export function formatKoreanDate(iso: string): string {
  const [y, m, d] = getKstDateStr(new Date(iso)).split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

