import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountSidebar } from '../../src/ui/sidebar';

const LS_KEY = 'dg-sidebar-last-state';

function setupDom(): void {
  document.body.replaceChildren();
  const app = document.createElement('main');
  app.id = 'app';
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.id = 'bottomNav';
  document.body.append(app, nav);
  localStorage.clear();
}

describe('mountSidebar', () => {
  beforeEach(setupDom);
  afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });

  it('injects toggle button, backdrop, drawer into document.body', () => {
    mountSidebar();
    expect(document.querySelector('#sidebarToggle')).not.toBeNull();
    expect(document.querySelector('#sidebarBackdrop')).not.toBeNull();
    expect(document.querySelector('#sidebarDrawer')).not.toBeNull();
  });

  it('drawer starts closed when no stored state', () => {
    mountSidebar();
    const drawer = document.querySelector<HTMLElement>('#sidebarDrawer')!;
    expect(drawer.dataset['open']).toBe('false');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
  });

  it('drawer restores open state from localStorage', () => {
    localStorage.setItem(LS_KEY, 'open');
    mountSidebar();
    const drawer = document.querySelector<HTMLElement>('#sidebarDrawer')!;
    expect(drawer.dataset['open']).toBe('true');
    expect(drawer.getAttribute('aria-hidden')).toBe('false');
  });

  it('clicking toggle opens drawer and persists state', () => {
    mountSidebar();
    const toggle = document.querySelector<HTMLButtonElement>('#sidebarToggle')!;
    toggle.click();
    const drawer = document.querySelector<HTMLElement>('#sidebarDrawer')!;
    expect(drawer.dataset['open']).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem(LS_KEY)).toBe('open');
  });

  it('ESC key closes open drawer', () => {
    localStorage.setItem(LS_KEY, 'open');
    mountSidebar();
    const drawer = document.querySelector<HTMLElement>('#sidebarDrawer')!;
    expect(drawer.dataset['open']).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(drawer.dataset['open']).toBe('false');
    expect(localStorage.getItem(LS_KEY)).toBe('closed');
  });

  it('backdrop click closes drawer', () => {
    localStorage.setItem(LS_KEY, 'open');
    mountSidebar();
    const backdrop = document.querySelector<HTMLElement>('#sidebarBackdrop')!;
    backdrop.click();
    const drawer = document.querySelector<HTMLElement>('#sidebarDrawer')!;
    expect(drawer.dataset['open']).toBe('false');
  });

  it('drawer renders one .nav-item per tab (5 total)', () => {
    mountSidebar();
    // v3.27 T2a: insights tab 제거 (6→5).
    const items = document.querySelectorAll('#sidebarDrawer .nav-item');
    expect(items.length).toBe(5);
  });

  it('clicking a drawer nav-item closes drawer and dispatches dg:nav:tab-changed', async () => {
    localStorage.setItem(LS_KEY, 'open');
    mountSidebar();
    const archiveBtn = document.querySelector<HTMLButtonElement>(
      '#sidebarDrawer .nav-item[data-tab-id="archive"]'
    )!;
    const spy = vi.fn();
    document.addEventListener('dg:nav:tab-changed', spy);
    archiveBtn.click();
    const drawer = document.querySelector<HTMLElement>('#sidebarDrawer')!;
    expect(drawer.dataset['open']).toBe('false');
    // v3.29 T3: switchTab is now async (dynamic import) — wait for chunk load + dispatch.
    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2000, interval: 20 });
    document.removeEventListener('dg:nav:tab-changed', spy);
  });

  it('restored-open drawer close refocuses toggle when no prior lastFocused', () => {
    // Open-on-mount path: activeElement === <body>, so lastFocused is null.
    // Close must still land focus on the toggle (WCAG 2.4.3 Focus Order).
    localStorage.setItem(LS_KEY, 'open');
    mountSidebar();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const toggle = document.querySelector<HTMLButtonElement>('#sidebarToggle')!;
    expect(document.activeElement).toBe(toggle);
  });
});
