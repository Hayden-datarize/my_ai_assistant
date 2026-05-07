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
