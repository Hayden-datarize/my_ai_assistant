import { openModal, closeModal } from './shared';
import { getCachedUser, saveUser } from '../../state/user';
import { STAGE_LABEL, getPlantIcon } from '../../state/plantCatalog';
import { switchTab } from '../nav';
import { scrollToGardenSection } from '../handlers/stats-shared';
import { escapeHtml } from '../../utils/escapeHtml';
import { INTEREST_LABEL } from '../components/garden-grid';
import { MSG } from '../messages';

/**
 * 첫 v3.15 진입 시 1회 표시. gardenIntroduced flag로 idempotent.
 *
 * Highlight: backfill 결과 중 가장 큰 stage 식물 1개 명시.
 * 신규 사용자 (모든 식물 stage 1, cum 0) → highlight 생략, "씨앗부터 시작해요" 대체.
 *
 * v3.18.1 H1 (#4): manual `.modal-backdrop` + `.modal-card` (0 CSS 매칭) →
 * `openModal()` helper로 refactor. `.welcome-garden-modal` wrapper + button IDs는
 * bodyHtml 안에 보존하여 spec 11 case 호환. AbortController는 openModal 내부에서 관리.
 */
export function maybeShowWelcomeGarden(): void {
  const user = getCachedUser();
  if (!user || user.gardenIntroduced) return;

  // backfill highlight 후보 — 가장 큰 stage (동률 시 cumulativeActivity 큰 것)
  const visible = user.interests.filter(id => user.plantStateByInterest[id]);
  const sorted = visible
    .map(id => ({ id, plant: user.plantStateByInterest[id]! }))
    .sort(
      (a, b) =>
        (b.plant.stage - a.plant.stage) ||
        (b.plant.cumulativeActivity - a.plant.cumulativeActivity),
    );

  const top = sorted[0];
  const newcomer = !top || (top.plant.stage === 1 && top.plant.cumulativeActivity === 0);

  let highlightHtml = '';
  if (!newcomer && top) {
    // XSS: label/stageLabel/emoji 모두 user-controlled 가능 — 먼저 escapeHtml 적용 후
    // MSG 함수에 전달 (MSG는 단순 string 보간, 추가 escapeHtml 불필요 — double-escape 방지)
    const label = escapeHtml(INTEREST_LABEL[top.id] ?? top.id);
    const stageLabel = escapeHtml(STAGE_LABEL[top.plant.stage]);
    const emoji = escapeHtml(getPlantIcon(top.id, top.plant.stage));
    highlightHtml = `<p class="welcome-garden-highlight">${MSG.GARDEN_HIGHLIGHT_BACKFILL(label, stageLabel, emoji)}</p>`;
  } else {
    highlightHtml = `<p class="welcome-garden-newcomer">${escapeHtml(MSG.GARDEN_NEWCOMER)}</p>`;
  }

  // v3.24 T3: indent 압축 (production-safe).
  const bodyHtml = `<div class="welcome-garden-modal"><p>${escapeHtml(MSG.GARDEN_INTRODUCE_BODY).replace(/\n/g, '<br>')}</p>${highlightHtml}<div class="modal-actions"><button type="button" class="btn-primary" id="welcomeGardenViewBtn">${escapeHtml(MSG.GARDEN_CTA_VIEW)}</button><button type="button" class="btn-secondary" id="welcomeGardenCloseBtn">${escapeHtml(MSG.GARDEN_CTA_CLOSE)}</button></div></div>`;

  const wrap = openModal({
    title: MSG.GARDEN_INTRODUCE_TITLE,
    bodyHtml,
    onClose: () => {
      const u = getCachedUser();
      if (u && !u.gardenIntroduced) {
        u.gardenIntroduced = true;
        // saveUser는 best-effort flag 토글 — Quota 시 다음 진입에서 재시도 (idempotent 설계).
        // v3.7 saveUser throw 정책은 사용자 데이터 변경 path 적용; 모달 flag 토글은 수용.
        try { saveUser(u); } catch { /* Quota silent — 다음 진입 재시도 */ }
      }
    },
  });

  // "정원 보러 가기" — closeModal()이 onClose fire (gardenIntroduced flag set) 후 stats tab 이동
  wrap.querySelector<HTMLButtonElement>('#welcomeGardenViewBtn')
    ?.addEventListener('click', () => {
      closeModal();
      // v3.29 T3: switchTab now async (dynamic import) — await render before scroll.
      // v3.29 T3 review fix (I2): chunk load fail 진단 가능화.
      switchTab('stats')
        .then(() => {
          // setTimeout 대신 requestAnimationFrame — paint 안정 보장 (home.ts T12 패턴)
          requestAnimationFrame(() => scrollToGardenSection());
        })
        .catch((err) => {
          console.warn('[welcome-garden] switchTab stats failed', err);
        });
    });

  wrap.querySelector<HTMLButtonElement>('#welcomeGardenCloseBtn')
    ?.addEventListener('click', () => closeModal());
}
