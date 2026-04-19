import { qs } from '../utils/dom';
import { renderHome } from './tabs/home';
import { renderArchive } from './tabs/archive';
import { renderStats } from './tabs/stats';
import { renderInsights } from './tabs/insights';
import { renderSettings } from './tabs/settings';

export type TabId = 'home' | 'archive' | 'stats' | 'insights' | 'settings';

const TABS: Array<{ id: TabId; label: string; render: (c: HTMLElement) => void }> = [
  { id: 'home', label: '홈', render: renderHome },
  { id: 'archive', label: '아카이브', render: renderArchive },
  { id: 'stats', label: '통계', render: renderStats },
  { id: 'insights', label: '인사이트', render: renderInsights },
  { id: 'settings', label: '설정', render: renderSettings },
];

export function mountNav(): void {
  const nav = qs<HTMLElement>('#bottomNav');
  nav.replaceChildren();
  for (const t of TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t.label;
    btn.dataset.tabId = t.id;
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
  // Notify handlers so they can hydrate the newly rendered markup.
  // Using raw dispatchEvent instead of the typed helper to avoid a cycle
  // (events.ts has no dependency on nav.ts).
  document.dispatchEvent(new CustomEvent('dg:nav:tab-changed', { detail: { tab: id } }));
}
