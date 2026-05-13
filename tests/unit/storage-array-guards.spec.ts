import { beforeEach, describe, expect, it } from 'vitest';
import { loadAnswers } from '../../src/state/persistence';
import { loadBriefings } from '../../src/state/briefings';
import { getEntityCounts } from '../../src/ui/handlers/archive';
import { renderArchive } from '../../src/ui/tabs/archive';
import { renderSettings } from '../../src/ui/tabs/settings';
import { hydrateStats } from '../../src/ui/handlers/stats';

function appendStatsFixture(): void {
  const ids = [
    'levelIcon',
    'levelName',
    'levelXpText',
    'xpProgressFill',
    'statAnswers',
    'statScraps',
    'statInsights',
    'heatmapGrid',
    'heatmapInfo',
    'badgesGrid',
    'categoryBreakdown',
    'growthSummary',
    'gardenContainer',
  ];
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    document.body.append(el);
  }
}

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
});

describe('Array.isArray storage guards (v3.31 T2 P2-2)', () => {
  it('loadAnswers returns [] for corrupted dg.answers and legacy answers objects', () => {
    localStorage.setItem('dg.answers', JSON.stringify({ length: 99 }));
    localStorage.setItem('answers', JSON.stringify({ length: 99 }));
    expect(loadAnswers()).toEqual([]);
  });

  it('loadBriefings returns [] for corrupted briefings object', () => {
    localStorage.setItem('briefings', JSON.stringify({ length: 99 }));
    expect(loadBriefings()).toEqual([]);
  });

  it('archive counts and renderArchive do not throw with corrupted answers and briefings', () => {
    localStorage.setItem('dg.answers', JSON.stringify({ length: 99 }));
    localStorage.setItem('answers', JSON.stringify({ length: 99 }));
    localStorage.setItem('briefings', JSON.stringify({ length: 99 }));

    expect(() => getEntityCounts()).not.toThrow();
    expect(getEntityCounts()).toEqual({ all: 0, answer: 0, scrap: 0, insight: 0 });

    const root = document.createElement('main');
    expect(() => renderArchive(root)).not.toThrow();
    expect(root.querySelector('#archiveTab')).not.toBeNull();
  });

  it('settings delete-all and stats hydrate paths do not throw with corrupted arrays', () => {
    localStorage.setItem('dg.answers', JSON.stringify({ length: 99 }));
    localStorage.setItem('briefings', JSON.stringify({ length: 99 }));

    const settingsRoot = document.createElement('main');
    expect(() => renderSettings(settingsRoot)).not.toThrow();
    expect(settingsRoot.querySelector<HTMLButtonElement>('#deleteAllAnswersBtn')?.disabled).toBe(true);

    appendStatsFixture();
    expect(() => hydrateStats()).not.toThrow();
  });
});
