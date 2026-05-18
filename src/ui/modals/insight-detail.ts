/**
 * 인사이트 detail 모달 — 전문 + 분야 dropdown + 작성일 + confirm 삭제 + archive nav chip.
 * Undo 미포함 (v3.8 답변 삭제와 차이 — 인사이트는 가벼운 entity).
 * v3.23 T9 (delete) / v3.25 T6 (분야 dropdown) / v3.38 T6 (archive nav chip + bodyNode migration).
 */
import { openModal, closeModal } from './shared';
import { getCachedUser, saveUser, getSaveErrorMessage, validateInterestId } from '../../state/user';
import { INTERESTS, getCategoryLabel } from '../../utils/categories';
import { showToast } from '../../utils/toast';
import { dispatch } from '../events';
import { KST_FMT_DATE } from '../../utils/intl';
import { navigateToInterestArchive } from './plant-detail';
import type { User, Insight } from '../../state/user';

/**
 * 인사이트 detail 모달을 열고 분야 변경 + 삭제 + archive 진입 wiring을 부착한다.
 * - dropdown 변경: saveUser 즉시 + dg:insights:updated dispatch + toast.
 *   saveUser throw 시 in-memory + select.value 양방향 rollback (v3.10 atomic).
 * - 삭제: confirm + saveUser + dg:insights:removed + closeModal + toast.
 * - archive nav chip (v3.38 T6): interestId valid 시 표시 → navigateToInterestArchive 재사용.
 * @param id - User.insights[] 내 Insight.id
 */
export function openInsightDetailModal(id: string): void {
  const user = getCachedUser();
  const insight = user?.insights.find(i => i.id === id);
  if (!user || !insight) return;

  const bodyNode = renderInsightDetailBody(insight);
  openModal({ title: '인사이트', bodyNode });

  attachListeners(bodyNode, user, id);
}

/**
 * v3.38 T6: bodyHtml → bodyNode 마이그 (v3.26 T7 xor union contract).
 * DOM API로 직접 생성 — escapeHtml 불요 (textContent 자체로 XSS 안전).
 * @internal — spec 검증용 export.
 */
export function renderInsightDetailBody(insight: Insight): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'insight-detail';

  // 1) 본문 (textContent 자체로 XSS 안전)
  const textP = document.createElement('p');
  textP.className = 'insight-detail-text';
  textP.textContent = insight.text;
  root.append(textP);

  // 2) meta block: 분야 dropdown + 작성일
  const meta = document.createElement('div');
  meta.className = 'insight-detail-meta';

  const label = document.createElement('label');
  label.className = 'insight-detail-interest';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = '분야:';
  label.append(labelSpan);

  const select = document.createElement('select');
  select.className = 'insight-interest-select';

  const unknownOpt = document.createElement('option');
  unknownOpt.value = 'unknown';
  unknownOpt.textContent = '📰 미분류';
  if (insight.interestId === 'unknown') unknownOpt.selected = true;
  select.append(unknownOpt);

  for (const i of INTERESTS) {
    const opt = document.createElement('option');
    opt.value = i.id;
    opt.textContent = getCategoryLabel(i.id);
    if (insight.interestId === i.id) opt.selected = true;
    select.append(opt);
  }
  label.append(select);
  meta.append(label);

  // v3.26 T1b: createdAt UTC ISO → KST 'YYYY-MM-DD' (KST_FMT_DATE Intl singleton).
  const dateP = document.createElement('p');
  dateP.className = 'insight-detail-date';
  dateP.textContent = KST_FMT_DATE.format(new Date(insight.createdAt));
  meta.append(dateP);

  root.append(meta);

  // 3) v3.38 T6: archive nav chip (interestId valid한 경우만).
  if (insight.interestId && insight.interestId !== 'unknown') {
    const navChip = document.createElement('button');
    navChip.type = 'button';
    navChip.className = 'insight-archive-nav-chip';
    navChip.textContent = '🔍 이 분야 다른 답변/스크랩 보기';
    navChip.setAttribute(
      'aria-label',
      `${getCategoryLabel(insight.interestId)} 분야 archive 탐색`,
    );
    root.append(navChip);
  }

  // 4) 삭제 버튼
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-danger insight-delete-btn';
  deleteBtn.textContent = '삭제';
  root.append(deleteBtn);

  return root;
}

function attachListeners(bodyNode: HTMLDivElement, user: User, id: string): void {
  // v3.25 T6: dropdown 분야 변경 wiring (atomic single-write — v3.10 graduated).
  bodyNode.querySelector<HTMLSelectElement>('.insight-interest-select')?.addEventListener('change', e => {
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

  // v3.38 T6: archive nav chip click → navigateToInterestArchive.
  // closure-bind 시점의 insight.interestId 사용 (chip 표시 조건이 valid 보장).
  bodyNode.querySelector<HTMLButtonElement>('.insight-archive-nav-chip')?.addEventListener('click', () => {
    const u = getCachedUser();
    const entry = u?.insights.find(i => i.id === id);
    if (!entry || !entry.interestId || entry.interestId === 'unknown') return;
    void navigateToInterestArchive(entry.interestId).catch(err => {
      console.warn('[insight-detail] navigate failed', err);
    });
  });

  bodyNode.querySelector<HTMLButtonElement>('.insight-delete-btn')?.addEventListener('click', () => {
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
