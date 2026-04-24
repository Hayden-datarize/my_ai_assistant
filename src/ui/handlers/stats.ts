/**
 * Stats tab handlers.
 * - dg:stats:weekly-report + dg:stats:growth-analysis → v3.2 stubs
 * - hydrateStats populates levelCard / stat-grid / heatmap / badges from state
 * - Heatmap cells use direct click to open a day detail modal (no event)
 */

import { on } from '../events';
import { loadAnswers } from '../../state/persistence';
import { loadBriefings } from '../../state/briefings';
import { openModal } from '../modals/shared';
import { escapeHtml } from '../../utils/escapeHtml';
import { showToast } from '../../utils/toast';
import { toKoType } from '../../utils/typeLabel';
import { getDateStr } from '../../utils/dates';

const USER_STORAGE = 'user';

interface LegacyUser {
  name: string;
  streak: number;
  xp: number;
  level: number;
}

function loadUser(): LegacyUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE);
    return raw ? (JSON.parse(raw) as LegacyUser) : null;
  } catch { return null; }
}

const WEEKDAY_KO = ['월', '화', '수', '목', '금', '토', '일'];

// Use local-TZ date components (getDateStr) rather than toISOString().slice(0, 10).
// Answer dates are written by home.ts via getDateStr (local); if the heatmap read
// path used UTC slicing, non-UTC users near day boundaries would see answers
// shifted by a day or missing. Keep write + read on the same local-date key.
function isoKey(d: Date): string {
  return getDateStr(d);
}

function computeTotalAndStreak(counts: Map<string, number>, firstDay: Date, days: number): { total: number; streak: number } {
  let total = 0;
  let streak = 0;
  let longest = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() + i);
    const n = counts.get(isoKey(d)) ?? 0;
    total += n;
    if (n > 0) { streak += 1; if (streak > longest) longest = streak; }
    else { streak = 0; }
  }
  return { total, streak: longest };
}

function formatCellLabel(dateKey: string): string {
  const [, mm, dd] = dateKey.split('-');
  const d = new Date(`${dateKey}T00:00:00`);
  const wdIdx = (d.getDay() + 6) % 7;
  return `${Number(mm)}월 ${Number(dd)}일 (${WEEKDAY_KO[wdIdx]})`;
}

function setDefaultInfo(info: HTMLElement, total: number, streak: number): void {
  info.textContent = total === 0
    ? '아직 기록이 없어요. 첫 답변을 남겨보세요.'
    : `이번 주 포함 4주 · ${total}개 달성 · 최장 연속 ${streak}일`;
}

export function mountStatsHandlers(): void {
  on('dg:stats:weekly-report', () => showToast('주간 리포트는 v3.2에서 준비 중입니다'));
  on('dg:stats:growth-analysis', () => showToast('성장 분석은 v3.2에서 준비 중입니다'));

  on('dg:nav:tab-changed', ({ tab }) => {
    if (tab === 'stats') hydrateStats();
  });
}

export function hydrateStats(): void {
  hydrateLevelCard();
  hydrateStatGrid();
  hydrateHeatmap();
  hydrateBadges();
  hydrateCategoryBreakdown();
  hydrateGrowthSummary();
}

function hydrateLevelCard(): void {
  const user = loadUser();
  const icon = document.getElementById('levelIcon');
  const name = document.getElementById('levelName');
  const xpText = document.getElementById('levelXpText');
  const fill = document.getElementById('xpProgressFill');
  if (!user) return;

  const levels = [
    { icon: '🌱', name: '새싹', thresh: 0 },
    { icon: '🌿', name: '새잎', thresh: 100 },
    { icon: '🌳', name: '나무', thresh: 300 },
    { icon: '🌲', name: '숲', thresh: 600 },
    { icon: '🏔️', name: '산', thresh: 1000 },
    { icon: '🌌', name: '하늘', thresh: 2000 },
  ];
  const current = [...levels].reverse().find((l) => user.xp >= l.thresh) ?? levels[0]!;
  const next = levels.find((l) => l.thresh > user.xp);
  if (icon) icon.textContent = current.icon;
  if (name) name.textContent = current.name;
  if (next) {
    const pct = ((user.xp - current.thresh) / (next.thresh - current.thresh)) * 100;
    if (xpText) xpText.textContent = `${user.xp} / ${next.thresh} XP`;
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  } else {
    if (xpText) xpText.textContent = `${user.xp} XP · MAX`;
    if (fill) fill.style.width = '100%';
  }
}

function hydrateStatGrid(): void {
  const user = loadUser();
  const answers = loadAnswers();
  const briefings = loadBriefings();
  const scrapCount = briefings.filter((b) => b.scrapped).length;

  const setText = (id: string, val: string | number) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  setText('statStreak', user?.streak ?? 0);
  setText('statAnswers', answers.length);
  setText('statArticles', scrapCount);
  setText('statXp', user?.xp ?? 0);
}

function hydrateHeatmap(): void {
  const grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.replaceChildren();
  const info = document.getElementById('heatmapInfo');

  const answers = loadAnswers();
  const counts = new Map<string, number>();
  for (const a of answers) {
    // a.date is always local (via getDateStr in home.ts). Fallback: parse the
    // UTC createdAt timestamp back into a Date and format it in local TZ so
    // legacy answers without .date still align with the heatmap cell keys.
    const key = a.date ?? (a.createdAt ? getDateStr(new Date(a.createdAt)) : '');
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // v3.3.4.2: Window anchored on the current week's Monday minus 3 weeks, so
  // the grid is always a clean 4×7 Mon-Sun rectangle (no leading/trailing
  // blanks, no jagged 토/일 edge). Future days within the current week (e.g.,
  // Sat/Sun when today is Wed) are rendered as empty level-0 cells; clicking
  // them opens the standard "기록 없음" modal.
  const today = new Date();
  const DAYS = 28;
  const daysFromMonday = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const currentWeekMonday = new Date(today);
  currentWeekMonday.setDate(today.getDate() - daysFromMonday);
  const firstDay = new Date(currentWeekMonday);
  firstDay.setDate(currentWeekMonday.getDate() - 21);
  const todayKey = getDateStr(today);

  const { total, streak } = computeTotalAndStreak(counts, firstDay, DAYS);
  if (info) setDefaultInfo(info, total, streak);

  const openDayDetail = (cell: HTMLButtonElement): void => {
    const date = cell.dataset['date']!;
    showDayDetail(date, () => cell.focus());
  };

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() + i);
    const key = getDateStr(d);
    const n = counts.get(key) ?? 0;
    const level = Math.min(3, n);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `heatmap-cell level-${level}${key === todayKey ? ' is-today' : ''}`;
    cell.dataset['date'] = key;
    const ariaLabel = n > 0 ? `${key}, ${n}개 달성` : `${key}, 기록 없음`;
    cell.setAttribute('aria-label', ariaLabel);
    cell.addEventListener('click', () => openDayDetail(cell));
    cell.addEventListener('mouseenter', () => {
      if (info) info.textContent = n > 0
        ? `${formatCellLabel(key)} · ${n}개 달성`
        : `${formatCellLabel(key)} · 기록 없음`;
    });
    cell.addEventListener('mouseleave', () => {
      if (info) setDefaultInfo(info, total, streak);
    });
    grid.append(cell);
  }

  // v3.3.4.2: post-refactor every child is a data cell (no more .is-blank padding).
  const dataCells = Array.from(grid.querySelectorAll<HTMLButtonElement>('.heatmap-cell'));
  dataCells.forEach((c, i) => c.setAttribute('tabindex', i === 0 ? '0' : '-1'));

  const moveFocus = (from: HTMLButtonElement, delta: number): void => {
    const idx = dataCells.indexOf(from);
    const target = idx + delta;
    if (target < 0 || target >= dataCells.length) return;
    from.setAttribute('tabindex', '-1');
    const next = dataCells[target]!;
    next.setAttribute('tabindex', '0');
    next.focus();
  };

  dataCells.forEach((cell) => {
    cell.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); moveFocus(cell, -1); break;
        case 'ArrowDown':  e.preventDefault(); moveFocus(cell, +1); break;
        case 'ArrowLeft':  e.preventDefault(); moveFocus(cell, -7); break;
        case 'ArrowRight': e.preventDefault(); moveFocus(cell, +7); break;
        case 'Enter':
        case ' ':          e.preventDefault(); openDayDetail(cell); break;
      }
    });
  });

  if (!sessionStorage.getItem('dg-heatmap-animated')) {
    grid.classList.add('is-entering');
    sessionStorage.setItem('dg-heatmap-animated', '1');
    setTimeout(() => grid.classList.remove('is-entering'), 250);
  }
}

function hydrateBadges(): void {
  const wrap = document.getElementById('badgesGrid');
  const user = loadUser();
  const answers = loadAnswers();
  if (!wrap) return;
  wrap.replaceChildren();
  const earned: Array<{ icon: string; label: string }> = [];
  if (answers.length >= 1) earned.push({ icon: '🌱', label: '첫 답변' });
  if (answers.length >= 10) earned.push({ icon: '📚', label: '열 걸음' });
  if (answers.length >= 30) earned.push({ icon: '🎯', label: '한 달 완성' });
  if (user && user.streak >= 7) earned.push({ icon: '🔥', label: '주간 스트릭' });
  if (user && user.level >= 3) earned.push({ icon: '🌳', label: '나무' });
  if (user && user.level >= 5) earned.push({ icon: '🏔️', label: '산' });
  if (earned.length === 0) {
    const hint = document.createElement('p');
    hint.textContent = '첫 답변을 남기면 뱃지가 열려요.';
    hint.className = 'badges-empty';
    wrap.append(hint);
    return;
  }
  for (const b of earned) {
    const span = document.createElement('span');
    span.className = 'badge';
    span.textContent = `${b.icon} ${b.label}`;
    wrap.append(span);
  }
}

function hydrateCategoryBreakdown(): void {
  const wrap = document.getElementById('categoryBreakdown');
  if (!wrap) return;
  wrap.replaceChildren();
  const answers = loadAnswers();
  const counts = new Map<string, number>();
  for (const a of answers) {
    const k = toKoType(a.type);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (counts.size === 0) {
    wrap.textContent = '아직 답변이 없어요.';
    return;
  }
  const max = Math.max(...counts.values());
  for (const [type, n] of counts) {
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    const label = document.createElement('span');
    label.className = 'breakdown-label';
    label.textContent = `${type} · ${n}`;
    const bar = document.createElement('span');
    bar.className = 'breakdown-bar';
    bar.style.width = `${(n / max) * 100}%`;
    row.append(label, bar);
    wrap.append(row);
  }
}

function hydrateGrowthSummary(): void {
  const el = document.getElementById('growthSummary');
  const user = loadUser();
  const answers = loadAnswers();
  if (!el) return;
  if (!user || answers.length === 0) {
    el.textContent = '기록을 쌓아가면 이곳에 성장 요약이 표시됩니다.';
    return;
  }
  const recent = answers.slice(0, 7).length;
  el.textContent = `최근 ${recent}개의 기록으로 레벨 ${user.level}까지 도달했어요. 오늘도 한 걸음 더 나아가 볼까요?`;
}

function showDayDetail(date: string, onClose?: () => void): void {
  const answers = loadAnswers().filter((a) => (a.date ?? (a.createdAt?.slice(0, 10) ?? '')) === date);
  if (answers.length === 0) {
    openModal({ title: date, bodyHtml: `<p>이 날은 기록이 없어요.</p>`, onClose });
    return;
  }
  const parts = answers.map((a) => `
    <article class="day-detail-card">
      ${a.type ? `<span class="archive-type">${escapeHtml(toKoType(a.type))}</span>` : ''}
      <div class="archive-detail-body">${escapeHtml(a.text).replace(/\n/g, '<br>')}</div>
      ${a.evaluation ? `<div class="archive-detail-eval">AI ${a.evaluation.score}점 · ${escapeHtml(a.evaluation.feedback)}</div>` : ''}
    </article>
  `);
  openModal({ title: `${date} 기록 ${answers.length}개`, bodyHtml: parts.join(''), onClose });
}
