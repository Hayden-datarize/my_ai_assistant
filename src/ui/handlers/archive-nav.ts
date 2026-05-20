/**
 * v3.40 T8 (C4): archive-nav-chip 공용 helper — plant-detail / insight-detail 3 callsite 공유.
 *
 * Architecture:
 *   closeModal → (dynamic import) resetArchiveFilters → applyInterestFilter(id) →
 *   switchTab('archive') → tryFocusWithPreventScroll
 *
 * Codex 사전 P1-3 흡수: archive.ts를 static import로 끌어오면 plant-detail/insight-detail
 * chunk가 archive chunk와 merge되어 chunk 분리 깨짐. helper 내부 dynamic import 유지 의무.
 *
 * @internal — caller는 plant-detail.ts (action chip) + insight-detail.ts (nav chip) 2 spot.
 */
import { closeModal } from '../modals/shared';
import { switchTab } from '../nav';

export async function navigateToInterestArchive(interestId: string): Promise<void> {
  // v3.39 T8 review: invalid interestId (whitelist miss 또는 'unknown') 사전 차단 —
  // applyInterestFilter 내부에서 setCurrentInterestId가 null로 정정하지만,
  // nav 진입점 자체에서 silent return으로 closeModal 부작용 차단.
  if (!interestId) return;

  closeModal();
  // Codex v3.36 P1-1 + v3.40 T8 (Codex 사전 P1-3): dynamic import 유지 — plant-detail/insight-detail
  // chunk가 archive handler를 static으로 끌어와 chunk merge되는 것을 차단.
  const { resetArchiveFilters, applyInterestFilter } = await import('./archive');
  resetArchiveFilters();
  applyInterestFilter(interestId);
  await switchTab('archive');

  // focus 부여 (검색 입력 즉시 가능). search input value는 비어 있음.
  const input = document.querySelector<HTMLInputElement>('#archiveSearch');
  if (!input) return;
  tryFocusWithPreventScroll(input);
}

/**
 * v3.37 T2 (Codex 사전 P2-1): `focus({ preventScroll })`이 throw하는 환경에서 graceful degrade.
 * @internal
 */
function tryFocusWithPreventScroll(input: HTMLInputElement): void {
  try {
    input.focus({ preventScroll: true });
  } catch (err) {
    console.warn('[archive-nav] focus({preventScroll}) fallback', err);
    input.focus();
  }
}
