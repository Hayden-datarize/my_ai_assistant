import { describe, it, expect, beforeEach } from 'vitest';
import { loadUserData, saveUser, getCachedUser } from '../../../src/state/user';
import { migrateUserToV2, migrateUserToV3 } from '../../../src/state/migration';
import { mkUser } from './userFixture';

beforeEach(() => localStorage.clear());

describe('user schema v2 migration', () => {
  it('migrateUserToV2: v1 → v2 (level 제거, 신규 필드 채움)', () => {
    const v1 = { name: '하든', interests: ['AI'], onboardedAt: '2026-01-01', streak: 5, lastActiveDate: '2026-04-29', xp: 250, level: 3 };
    const v2 = migrateUserToV2(v1);
    expect(v2.schemaVersion).toBe(2);
    expect((v2 as any).level).toBeUndefined();
    expect(v2.earnedBadges).toEqual({});
    expect(v2.gamificationMigrated).toBe(false);
    expect(v2.streak).toBe(5);
    expect(v2.xp).toBe(250);
    expect(v2.interests).toEqual(['AI']);
  });

  it('loadUserData: schemaVersion 없으면 lazy migrate v1→v5 + saveUser 1회', () => {
    localStorage.setItem('user', JSON.stringify({ name: '하든', interests: [], onboardedAt: '2026-01-01', streak: 0, lastActiveDate: '', xp: 0, level: 1 }));
    const u = loadUserData()!;
    expect(u.schemaVersion).toBe(5);
    expect((u as any).level).toBeUndefined();
    expect(u.earnedBadges).toEqual({});
    expect(u.streakFreeze.count).toBe(2);
    expect(u.streakFreeze.lastEarnedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const raw = JSON.parse(localStorage.getItem('user')!);
    expect(raw.schemaVersion).toBe(5);
  });

  it('loadUserData: schemaVersion 3 idempotent (재호출해도 동일)', () => {
    saveUser(mkUser({ name: '하든', onboardedAt: '2026-01-01' }));
    const a = loadUserData()!;
    const b = loadUserData()!;
    expect(a).toEqual(b);
  });

  it('recordDailyAnswer: u.level 필드 갱신 안 함 (제거됨)', async () => {
    saveUser(mkUser({ name: '하든', onboardedAt: '2026-01-01', xp: 99 }));
    const { recordDailyAnswer } = await import('../../../src/state/user');
    recordDailyAnswer(10);
    const raw = JSON.parse(localStorage.getItem('user')!);
    // v3.13 mission wiring: daily mission 즉시 완수 시 rewardXp 가산 가능. base +10 최소.
    expect(raw.xp).toBeGreaterThanOrEqual(109);
    expect(raw.level).toBeUndefined();
  });

  it('migrateUserToV2: earnedBadges 이미 있으면 보존 (idempotent guard)', () => {
    const partial = { name: 'x', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '', xp: 0, earnedBadges: { 'streak-3': 1700000000000 } };
    const v2 = migrateUserToV2(partial);
    expect(v2.earnedBadges).toEqual({ 'streak-3': 1700000000000 });
  });

  it('migrateUserToV2: gamificationMigrated 이미 true면 보존', () => {
    const partial = { name: 'x', interests: [], onboardedAt: '', streak: 0, lastActiveDate: '', xp: 0, gamificationMigrated: true };
    const v2 = migrateUserToV2(partial);
    expect(v2.gamificationMigrated).toBe(true);
  });

  describe('getCachedUser shape guard (P2-NEW-2)', () => {
    it('손상된 xp (string) → null 반환', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'x', interests: [], onboardedAt: '', streak: 0,
        lastActiveDate: '', xp: 'abc', schemaVersion: 2,
        earnedBadges: {}, gamificationMigrated: false,
      }));
      expect(loadUserData()).toBeNull();
    });

    it('손상된 streak (NaN-like) → null 반환', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'x', interests: [], onboardedAt: '', streak: null,
        lastActiveDate: '', xp: 0, schemaVersion: 2,
        earnedBadges: {}, gamificationMigrated: false,
      }));
      expect(loadUserData()).toBeNull();
    });

    it('손상된 interests (object) → null 반환', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'x', interests: { fake: 1 }, onboardedAt: '', streak: 0,
        lastActiveDate: '', xp: 0, schemaVersion: 2,
        earnedBadges: {}, gamificationMigrated: false,
      }));
      expect(loadUserData()).toBeNull();
    });

    it('손상된 name (number) → null 반환', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 42, interests: [], onboardedAt: '', streak: 0,
        lastActiveDate: '', xp: 0, schemaVersion: 2,
        earnedBadges: {}, gamificationMigrated: false,
      }));
      expect(loadUserData()).toBeNull();
    });

    it('손상된 데이터는 localStorage에서 삭제하지 않음 (raw 보존)', () => {
      const corrupted = JSON.stringify({
        name: 'x', interests: [], onboardedAt: '', streak: 0,
        lastActiveDate: '', xp: 'abc', schemaVersion: 2,
        earnedBadges: {}, gamificationMigrated: false,
      });
      localStorage.setItem('user', corrupted);
      expect(loadUserData()).toBeNull();
      expect(localStorage.getItem('user')).toBe(corrupted);
    });

    it('isValidUserShape: interests 배열에 비-string 요소 있으면 null 반환 (v3.13.1 T11 / P2-NEW-3)', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'A',
        interests: ['hr_system', 123, null],                                          // 비-string 섞임
        streak: 0,
        lastActiveDate: '',
        xp: 0,
        earnedBadges: {},
        gamificationMigrated: true,
        schemaVersion: 2,
      }));
      expect(getCachedUser()).toBeNull();
    });

    it('isValidUserShape: interests 배열의 모든 요소가 string이면 정상 반환 (v3.13.1 T11)', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'A',
        interests: ['hr_system', 'self_dev'],
        streak: 0,
        lastActiveDate: '',
        xp: 0,
        earnedBadges: {},
        gamificationMigrated: true,
        schemaVersion: 2,
      }));
      const u = getCachedUser();
      expect(u).not.toBeNull();
      expect(u!.interests).toEqual(['hr_system', 'self_dev']);
    });
  });

  it('migrateUserToV3: idempotent path returns new missions reference (immutable, atomic)', () => {
    const raw: any = {
      name: 'A', interests: [], streak: 0, lastActiveDate: '', xp: 0,
      earnedBadges: {}, gamificationMigrated: true, schemaVersion: 3,
      missions: {
        active: [],
        cumulative: { dailyCount: 1, weeklyCount: 2, monthlyCount: 3 },
        lastDailySeed: '2026-05-01',
        currentWeekIso: '2026-W18',
        currentMonthIso: '2026-05',
      },
    };
    const result = migrateUserToV3(raw);
    // immutable 패턴: result는 raw와 다른 missions / cumulative 객체
    expect(result.missions).not.toBe(raw.missions);
    expect(result.missions.cumulative).not.toBe(raw.missions.cumulative);
    // v3.14.4 T2: active 배열도 sanitize 통과한 새 배열 (windowStart/progress NaN/Infinity 가드).
    // sanitize는 마이그레이션 시점 one-shot이며, 이후 caller가 보유한 result.missions.active를
    // 사용하므로 tickMissionProgress의 in-place mutation invariant(C6)는 마이그레이션 이후
    // 시점부터 정상 유지된다.
    expect(result.missions.active).not.toBe(raw.missions.active);
    // 값은 보존
    expect(result.missions.cumulative.dailyCount).toBe(1);
    expect(result.missions.cumulative.weeklyCount).toBe(2);
    expect(result.missions.cumulative.monthlyCount).toBe(3);
    expect(result.missions.lastDailySeed).toBe('2026-05-01');
    expect(result.missions.currentWeekIso).toBe('2026-W18');
    expect(result.missions.currentMonthIso).toBe('2026-05');
  });
});
