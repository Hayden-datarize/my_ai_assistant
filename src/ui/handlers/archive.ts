/**
 * Archive tab handlers.
 * - dg:archive:filter { filter } + dg:archive:search + dg:archive:period-change (v3.2 stub)
 * - Direct click on each archive-card for detail modal (no event)
 */

import { on } from '../events';
import { loadAnswers, appendAnswer, deleteAnswerById, deleteAnswersByIds } from '../../state/persistence';
import { loadBriefings } from '../../state/briefings';
import { openModal, closeModal } from '../modals/shared';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast, showUndoToast } from '../../utils/toast';
import { toKoType } from '../../utils/typeLabel';
import { getSaveErrorMessage } from '../../state/user';
import { MSG } from '../messages';

let currentFilter = 'all';
let currentQuery = '';

// 선택 모드 상태
const selectedIds = new Set<string>();
let selectMode = false;

function updateBulkButton(): void {
  const bulk = document.getElementById('archiveBulkDelete') as HTMLButtonElement | null;
  if (!bulk) return;
  bulk.disabled = selectedIds.size === 0;
  bulk.textContent = `선택 항목 삭제 (${selectedIds.size})`;
}

function handleCardClickInSelectMode(e: Event): void {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.archive-card');
  if (!card) return;
  // ✕ 버튼 클릭 시 선택 모드 토글 건너뜀 — document-level 핸들러가 처리
  if ((e.target as HTMLElement).closest('.archive-card-delete')) return;
  e.stopPropagation();
  const id = card.dataset['answerId'];
  if (!id) return;
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    card.classList.remove('selected');
  } else {
    selectedIds.add(id);
    card.classList.add('selected');
  }
  updateBulkButton();
}

function handleSelectToggle(): void {
  selectMode = !selectMode;
  const toggle = document.getElementById('archiveSelectToggle');
  toggle?.setAttribute('aria-pressed', String(selectMode));
  document.getElementById('archiveTab')?.classList.toggle('archive--select-mode', selectMode);
  if (!selectMode) {
    selectedIds.clear();
    document.querySelectorAll('.archive-card.selected').forEach((c) =>
      c.classList.remove('selected')
    );
  }
  updateBulkButton();
}

function handleBulkDeleteClick(): void {
  const n = selectedIds.size;
  if (n === 0) return;
  if (!window.confirm(MSG.DELETE_CONFIRM_BULK(n))) return;
  const ids = [...selectedIds];
  const snapshot = loadAnswers().filter((a) => selectedIds.has(a.id));
  try {
    deleteAnswersByIds(ids);
  } catch (err) {
    showToast(getSaveErrorMessage(err));
    return;
  }
  selectedIds.clear();
  selectMode = false;
  document.getElementById('archiveSelectToggle')?.setAttribute('aria-pressed', 'false');
  document.getElementById('archiveTab')?.classList.remove('archive--select-mode');
  rerenderList();
  updateBulkButton();
  showUndoToast({
    message: MSG.DELETE_UNDO_TOAST,
    actionLabel: MSG.DELETE_UNDO_ACTION,
    onUndo: () => {
      try {
        snapshot.forEach((a) => appendAnswer(a));
        rerenderList();
      } catch {
        showToast(MSG.DELETE_UNDO_FAILED);
      }
    },
  });
}

/** 카드 클릭 — 이벤트 위임 (populateList + rerenderList 모두 커버) */
function handleCardClick(e: Event): void {
  // ✕ 버튼은 handleCardDeleteClick에서 처리
  if ((e.target as HTMLElement).closest('.archive-card-delete')) return;

  const card = (e.target as HTMLElement).closest<HTMLElement>('.archive-card');
  if (!card) return;

  if (selectMode) {
    handleCardClickInSelectMode(e);
    return;
  }

  const id = card.dataset['answerId'];
  if (id) {
    const answer = loadAnswers().find((a) => a.id === id);
    if (answer) showArchiveDetail({ kind: 'answer', answer });
    return;
  }

  // briefing 카드는 data-answer-id 없음 — per-card listener가 처리하도록 여기서는 무시
}

function handleCardDeleteClick(e: Event): void {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.archive-card-delete');
  if (!btn) return;
  // 선택 모드에서는 ✕ 비활성 (CSS hide와 별개로 JS 가드 — defense in depth)
  // FOUC/키보드/CSS-off/향후 CSS 변경에서도 confirm-less 단건 삭제를 차단
  if (selectMode) return;
  e.stopPropagation(); // detail 모달 진입 막기
  const card = btn.closest<HTMLElement>('.archive-card');
  const id = card?.dataset['answerId'];
  if (!id) return;

  const snapshot = loadAnswers().find((a) => a.id === id);
  if (!snapshot) return;

  try {
    deleteAnswerById(id);
  } catch (err) {
    showToast(getSaveErrorMessage(err));
    return;
  }

  rerenderList();
  showUndoToast({
    message: MSG.DELETE_UNDO_TOAST,
    actionLabel: MSG.DELETE_UNDO_ACTION,
    onUndo: () => {
      try {
        appendAnswer(snapshot);
        rerenderList();
      } catch {
        showToast(MSG.DELETE_UNDO_FAILED);
      }
    },
  });
}

export function mountArchiveHandlers(): void {
  // archive 카드 ✕ 버튼 클릭 — 이벤트 위임
  document.addEventListener('click', handleCardDeleteClick);

  // archive 카드 클릭 — 이벤트 위임 (선택 모드 + detail 모달)
  document.addEventListener('click', handleCardClick);

  // 선택 모드 토글 버튼 — 이벤트 위임 (archive 탭 렌더 전에 mount되므로)
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#archiveSelectToggle')) handleSelectToggle();
  });

  // 벌크 삭제 버튼 — 이벤트 위임
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#archiveBulkDelete')) handleBulkDeleteClick();
  });

  on('dg:archive:filter', ({ filter }) => {
    currentFilter = filter;
    rerenderList();
    // mark active chip
    document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset['filter'] === filter);
    });
  });

  on('dg:archive:search', () => {
    const input = document.getElementById('archiveSearch') as HTMLInputElement | null;
    currentQuery = (input?.value ?? '').trim().toLowerCase();
    rerenderList();
  });

  on('dg:archive:period-change', () => {
    showToast('기간 필터는 v3.2에서 준비 중입니다');
  });

  on('dg:nav:tab-changed', ({ tab }) => {
    if (tab === 'archive') hydrateArchive();
  });
}

export function hydrateArchive(): void {
  // Called after the archive tab renders. Re-apply current filter/search state.
  rerenderList();
  // Restore chip selection
  document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset['filter'] === currentFilter);
  });
}

export function rerenderList(): void {
  const list = document.getElementById('archiveList');
  if (!list) return;
  list.replaceChildren();

  const answers = loadAnswers();
  const briefings = loadBriefings();

  if (currentFilter === 'scrap') {
    const scrapped = briefings.filter((b) => b.scrapped);
    if (scrapped.length === 0) {
      list.textContent = '아직 스크랩한 기사가 없어요.';
      return;
    }
    for (const b of scrapped) {
      const card = document.createElement('article');
      card.className = 'archive-card';
      const date = document.createElement('div');
      date.className = 'archive-date';
      date.textContent = b.date;
      const title = document.createElement('div');
      title.className = 'archive-text';
      title.textContent = `⭐ ${b.title}`;
      const summary = document.createElement('div');
      summary.className = 'archive-summary';
      summary.textContent = b.summary;
      card.append(date, title, summary);
      card.addEventListener('click', () => showArchiveDetail({ kind: 'briefing', briefing: b }));
      list.append(card);
    }
    return;
  }

  let filtered = answers;
  if (currentFilter !== 'all') {
    filtered = filtered.filter((a) => (a.type ?? '').includes(currentFilter));
  }
  if (currentQuery) {
    filtered = filtered.filter((a) => a.text.toLowerCase().includes(currentQuery));
  }

  if (filtered.length === 0) {
    list.textContent = '조건에 맞는 기록이 없어요.';
    return;
  }

  for (const a of filtered) {
    const card = document.createElement('article');
    card.className = 'archive-card';
    card.dataset['answerId'] = a.id;
    const date = document.createElement('div');
    date.className = 'archive-date';
    const dateText = a.date ?? (a.createdAt ? new Date(a.createdAt).toLocaleDateString('ko-KR') : '');
    date.textContent = dateText;
    const body = document.createElement('div');
    body.className = 'archive-text';
    body.textContent = a.text.length > 140 ? `${a.text.slice(0, 140)}…` : a.text;
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'archive-card-delete';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', '답변 삭제');
    deleteBtn.textContent = '×';
    card.append(date, body, deleteBtn);
    if (a.type) {
      const tag = document.createElement('span');
      tag.className = 'archive-type';
      tag.textContent = toKoType(a.type);
      card.append(tag);
    }
    // 카드 클릭은 document-level 이벤트 위임(handleCardClick)이 처리
    list.append(card);
  }
}

type DetailPayload =
  | { kind: 'answer'; answer: ReturnType<typeof loadAnswers>[number] }
  | { kind: 'briefing'; briefing: ReturnType<typeof loadBriefings>[number] };

function showArchiveDetail(payload: DetailPayload): void {
  const parts: string[] = [];
  if (payload.kind === 'answer') {
    const a = payload.answer;
    const when = a.date ?? (a.createdAt ? new Date(a.createdAt).toLocaleDateString('ko-KR') : '');
    parts.push(`<div class="archive-detail-meta">${escapeHtml(when)}${a.type ? ` · ${escapeHtml(toKoType(a.type))}` : ''}</div>`);
    parts.push(`<div class="archive-detail-body">${escapeHtml(a.text).replace(/\n/g, '<br>')}</div>`);
    if (a.evaluation) {
      parts.push(`<div class="archive-detail-eval">AI 평가 ${a.evaluation.score}점 — ${escapeHtml(a.evaluation.feedback)}</div>`);
    }
  } else {
    const b = payload.briefing;
    parts.push(`<div class="archive-detail-meta">${escapeHtml(b.date)} — 스크랩 기사</div>`);
    parts.push(`<a class="archive-detail-link" href="${escapeHtml(b.url)}" target="_blank" rel="noopener">${escapeHtml(b.title)}</a>`);
    parts.push(`<div class="archive-detail-body">${escapeHtml(b.summary)}</div>`);
    if (b.memo) parts.push(`<div class="archive-detail-memo">📝 ${escapeHtml(b.memo)}</div>`);
  }
  openModal({ title: '기록 상세', bodyHtml: parts.join('') });
  void closeModal; // referenced so eslint doesn't flag the import
}
