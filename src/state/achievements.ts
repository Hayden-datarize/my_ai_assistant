import { dispatch } from '../ui/events';
import { didLevelUp } from './leveling';
import type { Snapshot, GameEvent } from './gameTypes';
import { STREAK_MILESTONES } from './gameTypes';
import { loadUserData, saveUser, getSaveErrorMessage } from './user';
import { showToast } from '../utils/toast';
import { loadBriefings, type Briefing } from './briefings';
import { loadAnswers } from './persistence';
import { BADGE_CATALOG } from './badgeCatalog';
import { interestKeywords, matchKeyword } from '../utils/interestKeywords';
import { assertNever } from '../utils/assertNever';
import { getMissionDef } from './missionCatalog';

// 답변에 카테고리 매핑은 없음 — 스크랩 카테고리만 사용 (spec §7.1).
// briefing의 sourceTitle을 카테고리 proxy로 사용 (없으면 url hostname try/catch graceful)
function categorizeScrapsByInterest(briefings: Briefing[], interests: string[]): {
  engaged: Set<string>;
  uniqueCount: number;
} {
  const engaged = new Set<string>();
  const cats = new Set<string>();
  for (const b of briefings) {
    if (!b.scrapped) continue;
    // P1-2 fix: invalid url일 때 new URL throw → takeSnapshot 전체 실패 → sweep 차단 위험.
    // sourceTitle 우선, 없으면 hostname try/catch graceful (최종 fallback은 빈 문자열 → cats에 추가 안 함).
    let cat = (b.sourceTitle ?? '').trim();
    if (!cat) {
      try { cat = new URL(b.url).hostname; } catch { cat = ''; }
    }
    if (cat) cats.add(cat);

    // P2-B: haystack hoist — interests 길이만큼 반복 string concat 회피.
    const hay = `${b.sourceTitle ?? ''} ${b.title} ${b.summary}`.toLowerCase();
    // P1-A fix: interest ID는 snake_case라 RSS 텍스트와 직접 매칭 안 됨.
    // INTERESTS catalog의 한국어 label에서 keyword 추출해 매칭.
    for (const i of interests) {
      if (interestKeywords(i).some(k => matchKeyword(hay, k))) engaged.add(i);
    }
  }
  return { engaged, uniqueCount: cats.size };
}

/**
 * Read-only — 현재 user/answers/briefings 상태로부터 Snapshot 생성.
 * 본 sweep 전후로 두 번 찍어 detectEvents에 넘긴다.
 *
 * v3.12 T5: uniqueAnsweredTypes / engagedInterests / uniqueScrapCategories 모두 채움.
 */
export function takeSnapshot(): Snapshot {
  const u = loadUserData();
  const answers = loadAnswers();
  const briefings = loadBriefings();
  const scraps = briefings.filter(b => b.scrapped);
  const memos = briefings.filter(b => b.memo && b.memo.trim().length > 0);
  const interests = u?.interests ?? [];
  const { engaged, uniqueCount } = categorizeScrapsByInterest(briefings, interests);

  // P0 fix: 실제 코드는 한국어 라벨 5종 (home.ts:657-661 + schema.ts:17 주석).
  const KNOWN_TYPES = new Set(['분석', '전환', '실무', '성장', '트렌드']);
  const answeredTypes = new Set<string>();
  for (const a of answers) {
    if (a.type && KNOWN_TYPES.has(a.type)) answeredTypes.add(a.type);
  }

  return {
    xp: u?.xp ?? 0,
    streak: u?.streak ?? 0,
    answersCount: answers.length,
    scrapsCount: scraps.length,
    memosCount: memos.length,
    uniqueAnsweredTypes: answeredTypes,
    selectedInterests: new Set(interests),
    engagedInterests: engaged,
    uniqueScrapCategories: uniqueCount,
    earnedBadgeIds: new Set(Object.keys(u?.earnedBadges ?? {})),
    // v3.13.1 T4: progressDates deep clone (P2-4 defense-in-depth)
    missionsActive: (u?.missions?.active ?? []).map(m => ({
      ...m,
      progressDates: m.progressDates ? [...m.progressDates] : undefined,
    })),
    missionsCumulative: {
      daily: u?.missions?.cumulative?.dailyCount ?? 0,
      weekly: u?.missions?.cumulative?.weeklyCount ?? 0,
      monthly: u?.missions?.cumulative?.monthlyCount ?? 0,
    },
    // v3.15 T5: plantStateByInterest → stage만 추출 (pre-migration user에서 undefined → 빈 객체)
    plantStages: Object.fromEntries(
      Object.entries(u?.plantStateByInterest ?? {}).map(([id, p]) => [id, p.stage])
    ),
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

  // ✅ T5 badge arm — !prev.earned && !curr.earned && predicate(curr)
  for (const b of BADGE_CATALOG) {
    if (prev.earnedBadgeIds.has(b.id)) continue;       // 이미 영구 unlock
    if (curr.earnedBadgeIds.has(b.id)) continue;       // 이중 안전망
    if (b.predicate(curr)) {
      out.push({ kind: 'badge', badgeId: b.id, at });
    }
  }

  // v3.13 T5/T9: mission-complete — false→true 전환 + 새 instance 즉시 완수 모두 emit.
  // pm 없음(새 instance, T9 same-action regen+tick): cm.completed=true 시만 emit.
  // pm 있음: 기존 instance가 false→true 전환 시 emit.
  for (const cm of curr.missionsActive) {
    if (!cm.completed) continue;                        // 완수 아님 → 항상 skip
    const pm = prev.missionsActive.find(p => p.defId === cm.defId);
    if (pm?.completed) continue;                        // 이미 완수 → 이중 emit 방지
    const def = getMissionDef(cm.defId);
    if (!def) continue;
    out.push({ kind: 'mission-complete', defId: cm.defId, period: cm.period, rewardXp: def.rewardXp, at });
  }

  // v3.15 T5: plant-stage-up — stage 증가 시 emit.
  // S1 fix: prev에 entry 없음(분야 추가 직후 / backfill 직후) → ??(currStage)로 0-diff 처리 → false emit 방지.
  for (const [id, currStage] of Object.entries(curr.plantStages)) {
    const prevStage = prev.plantStages[id] ?? currStage;
    if (prevStage < currStage) {
      out.push({
        kind: 'plant-stage-up',
        interestId: id,
        newStage: currStage as 1 | 2 | 3 | 4 | 5,
        at,
      });
    }
  }

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
    } catch (err) {
      // Quota 등 — 영구 저장 실패. 다음 진입 시 detectEvents가 prev=earnedBadges에 빠진 채 재실행 → 재시도됨.
      // v3.13.1 T14 (codex P1-2): silent ignore → toast로 노출 (v3.7 silent-fail 정책 준수).
      showToast(getSaveErrorMessage(err));
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
      case 'mission-complete':
        dispatch('dg:reward:mission-complete', { defId: e.defId, period: e.period, rewardXp: e.rewardXp, at: e.at });
        break;
      case 'plant-stage-up':
        dispatch('dg:reward:plant-stage-up', { interestId: e.interestId, newStage: e.newStage, at: e.at });
        break;
      default:
        assertNever(e);
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
