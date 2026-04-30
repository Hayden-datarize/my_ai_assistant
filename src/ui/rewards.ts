import { on } from './events';
import { findBadge } from '../state/badgeCatalog';
import { TIERS } from '../state/leveling';

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

function escapeText(s: string): string {
  // 카탈로그 데이터만 들어옴 — 그래도 방어적으로 escape
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function mountRewards(): void {
  if (mounted) return;
  mounted = true;

  disposers.push(on('dg:reward:badge-unlock', ({ badgeId }) => {
    const def = findBadge(badgeId);
    if (!def) return;
    const html = `
      <span class="toast-icon">${escapeText(def.icon)}</span>
      <span class="toast-text">🎯 <strong>${escapeText(def.name)}</strong> 뱃지 획득!</span>
      <button type="button" class="toast-detail" data-badge-id="${escapeText(def.id)}">자세히</button>
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
      <span class="toast-icon">${escapeText(tier.icon)}</span>
      <span class="toast-text"><strong>${escapeText(tier.name)}</strong> 레벨 달성!</span>
      <button type="button" class="toast-close" aria-label="닫기">×</button>
    `;
    spawnToast(html, 'levelup', TOAST_DURATIONS.levelup);
    // T8에서 playConfetti() 호출 추가
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

  disposers.push(on('dg:reward:xp-float', ({ amount: _amount }) => {
    // T7에서 spawnXpFloat(amount) 호출 + xpBadge ping 추가
  }));
}

/** @internal — test only. P1-1: dispose 후 mount flag 초기화 (spec 간 listener 누수 방지). */
export function __resetForTest(): void {
  while (disposers.length) disposers.pop()!();
  mounted = false;
  activeCount = 0;
  document.getElementById('rewardToastContainer')?.remove();
}
