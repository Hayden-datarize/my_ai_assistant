import { describe, it, expect } from 'vitest';
import { getActiveMissions } from '../../../src/state/missionEngine';
import type { User } from '../../../src/state/user';

/**
 * v3.14.4 T8 (M3): test seed 명시.
 * minimal v3 user fixture — earnedBadges, missions, gamificationMigrated 모두 포함.
 * `Partial<User> as User` cast는 v3.14.3 T8 (P3-T2-polish) 합의된 패턴.
 */
function makeUser(): User {
  return {
    name: 'T', interests: ['pm'], onboardedAt: '2026-04-01',
    streak: 0, lastActiveDate: '', xp: 0, earnedBadges: {},
    gamificationMigrated: true, schemaVersion: 7,
    missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
      lastDailySeed: '', currentWeekIso: '', currentMonthIso: '' },
    plantStateByInterest: {},
    gardenIntroduced: false,
    gardenBackfilled: false,
    streakFreeze: { count: 2, lastEarnedAt: '2026-05-07' },
    insights: [],
  } as Partial<User> as User;
}

/**
 * `getActiveMissions` — KST cross-midnight rollover 검증 (v3.13.2 P2-1 / v3.14.4 T8 주석 보강).
 *
 * - daily mission window는 KST 자정 00:00:00 기준으로 rotate (`lastDailySeed` 갱신).
 * - test seed (M3): `new Date(2026, 4, 2, ...)` = JS local TZ를 KST(UTC+9)로 가정.
 *   vitest는 시스템 TZ를 사용하므로 CI는 `TZ=Asia/Seoul`로 고정 (vitest.config / package.json).
 * - rotation deterministic (M2): `pickDailyMissions(dateIso, now)`는 `mulberry32(hashStr(dateIso))`
 *   기반 seeded RNG. **같은 KST date 동안은 같은 daily 미션 ID 집합 반환** (input
 *   dependent purity). 따라서 same-`now` 호출은 idempotent (`dirty=false` on 2nd call),
 *   cross-midnight 호출은 새 dateIso로 reseed → daily set 재생성 (`dirty=true`).
 * - midnight rollover invariant (M1): caller는 prev/curr 사이에 단일 `now` 캡처 사용.
 *   별도 `now` 인스턴스 사용 시 자정 경계에서 `lastDailySeed` 갱신 → defId 매칭 깨짐.
 *   `recordDailyAnswer` / `fireTrigger` / `mutateWithSweep` 모든 sweep entry-point가 준수.
 */
describe('getActiveMissions — cross-midnight paired-call (v3.13.2 P2-1)', () => {
  it('paired prev/curr with same now is consistent', () => {
    const u = makeUser();
    // M3: KST 2026-05-02 (토) 10:00 — 평일 daily seed deterministic anchor.
    const now = new Date(2026, 4, 2, 10, 0, 0);
    const prev = getActiveMissions(now, u);
    const curr = getActiveMissions(now, u);
    // M2: same dateIso → same seed → same defId set (rotation deterministic).
    expect(prev.active.length).toBe(curr.active.length);
    expect(prev.active.map(m => m.defId).sort()).toEqual(curr.active.map(m => m.defId).sort());
  });

  it('cross-midnight (separate now objects) regenerates daily missions', () => {
    const u = makeUser();
    // M1 (KST cross-midnight 주석): JS Date local TZ를 KST로 가정.
    // 23:59:50 → 00:00:10 (10초 경과)에 별도 Date 인스턴스 사용 — caller invariant 위반 케이스
    // 시뮬레이션. `lastDailySeed`가 새 dateIso로 갱신되어 daily set regen + dirty=true 검증.
    // v3.22 T6: 명시 KST instant 사용 — `new Date(year, month, ...)`은 머신 TZ 의존이라
    // NY 머신에서 KST cross-midnight 미발생. ISO+09:00 suffix로 머신 무관.
    const before = new Date('2026-05-02T23:59:50+09:00');
    const after  = new Date('2026-05-03T00:00:10+09:00');
    const prev = getActiveMissions(before, u);
    const dailyBefore = prev.active.filter(m => m.period === 'daily').map(m => m.defId);
    expect(dailyBefore.length).toBeGreaterThan(0);
    const curr = getActiveMissions(after, u);
    expect(curr.dirty).toBe(true);
    // M2: cross-midnight reseed의 side-effect — `lastDailySeed`가 빈 문자열에서 채워짐.
    expect(u.missions.lastDailySeed).not.toBe('');
  });

  it('single now capture invariant: same now produces idempotent dirty=false on second call', () => {
    const u = makeUser();
    // M1: 단일 `now` 캡처 — sweep entry-point의 표준 호출 패턴.
    // 2nd 호출은 `lastDailySeed === todayIso` 이므로 reseed skip → dirty=false.
    const now = new Date(2026, 4, 2, 10, 0, 0);
    getActiveMissions(now, u);
    const second = getActiveMissions(now, u);
    expect(second.dirty).toBe(false);
  });
});
