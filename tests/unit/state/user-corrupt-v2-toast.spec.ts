import { describe, it, expect, beforeEach } from 'vitest';

describe('getCachedUser — corrupt v2 toast (v3.12.1 P2-NEW-4)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="modalRoot"></div>';
  });

  it('shows toast when localStorage user JSON is malformed', async () => {
    localStorage.setItem('user', '{not-valid-json'); // 의도적 malformed
    const { getCachedUser } = await import('../../../src/state/user');
    const u = getCachedUser();
    expect(u).toBeNull();
    // toast 검증 — dynamic import는 microtask이므로 await 필요
    await new Promise(r => setTimeout(r, 10));
    const toast = document.querySelector('.toast');
    expect(toast?.textContent ?? '').toMatch(/데이터|손상|복구/);
  });

  it('does NOT show toast for clean (no-data) state', async () => {
    const { getCachedUser } = await import('../../../src/state/user');
    const u = getCachedUser();
    expect(u).toBeNull();
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('shows toast when JSON valid but shape invalid (e.g. missing interests)', async () => {
    // schemaVersion 3 + 일부 필드 누락 (interests 없음 → isValidUserShape 실패)
    localStorage.setItem('user', JSON.stringify({
      name: 'T', /* interests missing! */ onboardedAt: '2026-04-01',
      streak: 0, lastActiveDate: '', xp: 0, earnedBadges: {},
      gamificationMigrated: true, schemaVersion: 3,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
                  lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    }));
    const { getCachedUser } = await import('../../../src/state/user');
    const u = getCachedUser();
    expect(u).toBeNull();
    await new Promise(r => setTimeout(r, 10));
    const toast = document.querySelector('.toast');
    expect(toast?.textContent ?? '').toMatch(/데이터|손상|복구/);
  });
});
