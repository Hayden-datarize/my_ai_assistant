import type { MissionInstance, MissionPeriod } from '../state/missionTypes';
import { getMissionDef } from '../state/missionCatalog';
import { escapeHtml } from '../utils/escapeHtml';
import { consumeSparkleQueue, isReducedMotion } from './missions-sparkle';

const GROUP_TITLE: Record<MissionPeriod, string> = {
  daily: '오늘의 미션',
  weekly: '이번 주 미션',
  monthly: '이번 달 도전',
};

const PERIODS: MissionPeriod[] = ['daily', 'weekly', 'monthly'];

// SVG ring 기하학: r=20, 2πr ≈ 125.66
const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function renderRing(progress: number, target: number, completed: boolean): string {
  // Codex P1-3: NaN/Infinity 가드 — target<=0 또는 non-finite progress 차단
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, progress) : 0;
  const ratio = completed ? 1 : Math.min(1, safeProgress / safeTarget);
  const dashoffset = (RING_CIRCUMFERENCE * (1 - ratio)).toFixed(2);
  return `<span class="mission-card__ring" role="img" aria-label="진행 ${safeProgress}/${safeTarget}"><svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="${RING_RADIUS}" class="mission-card__ring-track"/><circle cx="24" cy="24" r="${RING_RADIUS}" class="mission-card__ring-progress" stroke-dasharray="${RING_CIRCUMFERENCE.toFixed(2)}" stroke-dashoffset="${dashoffset}"/></svg><span class="mission-card__ring-text">${safeProgress}/${safeTarget}</span></span>`;
}

function renderCard(m: MissionInstance): string {
  const def = getMissionDef(m.defId);
  if (!def) return ''; // 안전 — renderGroup에서 사전 filter됨 (defense-in-depth)
  const ariaLabel = m.completed ? `${def.text} 미션 완수` : def.text;
  const cls = m.completed ? 'mission-card mission-card--completed' : 'mission-card';
  const ringHtml = renderRing(m.progress, def.target, m.completed);
  const checkHtml = m.completed ? '<span class="mission-card__check" aria-label="완수">✓</span>' : '';
  return `<li class="${cls}" data-mission-id="${m.defId}" aria-label="${escapeHtml(ariaLabel)}"><h3 class="mission-card__title">${escapeHtml(def.text)}</h3>${ringHtml}<span class="mission-card__reward">+${def.rewardXp} XP</span>${checkHtml}</li>`;
}

function renderGroup(period: MissionPeriod, missions: MissionInstance[]): string {
  // Codex P1-2: known def filter — count/sort/render 모두 known 기준
  const known = missions.filter(m => getMissionDef(m.defId));
  if (!known.length) return '';
  const completedCount = known.filter(m => m.completed).length;
  const listId = `missionGroup${period.charAt(0).toUpperCase() + period.slice(1)}`;
  // 활성 → 완수 안정 정렬 (JS Array.sort ES2019 stable). same-status 상대 순서 유지.
  const sorted = [...known].sort((a, b) => Number(a.completed) - Number(b.completed));
  return `<div class="mission-group" data-period="${period}"><button class="mission-group__header" type="button" aria-expanded="true" aria-controls="${listId}"><span class="mission-group__title">${GROUP_TITLE[period]}</span><span class="mission-group__progress">${completedCount}/${known.length}</span><span class="mission-group__chevron" aria-hidden="true">▼</span></button><ul id="${listId}" class="mission-group__grid">${sorted.map(renderCard).join('')}</ul></div>`;
}

export function renderMissionsSection(root: HTMLElement, active: MissionInstance[]): void {
  // sparkle queue 소비 — render 이전에 결정 (정렬과 무관 일관)
  const sparkleSet = consumeSparkleQueue();

  const html = `<section id="missionsSection" class="missions-section" aria-label="미션">${PERIODS.map(p => renderGroup(p, active.filter(m => m.period === p))).join('')}</section>`;
  // catalog는 외부 입력 없음, def.text/ariaLabel는 escapeHtml, data-mission-id는 catalog ascii id (catalog invariant test로 보장).
  // eslint-disable-next-line no-restricted-syntax
  root.innerHTML = html;

  // chevron toggle wiring (기존 유지)
  root.querySelectorAll<HTMLButtonElement>('.mission-group__header').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const listId = btn.getAttribute('aria-controls')!;
      const list = root.querySelector<HTMLElement>(`#${listId}`);
      if (list) list.hidden = expanded;
    });
  });

  // sparkle class 부착 (mount 이후, reduced-motion 가드)
  if (sparkleSet.size > 0 && !isReducedMotion()) {
    root.querySelectorAll<HTMLElement>('.mission-card[data-mission-id]').forEach(el => {
      const id = el.dataset.missionId;
      if (id && sparkleSet.has(id)) {
        el.classList.add('mission-card--sparkle');
        el.addEventListener(
          'animationend',
          () => el.classList.remove('mission-card--sparkle'),
          { once: true },
        );
      }
    });
  }
}
