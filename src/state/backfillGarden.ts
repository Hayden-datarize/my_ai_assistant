import { loadBriefings } from './briefings';
import { interestKeywords, matchKeyword } from '../utils/interestKeywords';
import { thresholdLookup } from './plantCatalog';
import type { User } from './user';

/**
 * 첫 v3.15 진입 시 1회 — 기존 briefings 활동 이력을 식물 stage로 reflection.
 *
 * **Trigger 시점** (S3 spec self-review fix): loadUserData path에서 migrateUserToV4 직후 자동 호출.
 * **Sweep 우회** (S2 spec self-review fix): 본 함수 + 호출자 모두 takeSnapshot/runSweep 호출하지 않음 —
 * stage 1→4 jump 시 plant-stage-up 다발 emit 방지. 통지는 환영 모달 highlight로만 (T13).
 *
 * In-memory mutation. saveUser는 caller 책임.
 */
export function backfillGarden(user: User): void {
  if (user.gardenBackfilled) return;  // idempotent

  const briefings = loadBriefings();
  const today = new Date().toISOString();

  for (const interestId of user.interests) {
    const matched = briefings.filter(b => {
      if (!b.scrapped) return false;
      const hay = `${b.sourceTitle ?? ''} ${b.title} ${b.summary}`.toLowerCase();
      return interestKeywords(interestId).some(k => matchKeyword(hay, k));
    });
    // C4 (v3.16): memo가 undefined인 legacy/loose briefing 방어
    const memoCount = matched.filter(b => !!b.memo && b.memo.trim().length > 0).length;
    const cumulativeActivity = matched.length + memoCount;
    const stage = thresholdLookup(cumulativeActivity);

    user.plantStateByInterest[interestId] = {
      stage,
      cumulativeActivity,
      // C3 (Section 2 self-review fix): 진입 시점 (오늘) 으로 셋 — 첫 인상 wilting 회피
      lastEngagedAt: today,
      ...(stage === 5 ? { unlockedAt: today } : {}),
    };
  }

  user.gardenBackfilled = true;
}
