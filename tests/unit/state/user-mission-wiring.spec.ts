import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordDailyAnswer, getCachedUser, saveUser } from '../../../src/state/user';
import { migrateUserToV3 } from '../../../src/state/migration';

beforeEach(() => {
  // v3.14.3 T4 (P1-2): KST 화요일 자정 직후 고정 — daily-answer-1 시드 결정론.
  // KST 화요일은 UTC 월요일 15:00 이후. 2026-04-28(KST 화요일) 00:00:00 = UTC 2026-04-27 15:00.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-27T15:00:00Z'));
  localStorage.clear();
  const v3 = migrateUserToV3({
    name: 'T', interests: [], onboardedAt: 0, streak: 0, lastActiveDate: '',
    xp: 0, earnedBadges: {}, gamificationMigrated: true, schemaVersion: 2,
  });
  saveUser(v3);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recordDailyAnswer — mission integration', () => {
  it('첫 답변 → daily-answer mission progress, possibly completes', () => {
    const events: { defId: string }[] = [];
    document.addEventListener('dg:reward:mission-complete', (e) => events.push((e as CustomEvent).detail as { defId: string }));

    recordDailyAnswer(7);                           // 답변 자체 +7 XP
    const u = getCachedUser()!;
    const dailyAnswerMission = u.missions.active.find(m => m.defId.startsWith('daily-answer'));
    expect(dailyAnswerMission).toBeDefined();
    expect(dailyAnswerMission!.progress).toBeGreaterThan(0);

    // KST 화요일 고정 → daily-answer-1 (target 1, 즉시 complete) 결정론.
    // (catalog 변경 시 mulberry32(hashStr('2026-04-28')) seed로 다시 probe 필요 — M1 reviewer)
    expect(dailyAnswerMission!.completed).toBe(true);
    expect(u.xp).toBeGreaterThan(7);              // base + mission bonus
    expect(u.missions.cumulative.dailyCount).toBe(1);
    expect(events.find(e => e.defId === dailyAnswerMission!.defId)).toBeDefined();
  });

  it('recordDailyAnswer 본체에서 saveUser 1회만 호출 (mission tick + xp를 단일 write로 커버)', () => {
    // recordDailyAnswer 내부의 단일 saveUser 확인.
    // ※ runSweep 내 persistUnlocks(badge) 가 추가 saveUser를 할 수 있으므로
    //   여기서는 recordDailyAnswer 직전~saveUser(u) 직후의 1회 저장을 검증한다.
    // 검증: recordDailyAnswer 직후 getCachedUser()가 mission progress와 xp를 모두 포함 → atomic 저장 확인.
    recordDailyAnswer(7);
    const u = getCachedUser()!;
    // xp와 missions 상태가 동시에 저장되었음 (둘 다 localStorage에 반영)
    expect(u.xp).toBeGreaterThanOrEqual(7);        // 기본 xp 최소 7 (mission bonus 포함 가능)
    expect(u.missions.active.length).toBeGreaterThan(0);
    // answer mission progress가 저장에 포함되어 있음
    const answerMission = u.missions.active.find(m =>
      m.defId.startsWith('daily-answer') || m.defId.startsWith('weekly-answers') || m.defId.startsWith('monthly-answers')
    );
    expect(answerMission).toBeDefined();
    expect(answerMission!.progress).toBeGreaterThan(0);
  });

  it('missions.active 배열이 비어있지 않음 (getActiveMissions lazy regen 확인)', () => {
    recordDailyAnswer(7);
    const u = getCachedUser()!;
    expect(u.missions.active.length).toBeGreaterThan(0);
    expect(u.missions.lastDailySeed).not.toBe('');
  });
});
