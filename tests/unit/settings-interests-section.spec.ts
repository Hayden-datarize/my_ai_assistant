import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('settings tab: interests section', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modalRoot';
    document.body.append(modalRoot);
    const toast = document.createElement('div');
    toast.className = 'toast-container';
    document.body.append(toast);
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({
      name: '테',
      interests: ['recruiting', 'onboarding'],
      onboardedAt: new Date().toISOString(),
      streak: 0,
      lastActiveDate: new Date().toISOString().slice(0, 10),
      xp: 0,
      level: 1,
    }));
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders current interests section with chips for each interest', async () => {
    const { renderSettings } = await import('../../src/ui/tabs/settings');
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    const chips = container.querySelectorAll('.interest-chip');
    expect(chips.length).toBe(2);
  });

  it('renders edit button that opens interests modal on click', async () => {
    const { renderSettings } = await import('../../src/ui/tabs/settings');
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    const btn = container.querySelector<HTMLButtonElement>('#editInterestsBtn');
    expect(btn).not.toBeNull();
    btn?.click();
    // Wait for async dynamic import resolution
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.dg-modal')).not.toBeNull();
  });

  it('re-renders chips when dg:interests:changed fires', async () => {
    const { renderSettings } = await import('../../src/ui/tabs/settings');
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);

    // Simulate interests change via localStorage update + event
    const raw = JSON.parse(localStorage.getItem('user')!);
    raw.interests = ['recruiting', 'onboarding', 'culture'];
    localStorage.setItem('user', JSON.stringify(raw));
    document.dispatchEvent(new CustomEvent('dg:interests:changed'));

    // Allow handler to run
    await new Promise((r) => setTimeout(r, 20));
    const chips = container.querySelectorAll('.interest-chip');
    expect(chips.length).toBe(3);
  });

  it('shows placeholder when user has zero interests', async () => {
    localStorage.setItem('user', JSON.stringify({
      name: '테',
      interests: [],
      onboardedAt: new Date().toISOString(),
      streak: 0,
      lastActiveDate: new Date().toISOString().slice(0, 10),
      xp: 0,
      level: 1,
    }));
    const { renderSettings } = await import('../../src/ui/tabs/settings');
    const container = document.createElement('div');
    document.body.append(container);
    renderSettings(container);
    const display = container.querySelector('#currentInterests');
    expect(display?.textContent).toMatch(/없어요|없음/);
  });
});
