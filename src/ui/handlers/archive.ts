/**
 * Archive tab handlers.
 * - dg:archive:filter { filter } + dg:archive:search + dg:archive:period-change (v3.2 stub)
 * - Direct click on each archive-card for detail modal (no event)
 */

import { on } from '../events';
import { loadAnswers, saveAnswers, deleteAnswerById, deleteAnswersByIds } from '../../state/persistence';
import { loadBriefings, saveBriefings, toggleScrap } from '../../state/briefings';
import { openModal, closeModal } from '../modals/shared';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast, showUndoToast } from '../../utils/toast';
import { toKoType } from '../../utils/typeLabel';
import { getSaveErrorMessage } from '../../state/user';
import { MSG } from '../messages';
import { KST_FMT_KO } from '../../utils/intl';
import { renderBriefingCard } from './home';
import type { Answer } from '../../state/schema';
import { fireArchiveRevisitTrigger } from './missions-triggers';
import { getKSTDateIso } from '../../state/missionEngine';

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
  // 답변 vs scrap 분기 — selectedIds는 단일 Set, 필터 잠금으로 mixed 불가 (T5)
  const id = card.dataset['answerId'] ?? card.dataset['briefingId'];
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

  // 필터 chip 잠금 (T5 신설) — active 외 chip을 disabled + aria-disabled
  // selectedIds 단일 Set 정책상 답변/scrap 혼합 선택을 차단하기 위함
  document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((chip) => {
    const isActive = chip.dataset['filter'] === currentFilter;
    if (isActive) {
      chip.disabled = false;
      chip.removeAttribute('aria-disabled');
    } else {
      chip.disabled = selectMode;
      if (selectMode) chip.setAttribute('aria-disabled', 'true');
      else chip.removeAttribute('aria-disabled');
    }
  });

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

  // scrap 벌크 분기 (T5 신설)
  if (currentFilter === 'scrap') {
    if (!window.confirm(MSG.SCRAP_BULK_CONFIRM(n))) return;
    const ids = [...selectedIds];
    const briefings = loadBriefings();
    const snapshotIds = briefings
      .filter((b) => ids.includes(b.id) && b.scrapped)
      .map((b) => b.id);
    try {
      // atomic single write — race-safe
      const next = briefings.map((b) =>
        ids.includes(b.id) ? { ...b, scrapped: false } : b
      );
      saveBriefings(next);
    } catch (err) {
      showToast(getSaveErrorMessage(err));
      return;
    }
    selectedIds.clear();
    selectMode = false;
    document.getElementById('archiveSelectToggle')?.setAttribute('aria-pressed', 'false');
    document.getElementById('archiveTab')?.classList.remove('archive--select-mode');
    document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((chip) => {
      chip.disabled = false;
      chip.removeAttribute('aria-disabled');
    });
    rerenderList();
    updateBulkButton();
    showUndoToast({
      message: MSG.SCRAP_BULK_UNDO_TOAST(n),
      actionLabel: MSG.DELETE_UNDO_ACTION,
      onUndo: () => {
        try {
          const cur = loadBriefings();
          const restored = cur.map((b) =>
            snapshotIds.includes(b.id) ? { ...b, scrapped: true } : b
          );
          saveBriefings(restored);
          rerenderList();
          showToast(MSG.SCRAP_UNDO_RESTORED);
        } catch {
          showToast(MSG.DELETE_UNDO_FAILED);
        }
      },
    });
    return;
  }

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
  // 필터 chip 복원 (T5 신설)
  document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((chip) => {
    chip.disabled = false;
    chip.removeAttribute('aria-disabled');
  });
  rerenderList();
  updateBulkButton();
  showUndoToast({
    message: MSG.DELETE_UNDO_TOAST,
    actionLabel: MSG.DELETE_UNDO_ACTION,
    onUndo: () => {
      try {
        saveAnswers([...snapshot, ...loadAnswers()]);
        rerenderList();
        showToast(MSG.DELETE_UNDO_RESTORED);
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

  // v3.11 T7 — 답변 카드 → dedicated read-only answer-detail modal (dynamic import for chunk split)
  if (card.classList.contains('archive-card--answer')) {
    const id = card.dataset['answerId'];
    if (!id) return;
    const answer = loadAnswers().find((a) => a.id === id);
    if (!answer) return;
    void import('../modals/answer-detail').then(({ openAnswerDetail }) => {
      openAnswerDetail(answer);
    });
    // T10: archive-revisit mission trigger — 하루 1회 dedup (KST 기준)
    const todayKey = `archive-revisit-fired-${getKSTDateIso(new Date())}`;
    if (!sessionStorage.getItem(todayKey)) {
      try {
        fireArchiveRevisitTrigger();           // saveUser 내부 호출 — 성공 후에만 flag 세팅
        sessionStorage.setItem(todayKey, '1');
      } catch (err) {
        showToast(getSaveErrorMessage(err));   // Quota 등 저장 실패 시 토스트, 재시도 허용
      }
    }
    return;
  }

  // scrap 카드 분기 (T4 신설) — data-briefing-id 기반 delegation
  if (card.classList.contains('archive-card--scrap')) {
    const briefingId = card.dataset['briefingId'];
    const briefing = loadBriefings().find((b) => b.id === briefingId);
    if (briefing) showArchiveDetail({ kind: 'briefing', briefing });
    return;
  }
}

function handleCardDeleteClick(e: Event): void {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.archive-card-delete');
  if (!btn) return;
  // 선택 모드에서는 ✕ 비활성 (CSS hide와 별개로 JS 가드 — defense in depth)
  // FOUC/키보드/CSS-off/향후 CSS 변경에서도 confirm-less 단건 삭제를 차단
  if (selectMode) return;
  e.stopPropagation(); // detail 모달 진입 막기
  const card = btn.closest<HTMLElement>('.archive-card');
  if (!card) return;

  const answerId = card.dataset['answerId'];
  if (answerId) {
    const snapshot = loadAnswers().find((a) => a.id === answerId);
    if (!snapshot) return;

    try {
      deleteAnswerById(answerId);
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
          saveAnswers([snapshot, ...loadAnswers()]);
          rerenderList();
          showToast(MSG.DELETE_UNDO_RESTORED);
        } catch {
          showToast(MSG.DELETE_UNDO_FAILED);
        }
      },
    });
    return;
  }

  // scrap 카드 분기 (T5 신설) — toggleScrap → SCRAP_UNDO_TOAST
  if (card.classList.contains('archive-card--scrap')) {
    const briefingId = card.dataset['briefingId'];
    if (!briefingId) return;
    const briefings = loadBriefings();
    const idx = briefings.findIndex((b) => b.id === briefingId);
    if (idx < 0) return;

    try {
      toggleScrap(idx);
    } catch (err) {
      showToast(getSaveErrorMessage(err));
      return;
    }

    rerenderList();
    showUndoToast({
      message: MSG.SCRAP_UNDO_TOAST,
      actionLabel: MSG.DELETE_UNDO_ACTION,
      onUndo: () => {
        try {
          const cur = loadBriefings();
          const i = cur.findIndex((b) => b.id === briefingId);
          if (i >= 0 && !cur[i]!.scrapped) toggleScrap(i);
          rerenderList();
          showToast(MSG.SCRAP_UNDO_RESTORED);
        } catch {
          showToast(MSG.DELETE_UNDO_FAILED);
        }
      },
    });
  }
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

  // v3.27 T2a: insights tab 폐기 — dg:insights:* listener 흡수, archive re-render.
  on('dg:insights:added', () => rerenderList());
  on('dg:insights:removed', () => rerenderList());
  on('dg:insights:updated', () => rerenderList());

  // v3.27 T2a: archive insight card click → openInsightDetailModal (insights tab 흡수).
  document.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.archive-insight-card');
    if (!card) return;
    const id = card.dataset['insightId'];
    if (id) {
      void import('../modals/insight-detail').then(m => m.openInsightDetailModal(id));
    }
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

/**
 * v3.11 T6 — 답변 카드 풍부 layout.
 * 헤더(유형 칩 + 날짜 + ✕) + 질문 1줄 preview + 본문(CSS line-clamp 3).
 * questionText 없는 (이전 버전) 답변은 muted '질문 정보 없음' 으로 graceful degrade.
 */
function renderAnswerCard(a: Answer): HTMLElement {
  const card = document.createElement('article');
  card.className = 'archive-card archive-card--answer';
  card.dataset['answerId'] = a.id;

  // Header: 유형 칩 + 날짜 + ✕
  const header = document.createElement('div');
  header.className = 'archive-card-header';

  if (a.type) {
    const chip = document.createElement('span');
    chip.className = 'archive-type-chip';
    chip.textContent = toKoType(a.type);
    header.append(chip);
  }

  const date = document.createElement('time');
  date.className = 'archive-date';
  date.textContent = a.date ?? (a.createdAt ? KST_FMT_KO.format(new Date(a.createdAt)) : ''); // v3.26 T1b: KST anchor
  header.append(date);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'archive-card-delete';
  deleteBtn.type = 'button';
  deleteBtn.setAttribute('aria-label', '답변 삭제');
  deleteBtn.textContent = '×';
  header.append(deleteBtn);

  card.append(header);

  // Question preview (1줄)
  const q = document.createElement('p');
  if (a.questionText) {
    q.className = 'archive-card-question';
    q.textContent = `❓ ${a.questionText}`;
  } else {
    q.className = 'archive-card-question archive-card-question--missing';
    q.textContent = '질문 정보 없음 (이전 버전 답변)';
  }
  card.append(q);

  // Answer body (CSS line-clamp 3 — JS truncation 안 함)
  const body = document.createElement('p');
  body.className = 'archive-card-body';
  body.textContent = a.text;
  card.append(body);

  return card;
}

export function rerenderList(): void {
  const list = document.getElementById('archiveList');
  if (!list) return;
  list.replaceChildren();

  const answers = loadAnswers();
  const briefings = loadBriefings();

  // v3.20.1 H4: scrap 카드 렌더링 helper (idx-bound handler 제거 + ✕ 버튼 부착).
  // 'scrap' 필터 + 'all' 필터(통합) 둘 다 사용.
  function appendScrapCard(b: typeof briefings[number]): void {
    const card = renderBriefingCard(b, 0);
    card.classList.add('archive-card', 'archive-card--scrap');
    // renderBriefingCard registers idx-based handlers (setRead/toggleScrap/openMemoModal) where
    // idx indexes home's full briefings list. In archive's filtered subset, idx mismatches —
    // strip card-actions + replace link to drop listeners.
    card.querySelector('.card-actions')?.remove();
    const oldLink = card.querySelector<HTMLAnchorElement>('.card-main');
    if (oldLink) {
      const newLink = oldLink.cloneNode(true) as HTMLAnchorElement;
      oldLink.replaceWith(newLink);
    }
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'archive-card-delete';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', '스크랩 해제');
    deleteBtn.textContent = '×';
    card.append(deleteBtn);
    list!.append(card);
  }

  if (currentFilter === 'scrap') {
    const scrapped = briefings.filter((b) => b.scrapped);
    if (scrapped.length === 0) {
      list.textContent = '아직 스크랩한 기사가 없어요.';
      return;
    }
    scrapped.forEach((b) => appendScrapCard(b));
    return;
  }

  // v3.20.1 H4: '전체' 필터는 answers + scrapped briefings 통합 (사용자 의도).
  // type 필터(분석/전환/실무/성장/트렌드)는 answers만 — briefing은 type 없음.
  if (currentFilter === 'all') {
    const scrapped = briefings.filter((b) => b.scrapped);
    type Entry =
      | { kind: 'answer'; answer: typeof answers[number]; sortKey: string }
      | { kind: 'scrap'; briefing: typeof briefings[number]; sortKey: string };

    let entries: Entry[] = [
      ...answers.map((a) => ({ kind: 'answer' as const, answer: a, sortKey: a.createdAt })),
      ...scrapped.map((b) => ({ kind: 'scrap' as const, briefing: b, sortKey: b.date })),
    ];

    if (currentQuery) {
      entries = entries.filter((e) =>
        e.kind === 'answer'
          ? e.answer.text.toLowerCase().includes(currentQuery)
          : (e.briefing.title?.toLowerCase().includes(currentQuery) ?? false) ||
            (e.briefing.summary?.toLowerCase().includes(currentQuery) ?? false),
      );
    }

    if (entries.length === 0) {
      list.textContent = '아직 답변이나 스크랩한 기록이 없어요.';
      return;
    }

    // newest first — ISO datetime + YYYY-MM-DD 둘 다 lexicographic 정렬 호환
    entries.sort((x, y) => y.sortKey.localeCompare(x.sortKey));

    for (const e of entries) {
      if (e.kind === 'answer') list.append(renderAnswerCard(e.answer));
      else appendScrapCard(e.briefing);
    }
    return;
  }

  // type 분기 (분석/전환/실무/성장/트렌드) — answers만
  let filtered = answers.filter((a) => (a.type ?? '').includes(currentFilter));
  if (currentQuery) {
    filtered = filtered.filter((a) => a.text.toLowerCase().includes(currentQuery));
  }

  if (filtered.length === 0) {
    list.textContent = '조건에 맞는 기록이 없어요.';
    return;
  }

  for (const a of filtered) {
    list.append(renderAnswerCard(a));
  }
}

type DetailPayload =
  | { kind: 'answer'; answer: ReturnType<typeof loadAnswers>[number] }
  | { kind: 'briefing'; briefing: ReturnType<typeof loadBriefings>[number] };

function showArchiveDetail(payload: DetailPayload): void {
  const parts: string[] = [];
  if (payload.kind === 'answer') {
    const a = payload.answer;
    const when = a.date ?? (a.createdAt ? KST_FMT_KO.format(new Date(a.createdAt)) : ''); // v3.26 T1b: KST anchor
    parts.push(`<div class="archive-detail-meta">${escapeHtml(when)}${a.type ? ` · ${escapeHtml(toKoType(a.type))}` : ''}</div>`);
    parts.push(`<div class="archive-detail-body">${escapeHtml(a.text).replace(/\n/g, '<br>')}</div>`);
    if (a.evaluation) {
      parts.push(`<div class="archive-detail-eval">AI 평가 ${a.evaluation.score}점 — ${escapeHtml(a.evaluation.feedback)}</div>`);
    }
  } else {
    const b = payload.briefing;
    parts.push(`<div class="archive-detail-meta">${escapeHtml(b.date)} — 스크랩 기사</div>`);
    parts.push(`<a class="archive-detail-link" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title)}</a>`);
    parts.push(`<div class="archive-detail-body">${escapeHtml(b.summary)}</div>`);
    if (b.memo) parts.push(`<div class="archive-detail-memo">📝 ${escapeHtml(b.memo)}</div>`);
  }
  openModal({ title: '기록 상세', bodyHtml: parts.join('') });
  void closeModal; // referenced so eslint doesn't flag the import
}
