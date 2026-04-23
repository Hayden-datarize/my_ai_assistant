import { createFocusTrap, type FocusTrap } from './utils/focus-trap';
import { switchTab, TABS } from './nav';

const LS_KEY = 'dg-sidebar-last-state';

export function mountSidebar(): void {
  if (document.getElementById('sidebarDrawer')) return; // idempotent

  const toggle = document.createElement('button');
  toggle.id = 'sidebarToggle';
  toggle.className = 'sidebar-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '메뉴 열기');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'sidebarDrawer');
  toggle.textContent = '☰';

  const backdrop = document.createElement('div');
  backdrop.id = 'sidebarBackdrop';
  backdrop.className = 'sidebar-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const drawer = document.createElement('aside');
  drawer.id = 'sidebarDrawer';
  drawer.className = 'sidebar-drawer';
  drawer.setAttribute('role', 'navigation');
  drawer.setAttribute('aria-label', '주 내비게이션');
  drawer.setAttribute('aria-hidden', 'true');

  const nav = document.createElement('nav');
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
      switchTab(t.id);
      close();
    });
    nav.append(btn);
  }
  drawer.append(nav);

  document.body.append(toggle, backdrop, drawer);

  const trap: FocusTrap = createFocusTrap(drawer);
  let lastFocused: HTMLElement | null = null;

  function open(): void {
    drawer.dataset['open'] = 'true';
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.dataset['open'] = 'true';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '메뉴 닫기');
    lastFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    trap.activate();
    try {
      localStorage.setItem(LS_KEY, 'open');
    } catch {
      /* storage quota */
    }
  }

  function close(): void {
    drawer.dataset['open'] = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.dataset['open'] = 'false';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '메뉴 열기');
    trap.deactivate();
    if (lastFocused) {
      try {
        lastFocused.focus();
      } catch {
        /* detached */
      }
    }
    try {
      localStorage.setItem(LS_KEY, 'closed');
    } catch {
      /* storage quota */
    }
  }

  toggle.addEventListener('click', () => {
    if (drawer.dataset['open'] === 'true') close();
    else open();
  });

  backdrop.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.dataset['open'] === 'true') close();
  });

  // 초기 상태 복원
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LS_KEY);
  } catch {
    /* storage unavailable */
  }

  if (stored === 'open') {
    open();
  } else {
    drawer.dataset['open'] = 'false';
    backdrop.dataset['open'] = 'false';
  }
}
