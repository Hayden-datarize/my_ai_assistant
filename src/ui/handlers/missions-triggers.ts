// src/ui/handlers/missions-triggers.ts
import { getCachedUser, saveUser } from '../../state/user';
import { takeSnapshot, runSweep } from '../../state/achievements';
import { getActiveMissions, tickMissionProgress } from '../../state/missionEngine';
import type { MissionAction } from '../../state/missionTypes';

/**
 * 단일 진입점 — get/tick/save/sweep 패턴을 한 번에 실행.
 * recordDailyAnswer / mutateWithSweep와 같은 race-safe atomic single-write.
 *
 * @param now optional Date — caller가 두 trigger를 연속 호출할 때 동일 instance를 전달하면
 *   같은 KST window를 공유하여 자정 경계 race 차단 (v3.13.1 T14 / codex P1-1 / v3.14 T6 codex P1-7).
 */
function fireTrigger(action: MissionAction, now: Date = new Date()): void {
  const u = getCachedUser();
  if (!u) return;
  getActiveMissions(now, u);
  const prev = takeSnapshot();
  tickMissionProgress(u, action, now);
  saveUser(u);
  const curr = takeSnapshot();
  runSweep(prev, curr);
}

export function fireBriefingViewTrigger(now?: Date): void { fireTrigger('briefing-view', now); }
export function fireArchiveRevisitTrigger(now?: Date): void { fireTrigger('archive-revisit', now); }
export function fireCrossInterestTrigger(now?: Date): void { fireTrigger('cross-interest-view', now); }
