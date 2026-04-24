/**
 * Memo editor modal for briefing cards (v3.3.3 C6).
 *
 * Opened by the ✎ button on a briefing card. The old card embedded a textarea
 * inline; the new cardnews design has no room, so memo is modal-based.
 *
 * Semantics:
 *   - "저장" button → saveMemo(index, value) + toast + closeModal()
 *   - "취소" button / ESC / backdrop / × → closeModal() (no persistence)
 *   - onClose is cleanup-only; saving is explicit via the save button.
 */

import { openModal, closeModal } from './shared';
import { loadBriefings, saveMemo } from '../../state/briefings';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast } from '../../utils/toast';

export function openMemoModal(index: number): void {
  const list = loadBriefings();
  const briefing = list[index];
  if (!briefing) return;

  const existing = briefing.memo ?? '';
  const escaped = escapeHtml(existing);

  openModal({
    title: '메모',
    bodyHtml: `
      <textarea id="memoInput" class="dg-modal-textarea" rows="6">${escaped}</textarea>
      <div class="dg-modal-footer">
        <button type="button" id="cancelMemoBtn" class="btn btn-outline">취소</button>
        <button type="button" id="saveMemoBtn" class="btn btn-primary">저장</button>
      </div>
    `,
  });

  const saveBtn = document.getElementById('saveMemoBtn');
  const cancelBtn = document.getElementById('cancelMemoBtn');
  const input = document.getElementById('memoInput') as HTMLTextAreaElement | null;

  saveBtn?.addEventListener('click', () => {
    if (input) {
      saveMemo(index, input.value);
      showToast('메모가 저장되었어요');
    }
    closeModal();
  });

  cancelBtn?.addEventListener('click', () => {
    closeModal();
  });
}
