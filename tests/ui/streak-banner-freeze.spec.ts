import { describe, it, expect, beforeEach } from 'vitest';
import { updateStreakBanner, saveUser } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';

/**
 * v3.21 T4: streak banner freeze 표시 spec.
 * 정책:
 *   - streak > 0 + freeze.count > 0 → "🔥 N일 연속 성장 중 · ❄️ M"
 *   - streak > 0 + freeze.count = 0 → "🔥 N일 연속 성장 중" (❄️ 숨김)
 *   - streak = 0 → "오늘부터 다시 시작해봐요" (freeze 무시 — streak 0이 우선)
 */
describe('updateStreakBanner with freeze', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax -- jsdom fixture, no user interpolation
    document.body.innerHTML = '<div id="streakBanner"></div>';
    localStorage.clear();
  });

  it('streak 7 + freeze 2 → "🔥 7일 연속 성장 중 · ❄️ 2"', () => {
    saveUser(mkUser({ streak: 7, lastActiveDate: '2026-05-08', streakFreeze: { count: 2, lastEarnedAt: '2026-05-08' } }));
    updateStreakBanner();
    expect(document.getElementById('streakBanner')!.textContent).toBe('🔥 7일 연속 성장 중 · ❄️ 2');
  });

  it('streak 7 + freeze 0 → "🔥 7일 연속 성장 중" (❄️ 숨김)', () => {
    saveUser(mkUser({ streak: 7, lastActiveDate: '2026-05-08', streakFreeze: { count: 0, lastEarnedAt: '2026-05-08' } }));
    updateStreakBanner();
    expect(document.getElementById('streakBanner')!.textContent).toBe('🔥 7일 연속 성장 중');
  });

  it('streak 0 + freeze 2 → "오늘부터 다시 시작해봐요" (streak 0이 우선, freeze 무시)', () => {
    saveUser(mkUser({ streak: 0, lastActiveDate: '2026-05-08', streakFreeze: { count: 2, lastEarnedAt: '2026-05-08' } }));
    updateStreakBanner();
    expect(document.getElementById('streakBanner')!.textContent).toBe('오늘부터 다시 시작해봐요');
  });
});
