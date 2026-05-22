/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderGardenGrid } from '../../src/ui/components/garden-grid';
import type { User } from '../../src/state/user';

function makeUser(plantStages: Record<string, number>): User {
  const interests = Object.keys(plantStages);
  const plantStateByInterest: User['plantStateByInterest'] = {};
  for (const id of interests) {
    plantStateByInterest[id] = {
      stage: plantStages[id] as 1 | 2 | 3 | 4 | 5,
      cumulativeActivity: 1,
      lastWaterDate: '2026-05-22',
    } as User['plantStateByInterest'][string];
  }
  return {
    interests,
    plantStateByInterest,
  } as unknown as User;
}

describe('renderGardenGrid — max stage ambient (v3.50 M4)', () => {
  let root: HTMLDivElement;
  beforeEach(() => {
    root = document.createElement('div');
  });

  it('no bloomed plant: only .garden-grid (no --has-bloomed)', () => {
    const user = makeUser({ tech: 3, design: 2 });
    renderGardenGrid(root, user);
    const grid = root.querySelector('.garden-grid');
    expect(grid).not.toBeNull();
    expect(grid?.classList.contains('garden-grid--has-bloomed')).toBe(false);
    expect((grid as HTMLElement).style.getPropertyValue('--bloomed-count')).toBe('0');
  });

  it('one bloomed plant: .garden-grid--has-bloomed + --bloomed-count=1', () => {
    const user = makeUser({ tech: 5, design: 2 });
    renderGardenGrid(root, user);
    const grid = root.querySelector('.garden-grid');
    expect(grid?.classList.contains('garden-grid--has-bloomed')).toBe(true);
    expect((grid as HTMLElement).style.getPropertyValue('--bloomed-count')).toBe('1');
  });

  it('five bloomed plants: --bloomed-count=5 (raw, no JS cap)', () => {
    const user = makeUser({ a: 5, b: 5, c: 5, d: 5, e: 5 });
    renderGardenGrid(root, user);
    const grid = root.querySelector('.garden-grid');
    expect(grid?.classList.contains('garden-grid--has-bloomed')).toBe(true);
    expect((grid as HTMLElement).style.getPropertyValue('--bloomed-count')).toBe('5');
  });

  it('empty interests: garden-empty fallback, no bloom class', () => {
    const user = makeUser({});
    renderGardenGrid(root, user);
    expect(root.querySelector('.garden-empty')).not.toBeNull();
    expect(root.querySelector('.garden-grid--has-bloomed')).toBeNull();
  });
});
