import { on } from './events';
import { findBadge } from '../state/badgeCatalog';
import { TIERS } from '../state/leveling';
import { escapeHtml } from '../utils/escapeHtml';

const MAX_VISIBLE = 3;
const TOAST_DURATIONS = { badge: 3000, levelup: 4000, streak: 3000 } as const;

let mounted = false;
let activeCount = 0;
// P1-1 fix: spec 간 document listener 누적 → flake 방지. mountRewards가 등록한
// listener의 dispose 함수를 모아두고 __resetForTest에서 모두 호출.
const disposers: Array<() => void> = [];

function ensureContainer(): HTMLElement {
  let el = document.getElementById('rewardToastContainer');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'rewardToastContainer';
  el.className = 'toast-container toast-container--reward';
  (document.getElementById('modalRoot') ?? document.body).append(el);
  return el;
}

function spawnToast(html: string, modifier: 'badge' | 'levelup' | 'streak', durationMs: number): HTMLElement | null {
  if (activeCount >= MAX_VISIBLE) return null;
  const container = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast--${modifier}`;
  el.setAttribute('role', 'status');
  // eslint-disable-next-line no-restricted-syntax -- caller-controlled, no user interpolation in html (only escaped names from BADGE_CATALOG / TIERS)
  el.innerHTML = html;
  container.append(el);
  activeCount++;
  el.querySelector('.toast-close')?.addEventListener('click', () => removeToast(el));
  setTimeout(() => removeToast(el), durationMs);
  return el;
}

function removeToast(el: HTMLElement): void {
  if (!el.parentElement) return;
  el.remove();
  activeCount = Math.max(0, activeCount - 1);
}

const CONFETTI_COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];
const CONFETTI_COUNT = 30;

function playConfetti(): void {
  const root = document.getElementById('modalRoot') ?? document.body;
  const wrap = document.createElement('div');
  wrap.className = 'confetti-burst';
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-particle';
    p.style.setProperty('--angle', `${(360 / CONFETTI_COUNT) * i}deg`);
    p.style.setProperty('--color', CONFETTI_COLORS[i % CONFETTI_COLORS.length]!);
    p.style.setProperty('--delay', `${(i % 5) * 30}ms`);
    wrap.append(p);
  }
  root.append(wrap);
  setTimeout(() => wrap.remove(), 1100);
}

function spawnXpFloat(amount: number): void {
  const startEl = document.querySelector<HTMLElement>('.chat-bubble:last-of-type');
  const xpBadge = document.getElementById('xpBadge');

  // 시작점: chat bubble 우측 가장자리. 없으면 화면 중앙.
  const startRect = startEl?.getBoundingClientRect();
  const startX = startRect ? startRect.right : window.innerWidth / 2;
  const startY = startRect ? startRect.top + startRect.height / 2 : window.innerHeight / 2;

  // 끝점: xpBadge 중앙. 미존재 / 비가시(jsdom checkVisibility 없음 → width===0 체크) 시 우상단.
  const endRect = (xpBadge && (xpBadge as HTMLElement).getBoundingClientRect());
  const isVisible = endRect && endRect.width > 0 && endRect.height > 0;
  const endX = isVisible ? endRect.left + endRect.width / 2 : window.innerWidth - 32;
  const endY = isVisible ? endRect.top + endRect.height / 2 : 32;

  const el = document.createElement('span');
  el.className = 'xp-float';
  el.textContent = `+${amount} XP`;
  el.style.setProperty('--start-x', `${startX}px`);
  el.style.setProperty('--start-y', `${startY}px`);
  el.style.setProperty('--end-x', `${endX}px`);
  el.style.setProperty('--end-y', `${endY}px`);
  document.body.append(el);
  setTimeout(() => el.remove(), 1300);

  // 도착 시 xpBadge ping
  setTimeout(() => {
    if (!xpBadge) return;
    xpBadge.classList.add('badge-pulse');
    setTimeout(() => xpBadge.classList.remove('badge-pulse'), 300);
  }, 1000);
}

export function mountRewards(): void {
  if (mounted) return;
  mounted = true;

  disposers.push(on('dg:reward:badge-unlock', ({ badgeId }) => {
    const def = findBadge(badgeId);
    if (!def) return;
    const html = `
      <span class="toast-icon">${escapeHtml(def.icon)}</span>
      <span class="toast-text">🎯 <strong>${escapeHtml(def.name)}</strong> 뱃지 획득!</span>
      <button type="button" class="toast-detail" data-badge-id="${escapeHtml(def.id)}">자세히</button>
      <button type="button" class="toast-close" aria-label="닫기">×</button>
    `;
    const el = spawnToast(html, 'badge', TOAST_DURATIONS.badge);
    // T10에서 .toast-detail 핸들러 wiring (lazy import modal)
    if (el) {
      el.querySelector('.toast-detail')?.addEventListener('click', async () => {
        const { openBadgeDetail } = await import('./modals/badge-detail');
        openBadgeDetail(def.id);
      });
    }
  }));

  disposers.push(on('dg:reward:level-up', ({ tierId }) => {
    const tier = TIERS.find(t => t.id === tierId);
    if (!tier) return;
    const html = `
      <span class="toast-icon">${escapeHtml(tier.icon)}</span>
      <span class="toast-text"><strong>${escapeHtml(tier.name)}</strong> 레벨 달성!</span>
      <button type="button" class="toast-close" aria-label="닫기">×</button>
    `;
    spawnToast(html, 'levelup', TOAST_DURATIONS.levelup);
    playConfetti();
  }));

  disposers.push(on('dg:reward:streak-milestone', ({ days }) => {
    const html = `
      <span class="toast-icon">🔥</span>
      <span class="toast-text"><strong>${days}일</strong> 스트릭!</span>
      <button type="button" class="toast-close" aria-label="닫기">×</button>
    `;
    spawnToast(html, 'streak', TOAST_DURATIONS.streak);
    sessionStorage.setItem('dg:streakPulsePending', String(days));
  }));

  disposers.push(on('dg:reward:xp-float', ({ amount }) => {
    spawnXpFloat(amount);
  }));
}

/** @internal — test only. P1-1: dispose 후 mount flag 초기화 (spec 간 listener 누수 방지). */
export function __resetForTest(): void {
  while (disposers.length) disposers.pop()!();
  mounted = false;
  activeCount = 0;
  document.getElementById('rewardToastContainer')?.remove();
}
