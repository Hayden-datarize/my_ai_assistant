import { mountNav, switchTab } from './ui/nav';
import { mountSidebar } from './ui/sidebar';
// v3.29 T3 (Codex 사전 P1-3 / R4 P1): handler mount도 dynamic import — 정적
// import는 entry bundle에 합산되어 tab 분리 효과를 상쇄했음. Promise.all로 병렬
// 로드 + boot 시점에 listener 등록을 보존(handlers는 dg:* 이벤트 listener를
// 등록하므로 모두 boot에서 await 필요).
// v3.27 T2a: mountInsightsHandlers import 제거 — insights tab 폐기, dg:insights:* listener는 mountArchiveHandlers로 흡수.
import { mountRewards } from './ui/rewards';
import { renderOnboarding } from './ui/onboarding';
import { maybeShowWelcomeGarden } from './ui/modals/welcome-garden';
import { qs } from './utils/dom';

const USER_STORAGE = 'user';

function hasOnboarded(): boolean {
  try {
    const raw = localStorage.getItem(USER_STORAGE);
    if (!raw) return false;
    const u = JSON.parse(raw) as { interests?: unknown[] };
    return Array.isArray(u.interests) && u.interests.length > 0;
  } catch { return false; }
}

async function bootMainApp(): Promise<void> {
  // v3.29 T3 (Codex 사전 P1-3): handler mount lazy — boot 시점에 listener 등록을
  // 보존하기 위해 Promise.all 병렬 await. 향후 truly first-mount eager-only로
  // 줄이려면 handler가 dg:* listener 등록을 tab-changed 시점으로 미루도록 리팩토링 필요.
  const [home, archive, stats, missions] = await Promise.all([
    import('./ui/handlers/home'),
    import('./ui/handlers/archive'),
    import('./ui/handlers/stats'),
    import('./ui/handlers/missions'),
  ]);
  home.mountHomeHandlers();
  archive.mountArchiveHandlers();
  stats.mountStatsHandlers();
  missions.mountMissionsHandlers();
  // v3.27 T2a: mountInsightsHandlers 호출 제거 — mountArchiveHandlers에서 dg:insights:* 흡수.
  mountNav();
  mountSidebar();
  mountRewards();
  await switchTab('home');
  // v3.15: onboarding 완료 사용자에게만 환영 정원 모달 1회 표시 (gardenIntroduced flag guard)
  maybeShowWelcomeGarden();
}

function bootOnboarding(): void {
  const app = qs<HTMLElement>('#app');
  renderOnboarding(app);
  document.addEventListener('dg:onboarded', () => {
    location.reload();
  }, { once: true });
}

function boot(): void {
  if (hasOnboarded()) {
    void bootMainApp();
  } else {
    bootOnboarding();
  }
  registerServiceWorker();
}

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
