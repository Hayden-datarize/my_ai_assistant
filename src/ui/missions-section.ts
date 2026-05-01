import type { MissionInstance, MissionPeriod } from '../state/missionTypes';
import { getMissionDef } from '../state/missionCatalog';
import { escapeHtml } from '../utils/escapeHtml';

const GROUP_TITLE: Record<MissionPeriod, string> = {
  daily: '오늘의 미션',
  weekly: '이번 주 미션',
  monthly: '이번 달 도전',
};

const PERIODS: MissionPeriod[] = ['daily', 'weekly', 'monthly'];

function renderCard(m: MissionInstance): string {
  const def = getMissionDef(m.defId);
  if (!def) return '';
  const ariaLabel = m.completed ? `${def.text} 미션 완수` : def.text;
  const cls = m.completed ? 'mission-card mission-card--completed' : 'mission-card';
  const pbHtml = def.target >= 2
    ? `<span class="mission-card__progress" role="progressbar" aria-valuenow="${m.progress}" aria-valuemax="${def.target}" aria-label="${m.progress}/${def.target}">
         <span class="mission-card__bar" style="width:${Math.min(100, (m.progress / def.target) * 100)}%"></span>
         <span class="mission-card__count">${m.progress}/${def.target}</span>
       </span>`
    : '';
  const checkHtml = m.completed ? '<span class="mission-card__check" aria-label="완수">✓</span>' : '';
  return `<li class="${cls}" aria-label="${escapeHtml(ariaLabel)}">
    <span class="mission-card__title">${escapeHtml(def.text)}</span>
    ${pbHtml}
    <span class="mission-card__reward">+${def.rewardXp} XP</span>
    ${checkHtml}
  </li>`;
}

function renderGroup(period: MissionPeriod, missions: MissionInstance[]): string {
  if (!missions.length) return '';
  const completedCount = missions.filter(m => m.completed).length;
  const listId = `missionGroup${period.charAt(0).toUpperCase() + period.slice(1)}`;
  return `<div class="mission-group" data-period="${period}">
    <button class="mission-group__header" type="button" aria-expanded="true" aria-controls="${listId}">
      <span class="mission-group__title">${GROUP_TITLE[period]}</span>
      <span class="mission-group__progress">${completedCount}/${missions.length}</span>
      <span class="mission-group__chevron" aria-hidden="true">▼</span>
    </button>
    <ul id="${listId}" class="mission-group__list" role="list">
      ${missions.map(renderCard).join('')}
    </ul>
  </div>`;
}

export function renderMissionsSection(root: HTMLElement, active: MissionInstance[]): void {
  const html = `<section id="missionsSection" class="missions-section" aria-label="미션">
    ${PERIODS.map(p => renderGroup(p, active.filter(m => m.period === p))).join('')}
  </section>`;
  // v3.14.1 T3: 모든 interpolation은 정적 catalog/리터럴 union 또는 escapeHtml 처리됨 (renderCard:25-26).
  // catalog에 외부 입력이 도입되면 escapeHtml 추가 필수 — 그 전까지 의도적 허용.
  // eslint-disable-next-line no-restricted-syntax
  root.innerHTML = html;

  // chevron toggle wiring
  root.querySelectorAll<HTMLButtonElement>('.mission-group__header').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const listId = btn.getAttribute('aria-controls')!;
      const list = root.querySelector<HTMLElement>(`#${listId}`);
      if (list) list.hidden = expanded;
    });
  });
}
