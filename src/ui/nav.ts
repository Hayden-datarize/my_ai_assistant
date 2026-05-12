import { qs } from '../utils/dom';

// v3.27 T2a (Codex 사전 P0-5): 'insights' union 제거.
export type TabId = 'home' | 'archive' | 'stats' | 'settings' | 'missions';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  load: () => Promise<(c: HTMLElement) => void>;
}

// v3.29 T3 (Codex 사전 P1-3 / R4 P1): tab 렌더러를 정적 import → dynamic import 전환.
// 정적 import는 모두 entry bundle에 합산되어 trim 효과 0이었음. await import()로
// 진짜 chunk 분리 — home은 first switchTab 시점 eager, 나머지는 navigate 시 lazy.
// v3.27 T2a (Codex 사전 P0-5): insights TABS entry 제거.
export const TABS: Array<TabDef> = [
  { id: 'home', label: '홈', icon: '🏠', load: () => import('./tabs/home').then((m) => m.renderHome) },
  { id: 'archive', label: '아카이브', icon: '📚', load: () => import('./tabs/archive').then((m) => m.renderArchive) },
  { id: 'stats', label: '통계', icon: '📊', load: () => import('./tabs/stats').then((m) => m.renderStats) },
  { id: 'settings', label: '설정', icon: '⚙️', load: () => import('./tabs/settings').then((m) => m.renderSettings) },
  { id: 'missions', label: '미션', icon: '🎯', load: () => import('./tabs/missions').then((m) => m.renderMissions) },
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

    btn.addEventListener('click', () => {
      switchTab(t.id).catch((err) => {
        console.warn('[nav] switchTab failed', t.id, err);
      });
    });
    nav.append(btn);
  }
}

// v3.29 T3 review fix (I1): in-flight switch token — rapid clicks가 out-of-order
// chunk resolve로 잘못된 탭 render하는 race 차단. 최신 요청만 DOM mutate.
let pendingSwitchToken = 0;

export async function switchTab(id: TabId): Promise<void> {
  const tab = TABS.find((t) => t.id === id);
  if (!tab) throw new Error(`Unknown tab: ${id}`);
  const myToken = ++pendingSwitchToken;
  const render = await tab.load();
  if (myToken !== pendingSwitchToken) return; // superseded — stale render drop

  const app = qs<HTMLElement>('#app');
  app.replaceChildren();
  render(app);

  const buttons = document.querySelectorAll<HTMLButtonElement>('.nav-item');
  buttons.forEach((b) => {
    b.classList.toggle('active', b.dataset['tabId'] === id);
  });

  // Notify handlers so they can hydrate the newly rendered markup.
  // Using raw dispatchEvent instead of the typed helper to avoid a cycle
  // (events.ts has no dependency on nav.ts).
  document.dispatchEvent(new CustomEvent('dg:nav:tab-changed', { detail: { tab: id } }));
}
