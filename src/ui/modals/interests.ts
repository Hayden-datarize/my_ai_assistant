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

const USER_STORAGE = 'user';

interface LegacyUser {
  name: string;
  interests: string[];
  onboardedAt: string;
  streak: number;
  lastActiveDate: string;
  xp: number;
  level: number;
}

function loadUser(): LegacyUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE);
    return raw ? (JSON.parse(raw) as LegacyUser) : null;
  } catch {
    return null;
  }
}

function saveUser(u: LegacyUser): void {
  try {
    localStorage.setItem(USER_STORAGE, JSON.stringify(u));
  } catch {
    /* ignore */
  }
}

export function openInterestsModal(): void {
  const user = loadUser();
  if (!user) return;

  const current = new Set(user.interests);

  const checkboxesHtml = INTERESTS.map((c) => {
    const checked = current.has(c.id) ? 'checked' : '';
    return `
      <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;">
        <input type="checkbox" value="${escapeHtml(c.id)}" ${checked} />
        <span>${escapeHtml(c.label)}</span>
      </label>
    `;
  }).join('');

  openModal({
    title: '관심 분야 수정',
    bodyHtml: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${checkboxesHtml}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button type="button" id="cancelInterestsBtn" class="btn btn-outline">취소</button>
        <button type="button" id="saveInterestsBtn" class="btn btn-primary">저장</button>
      </div>
    `,
  });

  const saveBtn = document.getElementById('saveInterestsBtn') as HTMLButtonElement | null;
  const cancelBtn = document.getElementById('cancelInterestsBtn');
  const boxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

  const updateSaveState = (): void => {
    const anyChecked = Array.from(boxes).some((b) => b.checked);
    if (saveBtn) saveBtn.disabled = !anyChecked;
  };

  boxes.forEach((b) => b.addEventListener('change', updateSaveState));
  updateSaveState();

  saveBtn?.addEventListener('click', () => {
    const newInterests = Array.from(boxes).filter((b) => b.checked).map((b) => b.value);
    if (newInterests.length === 0) return;
    saveUser({ ...user, interests: newInterests });
    closeModal();
    showToast('관심 분야가 업데이트되었어요');
    document.dispatchEvent(new CustomEvent('dg:interests:changed'));
  });

  cancelBtn?.addEventListener('click', () => closeModal());
}
