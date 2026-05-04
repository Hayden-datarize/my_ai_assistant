/**
 * Interest categories editor modal (v3.3.3 D1).
 *
 * Spec §4.2. User previously had no way to modify interests after onboarding.
 * This modal renders a checkbox grid of all INTERESTS with the user's current
 * selections pre-checked. Save requires ≥1 selection; on save we persist and
 * dispatch `dg:interests:changed` so the settings tab (D2) can re-render.
 *
 * Semantics:
 *   - "저장" button → persist + toast + closeModal() + CustomEvent dispatch
 *   - "취소" button / ESC / backdrop / × → closeModal() (no persistence)
 *   - onClose is cleanup-only; saving is explicit via the save button.
 */

import { openModal, closeModal } from './shared';
import { INTERESTS } from '../../utils/categories';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast } from '../../utils/toast';
import { getCachedUser, saveUser, getSaveErrorMessage } from '../../state/user';
import { ensurePlantsForInterests } from '../../state/plantEngine';
import { MSG } from '../messages';

/**
 * 관심 분야 저장 handler — testable export (v3.15 T15 S10 P1-4 fix).
 *
 * user.interests 갱신 → ensurePlantsForInterests 호출 → saveUser (atomic single-write).
 * 분야 제거 시 plantStateByInterest entry 보존 (Q8-B archived 정책).
 *
 * @returns true = 저장 성공, false = 저장 실패 (toast 표시 완료)
 */
export function handleInterestsSave(newInterests: string[]): boolean {
  const user = getCachedUser();
  if (!user) return false;
  user.interests = newInterests;

  // S10 fix (P1-4): 새 분야 ID에 stage 1 식물 자동 생성 (기존 entry 보존 — idempotent)
  ensurePlantsForInterests(user);

  try {
    saveUser(user);
    return true;
  } catch (e) {
    showToast(getSaveErrorMessage(e));
    return false;
  }
}

export function openInterestsModal(): void {
  const user = getCachedUser();
  if (!user) return;

  const current = new Set(user.interests);

  const checkboxesHtml = INTERESTS.map((c) => {
    const checked = current.has(c.id) ? 'checked' : '';
    return `
      <label class="dg-modal-checkbox-card">
        <input type="checkbox" value="${escapeHtml(c.id)}" ${checked} />
        <span>${escapeHtml(c.label)}</span>
      </label>
    `;
  }).join('');

  const wrap = openModal({
    title: '관심 분야 수정',
    bodyHtml: `
      <div class="dg-modal-grid-2col">
        ${checkboxesHtml}
      </div>
      <div class="dg-modal-footer">
        <button type="button" id="cancelInterestsBtn" class="btn btn-outline">취소</button>
        <button type="button" id="saveInterestsBtn" class="btn btn-primary">저장</button>
      </div>
    `,
  });

  // v3.14.3 T7 (P2-2 / v3.14.2 P2-NEW-7): wrap-scoped queries — nested modal 안전.
  const saveBtn = wrap.querySelector<HTMLButtonElement>('#saveInterestsBtn');
  const cancelBtn = wrap.querySelector('#cancelInterestsBtn');
  const boxes = wrap.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

  const updateSaveState = (): void => {
    const anyChecked = Array.from(boxes).some((b) => b.checked);
    if (saveBtn) saveBtn.disabled = !anyChecked;
  };

  boxes.forEach((b) => b.addEventListener('change', updateSaveState));
  updateSaveState();

  saveBtn?.addEventListener('click', () => {
    const newInterests = Array.from(boxes).filter((b) => b.checked).map((b) => b.value);
    if (newInterests.length === 0) return;
    // handleInterestsSave: interests 갱신 + ensurePlantsForInterests + saveUser (try/catch 내부)
    // false 반환 시 toast 표시 완료 — modal 유지 (사용자 재시도 기회)
    if (!handleInterestsSave(newInterests)) return;
    closeModal();
    showToast(MSG.INTERESTS_UPDATED);
    document.dispatchEvent(new CustomEvent('dg:interests:changed'));
  });

  cancelBtn?.addEventListener('click', () => closeModal());
}
