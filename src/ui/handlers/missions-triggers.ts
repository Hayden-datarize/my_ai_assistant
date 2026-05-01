// src/ui/handlers/missions-triggers.ts
import { getCachedUser, saveUser } from '../../state/user';
import { takeSnapshot, runSweep } from '../../state/achievements';
import { getActiveMissions, tickMissionProgress } from '../../state/missionEngine';
import type { MissionAction } from '../../state/missionTypes';

/**
 * 단일 진입점 — get/tick/save/sweep 패턴을 한 번에 실행.
 * recordDailyAnswer / mutateWithSweep와 같은 race-safe atomic single-write.
 */
function fireTrigger(action: MissionAction): void {
  const u = getCachedUser();
  if (!u) return;
  const now = new Date();                                                         // single now capture (v3.13.1 T14 / codex P1-1)
  getActiveMissions(now, u);
  const prev = takeSnapshot();
  tickMissionProgress(u, action, now);
  saveUser(u);
  const curr = takeSnapshot();
  runSweep(prev, curr);
}

export function fireBriefingViewTrigger(): void { fireTrigger('briefing-view'); }
export function fireArchiveRevisitTrigger(): void { fireTrigger('archive-revisit'); }
export function fireCrossInterestTrigger(): void { fireTrigger('cross-interest-view'); }
