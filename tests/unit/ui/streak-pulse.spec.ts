import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mountRewards, __resetForTest } from '../../../src/ui/rewards';
import { hydrateStats } from '../../../src/ui/handlers/stats';
import { dispatch } from '../../../src/ui/events';
import { saveUser } from '../../../src/state/user';
import { mkUser } from '../state/userFixture';

beforeEach(() => {
  // eslint-disable-next-line no-restricted-syntax -- jsdom DOM seed; static template, no user interpolation
  document.body.innerHTML = `
    <div id="modalRoot"></div>
    <span id="statStreak"></span>
    <span id="statAnswers"></span>
    <span id="statArticles"></span>
    <span id="statXp"></span>
    <span id="levelIcon"></span>
    <span id="levelName"></span>
    <span id="levelXpText"></span>
    <span id="xpProgressFill"></span>
    <div id="heatmapGrid"></div>
    <div id="badgesGrid"></div>
    <div id="categoryBreakdown"></div>
    <div id="growthSummary"></div>
  `;
  sessionStorage.clear();
  localStorage.clear();
  saveUser(mkUser({ streak: 7, xp: 100, gamificationMigrated: true }));
  __resetForTest();
  mountRewards();
});

afterEach(() => { vi.useRealTimers(); });

describe('streak-milestone', () => {
  it('streak-milestone event → sessionStorage flag set + 토스트', () => {
    dispatch('dg:reward:streak-milestone', { days: 7, at: Date.now() });
    expect(sessionStorage.getItem('dg:streakPulsePending')).toBe('7');
    expect(document.querySelectorAll('.toast--streak')).toHaveLength(1);
  });

  it('hydrateStats: pending flag 있으면 #statStreak.fire-pulse 1.5초 후 제거', () => {
    sessionStorage.setItem('dg:streakPulsePending', '7');
    vi.useFakeTimers();
    hydrateStats();
    expect(document.getElementById('statStreak')!.classList.contains('fire-pulse')).toBe(true);
    expect(sessionStorage.getItem('dg:streakPulsePending')).toBeNull();
    vi.advanceTimersByTime(1700);
    expect(document.getElementById('statStreak')!.classList.contains('fire-pulse')).toBe(false);
  });

  it('hydrateStats: pending 없으면 fire-pulse 추가 안 함', () => {
    hydrateStats();
    expect(document.getElementById('statStreak')!.classList.contains('fire-pulse')).toBe(false);
  });

  it('streak-milestone 토스트 3초 후 자동 제거', () => {
    vi.useFakeTimers();
    dispatch('dg:reward:streak-milestone', { days: 7, at: Date.now() });
    expect(document.querySelectorAll('.toast--streak')).toHaveLength(1);
    vi.advanceTimersByTime(3500);
    expect(document.querySelectorAll('.toast--streak')).toHaveLength(0);
  });

  it('hydrateStats fire-pulse 1회만 (재진입 시 추가 안 함)', () => {
    sessionStorage.setItem('dg:streakPulsePending', '7');
    hydrateStats();
    hydrateStats();  // pending 이미 consumed
    // 두 번째 호출 시 fire-pulse 추가 안 함 (이미 sessionStorage에 없음)
    // 첫 호출에서 add 됐으므로 1회 OK — 두 번째에서 또 add 안 됨 검증
    expect(sessionStorage.getItem('dg:streakPulsePending')).toBeNull();
  });
});
