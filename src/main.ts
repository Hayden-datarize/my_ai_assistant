import { mountNav, switchTab } from './ui/nav';
import { mountSidebar } from './ui/sidebar';
import { mountHomeHandlers } from './ui/handlers/home';
import { mountArchiveHandlers } from './ui/handlers/archive';
import { mountStatsHandlers } from './ui/handlers/stats';
import { mountRewards } from './ui/rewards';
import { renderOnboarding } from './ui/onboarding';
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

function bootMainApp(): void {
  mountHomeHandlers();
  mountArchiveHandlers();
  mountStatsHandlers();
  mountNav();
  mountSidebar();
  mountRewards();
  switchTab('home');
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
    bootMainApp();
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
