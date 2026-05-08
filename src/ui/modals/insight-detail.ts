/**
 * 인사이트 detail 모달 — 전문 + 작성일 + confirm 삭제.
 * Undo 미포함 (v3.8 답변 삭제와 차이 — 인사이트는 가벼운 entity).
 * v3.23 T9.
 */
import { openModal, closeModal } from './shared';
import { getCachedUser, saveUser, getSaveErrorMessage } from '../../state/user';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast } from '../../utils/toast';
import { dispatch } from '../events';

/**
 * 인사이트 detail 모달을 열고 삭제 버튼을 wiring한다.
 * @param id - User.insights[] 내 Insight.id
 */
export function openInsightDetailModal(id: string): void {
  const user = getCachedUser();
  const insight = user?.insights.find(i => i.id === id);
  if (!user || !insight) return;

  // eslint-disable-next-line no-restricted-syntax -- escapeHtml applied to all dynamic strings
  const bodyHtml = `
    <div class="insight-detail">
      <p class="insight-detail-text">${escapeHtml(insight.text)}</p>
      <p class="insight-detail-date">${escapeHtml(insight.createdAt.slice(0, 10))}</p>
      <button type="button" class="btn btn-danger insight-delete-btn">삭제</button>
    </div>
  `;
  const modal = openModal({ title: '인사이트', bodyHtml });

  modal.querySelector('.insight-delete-btn')?.addEventListener('click', () => {
    if (!window.confirm('이 인사이트를 삭제할까요?')) return;
    const removed = user.insights.find(i => i.id === id);
    if (!removed) return;
    user.insights = user.insights.filter(i => i.id !== id);
    try {
      saveUser(user);
      dispatch('dg:insights:removed', { id });
      closeModal();
      showToast('인사이트를 삭제했어요');
    } catch (e) {
      // rollback: filter 결과를 push back
      user.insights.push(removed);
      showToast(getSaveErrorMessage(e));
    }
  });
}
