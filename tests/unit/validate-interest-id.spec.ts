/**
 * v3.25 T1: Insight.interestId entry-level guard spec.
 *
 * - INTERESTS 15개 whitelist 매칭 → 그대로 반환
 * - 매칭 실패 또는 'unknown' sentinel → 'unknown'
 * - trim은 caller 책임 (parseInsightResponse가 처리)
 *
 * v3.25 T2 NEW: isValidUserShape Insight entry-level shape 강화 spec (Codex P0-A1 fix).
 * - migrate chain (V3→V4→V5→V6→V7) 끝난 후 entry-level 검증.
 * - v6 user는 migrateUserToV7에서 interestId='unknown' 채워지므로 데이터 손실 0.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { validateInterestId, getCachedUser } from '../../src/state/user';

describe('validateInterestId (v3.25 T1)', () => {
  it('whitelist 멤버는 그대로 반환', () => {
    expect(validateInterestId('recruiting')).toBe('recruiting');
    expect(validateInterestId('ai_ml')).toBe('ai_ml');
    expect(validateInterestId('self_dev')).toBe('self_dev');
  });

  it('whitelist 외 string은 unknown 폴백', () => {
    expect(validateInterestId('hallucinated')).toBe('unknown');
    expect(validateInterestId('')).toBe('unknown');
    expect(validateInterestId('  recruiting  ')).toBe('unknown');  // trim은 caller 책임
  });

  it("'unknown' 입력은 그대로 unknown (whitelist 외이지만 sentinel)", () => {
    expect(validateInterestId('unknown')).toBe('unknown');
  });

  // v3.25 T1 review M1: case-sensitive 정책 명시 (INTERESTS id는 lowercase snake_case).
  it('case-sensitive — 대소문자 다르면 unknown', () => {
    expect(validateInterestId('Recruiting')).toBe('unknown');
    expect(validateInterestId('AI_ML')).toBe('unknown');
    expect(validateInterestId('SELF_DEV')).toBe('unknown');
  });
});

describe('isValidUserShape — Insight entry shape (v3.25 T2)', () => {
  beforeEach(() => { localStorage.clear(); });

  function makeBaseUser(): Record<string, unknown> {
    return {
      schemaVersion: 8,
      name: 'X', interests: [], onboardedAt: '2026-01-01',
      streak: 0, lastActiveDate: '2026-01-01',
      xp: 0, earnedBadges: {}, gamificationMigrated: true,
      missions: { active: [], cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
                  lastDailySeed: '2026-01-01', currentWeekIso: '2026-W01', currentMonthIso: '2026-01' },
      plantStateByInterest: {}, gardenIntroduced: true, gardenBackfilled: true,
      streakFreeze: { count: 2, lastEarnedAt: '2026-01-01' },
      insights: [],
      xpHistory: [],  // v3.27 T1: v8 isValidUserShape required
    };
  }

  it('정상 v7 insights — getCachedUser 통과', () => {
    const u = makeBaseUser();
    u.insights = [{ id: 'i1', text: 'ok', createdAt: '2026-01-01', interestId: 'recruiting' }];
    localStorage.setItem('user', JSON.stringify(u));
    expect(getCachedUser()).not.toBeNull();
  });

  it('v7 insights[].interestId 누락 — getCachedUser null', () => {
    const u = makeBaseUser();
    u.insights = [{ id: 'i1', text: 'ok', createdAt: '2026-01-01' }];
    localStorage.setItem('user', JSON.stringify(u));
    expect(getCachedUser()).toBeNull();
  });

  it('v7 insights[].interestId 비-string — getCachedUser null', () => {
    const u = makeBaseUser();
    u.insights = [{ id: 'i1', text: 'ok', createdAt: '2026-01-01', interestId: 123 }];
    localStorage.setItem('user', JSON.stringify(u));
    expect(getCachedUser()).toBeNull();
  });

  it('v6 insights — migrateUserToV7→V8로 자동 변환 후 통과 (interestId=unknown 채움)', () => {
    const u = makeBaseUser();
    u.schemaVersion = 6;  // v6 user (interestId 없음)
    u.insights = [{ id: 'i1', text: 'ok', createdAt: '2026-01-01' }];  // interestId 없음
    localStorage.setItem('user', JSON.stringify(u));
    const result = getCachedUser();
    expect(result).not.toBeNull();
    expect(result!.schemaVersion).toBe(8);  // v3.27 T1: chain v6→v7→v8
    expect(result!.insights[0]!.interestId).toBe('unknown');
  });
});
