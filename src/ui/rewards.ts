import { on } from './events';
import { findBadge } from '../state/badgeCatalog';
import { TIERS } from '../state/leveling';
import { escapeHtml } from '../utils/escapeHtml';
import { INTEREST_LABEL } from './components/garden-grid';
import { MSG } from './messages';

const MAX_VISIBLE = 3;
// v3.14.3 T10 (P3-toast-const): export — spec/외부 코드 canonical 참조.
// v3.14.4 T9 (M2): 일관성 정당화 추가.
//
// gamification toast 전용 scale (3000~4000ms). general-purpose toast(`utils/toast.ts`
// default 2500ms, `user.ts` corruption 4000ms)와는 분리된 도메인.
//
// 값 정당화:
// - badge(3000)·streak(3000): 단순 알림, 짧지도 길지도 않은 표준값.
// - levelup(4000): confetti 애니메이션(1100ms)과 함께 시각 가중 — corruption(4000)과
//   동일 상한, "축하" 가독성 마진.
// - mission(3500): 미션 progress text가 길어 streak/badge보다 약간 김.
// - freeze(4000): "Streak Freeze로 N일 연속 유지!" 메시지 + ❄️ 아이콘 시각 가중 — levelup과
//   동일 상한 (좌절 회복 UX → 가독성 마진 ↑). v3.21 T5.
export const TOAST_DURATIONS = { badge: 3000, levelup: 4000, streak: 3000, mission: 3500, bloom: 4000, freeze: 4000 } as const;

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

function spawnToast(html: string, modifier: 'badge' | 'levelup' | 'streak' | 'mission' | 'bloom' | 'freeze', durationMs: number): HTMLElement | null {
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

/**
 * Toast DOM 제거 + activeCount 감소.
 *
 * Idempotent: parentElement === null이면 early return — close-click + auto-dismiss
 * setTimeout race에서 double-decrement 방지.
 *
 * v3.14.2 T9 (P2-12-7/8 closeout): 이 guard가 timer leak을 무해화하므로
 * 별도 dedup 추적 불필요.
 *
 * v3.14.3 T11 + v3.14.4 T9 (M1, fake-timer anchor):
 *   spawnToast가 등록한 `setTimeout(() => removeToast(el), durationMs)` 콜백은
 *   `vi.advanceTimersByTime(durationMs)` 호출 시 fire한다. 따라서 spec에서
 *   명시적 removeToast 호출 불필요 — fake timer side-effect로 자동 호출됨.
 *
 *   Detached element를 받는 경로 (race window):
 *   1. `__resetForTest()` 가 container를 비운 직후 timer fire
 *   2. close-button click이 timer fire 직전 발생
 *   양쪽 모두 `el.parentElement === null` → early return → DOM/state 변경 0.
 *
 *   spec: `tests/unit/ui/rewards-reset-clear-timers.spec.ts`.
 *
 * @internal — production caller는 spawnToast의 setTimeout/close-click handler
 * 두 개뿐. 외부 모듈에서 직접 호출 안 함.
 */
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

  // v3.21 T5: streak freeze 소비 toast (사전 review P0-2 fix — caller-side direct dispatch).
  // dispatch 진원지: src/state/user.ts recordDailyAnswer (saveUser 성공 후, Option B).
  disposers.push(on('dg:reward:streak-freeze-used', ({ days }) => {
    const html = `
      <span class="toast-icon">❄️</span>
      <span class="toast-text">Streak Freeze로 <strong>${days}일</strong> 연속 유지!</span>
      <button type="button" class="toast-close" aria-label="닫기">×</button>
    `;
    spawnToast(html, 'freeze', TOAST_DURATIONS.freeze);
  }));

  disposers.push(on('dg:reward:xp-float', ({ amount }) => {
    spawnXpFloat(amount);
  }));

  disposers.push(on('dg:reward:mission-complete', ({ period, rewardXp }) => {
    const isMonthly = period === 'monthly';
    const html = isMonthly
      ? `<span class="toast-text">🌟 이달의 도전 완수! +${rewardXp} XP</span><button type="button" class="toast-close" aria-label="닫기">×</button>`
      : `<span class="toast-text">🎯 미션 완수! +${rewardXp} XP</span><button type="button" class="toast-close" aria-label="닫기">×</button>`;
    const el = spawnToast(html, 'mission', TOAST_DURATIONS.mission);
    if (el && isMonthly) el.classList.add('toast--monthly');
  }));

  // v3.15 T14 — stage 4→5 (만개) bloom toast + confetti (C5 fix: 비-action, navigate 안 함)
  disposers.push(on('dg:reward:plant-stage-up', ({ interestId, newStage }) => {
    if (newStage !== 5) return;  // stage 1~4 silent (잡음 회피)
    const plainLabel = INTEREST_LABEL[interestId] ?? interestId;
    const message = MSG.GARDEN_BLOOM(plainLabel);  // e.g. "AI/ML 정원이 만개했어요 🌸"
    const html = `<span class="toast-text">${escapeHtml(message)}</span>`;
    spawnToast(html, 'bloom', TOAST_DURATIONS.bloom);
    playConfetti();
  }));
}

/** @internal — test only. P1-1: dispose 후 mount flag 초기화 (spec 간 listener 누수 방지). */
export function __resetForTest(): void {
  while (disposers.length) disposers.pop()!();
  mounted = false;
  activeCount = 0;
  document.getElementById('rewardToastContainer')?.remove();
}
