import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDateStr } from '../../src/utils/dates';

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
      lastActiveDate: getDateStr(),
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
    // Poll for dynamic import resolution + DOM mount.
    await vi.waitFor(() => {
      expect(document.querySelector('.dg-modal')).not.toBeNull();
    });
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

    // Poll until chip count reflects updated interests.
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.interest-chip').length).toBe(3);
    });
  });

  it('shows placeholder when user has zero interests', async () => {
    localStorage.setItem('user', JSON.stringify({
      name: '테',
      interests: [],
      onboardedAt: new Date().toISOString(),
      streak: 0,
      lastActiveDate: getDateStr(),
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

describe('settings listener registration (P1-1 fix)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({
      name: '테',
      interests: ['recruiting'],
      onboardedAt: new Date().toISOString(),
      streak: 0,
      lastActiveDate: getDateStr(),
      xp: 0,
      level: 1,
    }));
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('does not accumulate dg:interests:changed listeners across multiple renders', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const { renderSettings } = await import('../../src/ui/tabs/settings');

    const c1 = document.createElement('div');
    const c2 = document.createElement('div');
    const c3 = document.createElement('div');
    renderSettings(c1);
    renderSettings(c2);
    renderSettings(c3);

    // Count only the 'dg:interests:changed' additions. After the fix,
    // registration happens once at module-load, NOT per render, so calling
    // renderSettings multiple times should NOT increment the count.
    const interestsAdds = addSpy.mock.calls.filter(([type]) => type === 'dg:interests:changed').length;
    expect(interestsAdds).toBeLessThanOrEqual(1);
    addSpy.mockRestore();
  });

  it('event still updates chips after multiple renders (last container wins)', async () => {
    const { renderSettings } = await import('../../src/ui/tabs/settings');
    const c1 = document.createElement('div');
    const c2 = document.createElement('div');
    renderSettings(c1);
    renderSettings(c2);
    document.body.append(c2); // only c2 is mounted

    const raw = JSON.parse(localStorage.getItem('user')!);
    raw.interests = ['recruiting', 'onboarding'];
    localStorage.setItem('user', JSON.stringify(raw));
    document.dispatchEvent(new CustomEvent('dg:interests:changed'));

    await new Promise((r) => setTimeout(r, 20));

    const chipsC2 = c2.querySelectorAll('.interest-chip');
    expect(chipsC2.length).toBe(2);
  });
});
