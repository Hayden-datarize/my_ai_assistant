import { mountNav, switchTab } from './ui/nav';
import { mountSidebar } from './ui/sidebar';
import { registerCoreHandlerListeners } from './ui/handlers/register';
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
  // v3.31 C7: home handler remains eager for first-screen hydration/theme.
  // Archive/stats/missions listeners are registered by lightweight modules and
  // lazy-import their heavy handlers only on event or first tab visit.
  const [home] = await Promise.all([
    import('./ui/handlers/home'),
  ]);
  home.mountHomeHandlers();
  registerCoreHandlerListeners();
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
