import { dispatch } from '../ui/events';
import { didLevelUp } from './leveling';
import type { Snapshot, GameEvent } from './gameTypes';
import { STREAK_MILESTONES } from './gameTypes';
import { loadUserData, saveUser } from './user';
import { loadBriefings } from './briefings';
import { loadAnswers } from './persistence';

/**
 * Read-only — 현재 user/answers/briefings 상태로부터 Snapshot 생성.
 * 본 sweep 전후로 두 번 찍어 detectEvents에 넘긴다.
 *
 * T3에서는 xp/streak/counts만 채움. uniqueAnsweredTypes / engagedInterests /
 * uniqueScrapCategories는 T5에서 채움 (badge arm 활성화 시).
 */
export function takeSnapshot(): Snapshot {
  const u = loadUserData();
  const answers = loadAnswers();
  const briefings = loadBriefings();
  const scraps = briefings.filter(b => b.scrapped);
  const memos = briefings.filter(b => b.memo && b.memo.trim().length > 0);
  return {
    xp: u?.xp ?? 0,
    streak: u?.streak ?? 0,
    answersCount: answers.length,
    scrapsCount: scraps.length,
    memosCount: memos.length,
    uniqueAnsweredTypes: new Set(),
    selectedInterests: new Set(u?.interests ?? []),
    engagedInterests: new Set(),
    uniqueScrapCategories: 0,
    earnedBadgeIds: new Set(Object.keys(u?.earnedBadges ?? {})),
  };
}

export function detectEvents(prev: Snapshot, curr: Snapshot): GameEvent[] {
  const out: GameEvent[] = [];
  const at = Date.now();

  if (curr.xp > prev.xp) {
    out.push({ kind: 'xp-gained', amount: curr.xp - prev.xp, at });
  }

  const tier = didLevelUp(prev.xp, curr.xp);
  if (tier) out.push({ kind: 'level-up', tierId: tier.id, at });

  for (const m of STREAK_MILESTONES) {
    if (prev.streak < m && curr.streak >= m) {
      out.push({ kind: 'streak-milestone', days: m, at });
    }
  }

  // badge arm은 T5에서 활성화
  return out;
}

/**
 * badge unlock 이벤트를 user.earnedBadges에 영구 저장.
 * 다른 event 종류는 transient (저장 안 함).
 */
export function persistUnlocks(events: GameEvent[]): void {
  const u = loadUserData();
  if (!u) return;
  let dirty = false;
  for (const e of events) {
    if (e.kind === 'badge' && !u.earnedBadges[e.badgeId]) {
      u.earnedBadges[e.badgeId] = e.at;
      dirty = true;
    }
  }
  if (dirty) {
    try {
      saveUser(u);
    } catch {
      // Quota 등 — 영구 저장 실패. 토스트는 이미 dispatch됐을 수 있으나
      // 다음 진입 시 detectEvents가 prev=earnedBadges에 빠진 채 재실행 → 재시도됨.
      // 본 사이클 단순화: silent ignore (사용자 UX 영향 적음).
    }
  }
}

export function emitEvents(events: GameEvent[]): void {
  for (const e of events) {
    switch (e.kind) {
      case 'xp-gained':
        dispatch('dg:reward:xp-float', { amount: e.amount, at: e.at });
        break;
      case 'level-up':
        dispatch('dg:reward:level-up', { tierId: e.tierId, at: e.at });
        break;
      case 'streak-milestone':
        dispatch('dg:reward:streak-milestone', { days: e.days, at: e.at });
        break;
      case 'badge':
        dispatch('dg:reward:badge-unlock', { badgeId: e.badgeId, at: e.at });
        break;
    }
  }
}

/**
 * 단일 진입점. prev/curr Snapshot으로 events 도출 → 영구 저장 → emit.
 * 호출자(recordDailyAnswer / toggleScrap / saveMemo)는 saveUser 성공 후
 * curr=takeSnapshot()을 다시 찍어 본 함수에 넘겨야 함.
 */
export function runSweep(prev: Snapshot, curr: Snapshot): void {
  const events = detectEvents(prev, curr);
  if (events.length === 0) return;
  persistUnlocks(events);
  emitEvents(events);
}
