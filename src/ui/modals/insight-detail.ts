/**
 * 인사이트 detail 모달 — 전문 + 분야 dropdown + 작성일 + confirm 삭제.
 * Undo 미포함 (v3.8 답변 삭제와 차이 — 인사이트는 가벼운 entity).
 * v3.23 T9 (delete) / v3.25 T6 (분야 dropdown).
 */
import { openModal, closeModal } from './shared';
import { getCachedUser, saveUser, getSaveErrorMessage, validateInterestId } from '../../state/user';
import { INTERESTS, getCategoryLabel } from '../../utils/categories';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast } from '../../utils/toast';
import { dispatch } from '../events';
import { KST_FMT_DATE } from '../../utils/intl';

/**
 * 인사이트 detail 모달을 열고 분야 변경 + 삭제 wiring을 부착한다.
 * - dropdown 변경: saveUser 즉시 + dg:insights:updated dispatch + toast.
 *   saveUser throw 시 in-memory + select.value 양방향 rollback (v3.10 atomic).
 * - 삭제: confirm + saveUser + dg:insights:removed + closeModal + toast.
 * @param id - User.insights[] 내 Insight.id
 */
export function openInsightDetailModal(id: string): void {
  const user = getCachedUser();
  const insight = user?.insights.find(i => i.id === id);
  if (!user || !insight) return;

  // dropdown options: '미분류' 첫번째 + INTERESTS 15개 (catalog 순서).
  const optionsHtml = [
    `<option value="unknown"${insight.interestId === 'unknown' ? ' selected' : ''}>📰 미분류</option>`,
    ...INTERESTS.map(i => {
      const sel = insight.interestId === i.id ? ' selected' : '';
      return `<option value="${escapeHtml(i.id)}"${sel}>${escapeHtml(getCategoryLabel(i.id))}</option>`;
    }),
  ].join('');

  // v3.24 T3: indent 압축 (production-safe).
  // eslint-disable-next-line no-restricted-syntax -- escapeHtml applied to all dynamic strings
  // v3.26 T1b: createdAt UTC ISO → KST 'YYYY-MM-DD' (slice(0,10)는 UTC date prefix라 KST 자정 어긋남)
  const kstDate = KST_FMT_DATE.format(new Date(insight.createdAt));
  const bodyHtml = `<div class="insight-detail"><p class="insight-detail-text">${escapeHtml(insight.text)}</p><div class="insight-detail-meta"><label class="insight-detail-interest"><span>분야:</span><select class="insight-interest-select">${optionsHtml}</select></label><p class="insight-detail-date">${escapeHtml(kstDate)}</p></div><button type="button" class="btn btn-danger insight-delete-btn">삭제</button></div>`;
  const modal = openModal({ title: '인사이트', bodyHtml });

  // v3.25 T6: dropdown 분야 변경 wiring (atomic single-write — v3.10 graduated).
  modal.querySelector<HTMLSelectElement>('.insight-interest-select')?.addEventListener('change', e => {
    const select = e.currentTarget as HTMLSelectElement;
    const newId = validateInterestId(select.value);
    const u = getCachedUser();
    const entry = u?.insights.find(i => i.id === id);
    if (!u || !entry) return;
    const previous = entry.interestId;
    entry.interestId = newId;
    try {
      saveUser(u);
      dispatch('dg:insights:updated', { id });
      showToast('분야를 변경했어요');
    } catch (err) {
      // 양방향 rollback: in-memory + UI (select.value)
      entry.interestId = previous;
      select.value = previous;
      showToast(getSaveErrorMessage(err));
    }
  });

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
