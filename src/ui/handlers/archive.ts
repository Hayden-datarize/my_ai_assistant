/**
 * Archive tab handlers.
 * - v3.31 C7: dg:* listeners live in archive-listeners.ts and lazy-call exported
 *   callbacks here. mountArchiveHandlers() owns archive DOM delegation only.
 * - Direct click on each archive-card for detail modal (no event)
 */

import { loadAnswers, saveAnswers, deleteAnswerById, deleteAnswersByIds } from '../../state/persistence';
import { loadBriefings, saveBriefings, toggleScrap } from '../../state/briefings';
import { openModal } from '../modals/shared';
import { escapeHtml } from '../../utils/escapeHtml';
import { highlightHtml } from '../../utils/highlight';
import { matchesAllTokens, tokenizeQuery, fuzzyMatchesToken } from '../../utils/fuzzy';
import { scoreEntry } from '../../utils/ranking';
import { sortPinThenScoreDesc } from '../../utils/archiveSort';
import { showToast, showUndoToast } from '../../utils/toast';
import { toKoType } from '../../utils/typeLabel';
import { getSaveErrorMessage, getCachedUser, saveUser, type Insight } from '../../state/user';
import { MSG } from '../messages';
import { KST_FMT_KO } from '../../utils/intl';
import { renderBriefingCard } from './home';
import type { Answer } from '../../state/schema';
import { fireArchiveRevisitTrigger } from './missions-triggers';
import { getKSTDateIso } from '../../state/missionEngine';

let currentFilter = 'all';
// v3.32 T3 (Codex 사전 P0-2): currentQuery 제거 — SoT 일원화.
// ESLint no-unused-vars: error로 write-only state는 lint fail.
let currentTokens: string[] = [];
// v3.27 T2b (Codex 사전 P0-4): 1차 entity chip state — 'all' | 'answer' | 'scrap' | 'insight'.
// scrap 분기는 currentFilter === 'scrap' (data-filter)에서 currentEntity === 'scrap'으로 전면 이전.
type EntityFilter = 'all' | 'answer' | 'scrap' | 'insight';
let currentEntity: EntityFilter = 'all';

// v3.30 T2 review fix (P1): mountArchiveHandlers double-mount 가드.
// Production 단일 호출 (main.ts) — test가 여러 번 mount 시 listener 중복 등록 방지.
// `on()` helper는 호출마다 fresh wrapped closure를 allocate하므로 removeEventListener로 dedupe 불가.
let __archiveMounted = false;

/**
 * v3.30 T2 review fix: test 격리용 reset helper.
 * - guard flag만 reset. 등록된 wrapped closure ref 보존 X (해제 불가).
 * - vitest 기본 jsdom 환경은 spec마다 fresh document를 제공하지 않으므로
 *   동일 module instance 내 mount 반복 시 listener가 누적될 수 있다.
 *   본 helper는 mount 가드만 reset하고, 누적 listener는 module 캐시 무효화
 *   (vi.resetModules) 또는 spec 격리(jsdom file-level)에 의존한다.
 */
export function resetArchiveHandlersForTest(): void {
  __archiveMounted = false;
}

/**
 * v3.30 T2: entity별 count single source-of-truth (R7).
 * - answers: persistence (loadAnswers().length)
 * - scrap: briefings.filter(b => b.scrapped).length
 * - insight: getCachedUser()?.insights ?? []
 * - cachedUser null 시 insight = 0 (silent corruption guard, P0 v3.13/v3.27 graduated).
 */
export function getEntityCounts(): Record<EntityFilter, number> {
  const answer = loadAnswers().length;
  const scrap = loadBriefings().filter((b) => b.scrapped).length;
  const insight = getCachedUser()?.insights.length ?? 0;
  return { all: answer + scrap + insight, answer, scrap, insight };
}

/**
 * v3.30 T2: DOM data-entity-count span 4개 textContent 갱신 (chip row 재생성 X).
 * - counts 인자 생략 시 getEntityCounts() 자동 호출.
 * - data-entity-count span 없는 DOM (chip row 첫 렌더 전) 에서는 silent no-op.
 */
export function refreshEntityCounts(counts?: Record<EntityFilter, number>): void {
  const c = counts ?? getEntityCounts();
  document.querySelectorAll<HTMLElement>('[data-entity-count]').forEach((el) => {
    const id = el.getAttribute('data-entity-count') as EntityFilter | null;
    if (id && c[id] !== undefined) el.textContent = String(c[id]);
  });
}

export function handleArchiveFilter(filter: string): void {
  currentFilter = filter;
  rerenderList();
  document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset['filter'] === filter);
  });
}

export function handleArchiveSearch(): void {
  const input = document.getElementById('archiveSearch') as HTMLInputElement | null;
  currentTokens = tokenizeQuery(input?.value ?? '');
  rerenderList();
}

export function handleArchivePeriodChange(): void {
  showToast('기간 필터는 v3.2에서 준비 중입니다');
}

export function handleArchiveUpdated(): void {
  refreshEntityCounts();
  rerenderList();
}

export function handleInsightsChanged(): void {
  rerenderList();
}

// 선택 모드 상태
const selectedIds = new Set<string>();
let selectMode = false;

/**
 * v3.27 T4: 3 entity unified 핀 토글.
 * - Codex 사전 P0-2: scrap pin은 loadBriefings → mutate → saveBriefings (briefings storage anchor)
 * - Codex 사전 P0-3: answer pin은 loadAnswers → mutate → saveAnswers (answers storage anchor, single-write)
 * - insight pin은 User.insights[] mutate → saveUser (user storage anchor, v3.7 throw 패턴)
 * - 비-소유 id → no-op + console.warn (silent fail 방지)
 * - save throw 시 toast + early-return (이벤트 emit 안 함, v3.12 false-fire invariant 정합)
 */
export type PinEntity = 'answer' | 'scrap' | 'insight';

export function togglePin(entity: PinEntity, id: string): void {
  if (entity === 'insight') {
    const user = getCachedUser();
    if (!user) {
      console.warn(`[v3.27 T4] togglePin insight: cached user 없음`);
      return;
    }
    const insight = user.insights.find((i) => i.id === id);
    if (!insight) {
      console.warn(`[v3.27 T4] togglePin insight id=${id} not found`);
      return;
    }
    insight.pinned = !insight.pinned;
    try { saveUser(user); }
    catch (err) { showToast(getSaveErrorMessage(err)); return; }
  } else if (entity === 'answer') {
    const answers = loadAnswers();
    const a = answers.find((x) => x.id === id);
    if (!a) { console.warn(`[v3.27 T4] togglePin answer id=${id} not found`); return; }
    a.pinned = !a.pinned;
    try { saveAnswers(answers); }
    catch (err) { showToast(getSaveErrorMessage(err)); return; }
  } else {
    const briefings = loadBriefings();
    const b = briefings.find((x) => x.id === id);
    if (!b) { console.warn(`[v3.27 T4] togglePin scrap id=${id} not found`); return; }
    b.pinned = !b.pinned;
    try { saveBriefings(briefings); }
    catch (err) { showToast(getSaveErrorMessage(err)); return; }
  }
  document.dispatchEvent(new CustomEvent('dg:archive:updated', { detail: { entity, id } }));
}

/** v3.27 T4: pin 토글 button DOM helper — renderAnswerCard / appendScrapCard / renderInsightCard 재사용. */
function makePinButton(entity: PinEntity, id: string, pinned: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'archive-pin-toggle';
  btn.type = 'button';
  btn.dataset['pinEntity'] = entity;
  btn.dataset['pinId'] = id;
  btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  btn.setAttribute('aria-label', pinned ? '핀 해제' : '핀 고정');
  btn.textContent = pinned ? '📌' : '📍';
  return btn;
}

function updateBulkButton(): void {
  const bulk = document.getElementById('archiveBulkDelete') as HTMLButtonElement | null;
  if (!bulk) return;
  bulk.disabled = selectedIds.size === 0;
  bulk.textContent = `선택 항목 삭제 (${selectedIds.size})`;
}

/**
 * v3.37 T1: archive module state + DOM chip ARIA 일괄 default('all') 복귀.
 * 진입점: counter-click handler / plant-detail navigateToInterestArchive (T2).
 *
 * Reset 대상:
 *   - currentFilter / currentTokens / currentEntity / selectedIds / selectMode
 *
 * DOM 동기화:
 *   - .archive-entity-chip → 'all'만 active + aria-checked='true'
 *   - .filter-chip → 'all'만 active + disabled=false (selectMode 중간 lock 해제)
 *   - #archiveFilters question type row → display='' (entity 'scrap'/'insight' 시 숨김 상태 복구)
 *   - #archiveSearch.value = '' (counter-click stale 검색 string + unfiltered list UI mismatch 차단, v3.37 T4 Codex 최종 P2 흡수)
 *   - #archiveSelectToggle aria-pressed='false'
 *   - #archiveTab .archive--select-mode 제거
 *   - .archive-card.selected 클래스 제거
 *
 * 명시적 호출 (v2 — Codex 사전 P1-1 흡수):
 *   - updateBulkButton() — selectedIds.clear() 직후. select mode 중간에 reset 진입 시
 *     "선택 항목 삭제 (N)" 버튼이 enabled+stale count 잔존 방지.
 *
 * 명시적 비-호출:
 *   - rerenderList() — caller가 명시 호출 (counter-click rerenderList / plant-action handleArchiveSearch).
 *
 * `__archiveMounted`는 reset 대상 아님 — mount 가드는 1회성.
 */
export function resetArchiveFilters(): void {
  // Module state
  currentFilter = 'all';
  currentTokens = [];
  currentEntity = 'all';
  selectedIds.clear();
  selectMode = false;

  // Entity chip ARIA
  document.querySelectorAll<HTMLButtonElement>('.archive-entity-chip').forEach((b) => {
    const active = b.dataset['entity'] === 'all';
    b.classList.toggle('active', active);
    b.setAttribute('aria-checked', active ? 'true' : 'false');
  });

  // Filter chip active + selectMode lock 해제
  document.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset['filter'] === 'all');
    chip.disabled = false;
    chip.removeAttribute('aria-disabled');
  });

  // Question type row 표시 복구 (entity 'scrap'/'insight'에서 display:none 상태 가능)
  const q = document.getElementById('archiveFilters');
  if (q) q.style.display = '';

  // v3.37 T4 (Codex 최종 P2): #archiveSearch DOM value 동기화 — module state currentTokens=[]와 동행.
  // counter-click 경로(plant-detail은 직후 input.value=keyword로 덮어씀)에서 stale 검색 string + unfiltered list UI mismatch 차단.
  const search = document.getElementById('archiveSearch') as HTMLInputElement | null;
  if (search) search.value = '';

  // Select mode UI 흔적 제거
  document.getElementById('archiveSelectToggle')?.setAttribute('aria-pressed', 'false');
  document.getElementById('archiveTab')?.classList.remove('archive--select-mode');
  document.querySelectorAll('.archive-card.selected').forEach((c) =>
    c.classList.remove('selected')
  );

  // v2 (Codex 사전 P1-1): bulk delete button 동기화 — selectedIds 비웠으니 disabled + count=0
  updateBulkButton();
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
  // v3.27 T2b (P0-4): currentFilter → currentEntity 이전 (entity chip 도입).
  if (currentEntity === 'scrap') {
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
  // v3.27 T4 (Codex P1-1): pin 토글 버튼 click은 card-level 액션 차단 (select 토글 / detail 모달 / scrap 토글).
  if ((e.target as HTMLElement).closest('.archive-pin-toggle')) return;

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
  // v3.30 T2 review fix (P1): double-mount 가드 — production main.ts 단일 호출에는 영향 없음.
  if (__archiveMounted) return;
  __archiveMounted = true;

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

  // v3.27 T4: pin 버튼 click — 이벤트 위임 (rerender 후 새 button에도 wiring 유지).
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.archive-pin-toggle');
    if (!btn) return;
    e.stopPropagation(); // card click delegate / select 모드 toggle 방지
    const entity = btn.dataset['pinEntity'] as PinEntity | undefined;
    const id = btn.dataset['pinId'];
    if (!entity || !id) return;
    togglePin(entity, id);
  });

  // v3.27 T4 → v3.37 T1: counter click → resetArchiveFilters() 진입점 통합.
  // plant-detail navigateToInterestArchive과 동일 reset 시맨틱 공유 (T2에서 추가).
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.other-pin-counter')) return;
    resetArchiveFilters();
    rerenderList();
  });

  // v3.27 T2a: archive insight card click → openInsightDetailModal (insights tab 흡수).
  document.addEventListener('click', (e) => {
    // v3.27 T4 (Codex P1-1): pin 토글 button click은 detail 모달 차단.
    if ((e.target as HTMLElement).closest('.archive-pin-toggle')) return;
    const card = (e.target as HTMLElement).closest<HTMLElement>('.archive-insight-card');
    if (!card) return;
    const id = card.dataset['insightId'];
    if (id) {
      void import('../modals/insight-detail').then(m => m.openInsightDetailModal(id));
    }
  });

  // v3.27 T2b: entity chip click — 1차 row [전체/답변/스크랩/인사이트].
  document.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.archive-entity-chip[data-entity]');
    if (!chip) return;
    const entity = chip.dataset['entity'] as EntityFilter | undefined;
    if (!entity) return;
    currentEntity = entity;
    // ARIA radiogroup state
    document.querySelectorAll<HTMLButtonElement>('.archive-entity-chip').forEach((b) => {
      const active = b.dataset['entity'] === entity;
      b.classList.toggle('active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    // 2차 question type row 조건부 노출 — entity ∈ {all, answer}만.
    const questionRow = document.getElementById('archiveFilters');
    if (questionRow) {
      const hide = entity === 'scrap' || entity === 'insight';
      questionRow.style.display = hide ? 'none' : '';
    }
    rerenderList();
  });

  // v3.27 T2b: onboarding banner dismiss — sessionStorage stamp + remove.
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('#archiveOnboardingDismiss')) return;
    sessionStorage.setItem('archive-relocated-seen', '1');
    document.getElementById('archiveRelocatedBanner')?.remove();
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

  // v3.27 T4: pin 토글 버튼 — delete 왼쪽
  header.append(makePinButton('answer', a.id, a.pinned));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'archive-card-delete';
  deleteBtn.type = 'button';
  deleteBtn.setAttribute('aria-label', '답변 삭제');
  deleteBtn.textContent = '×';
  header.append(deleteBtn);

  card.append(header);

  // Question preview (1줄)
  // v3.35 T2 (C2): questionText hit 시 <mark> highlight 적용 — body 와 동일 pattern.
  const q = document.createElement('p');
  if (a.questionText) {
    q.className = 'archive-card-question';
    if (currentTokens.length > 0) {
      // eslint-disable-next-line no-restricted-syntax -- highlightHtml escapeHtml + escapeRegex 적용, <mark> only inject
      q.innerHTML = `❓ ${highlightHtml(a.questionText, currentTokens)}`;
    } else {
      q.textContent = `❓ ${a.questionText}`;
    }
  } else {
    q.className = 'archive-card-question archive-card-question--missing';
    q.textContent = '질문 정보 없음 (이전 버전 답변)';
  }
  card.append(q);

  // Answer body (CSS line-clamp 3 — JS truncation 안 함)
  const body = document.createElement('p');
  body.className = 'archive-card-body';
  // v3.29 T2: 검색 활성 시 keyword <mark> highlight (XSS-safe helper)
  // v3.32 T3: currentTokens 직접 전달 (T2 임시 어댑테이션 정리)
  if (currentTokens.length > 0) {
    // eslint-disable-next-line no-restricted-syntax -- highlightHtml escapeHtml + escapeRegex 적용, <mark> only inject
    body.innerHTML = highlightHtml(a.text, currentTokens);
  } else {
    body.textContent = a.text;
  }
  card.append(body);

  return card;
}

/**
 * v3.27 T4: insight 카드 (rerenderList path — 핀 토글 후 re-render 필요).
 * populateList(tabs/archive.ts)도 동일 class/dataset 유지 — list.replaceChildren() 후 동일 모양.
 */
function renderInsightCard(i: Insight): HTMLElement {
  const card = document.createElement('article');
  card.className = 'archive-card archive-insight-card';
  card.dataset['insightId'] = i.id;

  const header = document.createElement('div');
  header.className = 'archive-card-header';
  const date = document.createElement('time');
  date.className = 'archive-date';
  date.textContent = KST_FMT_KO.format(new Date(i.createdAt));
  header.append(date);
  header.append(makePinButton('insight', i.id, i.pinned));
  card.append(header);

  const body = document.createElement('p');
  body.className = 'archive-card-body';
  // v3.29 T2: 검색 활성 시 keyword <mark> highlight (XSS-safe helper)
  // v3.32 T3: currentTokens 직접 전달
  if (currentTokens.length > 0) {
    // eslint-disable-next-line no-restricted-syntax -- highlightHtml escapeHtml + escapeRegex 적용, <mark> only inject
    body.innerHTML = highlightHtml(i.text, currentTokens);
  } else {
    body.textContent = i.text;
  }
  card.append(body);

  return card;
}

/** v3.27 T4: pinned-first → sortKey desc. Stable sort (Array.prototype.sort is stable since ES2019). */
function sortPinThenDesc<T>(items: T[], getPinned: (t: T) => boolean, getKey: (t: T) => string): T[] {
  return [...items].sort((a, b) => {
    const pinDelta = (getPinned(b) ? 1 : 0) - (getPinned(a) ? 1 : 0);
    if (pinDelta !== 0) return pinDelta;
    return getKey(b).localeCompare(getKey(a));
  });
}

/** v3.27 T4: 다른 카테고리 pin count — entity chip에 외부 entity의 pinned 항목 수. */
function computeOtherPinCount(entity: EntityFilter, answers: Answer[], scraps: ReturnType<typeof loadBriefings>, insights: Insight[]): number {
  if (entity === 'all') return 0;
  let count = 0;
  if (entity !== 'answer') count += answers.filter((a) => a.pinned).length;
  if (entity !== 'scrap') count += scraps.filter((b) => b.pinned).length;
  if (entity !== 'insight') count += insights.filter((i) => i.pinned).length;
  return count;
}

/** v3.27 T4: counter 렌더 — list 형제로 prepend (list.replaceChildren 영향 안 받음). */
function renderOtherPinCounter(count: number): void {
  document.querySelector('.other-pin-counter')?.remove();
  if (count === 0) return;
  const list = document.getElementById('archiveList');
  if (!list?.parentElement) return;
  const btn = document.createElement('button');
  btn.className = 'other-pin-counter';
  btn.type = 'button';
  btn.textContent = `다른 카테고리에 핀 ${count}개`;
  list.parentElement.insertBefore(btn, list);
}

/**
 * v3.38 T5b: archive 검색 fuzzy 통합 — exact match 0건 degrade fallback.
 *
 * - exact `matchesAllTokens` 우선 (성공 시 fuzzy 안 시도, degrade 우아).
 * - exact false + `useFuzzy=true` 면 per-record fuzzy 시도 (모든 token이 fuzzy match).
 * - 초성-only token은 `fuzzyMatchesToken` 내부에서 false → 자연스레 exact-only.
 *
 * caller는 `useFuzzy` 를 archive-wide guard (전체 pool ≤ 5000) 로 계산하여 전달.
 */
function matchesAllTokensFuzzy(text: string, tokens: string[], useFuzzy: boolean): boolean {
  if (matchesAllTokens(text, tokens)) return true;
  if (!useFuzzy) return false;
  return tokens.every((t) => fuzzyMatchesToken(text, t));
}

// v3.38 T5b: archive-wide pool guard (UI freeze 차단) — fuzzy 활성화 임계치.
const ARCHIVE_FUZZY_POOL_CAP = 5000;

export function rerenderList(): void {
  // v3.30 T7 P1 fix (Codex 최종 review): 모든 caller에서 chip count 자동 갱신.
  // 답변 단건/벌크 삭제, scrap 해제/undo, dg:insights:* 변경 후 stale 방지.
  // refreshEntityCounts는 data-entity-count span 없는 DOM에서 silent no-op (archive 탭 진입 전 안전).
  refreshEntityCounts();

  const list = document.getElementById('archiveList');
  if (!list) return;
  list.replaceChildren();

  const answers = loadAnswers();
  const briefings = loadBriefings();
  const scraps = briefings.filter((b) => b.scrapped);
  const insights = getCachedUser()?.insights ?? [];

  // v3.38 T5b (Codex 사전 P1-4): archive-wide guard — 전체 pool > 5000 이면 fuzzy off.
  // 한 번만 계산하여 4개 entity 분기에 동일하게 전달. UI freeze 차단.
  const useFuzzy = currentTokens.length > 0
    && (answers.length + scraps.length + insights.length) <= ARCHIVE_FUZZY_POOL_CAP;

  // v3.27 T4: counter (entity != 'all' 시 외부 pinned 가시화).
  renderOtherPinCounter(computeOtherPinCount(currentEntity, answers, scraps, insights));

  // v3.20.1 H4: scrap 카드 렌더링 helper (idx-bound handler 제거 + ✕ 버튼 부착).
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
    // v3.27 T4: pin 토글 버튼
    card.append(makePinButton('scrap', b.id, b.pinned));
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'archive-card-delete';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', '스크랩 해제');
    deleteBtn.textContent = '×';
    card.append(deleteBtn);
    list!.append(card);
  }

  // v3.27 T2b (P0-4): scrap entity branch.
  if (currentEntity === 'scrap') {
    let pool = scraps;
    if (currentTokens.length > 0) {
      // v3.32 T3 (Codex 사전 P1-3): title+summary 결합 검색 — 토큰이 두 필드에 나뉜 항목 false negative 차단.
      // v3.38 T4: title/summary는 Briefing interface상 required string — redundant `?? ''` 제거.
      // v3.38 T5b: exact match 0건 시 fuzzy fallback (archive-wide guard 적용).
      pool = pool.filter((b) =>
        matchesAllTokensFuzzy(`${b.title} ${b.summary}`, currentTokens, useFuzzy));
    }
    if (pool.length === 0) {
      list.textContent = '아직 스크랩한 기사가 없어요.';
      return;
    }
    // v3.34 T3: 검색 시 3-tier ranking (pinned > score > date), 미검색 시 기존 2-tier.
    if (currentTokens.length > 0) {
      sortPinThenScoreDesc(
        pool,
        (b) => b.pinned,
        // v3.38 T4: title/summary는 required string — `?? ''` 제거.
        (b) => scoreEntry(
          [{ text: b.title, weight: 2 }, { text: b.summary, weight: 1 }],
          currentTokens,
        ),
        (b) => b.date,
      ).forEach((b) => appendScrapCard(b));
    } else {
      sortPinThenDesc(pool, (b) => b.pinned, (b) => b.date).forEach((b) => appendScrapCard(b));
    }
    return;
  }

  // v3.27 T4: insight entity branch.
  if (currentEntity === 'insight') {
    let pool = insights;
    if (currentTokens.length > 0) {
      // v3.38 T5b: exact match 0건 시 fuzzy fallback (archive-wide guard 적용).
      pool = pool.filter((i) => matchesAllTokensFuzzy(i.text, currentTokens, useFuzzy));
    }
    if (pool.length === 0) {
      list.textContent = '아직 저장된 인사이트가 없어요.';
      return;
    }
    // v3.34 T3: 검색 시 3-tier ranking, 미검색 시 기존 2-tier.
    if (currentTokens.length > 0) {
      sortPinThenScoreDesc(
        pool,
        (i) => i.pinned,
        (i) => scoreEntry([{ text: i.text, weight: 1 }], currentTokens),
        (i) => i.createdAt,
      ).forEach((i) => list.append(renderInsightCard(i)));
    } else {
      sortPinThenDesc(pool, (i) => i.pinned, (i) => i.createdAt).forEach((i) => list.append(renderInsightCard(i)));
    }
    return;
  }

  // v3.27 T4: 'all' merge (answers + scraps + insights) — question chip 'all' 시.
  if (currentEntity === 'all' && currentFilter === 'all') {
    type Entry =
      | { kind: 'answer'; answer: Answer; sortKey: string; pinned: boolean }
      | { kind: 'scrap'; briefing: typeof briefings[number]; sortKey: string; pinned: boolean }
      | { kind: 'insight'; insight: Insight; sortKey: string; pinned: boolean };

    let entries: Entry[] = [
      ...answers.map((a) => ({ kind: 'answer' as const, answer: a, sortKey: a.createdAt, pinned: a.pinned })),
      ...scraps.map((b) => ({ kind: 'scrap' as const, briefing: b, sortKey: b.date, pinned: b.pinned })),
      ...insights.map((i) => ({ kind: 'insight' as const, insight: i, sortKey: i.createdAt, pinned: i.pinned })),
    ];

    if (currentTokens.length > 0) {
      // v3.34 T3: answer는 questionText+text 결합 (ranking weight 정합). briefing은 title+summary.
      // v3.38 T5b: 3 entity kind 각각 exact 0건 시 fuzzy fallback (per-record, archive-wide guard).
      entries = entries.filter((e) =>
        e.kind === 'answer'
          ? matchesAllTokensFuzzy(`${e.answer.questionText ?? ''} ${e.answer.text}`, currentTokens, useFuzzy)
          : e.kind === 'insight'
            ? matchesAllTokensFuzzy(e.insight.text, currentTokens, useFuzzy)
            // v3.38 T4: briefing.title/summary required → `?? ''` 제거.
            : matchesAllTokensFuzzy(`${e.briefing.title} ${e.briefing.summary}`, currentTokens, useFuzzy),
      );
    }

    if (entries.length === 0) {
      list.textContent = '아직 답변이나 스크랩한 기록이 없어요.';
      return;
    }

    // v3.34 T3: 검색 시 3-tier ranking (pinned > score > date), 미검색 시 기존 2-tier.
    const entryScore = (e: Entry): number => {
      if (e.kind === 'answer') {
        return scoreEntry(
          [{ text: e.answer.questionText ?? '', weight: 2 }, { text: e.answer.text, weight: 1 }],
          currentTokens,
        );
      }
      if (e.kind === 'insight') {
        return scoreEntry([{ text: e.insight.text, weight: 1 }], currentTokens);
      }
      // v3.38 T4: briefing.title/summary required → `?? ''` 제거.
      return scoreEntry(
        [{ text: e.briefing.title, weight: 2 }, { text: e.briefing.summary, weight: 1 }],
        currentTokens,
      );
    };

    const sorted = currentTokens.length > 0
      ? sortPinThenScoreDesc(entries, (e) => e.pinned, entryScore, (e) => e.sortKey)
      : sortPinThenDesc(entries, (e) => e.pinned, (e) => e.sortKey);
    for (const e of sorted) {
      if (e.kind === 'answer') list.append(renderAnswerCard(e.answer));
      else if (e.kind === 'insight') list.append(renderInsightCard(e.insight));
      else appendScrapCard(e.briefing);
    }
    return;
  }

  // answer entity (entity='answer' or 'all' with question chip != 'all') — type 분기.
  let filtered = answers;
  if (currentFilter !== 'all') filtered = filtered.filter((a) => (a.type ?? '').includes(currentFilter));
  if (currentTokens.length > 0) {
    // v3.34 T3: filter 대상에 questionText 결합 (ranking weight 활성화 정합).
    // v3.38 T5b: exact match 0건 시 fuzzy fallback (archive-wide guard 적용).
    filtered = filtered.filter((a) =>
      matchesAllTokensFuzzy(`${a.questionText ?? ''} ${a.text}`, currentTokens, useFuzzy));
  }

  if (filtered.length === 0) {
    list.textContent = '조건에 맞는 기록이 없어요.';
    return;
  }

  // v3.34 T3: 검색 시 3-tier ranking (pinned > score > date), 미검색 시 기존 2-tier.
  if (currentTokens.length > 0) {
    sortPinThenScoreDesc(
      filtered,
      (a) => a.pinned,
      (a) => scoreEntry(
        [{ text: a.questionText ?? '', weight: 2 }, { text: a.text, weight: 1 }],
        currentTokens,
      ),
      (a) => a.createdAt,
    ).forEach((a) => list.append(renderAnswerCard(a)));
  } else {
    sortPinThenDesc(filtered, (a) => a.pinned, (a) => a.createdAt).forEach((a) => list.append(renderAnswerCard(a)));
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
}
