import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getKstDateStr } from '../../src/utils/dates';

describe('openInterestsModal', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const root = document.createElement('div');
    root.id = 'modalRoot';
    document.body.append(root);
    const toast = document.createElement('div');
    toast.className = 'toast-container';
    document.body.append(toast);
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({
      name: '테',
      interests: ['recruiting', 'onboarding'],
      onboardedAt: new Date().toISOString(),
      streak: 0,
      lastActiveDate: getKstDateStr(),
      xp: 0,
      level: 1,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows current interests as checked, others unchecked', async () => {
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    openInterestsModal();
    const recruiting = document.querySelector<HTMLInputElement>('input[value="recruiting"]');
    const onboarding = document.querySelector<HTMLInputElement>('input[value="onboarding"]');
    expect(recruiting?.checked).toBe(true);
    expect(onboarding?.checked).toBe(true);
    // Some unchecked category should exist (pick any non-recruiting, non-onboarding)
    const boxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const unchecked = Array.from(boxes).filter((b) => !b.checked);
    expect(unchecked.length).toBeGreaterThan(0);
  });

  it('save persists new interests to localStorage', async () => {
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    openInterestsModal();
    // Uncheck recruiting, keep onboarding, add one more
    const recruiting = document.querySelector<HTMLInputElement>('input[value="recruiting"]')!;
    recruiting.checked = false;
    recruiting.dispatchEvent(new Event('change', { bubbles: true }));

    const boxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const firstUnchecked = Array.from(boxes).find((b) => !b.checked && b.value !== 'recruiting');
    if (firstUnchecked) {
      firstUnchecked.checked = true;
      firstUnchecked.dispatchEvent(new Event('change', { bubbles: true }));
    }

    document.querySelector<HTMLButtonElement>('#saveInterestsBtn')!.click();

    const user = JSON.parse(localStorage.getItem('user')!);
    expect(user.interests).not.toContain('recruiting');
    expect(user.interests).toContain('onboarding');
    if (firstUnchecked) expect(user.interests).toContain(firstUnchecked.value);
  });

  it('save dispatches dg:interests:changed event', async () => {
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    openInterestsModal();
    const listener = new Promise<void>((resolve) => {
      document.addEventListener('dg:interests:changed', () => resolve(), { once: true });
    });
    document.querySelector<HTMLButtonElement>('#saveInterestsBtn')!.click();
    await listener; // resolves or times out
  });

  it('save disabled when zero interests checked', async () => {
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    openInterestsModal();
    const boxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    boxes.forEach((b) => {
      b.checked = false;
      b.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const save = document.querySelector<HTMLButtonElement>('#saveInterestsBtn');
    expect(save?.disabled).toBe(true);
  });

  it('cancel does not persist changes', async () => {
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    openInterestsModal();
    const recruiting = document.querySelector<HTMLInputElement>('input[value="recruiting"]')!;
    recruiting.checked = false;
    recruiting.dispatchEvent(new Event('change'));

    document.querySelector<HTMLButtonElement>('#cancelInterestsBtn')!.click();

    const user = JSON.parse(localStorage.getItem('user')!);
    expect(user.interests).toContain('recruiting');
  });

  it('no-op when user not in localStorage', async () => {
    localStorage.clear();
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    expect(() => openInterestsModal()).not.toThrow();
    // Modal should not open
    expect(document.querySelector('.dg-modal')).toBeNull();
  });

  it('shows quota toast when saveUser throws QuotaExceededError', async () => {
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    openInterestsModal();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const saveBtn = document.getElementById('saveInterestsBtn') as HTMLButtonElement;
    saveBtn.click();

    const toast = document.querySelector('.toast');
    expect(toast?.textContent).toContain('저장 공간이 가득 찼어요');
  });

  it('shows fallback toast for generic save error', async () => {
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    openInterestsModal();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('generic storage error');
    });

    const saveBtn = document.getElementById('saveInterestsBtn') as HTMLButtonElement;
    saveBtn.click();

    const toast = document.querySelector('.toast');
    expect(toast?.textContent).toContain('저장하지 못했어요');
  });

  it('keeps modal open when save fails (재시도 기회)', async () => {
    const { openInterestsModal } = await import('../../src/ui/modals/interests');
    openInterestsModal();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const saveBtn = document.getElementById('saveInterestsBtn') as HTMLButtonElement;
    saveBtn.click();

    // Modal wrapper(.dg-modal) should still be in DOM — closeModal() removes it.
    // Asserting the wrapper itself (not just the save button) guards against
    // future refactors that might keep the button alive while detaching the modal.
    expect(document.querySelector('.dg-modal')).not.toBeNull();
    expect(document.getElementById('saveInterestsBtn')).not.toBeNull();
  });
});
