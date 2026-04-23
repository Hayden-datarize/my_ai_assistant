/**
 * Archive tab handlers.
 * - dg:archive:filter { filter } + dg:archive:search + dg:archive:period-change (v3.2 stub)
 * - Direct click on each archive-card for detail modal (no event)
 */

import { on } from '../events';
import { loadAnswers } from '../../state/persistence';
import { loadBriefings } from '../../state/briefings';
import { openModal, closeModal } from '../modals/shared';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast } from '../../utils/toast';
import { toKoType } from '../../utils/typeLabel';

let currentFilter = 'all';
let currentQuery = '';

export function mountArchiveHandlers(): void {
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

function rerenderList(): void {
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
    const date = document.createElement('div');
    date.className = 'archive-date';
    const dateText = a.date ?? (a.createdAt ? new Date(a.createdAt).toLocaleDateString('ko-KR') : '');
    date.textContent = dateText;
    const body = document.createElement('div');
    body.className = 'archive-text';
    body.textContent = a.text.length > 140 ? `${a.text.slice(0, 140)}…` : a.text;
    card.append(date, body);
    if (a.type) {
      const tag = document.createElement('span');
      tag.className = 'archive-type';
      tag.textContent = toKoType(a.type);
      card.append(tag);
    }
    card.addEventListener('click', () => showArchiveDetail({ kind: 'answer', answer: a }));
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
