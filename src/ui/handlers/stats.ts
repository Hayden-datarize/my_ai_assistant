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
import { openStatsRangeModal } from '../modals/stats-range-modal';
import { toKoType } from '../../utils/typeLabel';
import { getKstDateStr } from '../../utils/dates';
import { getCachedUser } from '../../state/user';
import { TIERS, getCurrentTier } from '../../state/leveling';
import { BADGE_CATALOG, type BadgeDef } from '../../state/badgeCatalog';
import { renderGardenGrid } from '../components/garden-grid';

const WEEKDAY_KO = ['월', '화', '수', '목', '금', '토', '일'];

function computeTotalAndStreak(counts: Map<string, number>, firstDay: Date, days: number): { total: number; streak: number } {
  let total = 0;
  let streak = 0;
  let longest = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() + i);
    const n = counts.get(getKstDateStr(d)) ?? 0;
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
  // v3.23 T6: stub 교체 — openStatsRangeModal (range prop)
  on('dg:stats:weekly-report', () => { void openStatsRangeModal({ range: 7 }); });
  on('dg:stats:growth-analysis', () => { void openStatsRangeModal({ range: 30 }); });

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
  hydrateGarden();
}

/** stats 탭 #gardenContainer에 정원 그리드를 렌더링한다. */
function hydrateGarden(): void {
  const root = document.getElementById('gardenContainer');
  const user = getCachedUser();
  if (!root || !user) return;
  renderGardenGrid(root, user);
}

function hydrateLevelCard(): void {
  const user = getCachedUser();
  const icon = document.getElementById('levelIcon');
  const name = document.getElementById('levelName');
  const xpText = document.getElementById('levelXpText');
  const fill = document.getElementById('xpProgressFill');
  if (!user) return;

  const current = getCurrentTier(user.xp);
  const next = TIERS.find((l) => l.thresh > user.xp);
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
  const user = getCachedUser();
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

  // v3.12 T9 — streak milestone fire pulse (sessionStorage flag consume)
  const pending = sessionStorage.getItem('dg:streakPulsePending');
  if (pending) {
    const stat = document.getElementById('statStreak');
    if (stat) {
      stat.classList.add('fire-pulse');
      sessionStorage.removeItem('dg:streakPulsePending');
      setTimeout(() => stat.classList.remove('fire-pulse'), 1500);
    }
  }
}

/**
 * Render the stats-tab heatmap from cached answers.
 *
 * @internal Exported for vitest unit testing only (v3.18 T5 G3-1).
 *           Not part of the public module API.
 *
 * v3.13 hydrateGreetingAndStreak / v3.10 패턴 — internal hydrator export.
 */
export function hydrateHeatmap(): void {
  const grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.replaceChildren();
  const info = document.getElementById('heatmapInfo');

  const answers = loadAnswers();
  const counts = new Map<string, number>();
  for (const a of answers) {
    // a.date is always KST (via getKstDateStr in home.ts, v3.22 T5 sweep). Fallback:
    // parse the UTC createdAt timestamp into a Date and format in KST so legacy
    // answers without .date still align with the heatmap cell keys.
    const key = a.date ?? (a.createdAt ? getKstDateStr(new Date(a.createdAt)) : '');
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // v3.3.4.2: Window anchored on the current week's Monday minus 3 weeks, so
  // the grid is always a clean 4×7 Mon-Sun rectangle (no leading/trailing
  // blanks, no jagged 토/일 edge).
  // v3.3.4.3: future days within the current week (e.g., Sat/Sun when today
  // is Wed) get .is-future + aria-disabled; click is a no-op, mouseenter
  // shows "아직 오지 않은 날짜", and keyboard nav skips over them.
  const today = new Date();
  const DAYS = 28;
  const daysFromMonday = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const currentWeekMonday = new Date(today);
  currentWeekMonday.setDate(today.getDate() - daysFromMonday);
  const firstDay = new Date(currentWeekMonday);
  firstDay.setDate(currentWeekMonday.getDate() - 21);
  const todayKey = getKstDateStr(today);

  const { total, streak } = computeTotalAndStreak(counts, firstDay, DAYS);
  if (info) setDefaultInfo(info, total, streak);

  const openDayDetail = (cell: HTMLButtonElement): void => {
    const date = cell.dataset['date']!;
    showDayDetail(date, () => cell.focus());
  };

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() + i);
    const key = getKstDateStr(d);
    const n = counts.get(key) ?? 0;
    const level = Math.min(3, n);
    // v3.3.4.3: YYYY-MM-DD ISO string lexicographic order === chronological order
    const isFuture = key > todayKey;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `heatmap-cell level-${level}${key === todayKey ? ' is-today' : ''}${isFuture ? ' is-future' : ''}`;
    cell.dataset['date'] = key;
    if (isFuture) {
      cell.dataset['future'] = 'true';
      cell.setAttribute('aria-disabled', 'true');
      // v3.5 (C2/C3): aria-label uses human-friendly date format,
      // matching mouseenter info text style.
      cell.setAttribute('aria-label', `${formatCellLabel(key)}, 미래 날짜`);
    } else {
      const ariaLabel = n > 0
        ? `${formatCellLabel(key)}, ${n}개 달성`
        : `${formatCellLabel(key)}, 기록 없음`;
      cell.setAttribute('aria-label', ariaLabel);
    }
    cell.addEventListener('click', () => {
      if (cell.dataset['future'] === 'true') return;
      openDayDetail(cell);
    });
    cell.addEventListener('mouseenter', () => {
      if (!info) return;
      if (cell.dataset['future'] === 'true') {
        info.textContent = `${formatCellLabel(key)} · 아직 오지 않은 날짜`;
      } else {
        info.textContent = n > 0
          ? `${formatCellLabel(key)} · ${n}개 달성`
          : `${formatCellLabel(key)} · 기록 없음`;
      }
    });
    cell.addEventListener('mouseleave', () => {
      if (info) setDefaultInfo(info, total, streak);
    });
    grid.append(cell);
  }

  // v3.3.4.2: post-refactor every child is a data cell (no more .is-blank padding).
  // v3.18 T5 (G3-1): explicit future-aware tabindex — future cells always -1,
  // first non-future cell is the roving tabindex anchor (0). 이전 implicit
  // "dataCells[0] is always past" 가정 제거 — firstDay 계산 변경 시 회귀 차단.
  const dataCells = Array.from(grid.querySelectorAll<HTMLButtonElement>('.heatmap-cell'));
  const firstReachable = dataCells.find((c) => c.dataset['future'] !== 'true');
  dataCells.forEach((c) => {
    c.setAttribute('tabindex', c === firstReachable ? '0' : '-1');
  });

  const moveFocus = (from: HTMLButtonElement, delta: number): void => {
    const startIdx = dataCells.indexOf(from);
    let target = startIdx + delta;
    const step = delta > 0 ? 1 : -1;
    // v3.3.4.3: skip consecutive future cells in the direction of travel
    while (
      target >= 0 &&
      target < dataCells.length &&
      dataCells[target]!.dataset['future'] === 'true'
    ) {
      target += step;
    }
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

export const CATEGORY_ORDER: ReadonlyArray<BadgeDef['category']> = ['streak', 'volume', 'tier', 'diversity', 'engagement', 'mission'] as const;
export const CATEGORY_LABELS: Record<BadgeDef['category'], string> = {
  streak:      '🔥 Streak',
  volume:      '📚 Volume',
  tier:        '🌳 Tier',
  diversity:   '🎨 Diversity',
  engagement:  '✏️ Engagement',
  mission:     '🎯 Mission',
};

function showTooltip(btn: HTMLButtonElement): void {
  // close previously open tooltip(s)
  document.querySelectorAll('.badge.show-tooltip').forEach(el => el.classList.remove('show-tooltip'));
  btn.classList.add('show-tooltip');
  setTimeout(() => btn.classList.remove('show-tooltip'), 3000);
}

/**
 * Render a single badge button (earned or locked).
 *
 * v3.14.2 T10 (P2-12-9): extracted from `hydrateBadges` to keep the parent
 * function ≤30 lines. Behavior unchanged — `isEarned` controls aria-label /
 * tooltip / lock overlay / click target (openBadgeDetail vs showTooltip),
 * and Enter/Space keydown re-dispatches click().
 */
function renderBadgeButton(def: BadgeDef, isEarned: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `badge ${isEarned ? 'badge--earned' : 'badge--locked'}`;
  btn.setAttribute('aria-label', isEarned
    ? `${def.name} — ${def.description}`
    : `${def.name} (잠김) — ${def.description}`);
  if (!isEarned) btn.dataset['tooltip'] = `달성 조건: ${def.description}`;
  btn.dataset['badgeId'] = def.id;
  const iconEl = document.createElement('span');
  iconEl.className = 'badge-icon';
  iconEl.textContent = def.icon;
  const nameEl = document.createElement('span');
  nameEl.className = 'badge-name';
  nameEl.textContent = def.name;
  btn.append(iconEl, nameEl);
  if (!isEarned) {
    const lock = document.createElement('span');
    lock.className = 'badge-lock';
    lock.textContent = '🔒';
    btn.append(lock);
  }
  btn.addEventListener('click', async () => {
    if (isEarned) {
      const { openBadgeDetail } = await import('../modals/badge-detail');
      openBadgeDetail(def.id);
    } else {
      showTooltip(btn);
    }
  });
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
  return btn;
}

/**
 * Render one category (h4 label + nested .badges-grid of badge buttons).
 *
 * Returns null when the category has no badges in the catalog (skipped by
 * caller). Earned status is resolved per badge via the `earned` Set.
 */
function renderBadgeCategory(
  cat: BadgeDef['category'],
  list: readonly BadgeDef[],
  earned: ReadonlySet<string>,
): HTMLElement | null {
  if (list.length === 0) return null;
  const catWrap = document.createElement('div');
  catWrap.className = 'badges-category';
  const h4 = document.createElement('h4');
  h4.textContent = CATEGORY_LABELS[cat];
  const grid = document.createElement('div');
  grid.className = 'badges-grid';
  for (const def of list) {
    grid.append(renderBadgeButton(def, earned.has(def.id)));
  }
  catWrap.append(h4, grid);
  return catWrap;
}

function hydrateBadges(): void {
  const wrap = document.getElementById('badgesGrid');
  const user = getCachedUser();
  if (!wrap) return;
  wrap.replaceChildren();
  if (!user) return;

  // v3.14.3 T13 (P3-T10-drift): heading count vs DOM 정합 — catalog 외 legacy ID 제외.
  // renderBadgeCategory가 BADGE_CATALOG만 iterate하므로, heading X도 catalog filter 적용.
  const catalogIds = new Set(BADGE_CATALOG.map((b) => b.id));
  const earned = new Set(
    Object.keys(user.earnedBadges ?? {}).filter((id) => catalogIds.has(id)),
  );
  const total = BADGE_CATALOG.length;
  const section = document.createElement('div');
  section.className = 'badges-section';
  const heading = document.createElement('h3');
  heading.textContent = `🏆 뱃지 (${earned.size} / ${total})`;
  section.append(heading);

  for (const cat of CATEGORY_ORDER) {
    const list = BADGE_CATALOG.filter((b) => b.category === cat);
    const catEl = renderBadgeCategory(cat, list, earned);
    if (catEl) section.append(catEl);
  }
  wrap.append(section);
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
  const user = getCachedUser();
  const answers = loadAnswers();
  if (!el) return;
  if (!user || answers.length === 0) {
    el.textContent = '기록을 쌓아가면 이곳에 성장 요약이 표시됩니다.';
    return;
  }
  const recent = answers.slice(0, 7).length;
  // v3.12 T2: level 필드 drop. tierName으로 표현. T11에서 동일 패턴 유지 (영구).
  const tierName = getCurrentTier(user.xp).name;
  el.textContent = `최근 ${recent}개의 기록으로 ${tierName} 단계까지 도달했어요. 오늘도 한 걸음 더 나아가 볼까요?`;
}

function showDayDetail(date: string, onClose?: () => void): void {
  // v3.22 T7 (codex P1): heatmap counts (line 155)와 동일 KST fallback 사용 — legacy
  // answer (date 누락 + createdAt만)가 두 view에서 같은 KST date로 분류되도록 보장.
  const answers = loadAnswers().filter((a) => (a.date ?? (a.createdAt ? getKstDateStr(new Date(a.createdAt)) : '')) === date);
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
