import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { hydrateStats } from '../../../src/ui/handlers/stats';
import { saveUser } from '../../../src/state/user';
import { mkUser } from '../state/userFixture';

const STATS_DOM = `
  <span id="statStreak"></span><span id="statAnswers"></span>
  <span id="statArticles"></span><span id="statXp"></span>
  <span id="levelIcon"></span><span id="levelName"></span>
  <span id="levelXpText"></span><span id="xpProgressFill"></span>
  <div id="heatmapGrid"></div><div id="badgesGrid"></div>
  <div id="categoryBreakdown"></div><div id="growthSummary"></div>
  <div id="modalRoot"></div>
`;

beforeEach(() => {
  localStorage.clear();
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
  document.body.innerHTML = STATS_DOM;
  saveUser(mkUser({ gamificationMigrated: true }));
});

afterEach(() => { vi.useRealTimers(); });

describe('badge tooltip', () => {
  it('locked 뱃지 click → .show-tooltip 클래스 add', () => {
    hydrateStats();
    const locked = document.querySelector<HTMLButtonElement>('.badge--locked')!;
    locked.click();
    expect(locked.classList.contains('show-tooltip')).toBe(true);
  });

  it('locked 뱃지 → 3초 후 .show-tooltip 자동 제거', () => {
    vi.useFakeTimers();
    hydrateStats();
    const locked = document.querySelector<HTMLButtonElement>('.badge--locked')!;
    locked.click();
    expect(locked.classList.contains('show-tooltip')).toBe(true);
    vi.advanceTimersByTime(3500);
    expect(locked.classList.contains('show-tooltip')).toBe(false);
  });

  it('Enter 키 → tooltip toggle', () => {
    hydrateStats();
    const locked = document.querySelector<HTMLButtonElement>('.badge--locked')!;
    locked.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(locked.classList.contains('show-tooltip')).toBe(true);
  });

  it('Space 키 → tooltip toggle', () => {
    hydrateStats();
    const locked = document.querySelector<HTMLButtonElement>('.badge--locked')!;
    locked.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(locked.classList.contains('show-tooltip')).toBe(true);
  });

  it('aria-describedby — locked 뱃지 tooltip id 연결 (button 자체에 data-tooltip)', () => {
    hydrateStats();
    const locked = document.querySelector<HTMLButtonElement>('.badge--locked')!;
    expect(locked.dataset['tooltip']).toMatch(/달성 조건/);
  });
});
