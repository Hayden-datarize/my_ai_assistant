import { describe, it, expect, beforeEach } from 'vitest';
import { renderGardenGrid } from '../../src/ui/components/garden-grid';
import { saveUser, loadUserData } from '../../src/state/user';
import { wireGardenGridClicks } from '../../src/ui/tabs/stats';
import { mkUser } from '../unit/state/userFixture';

describe('garden-grid click wiring (사전 review P0-4 fix)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    localStorage.clear();
  });

  it('garden card는 <button>으로 렌더 + aria-label 보유', () => {
    const root = document.getElementById('root')!;
    saveUser(mkUser({
      gardenBackfilled: true,
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } as never },
    }));
    renderGardenGrid(root, loadUserData()!);

    const card = root.querySelector('.garden-card[data-interest-id="leadership"]') as HTMLButtonElement;
    expect(card.tagName).toBe('BUTTON');
    expect(card.getAttribute('aria-label')).toContain('정원');
  });

  it('garden card click + wireup 발동 → modal open', () => {
    const root = document.getElementById('root')!;
    saveUser(mkUser({
      gardenBackfilled: true,
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } as never },
    }));
    renderGardenGrid(root, loadUserData()!);
    wireGardenGridClicks(root);                            // 사전 review P0-4 fix: wireup 명시 발동

    const card = root.querySelector('.garden-card[data-interest-id="leadership"]') as HTMLButtonElement;
    card.click();
    expect(document.querySelector('.plant-detail-modal')).toBeTruthy();
  });

  it('Esc key → modal close (shared.openModal이 처리)', () => {
    const root = document.getElementById('root')!;
    saveUser(mkUser({
      gardenBackfilled: true,
      interests: ['leadership'],
      plantStateByInterest: { leadership: { stage: 2, cumulativeActivity: 10 } as never },
    }));
    renderGardenGrid(root, loadUserData()!);
    wireGardenGridClicks(root);

    const card = root.querySelector('.garden-card[data-interest-id="leadership"]') as HTMLButtonElement;
    card.click();
    expect(document.querySelector('.plant-detail-modal')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.dg-modal')).toBeFalsy();
  });
});
