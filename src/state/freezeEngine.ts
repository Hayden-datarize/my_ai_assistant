import type { User } from './user';
import { getKstDateStr } from '../utils/dates';

const SEVEN_DAYS_MS = 7 * 86400_000;
const FREEZE_CAP = 2;

/**
 * Streak Freeze 충전 로직 (rolling 7-day window from lastEarnedAt, cap 2).
 *
 * - gap < 7d → no-op
 * - gap N×7d → +N regen (cap 2까지 clamp), lastEarnedAt += N×7d
 * - count == cap → no-op (시간/포인터 모두 보존)
 * - 시계 역행 (now < lastEarnedAt) → no-op
 * - 손상 lastEarnedAt → today으로 reset (count 유지, v3.12 silent NaN 차단 lesson)
 *
 * KST 자정 anchor (Pattern A graduated v3.14.5 — Date.parse(date + 'T00:00:00+09:00')).
 * In-memory 변경만 (saveUser 호출 X — caller 책임).
 */
export function regenerateFreeze(u: User, now: Date): void {
  const lastEarnedMs = Date.parse(u.streakFreeze.lastEarnedAt + 'T00:00:00+09:00');
  if (!Number.isFinite(lastEarnedMs)) {
    // 손상된 lastEarnedAt → today으로 reset (count 유지)
    u.streakFreeze.lastEarnedAt = getKstDateStr(now);
    return;
  }

  const elapsedMs = now.getTime() - lastEarnedMs;
  if (elapsedMs < SEVEN_DAYS_MS) return;

  const quotient = Math.floor(elapsedMs / SEVEN_DAYS_MS);
  if (quotient <= 0) return;  // 시계 역행 방어 (elapsedMs ≥ 7d 이미 통과했으나 이중 가드)

  const room = FREEZE_CAP - u.streakFreeze.count;
  if (room <= 0) return;

  const grant = Math.min(quotient, room);
  u.streakFreeze.count += grant;

  // lastEarnedAt += quotient × 7d (cap 도달해도 시간은 진행 — 다음 충전 기준 동기화)
  const newLastEarnedMs = lastEarnedMs + quotient * SEVEN_DAYS_MS;
  u.streakFreeze.lastEarnedAt = getKstDateStr(new Date(newLastEarnedMs));
}

/**
 * Streak Freeze 소비 로직 (Duolingo 정석).
 *
 * 결석한 날짜 수(gap) 만큼 freeze를 1:1 소비하여 streak를 보존한다.
 *
 * - gap 0 또는 음수/NaN/Infinity → no-op (consumed 0, preserved true)
 * - gap N + count ≥ N → N consume, preserved true (streak 보존)
 * - gap N + count < N → 가용한 만큼 소비, preserved false (streak reset)
 *
 * In-memory 변경만 (saveUser 호출 X — caller 책임).
 *
 * @param u - User
 * @param gap - 결석한 날짜 수 (today와 lastActiveDate 차이 - 1)
 * @returns consumed 실제 소비된 freeze 개수, preserved streak 보존 여부 (consumed === gap)
 *
 * Note (v3.21 T5): toast event dispatch는 caller(`recordDailyAnswer`)가 saveUser 성공
 *   후 처리한다 (Option B). 본 함수에서 직접 dispatch하지 않음 — false-fire 방지
 *   (saveUser throw 시 in-memory 변경만 되고 persist 실패 → toast 떴는데 데이터 없음 회피).
 *   사전 review P0-2 fix: sweep delta는 regen+1/consume−1 시 net=0 false-negative.
 */
export function consumeFreezeForGap(
  u: User,
  gap: number,
): { consumed: number; preserved: boolean } {
  if (!Number.isFinite(gap) || gap <= 0) return { consumed: 0, preserved: true };
  const consumed = Math.min(gap, u.streakFreeze.count);
  u.streakFreeze.count -= consumed;
  return { consumed, preserved: consumed === gap };
}
