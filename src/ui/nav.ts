import { qs } from '../utils/dom';
import { renderHome } from './tabs/home';
import { renderArchive } from './tabs/archive';
import { renderStats } from './tabs/stats';
import { renderInsights } from './tabs/insights';
import { renderSettings } from './tabs/settings';

export type TabId = 'home' | 'archive' | 'stats' | 'insights' | 'settings';

export const TABS: Array<{ id: TabId; label: string; icon: string; render: (c: HTMLElement) => void }> = [
  { id: 'home', label: '홈', icon: '🏠', render: renderHome },
  { id: 'archive', label: '아카이브', icon: '📚', render: renderArchive },
  { id: 'stats', label: '통계', icon: '📊', render: renderStats },
  { id: 'insights', label: '인사이트', icon: '💡', render: renderInsights },
  { id: 'settings', label: '설정', icon: '⚙️', render: renderSettings },
];

export function mountNav(): void {
  const nav = qs<HTMLElement>('#bottomNav');
  nav.replaceChildren();
  for (const t of TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-item';
    btn.dataset['tabId'] = t.id;

    const icon = document.createElement('span');
    icon.className = 'nav-icon';
    icon.textContent = t.icon;
    btn.append(icon);

    const label = document.createElement('span');
    label.textContent = t.label;
    btn.append(label);

    btn.addEventListener('click', () => switchTab(t.id));
    nav.append(btn);
  }
}

export function switchTab(id: TabId): void {
  const tab = TABS.find((t) => t.id === id);
  if (!tab) throw new Error(`Unknown tab: ${id}`);
  const app = qs<HTMLElement>('#app');
  app.replaceChildren();
  tab.render(app);

  const buttons = document.querySelectorAll<HTMLButtonElement>('.nav-item');
  buttons.forEach((b) => {
    b.classList.toggle('active', b.dataset['tabId'] === id);
  });

  // Notify handlers so they can hydrate the newly rendered markup.
  // Using raw dispatchEvent instead of the typed helper to avoid a cycle
  // (events.ts has no dependency on nav.ts).
  document.dispatchEvent(new CustomEvent('dg:nav:tab-changed', { detail: { tab: id } }));
}
